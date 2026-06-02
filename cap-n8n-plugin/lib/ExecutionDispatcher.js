const cds = require('@sap/cds')
const { sanitizeDetails } = require('./errors')

const SKIP_STATUSES = new Set(['cancel_requested', 'cancelled'])

function parsePayload(dispatch) {
  if (!dispatch || dispatch.payload === undefined || dispatch.payload === null || dispatch.payload === '') {
    return {}
  }

  if (typeof dispatch.payload !== 'string') return dispatch.payload

  return JSON.parse(dispatch.payload)
}

function addOptionalValue(target, key, value) {
  if (value !== undefined && value !== null) {
    target[key] = value
  }
}

class ExecutionDispatcher {
  constructor({ service, store, sensitiveValues = [] } = {}) {
    if (!service) throw new TypeError('ExecutionDispatcher requires an n8n service')
    if (!store) throw new TypeError('ExecutionDispatcher requires an ExecutionStore')

    this.service = service
    this.store = store
    this.sensitiveValues = Array.isArray(sensitiveValues) ? sensitiveValues : []
    this.log = cds.log('n8n')
  }

  async dispatchPending(filters = {}) {
    const dispatches = await this.store.findDispatches(filters)
    const results = []

    for (const dispatch of dispatches) {
      const result = await this.dispatch(dispatch)
      if (result) results.push(result)
    }

    return filters.executionId ? results[0] : results
  }

  async dispatch(dispatchOrExecutionId) {
    const dispatch = typeof dispatchOrExecutionId === 'string'
      ? await this.store.getDispatch(dispatchOrExecutionId)
      : dispatchOrExecutionId

    if (!dispatch) return undefined

    const execution = await this.store.getExecution(dispatch.executionId)
    if (!execution) return undefined
    if (SKIP_STATUSES.has(execution.status)) return execution

    let attempts = Number(dispatch.attempts || execution.attempts || 0)
    let payload

    try {
      payload = parsePayload(dispatch)
    } catch (err) {
      const error = this._createStoredError(err, dispatch, attempts, {
        code: 'ERR_N8N_DISPATCH_PAYLOAD',
        message: 'Stored n8n dispatch payload could not be parsed.'
      })
      return this.store.markFailed(dispatch.executionId, { attempts, error })
    }

    const options = {
      correlationId: dispatch.correlationId,
      businessKey: dispatch.businessKey,
      tag: dispatch.tag,
      executionId: dispatch.executionId,
      workflowPath: dispatch.workflowPath,
      onAttempt: async ({ attempt, maxAttempts }) => {
        attempts += 1
        await this.store.markDispatching(dispatch.executionId, { attempts })
        this.log.info('Dispatching queued n8n workflow', {
          workflowId: dispatch.workflowId,
          executionId: dispatch.executionId,
          attempt,
          attempts: maxAttempts,
          storedAttempts: attempts,
          correlationId: dispatch.correlationId
        })
      }
    }

    try {
      const webhook = await this.service._dispatchWebhook(
        dispatch.workflowPath || dispatch.workflowId,
        payload,
        options
      )

      await this.store.markRunning(dispatch.executionId, {
        attempts,
        n8nExecutionId: webhook.n8nExecutionId
      })

      const succeeded = await this.store.markSucceeded(dispatch.executionId, {
        attempts,
        n8nExecutionId: webhook.n8nExecutionId,
        result: webhook.result
      })

      this.log.info('Queued n8n workflow dispatch succeeded', {
        workflowId: dispatch.workflowId,
        executionId: dispatch.executionId,
        n8nExecutionId: webhook.n8nExecutionId,
        attempts,
        correlationId: dispatch.correlationId
      })

      return succeeded
    } catch (err) {
      const error = this._createStoredError(err, dispatch, attempts)
      const failed = await this.store.markFailed(dispatch.executionId, {
        attempts,
        error
      })

      this.log.error('Queued n8n workflow dispatch failed', {
        workflowId: dispatch.workflowId,
        executionId: dispatch.executionId,
        attempts,
        reason: error.code,
        statusCode: error.statusCode,
        correlationId: dispatch.correlationId
      })

      err.execution = failed
      throw err
    }
  }

  _createStoredError(err, dispatch, attempts, override = {}) {
    const error = {
      source: err.source || 'n8n',
      statusCode: err.statusCode,
      retryable: Boolean(err.retryable),
      code: override.code || err.code,
      message: override.message || err.message || 'n8n dispatch failed.',
      details: {
        ...(err.details || {}),
        workflowId: dispatch.workflowId,
        executionId: dispatch.executionId,
        correlationId: dispatch.correlationId,
        attempt: attempts
      }
    }

    addOptionalValue(error, 'statusCode', err.statusCode)
    return sanitizeDetails(error, this.sensitiveValues)
  }
}

module.exports = {
  ExecutionDispatcher
}
