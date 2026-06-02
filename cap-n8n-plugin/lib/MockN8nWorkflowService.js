const cds = require('@sap/cds')
const { sanitizeDetails } = require('./errors')
const {
  createCancelResult,
  createExecutionNotFoundResult,
  createExecutionResult,
  createStartResult
} = require('./result')
const { resolveN8nConfig } = require('./config')
const { EXECUTION_STATUSES } = require('./ExecutionStore')

const QUERY_FILTERS = new Set([
  'executionId',
  'workflowId',
  'businessKey',
  'tag',
  'status'
])
const VALID_STATUSES = new Set(EXECUTION_STATUSES)
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled'])
const ACTIVE_STATUSES = new Set(['queued', 'dispatching', 'running'])
const DEFAULT_PAGE_LIMIT = 50
const MAX_PAGE_LIMIT = 100

function now() {
  return new Date().toISOString()
}

function createMockFailure(workflowId) {
  const error = new Error(`Configured mock n8n workflow failed for workflowId "${workflowId}"`)
  error.code = 'ERR_N8N_MOCK_FAILURE'
  error.source = 'n8n'
  error.statusCode = 500
  error.retryable = false
  error.mock = true
  return error
}

function configuredFailures(...configs) {
  const workflows = []

  for (const config of configs) {
    const failWorkflows = config?.mock?.failWorkflows ?? config?.failWorkflows
    if (Array.isArray(failWorkflows)) workflows.push(...failWorkflows)
    else if (failWorkflows instanceof Set) workflows.push(...failWorkflows)
    else if (typeof failWorkflows === 'string' && failWorkflows.trim()) workflows.push(failWorkflows.trim())
  }

  return workflows
}

function configuredValue(name, configs, fallback) {
  for (const config of configs) {
    const value = config?.mock?.[name] ?? config?.[name]
    if (value !== undefined && value !== null && value !== '') return value
  }

  return fallback
}

function configuredBoolean(name, configs, fallback = false) {
  const value = configuredValue(name, configs, fallback)
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'off'].includes(normalized)) return false
  }

  return Boolean(value)
}

function configuredInteger(name, configs, fallback = 0) {
  const value = Number(configuredValue(name, configs, fallback))
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.trunc(value))
}

