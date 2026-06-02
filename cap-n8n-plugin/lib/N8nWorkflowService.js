const cds = require('@sap/cds')
const { normalizeDuplicatePolicy, resolveN8nConfig } = require('./config')
const { createN8nError, isRetryableStatus, sanitizeDetails } = require('./errors')
const { ExecutionDispatcher } = require('./ExecutionDispatcher')
const { ExecutionStore } = require('./ExecutionStore')
const {
  createCancelResult,
  createDuplicateResult,
  createExecutionNotFoundResult,
  createStartResult,
  normalizeWebhookPath
} = require('./result')

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled'])
const STOPPABLE_STATUSES = new Set(['dispatching', 'running'])

function delay(ms) {
  if (!ms) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseWebhookResponse(responseText) {
  if (!responseText) return { success: true }

  try {
    return JSON.parse(responseText)
  } catch (e) {
    return { success: true, message: responseText }
  }
}

function parseSafeErrorResponse(responseText) {
  if (!responseText) return undefined

  try {
    return JSON.parse(responseText)
  } catch (e) {
    return {
      message: 'n8n returned a non-JSON error response.',
      length: responseText.length
    }
  }
}

function publicStartOptions(data = {}) {
  const options = data.options ? { ...data.options } : { ...data }

  delete options.workflowId
  delete options.inputs

  return options
}

function publicOptions(options = {}) {
  const { _req, ...safeOptions } = options || {}
  return safeOptions
}

function publicQueryFilters(data = {}) {
  if (data.filters && typeof data.filters === 'object') return data.filters

  const { page, options, ...filters } = data
  return filters
}

function isPostCommitRequest(req) {
  return req && typeof req.on === 'function'
}

function publicCancelExecutionId(data) {
  if (data && typeof data === 'object') return data.executionId
  return data
}

class N8nWorkflowService extends cds.Service {
  async init() {
    this.config = resolveN8nConfig({ ...(this.options || {}), kind: 'webhook' })
    this.baseUrl = this.config.baseUrl
    this.apiKey = this.config.apiKey
    this.timeoutMs = this.config.timeoutMs
    this.retries = this.config.retries
    this.retryDelayMs = this.config.retryDelayMs
    this.cancelConfig = this.config.cancel || {}
    this.db = cds.db || await cds.connect.to('db')
    this.store = new ExecutionStore({
      db: this.db,
      sensitiveValues: [this.apiKey].filter(Boolean)
    })
    this.dispatcher = new ExecutionDispatcher({
      service: this,
      store: this.store,
      sensitiveValues: [this.apiKey].filter(Boolean)
    })

    this.on('start', (req) => this.start(req.data.workflowId, req.data.inputs, {
      ...publicStartOptions(req.data),
      _req: req
    }))
    this.on('dispatchExecution', (req) => this.dispatchPending({ executionId: req.data.executionId }))
    this.on('dispatchPending', (req) => this.dispatchPending(req.data || {}))
    this.on('getExecution', (req) => this.getExecution(req.data.executionId || req.data))
    this.on('queryExecutions', (req) => this.queryExecutions(
      publicQueryFilters(req.data || {}),
      req.data?.page || {}
    ))
    this.on('cancel', (req) => this.cancel(publicCancelExecutionId(req.data)))

    await super.init()
  }

  async start(workflowId, inputs = {}, options = {}) {
    const safeOptions = publicOptions(options)
    const req = options._req || cds.context
    const workflowPath = normalizeWebhookPath(workflowId)
    const requestStore = isPostCommitRequest(req) ? this.store.forRequest(req) : this.store
    const duplicate = await this._findDuplicateSignal({
      workflowId,
      options: safeOptions,
      store: requestStore
    })

    if (duplicate?.policy === 'reject') {
      throw this._createDuplicateError({
        workflowId,
        duplicate: duplicate.result
      })
    }

    if (duplicate?.policy === 'reuseActive') {
      return this._createStartResult(duplicate.executions[0], duplicate.result)
    }

    const queued = await this._createQueuedExecution({
      workflowId,
      workflowPath,
      inputs,
      options: safeOptions,
      req
    })
    const startResult = this._createStartResult(queued, duplicate?.result)
    const dispatch = async () => {
      try {
        const dispatched = await this.dispatchPending({ executionId: queued.executionId })
        if (dispatched) Object.assign(startResult, this._createStartResult(dispatched, duplicate?.result))
        return dispatched
      } catch (err) {
        if (!safeOptions.bestEffort) throw err

        if (err.execution) {
          Object.assign(startResult, this._createStartResult(err.execution, duplicate?.result))
          return err.execution
        }

        cds.log('n8n').error('Best-effort n8n workflow dispatch failed without persisted execution state', {
          workflowId,
          reason: err.message,
          code: err.code,
          statusCode: err.statusCode
        })
      }
    }

    if (isPostCommitRequest(req)) {
      req.on('succeeded', dispatch)
      return startResult
    }

    const dispatched = await dispatch()
    return this._createStartResult(dispatched || queued, duplicate?.result)
  }

  async dispatchPending(filters = {}) {
    return this.dispatcher.dispatchPending(filters)
  }

  async getExecution(executionId) {
    const execution = await this.store.getExecution(executionId)
    return execution || createExecutionNotFoundResult(executionId)
  }

  async queryExecutions(filters = {}, page = {}) {
    return this.store.queryExecutions(filters, page)
  }

  async cancel(executionId) {
    const execution = await this.store.getExecution(executionId)

    if (!execution) {
      return createCancelResult({
        executionId,
        notFound: true,
        noOp: true,
        reason: 'n8n execution not found.'
      })
    }

    if (execution.status === 'queued') {
      const result = createCancelResult({
        executionId: execution.executionId,
        status: 'cancelled',
        cancelled: true,
        reason: 'Queued n8n execution cancelled before dispatch.'
      })

      await this.store.markCancelled(execution.executionId, { result })
      return result
    }

    if (execution.status === 'cancel_requested') {
      const result = createCancelResult({
        executionId: execution.executionId,
        status: 'cancel_requested',
        noOp: true,
        unsupported: execution.result?.unsupported === true,
        reason: execution.result?.reason || 'Cancellation is already requested for this n8n execution.'
      })

      await this.store.saveResult(execution.executionId, result)
      return result
    }

    if (TERMINAL_STATUSES.has(execution.status)) {
      const result = createCancelResult({
        executionId: execution.executionId,
        status: execution.status,
        noOp: true,
        cancelled: execution.status === 'cancelled',
        reason: `n8n execution is already terminal with status "${execution.status}".`
      })

      await this.store.saveResult(execution.executionId, result)
      return result
    }

    if (STOPPABLE_STATUSES.has(execution.status)) {
      return this._cancelActiveExecution(execution)
    }

    const result = createCancelResult({
      executionId: execution.executionId,
      status: execution.status,
      noOp: true,
      unsupported: true,
      reason: `Cancellation is unsupported for n8n execution status "${execution.status}".`
    })

    await this.store.saveResult(execution.executionId, result)
    return result
  }

  async _createQueuedExecution({ workflowId, workflowPath, inputs, options, req }) {
    const entry = {
      workflowId,
      correlationId: options.correlationId,
      businessKey: options.businessKey,
      tag: options.tag,
      inputs,
      dispatch: {
        workflowPath,
        payload: inputs
      }
    }

    if (isPostCommitRequest(req)) {
      return this.store.forRequest(req).createQueued(entry)
    }

    return this.store.transaction((store) => store.createQueued(entry))
  }

  async _cancelActiveExecution(execution) {
    if (!this._supportsN8nStop(execution)) {
      const result = createCancelResult({
        executionId: execution.executionId,
        n8nExecutionId: execution.n8nExecutionId,
        status: 'cancel_requested',
        cancelled: false,
        noOp: true,
        unsupported: true,
        reason: this._unsupportedCancelReason(execution)
      })

      await this.store.requestCancel(execution.executionId, { result })
      return result
    }

    try {
      const stopResult = await this._stopN8nExecution(execution)
      const result = createCancelResult({
        executionId: execution.executionId,
        n8nExecutionId: execution.n8nExecutionId,
        status: 'cancelled',
        cancelled: true,
        reason: 'n8n execution stop confirmed.',
        stopResult
      })

      await this.store.markCancelled(execution.executionId, { result })
      return result
    } catch (err) {
      const error = this._createCancelErrorResult(err)
      const result = createCancelResult({
        executionId: execution.executionId,
        n8nExecutionId: execution.n8nExecutionId,
        status: 'cancel_requested',
        cancelled: false,
        noOp: true,
        reason: 'n8n stop request failed; cancellation remains requested locally.',
        error
      })

      await this.store.requestCancel(execution.executionId, { result, error })
      return result
    }
  }

  _supportsN8nStop(execution = {}) {
    return Boolean(
      execution.n8nExecutionId &&
      this.cancelConfig.supported &&
      this.cancelConfig.apiBaseUrl
    )
  }

  _unsupportedCancelReason(execution = {}) {
    if (!execution.n8nExecutionId) {
      return 'n8n webhook cancellation is unsupported because no n8nExecutionId is stored for this execution.'
    }

    return 'n8n webhook cancellation is unsupported because the n8n stop API is not enabled in configuration.'
  }

  async _stopN8nExecution(execution) {
    const safeBaseUrl = this.cancelConfig.apiBaseUrl.replace(/\/$/, '')
    const url = `${safeBaseUrl}/api/v1/executions/${encodeURIComponent(execution.n8nExecutionId)}/stop`
    const headers = {
      'Content-Type': 'application/json'
    }

    if (this.apiKey) {
      headers['X-N8N-API-KEY'] = this.apiKey
    }

    const response = await this._fetchN8nStop(url, headers)
    const responseText = await response.text()

    if (!response.ok) {
      throw createN8nError({
        message: `n8n execution stop request failed with status ${response.status}.`,
        statusCode: response.status,
        retryable: isRetryableStatus(response.status),
        code: 'ERR_N8N_CANCEL_HTTP_STATUS',
        details: {
          executionId: execution.executionId,
          n8nExecutionId: execution.n8nExecutionId,
          statusCode: response.status,
          response: parseSafeErrorResponse(responseText),
          sensitiveValues: [this.apiKey].filter(Boolean)
        }
      })
    }

    return sanitizeDetails(parseWebhookResponse(responseText), [this.apiKey].filter(Boolean))
  }

  async _fetchN8nStop(url, headers) {
    const controller = new AbortController()
    const timeout = this.timeoutMs > 0
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : undefined

    try {
      return await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal
      })
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  _createCancelErrorResult(err) {
    const error = err && err.source === 'n8n'
      ? err
      : createN8nError({
          message: err?.name === 'AbortError'
            ? 'n8n execution stop request timed out.'
            : 'n8n execution stop request failed before a response was received.',
          retryable: true,
          code: err?.name === 'AbortError' ? 'ERR_N8N_CANCEL_TIMEOUT' : 'ERR_N8N_CANCEL_NETWORK',
          details: {
            sensitiveValues: [this.apiKey].filter(Boolean)
          },
          cause: err
        })

    return sanitizeDetails({
      source: error.source || 'n8n',
      statusCode: error.statusCode,
      retryable: Boolean(error.retryable),
      code: error.code,
      message: error.message,
      details: error.details
    }, [this.apiKey].filter(Boolean))
  }

  _createStartResult(execution = {}, duplicate) {
    return createStartResult({
      workflowId: execution.workflowId,
      executionId: execution.executionId,
      n8nExecutionId: execution.n8nExecutionId,
      correlationId: execution.correlationId,
      businessKey: execution.businessKey,
      tag: execution.tag,
      status: execution.status,
      attempts: execution.attempts,
      result: execution.result,
      error: execution.error,
      duplicate
    })
  }

  async _findDuplicateSignal({ workflowId, options = {}, store = this.store } = {}) {
    const policy = normalizeDuplicatePolicy(
      options.duplicatePolicy ?? options.duplicates?.policy,
      this.config.duplicatePolicy,
      400
    )
    const executions = await store.findActiveDuplicates({
      workflowId,
      correlationId: options.correlationId,
      businessKey: options.businessKey,
      tag: options.tag
    })

    if (executions.length === 0) return undefined

    return {
      policy,
      executions,
      result: createDuplicateResult({
        policy,
        duplicates: executions
      })
    }
  }

  _createDuplicateError({ workflowId, duplicate }) {
    return createN8nError({
      message: 'Active n8n execution already exists for this workflow metadata.',
      statusCode: 409,
      retryable: false,
      code: 'ERR_N8N_DUPLICATE_EXECUTION',
      details: {
        workflowId,
        duplicate
      }
    })
  }

  async _triggerWebhook(workflowId, inputs = {}, options = {}) {
    const webhook = await this._dispatchWebhook(workflowId, inputs, options)

    return createStartResult({
      workflowId,
      executionId: webhook.n8nExecutionId,
      correlationId: options.correlationId,
      businessKey: options.businessKey,
      tag: options.tag,
      result: webhook.result
    })
  }

  async _dispatchWebhook(workflowId, inputs = {}, options = {}) {
    const safeBaseUrl = this.baseUrl.replace(/\/$/, '')
    const safePath = normalizeWebhookPath(workflowId)
    const url = `${safeBaseUrl}/${safePath}`
    const headers = {
      'Content-Type': 'application/json'
    }

    if (this.apiKey) {
      headers['X-N8N-API-KEY'] = this.apiKey
    }

    const maxAttempts = Math.max(1, this.retries || 1)
    let lastError

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        if (typeof options.onAttempt === 'function') {
          await options.onAttempt({
            attempt,
            maxAttempts,
            workflowId,
            correlationId: options.correlationId
          })
        }

        cds.log('n8n').info(`Triggering n8n workflow at ${url}`)
        const response = await this._fetchWebhook(url, headers, inputs)
        const responseText = await response.text()

        if (!response.ok) {
          throw this._createHttpError({
            response,
            responseText,
            workflowId,
            options,
            attempt,
            maxAttempts
          })
        }

        const result = parseWebhookResponse(responseText)

        return {
          workflowId,
          n8nExecutionId: result && typeof result === 'object' ? result.executionId : undefined,
          result
        }
      } catch (err) {
        lastError = this._normalizeTransportError(err, {
          workflowId,
          options,
          attempt,
          maxAttempts
        })

        if (!lastError.retryable || attempt >= maxAttempts) {
          cds.log('n8n').error(`Failed to trigger n8n workflow: ${lastError.message}`)
          throw lastError
        }

        this._logRetry({
          workflowId,
          options,
          attempt,
          maxAttempts,
          error: lastError
        })

        await delay(this._retryDelay(attempt))
      }
    }

    throw lastError
  }

  async _fetchWebhook(url, headers, inputs) {
    const controller = new AbortController()
    const timeout = this.timeoutMs > 0
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : undefined

    try {
      return await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(inputs || {}),
        signal: controller.signal
      })
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  _createHttpError({ response, responseText, workflowId, options, attempt, maxAttempts }) {
    const statusCode = response.status
    const retryable = isRetryableStatus(statusCode)

    return createN8nError({
      message: `n8n webhook request failed with status ${statusCode}.`,
      statusCode,
      retryable,
      code: retryable ? 'ERR_N8N_RETRYABLE_STATUS' : 'ERR_N8N_HTTP_STATUS',
      details: {
        workflowId,
        executionId: options.executionId,
        statusCode,
        attempt,
        attempts: maxAttempts,
        correlationId: options.correlationId,
        response: parseSafeErrorResponse(responseText),
        sensitiveValues: [this.apiKey].filter(Boolean)
      }
    })
  }

  _normalizeTransportError(err, { workflowId, options, attempt, maxAttempts }) {
    if (err && err.source === 'n8n') return err

    const timedOut = err && err.name === 'AbortError'
    return createN8nError({
      message: timedOut
        ? 'n8n webhook request timed out.'
        : 'n8n webhook request failed before a response was received.',
      retryable: true,
      code: timedOut ? 'ERR_N8N_TIMEOUT' : 'ERR_N8N_NETWORK',
      details: {
        workflowId,
        executionId: options.executionId,
        attempt,
        attempts: maxAttempts,
        timeoutMs: this.timeoutMs,
        correlationId: options.correlationId,
        sensitiveValues: [this.apiKey].filter(Boolean)
      },
      cause: err
    })
  }

  _retryDelay(attempt) {
    const maxDelayMs = this.config.retry?.maxDelayMs ?? this.retryDelayMs
    return Math.min(this.retryDelayMs * (2 ** (attempt - 1)), maxDelayMs)
  }

  _logRetry({ workflowId, options, attempt, maxAttempts, error }) {
    cds.log('n8n').warn('Retrying n8n workflow start after transient failure', {
      workflowId,
      executionId: options.executionId,
      attempt,
      attempts: maxAttempts,
      reason: error.code,
      statusCode: error.statusCode,
      correlationId: options.correlationId
    })
  }
}

module.exports = N8nWorkflowService
