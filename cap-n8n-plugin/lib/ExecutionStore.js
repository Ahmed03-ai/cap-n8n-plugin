const cds = require('@sap/cds')
const { randomUUID } = require('node:crypto')
const { sanitizeDetails } = require('./errors')
const { createExecutionResult } = require('./result')

const { INSERT, SELECT, UPDATE } = cds.ql
const EXECUTIONS = 'cap.n8n.WorkflowExecutions'
const DISPATCHES = 'cap.n8n.WorkflowDispatches'
const DEFAULT_PAGE_LIMIT = 50
const MAX_PAGE_LIMIT = 100
const MAX_DUPLICATE_MATCHES = 20
const QUERY_FILTERS = new Set([
  'executionId',
  'workflowId',
  'businessKey',
  'tag',
  'status'
])
const EXECUTION_STATUSES = new Set([
  'queued',
  'dispatching',
  'running',
  'succeeded',
  'failed',
  'cancel_requested',
  'cancelled',
  'unknown'
])
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled'])
const ACTIVE_STATUSES = new Set(['queued', 'dispatching', 'running', 'cancel_requested'])

function now() {
  return new Date().toISOString()
}

function addOptionalValue(target, key, value) {
  if (value !== undefined && value !== null) {
    target[key] = value
  }
}

function createStatusError(status) {
  const error = new Error(`Invalid n8n execution status "${status}"`)
  error.code = 'ERR_N8N_EXECUTION_STATUS'
  error.statusCode = 400
  error.source = 'n8n'
  error.allowed = [...EXECUTION_STATUSES]
  return error
}

function createFilterError(field) {
  const error = new Error(`Invalid n8n execution query filter "${field}"`)
  error.code = 'ERR_N8N_EXECUTION_FILTER'
  error.statusCode = 400
  error.source = 'n8n'
  error.allowed = [...QUERY_FILTERS]
  return error
}

function createPageError(field) {
  const error = new Error(`Invalid n8n execution page "${field}"`)
  error.code = 'ERR_N8N_EXECUTION_PAGE'
  error.statusCode = 400
  error.source = 'n8n'
  return error
}

function serializeEnvelope(value, sensitiveValues) {
  if (value === undefined || value === null) return undefined
  return JSON.stringify(sanitizeDetails(value, sensitiveValues))
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function normalizeQueryFilters(filters = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw createFilterError('filters')
  }

  const normalized = {}
  for (const [field, value] of Object.entries(filters)) {
    if (!QUERY_FILTERS.has(field)) throw createFilterError(field)
    if (!hasValue(value)) continue
    if (field === 'status' && !EXECUTION_STATUSES.has(value)) {
      throw createStatusError(value)
    }
    normalized[field] = value
  }

  return normalized
}

function normalizePage(page = {}) {
  if (!page || typeof page !== 'object' || Array.isArray(page)) {
    throw createPageError('page')
  }

  const limit = page.limit === undefined || page.limit === null || page.limit === ''
    ? DEFAULT_PAGE_LIMIT
    : Number(page.limit)
  const offset = page.offset === undefined || page.offset === null || page.offset === ''
    ? 0
    : Number(page.offset)

  if (!Number.isFinite(limit) || limit <= 0) throw createPageError('limit')
  if (!Number.isFinite(offset) || offset < 0) throw createPageError('offset')

  return {
    limit: Math.min(Math.trunc(limit), MAX_PAGE_LIMIT),
    offset: Math.trunc(offset)
  }
}

class ExecutionStore {
  constructor(options = {}) {
    this.db = options.db || options
    this.sensitiveValues = Array.isArray(options.sensitiveValues)
      ? options.sensitiveValues.filter((value) => typeof value === 'string' && value)
      : []

    if (!this.db || typeof this.db.run !== 'function') {
      throw new TypeError('ExecutionStore requires a CAP database service')
    }
  }

  withDb(db) {
    return new ExecutionStore({
      db,
      sensitiveValues: this.sensitiveValues
    })
  }

  forRequest(req) {
    if (!req || typeof this.db.tx !== 'function') return this
    return this.withDb(this.db.tx(req))
  }

  async transaction(fn) {
    if (typeof this.db.tx !== 'function') return fn(this)

    return this.db.tx(async (tx) => fn(this.withDb(tx)))
  }