function addOptionalValue(target, key, value) {
  if (value !== undefined && value !== null) {
    target[key] = value
  }
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function createFilterError(field) {
  const error = new Error(`Invalid n8n execution query filter "${field}"`)
  error.code = 'ERR_N8N_EXECUTION_FILTER'
  error.statusCode = 400
  error.source = 'n8n'
  error.allowed = [...QUERY_FILTERS]
  return error
}

function createStatusError(status) {
  const error = new Error(`Invalid n8n execution status "${status}"`)
  error.code = 'ERR_N8N_EXECUTION_STATUS'
  error.statusCode = 400
  error.source = 'n8n'
  error.allowed = [...VALID_STATUSES]
  return error
}

function createPageError(field) {
  const error = new Error(`Invalid n8n execution page "${field}"`)
  error.code = 'ERR_N8N_EXECUTION_PAGE'
  error.statusCode = 400
  error.source = 'n8n'
  return error
}

function normalizeQueryFilters(filters = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw createFilterError('filters')
  }

  const normalized = {}
  for (const [field, value] of Object.entries(filters)) {
    if (!QUERY_FILTERS.has(field)) throw createFilterError(field)
    if (!hasValue(value)) continue
    if (field === 'status' && !VALID_STATUSES.has(value)) {
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

function publicQueryFilters(data = {}) {
  if (data.filters && typeof data.filters === 'object') return data.filters

  const { page, options, ...filters } = data
  return filters
}

function publicCancelExecutionId(data) {
  if (data && typeof data === 'object') return data.executionId
  return data
}

function errorToEnvelope(error) {
  return sanitizeDetails({
    source: error.source || 'n8n',
    statusCode: error.statusCode,
    retryable: Boolean(error.retryable),
    code: error.code,
    message: error.message,
    details: error.details,
    mock: error.mock === true
  })
}

class MockN8nWorkflowService extends cds.Service {
  async init() {
    this.config = resolveN8nConfig({ ...(this.options || {}), kind: 'mock' })
    this.executions = []
    this._nextExecution = 1
    this._timers = new Set()

    this.on('start', (req) => this.start(req.data.workflowId, req.data.inputs, req.data.options || req.data))
    this.on('getExecution', (req) => this.getExecution(req.data.executionId || req.data))
    this.on('queryExecutions', (req) => this.queryExecutions(
      publicQueryFilters(req.data || {}),
      req.data?.page || {}
    ))
    this.on('cancel', (req) => this.cancel(publicCancelExecutionId(req.data)))

    await super.init()
  }

  async start(workflowId, inputs = {}, options = {}) {
    const failures = configuredFailures(this.config, this.options, options)
    const timestamp = now()
    const record = {
      executionId: `mock-exec-${this._nextExecution++}`,
      workflowId,
      inputs: inputs || {},
      status: 'running',
      attempts: 0,
      createdAt: timestamp,
      startedAt: timestamp,
      updatedAt: timestamp
    }

    addOptionalValue(record, 'correlationId', options.correlationId)
    addOptionalValue(record, 'businessKey', options.businessKey)
    addOptionalValue(record, 'tag', options.tag)
    this.executions.push(record)

    if (failures.includes(workflowId)) {
      const failure = createMockFailure(workflowId)
      this._markFailed(record, failure)
      throw failure
    }

    const configs = [options, this.options, this.config]
    const holdRunning = configuredBoolean('holdRunning', configs, false)
    const completionDelayMs = configuredInteger('completionDelayMs', configs, 0)

    if (completionDelayMs > 0) {
      const timer = setTimeout(() => {
        this._timers.delete(timer)
        if (record.status === 'running') {
          this._markSucceeded(record, {
            mock: true,
            workflowId,
            executionId: record.executionId
          })
        }
      }, completionDelayMs)
      this._timers.add(timer)
    }

    if (!holdRunning && completionDelayMs === 0) {
      this._markSucceeded(record, {
        mock: true,
        workflowId,
        executionId: record.executionId
      })
    }

    return this._createStartResult(record)
  }

  async getExecution(executionId) {
    const record = this._findExecution(executionId)
    return record ? this._publicExecution(record) : createExecutionNotFoundResult(executionId)
  }

  async queryExecutions(filters = {}, page = {}) {
    const normalizedFilters = normalizeQueryFilters(filters)
    const normalizedPage = normalizePage(page)
    const filtered = this.executions
      .filter((record) => this._matchesFilters(record, normalizedFilters))
      .sort((left, right) => this._compareExecutions(left, right))
    const items = filtered.slice(normalizedPage.offset, normalizedPage.offset + normalizedPage.limit)
    const hasMore = filtered.length > normalizedPage.offset + normalizedPage.limit

    return {
      items: items.map((record) => this._publicExecution(record)),
      pageInfo: {
        limit: normalizedPage.limit,
        offset: normalizedPage.offset,
        nextOffset: hasMore ? normalizedPage.offset + normalizedPage.limit : undefined,
        hasMore
      }
    }
  }

  async cancel(executionId) {
    const record = this._findExecution(executionId)

    if (!record) {
      return createCancelResult({
        executionId,
        notFound: true,
        noOp: true,
        reason: 'n8n execution not found.'
      })
    }

    if (record.status === 'cancel_requested') {
      const result = createCancelResult({
        executionId: record.executionId,
        status: 'cancel_requested',
        noOp: true,
        reason: 'Cancellation is already requested for this mock n8n execution.'
      })
      record.result = result
      record.updatedAt = now()
      return result
    }

    if (TERMINAL_STATUSES.has(record.status)) {
      const result = createCancelResult({
        executionId: record.executionId,
        status: record.status,
        noOp: true,
        cancelled: record.status === 'cancelled',
        reason: `Mock n8n execution is already terminal with status "${record.status}".`
      })
      record.result = result
      record.updatedAt = now()
      return result
    }

    if (ACTIVE_STATUSES.has(record.status)) {
      const result = createCancelResult({
        executionId: record.executionId,
        status: 'cancelled',
        cancelled: true,
        reason: 'Mock n8n execution cancelled locally.'
      })
      this._markCancelled(record, result)
      return result
    }

    const result = createCancelResult({
      executionId: record.executionId,
      status: record.status,
      noOp: true,
      unsupported: true,
      reason: `Cancellation is unsupported for mock n8n execution status "${record.status}".`
    })
    record.result = result
    record.updatedAt = now()
    return result
  }

  async completeMockExecution(executionId, result = {}) {
    const record = this._findExecution(executionId)
    if (!record) return createExecutionNotFoundResult(executionId)
    if (TERMINAL_STATUSES.has(record.status)) return this._publicExecution(record)

    this._markSucceeded(record, result)
    return this._publicExecution(record)
  }

  async failMockExecution(executionId, error = {}) {
    const record = this._findExecution(executionId)
    if (!record) return createExecutionNotFoundResult(executionId)
    if (TERMINAL_STATUSES.has(record.status)) return this._publicExecution(record)

    this._markFailed(record, error)
    return this._publicExecution(record)
  }

  _createStartResult(record) {
    const execution = this._publicExecution(record)

    return createStartResult({
      workflowId: execution.workflowId,
      executionId: execution.executionId,
      correlationId: execution.correlationId,
      businessKey: execution.businessKey,
      tag: execution.tag,
      status: execution.status,
      attempts: execution.attempts,
      result: execution.result,
      error: execution.error,
      mock: true
    })
  }

  _publicExecution(record) {
    return createExecutionResult(record)
  }

  _findExecution(executionId) {
    return this.executions.find((execution) => execution.executionId === executionId)
  }

  _matchesFilters(record, filters) {
    for (const [field, value] of Object.entries(filters)) {
      if (record[field] !== value) return false
    }

    return true
  }

  _compareExecutions(left, right) {
    const leftUpdated = Date.parse(left.updatedAt || left.createdAt || 0)
    const rightUpdated = Date.parse(right.updatedAt || right.createdAt || 0)
    if (leftUpdated !== rightUpdated) return rightUpdated - leftUpdated

    const leftCreated = Date.parse(left.createdAt || 0)
    const rightCreated = Date.parse(right.createdAt || 0)
    return rightCreated - leftCreated
  }

  _markSucceeded(record, result = {}) {
    const timestamp = now()
    record.status = 'succeeded'
    record.result = sanitizeDetails(result)
    record.finishedAt = timestamp
    record.updatedAt = timestamp
    return record
  }

  _markFailed(record, error = {}) {
    const timestamp = now()
    record.status = 'failed'
    record.error = errorToEnvelope(error)
    record.finishedAt = timestamp
    record.updatedAt = timestamp
    return record
  }

  _markCancelled(record, result = {}) {
    const timestamp = now()
    record.status = 'cancelled'
    record.result = sanitizeDetails(result)
    record.finishedAt = timestamp
    record.updatedAt = timestamp
    return record
  }
}

module.exports = MockN8nWorkflowService
