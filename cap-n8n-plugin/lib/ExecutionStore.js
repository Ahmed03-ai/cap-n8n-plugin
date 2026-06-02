const cds = require('@sap/cds')
const { randomUUID } = require('node:crypto')
const { sanitizeDetails } = require('./errors')
const { createExecutionResult } = require('./result')

const { INSERT, SELECT, UPDATE } = cds.ql
const EXECUTIONS = 'cap.n8n.WorkflowExecutions'
const DISPATCHES = 'cap.n8n.WorkflowDispatches'
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

function serializeEnvelope(value, sensitiveValues) {
  if (value === undefined || value === null) return undefined
  return JSON.stringify(sanitizeDetails(value, sensitiveValues))
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
    await this._updateDispatch(executionId, {
      status: 'dispatching',
      updatedAt: now(),
      lastAttemptAt: now()
    })

    return this.updateStatus(executionId, 'dispatching', updates)
  }

  async markRunning(executionId, updates = {}) {
    await this._updateDispatch(executionId, {
      status: 'running',
      updatedAt: now()
    })

    return this.updateStatus(executionId, 'running', updates)
  }

  async markSucceeded(executionId, updates = {}) {
    await this._updateDispatch(executionId, {
      status: 'succeeded',
      updatedAt: now(),
      finishedAt: now()
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
}

module.exports = {
  ExecutionStore,
  EXECUTION_STATUSES: [...EXECUTION_STATUSES]
}