  async createQueued({
    executionId = randomUUID(),
    workflowId,
    n8nExecutionId,
    correlationId,
    businessKey,
    tag,
    inputs,
    dispatch
  } = {}) {
    const timestamp = now()
    const record = {
      executionId,
      workflowId,
      status: 'queued',
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    addOptionalValue(record, 'n8nExecutionId', n8nExecutionId)
    addOptionalValue(record, 'correlationId', correlationId)
    addOptionalValue(record, 'businessKey', businessKey)
    addOptionalValue(record, 'tag', tag)

    await this.db.run(INSERT.into(EXECUTIONS).entries(record))

    if (dispatch || inputs !== undefined) {
      await this._createDispatch({
        executionId,
        workflowId,
        correlationId,
        businessKey,
        tag,
        inputs,
        dispatch,
        timestamp
      })
    }

    return createExecutionResult(record)
  }

  async getExecution(executionId) {
    const record = await this.db.run(SELECT.one.from(EXECUTIONS).where({ executionId }))
    return record ? createExecutionResult(record) : undefined
  }

  async queryExecutions(filters = {}, page = {}) {
    const normalizedFilters = normalizeQueryFilters(filters)
    const normalizedPage = normalizePage(page)
    let query = SELECT.from(EXECUTIONS)

    if (Object.keys(normalizedFilters).length > 0) {
      query = query.where(normalizedFilters)
    }

    const records = await this.db.run(
      query
        .orderBy('updatedAt desc', 'createdAt desc')
        .limit(normalizedPage.limit + 1, normalizedPage.offset)
    )
    const hasMore = records.length > normalizedPage.limit

    return {
      items: records.slice(0, normalizedPage.limit).map((record) => createExecutionResult(record)),
      pageInfo: {
        limit: normalizedPage.limit,
        offset: normalizedPage.offset,
        nextOffset: hasMore ? normalizedPage.offset + normalizedPage.limit : undefined,
        hasMore
      }
    }
  }

  async findActiveDuplicates({ workflowId, correlationId, businessKey, tag } = {}) {
    if (!hasValue(workflowId)) return []

    const lookups = []
    if (hasValue(correlationId)) lookups.push({ workflowId, correlationId })
    if (hasValue(businessKey)) lookups.push({ workflowId, businessKey })
    if (hasValue(tag)) lookups.push({ workflowId, tag })
    if (lookups.length === 0) return []

    const duplicates = new Map()

    for (const lookup of lookups) {
      const records = await this._findActiveExecutions(lookup)
      for (const record of records) {
        duplicates.set(record.executionId, createExecutionResult(record))
        if (duplicates.size >= MAX_DUPLICATE_MATCHES) return [...duplicates.values()]
      }
    }

    return [...duplicates.values()]
  }

  async getDispatch(executionId) {
    return this.db.run(SELECT.one.from(DISPATCHES).where({ executionId }))
  }

  async findDispatches({ executionId, limit = 100 } = {}) {
    if (executionId) {
      const dispatch = await this.getDispatch(executionId)
      return dispatch ? [dispatch] : []
    }

    const safeLimit = Math.max(1, Math.trunc(Number(limit) || 100))
    const queued = await this.db.run(
      SELECT.from(DISPATCHES).where({ status: 'queued' }).limit(safeLimit)
    )

    if (queued.length >= safeLimit) return queued

    const failed = await this.db.run(
      SELECT.from(DISPATCHES).where({ status: 'failed' }).limit(safeLimit - queued.length)
    )

    return [...queued, ...failed]
  }

  async updateStatus(executionId, status, updates = {}) {
    this._assertValidStatus(status)

    const timestamp = now()
    const patch = {
      status,
      updatedAt: timestamp
    }

    if (status === 'running') patch.startedAt = updates.startedAt || timestamp
    if (TERMINAL_STATUSES.has(status)) patch.finishedAt = updates.finishedAt || timestamp
    if (updates.result !== undefined) patch.result = serializeEnvelope(updates.result, this.sensitiveValues)
    if (updates.error !== undefined) patch.error = serializeEnvelope(updates.error, this.sensitiveValues)
    addOptionalValue(patch, 'n8nExecutionId', updates.n8nExecutionId)
    addOptionalValue(patch, 'attempts', updates.attempts)

    await this.db.run(UPDATE(EXECUTIONS).set(patch).where({ executionId }))
    return this.getExecution(executionId)
  }

  async markDispatching(executionId, updates = {}) {
    const timestamp = now()
    const dispatchPatch = {
      status: 'dispatching',
      updatedAt: timestamp,
      lastAttemptAt: timestamp
    }

    addOptionalValue(dispatchPatch, 'attempts', updates.attempts)

    await this._updateDispatch(executionId, {
      ...dispatchPatch
    })

    return this.updateStatus(executionId, 'dispatching', updates)
  }

  async markRunning(executionId, updates = {}) {
    const dispatchPatch = {
      status: 'running',
      updatedAt: now()
    }

    addOptionalValue(dispatchPatch, 'attempts', updates.attempts)

    await this._updateDispatch(executionId, dispatchPatch)

    return this.updateStatus(executionId, 'running', updates)
  }

  async markSucceeded(executionId, updates = {}) {
    const timestamp = now()
    const dispatchPatch = {
      status: 'succeeded',
      updatedAt: timestamp,
      finishedAt: timestamp
    }

    addOptionalValue(dispatchPatch, 'attempts', updates.attempts)

    await this._updateDispatch(executionId, {
      ...dispatchPatch
    })

    return this.updateStatus(executionId, 'succeeded', updates)
  }

  async markFailed(executionId, updates = {}) {
    const timestamp = now()
    const error = serializeEnvelope(updates.error, this.sensitiveValues)
    const dispatchPatch = {
      status: 'failed',
      updatedAt: timestamp,
      finishedAt: timestamp
    }

    if (error !== undefined) dispatchPatch.error = error
    addOptionalValue(dispatchPatch, 'attempts', updates.attempts)
    await this._updateDispatch(executionId, dispatchPatch)

    return this.updateStatus(executionId, 'failed', updates)
  }

  async saveResult(executionId, result) {
    await this.db.run(UPDATE(EXECUTIONS).set({
      result: serializeEnvelope(result, this.sensitiveValues),
      updatedAt: now()
    }).where({ executionId }))

    return this.getExecution(executionId)
  }

  async saveError(executionId, error) {
    await this.db.run(UPDATE(EXECUTIONS).set({
      error: serializeEnvelope(error, this.sensitiveValues),
      updatedAt: now()
    }).where({ executionId }))

    return this.getExecution(executionId)
  }

  _assertValidStatus(status) {
    if (!EXECUTION_STATUSES.has(status)) {
      throw createStatusError(status)
    }
  }

  async _createDispatch({ executionId, workflowId, correlationId, businessKey, tag, inputs, dispatch, timestamp }) {
    const payload = dispatch?.payload !== undefined ? dispatch.payload : inputs
    const record = {
      executionId,
      workflowId,
      status: dispatch?.status || 'queued',
      attempts: 0,
      payload: JSON.stringify(payload || {}),
      createdAt: timestamp,
      updatedAt: timestamp
    }

    addOptionalValue(record, 'workflowPath', dispatch?.workflowPath)
    addOptionalValue(record, 'correlationId', correlationId)
    addOptionalValue(record, 'businessKey', businessKey)
    addOptionalValue(record, 'tag', tag)
    addOptionalValue(record, 'error', serializeEnvelope(dispatch?.error, this.sensitiveValues))

    await this.db.run(INSERT.into(DISPATCHES).entries(record))
  }

  async _updateDispatch(executionId, patch) {
    await this.db.run(UPDATE(DISPATCHES).set(patch).where({ executionId }))
  }

  async _findActiveExecutions(filter) {
    const records = []

    for (const status of ACTIVE_STATUSES) {
      const rows = await this.db.run(
        SELECT.from(EXECUTIONS)
          .where({ ...filter, status })
          .orderBy('updatedAt desc', 'createdAt desc')
          .limit(MAX_DUPLICATE_MATCHES)
      )

      records.push(...rows)
      if (records.length >= MAX_DUPLICATE_MATCHES) return records.slice(0, MAX_DUPLICATE_MATCHES)
    }

    return records
  }
}

module.exports = {
  ExecutionStore,
  ACTIVE_STATUSES: [...ACTIVE_STATUSES],
  EXECUTION_STATUSES: [...EXECUTION_STATUSES]
}
