const cds = require('@sap/cds')
const { resolveN8nConfig } = require('./config')
const { createN8nError, isRetryableStatus } = require('./errors')
const { createStartResult, normalizeWebhookPath } = require('./result')

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

class N8nWorkflowService extends cds.Service {
  async init() {
    this.config = resolveN8nConfig({ ...(this.options || {}), kind: 'webhook' })
    this.baseUrl = this.config.baseUrl
    this.apiKey = this.config.apiKey
    this.timeoutMs = this.config.timeoutMs
    this.retries = this.config.retries
    this.retryDelayMs = this.config.retryDelayMs

    this.on('start', (req) => this.start(req.data.workflowId, req.data.inputs, req.data.options || req.data))

    await super.init()
  }

  async start(workflowId, inputs = {}, options = {}) {
    return this._triggerWebhook(workflowId, inputs, options)
  }

  async _triggerWebhook(workflowId, inputs = {}, options = {}) {
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

        return createStartResult({
          workflowId,
          executionId: result && typeof result === 'object' ? result.executionId : undefined,
          correlationId: options.correlationId,
          businessKey: options.businessKey,
          result
        })
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
      attempt,
      attempts: maxAttempts,
      reason: error.code,
      statusCode: error.statusCode,
      correlationId: options.correlationId
    })
  }
}

module.exports = N8nWorkflowService
