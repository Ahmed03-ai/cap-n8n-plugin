const { createN8nError, isRetryableStatus } = require('../errors')

const DEFAULT_TIMEOUT_MS = 10000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/g, '')
}

function resolveApiBaseUrl({ baseUrl, apiBaseUrl } = {}) {
  const explicitApiBaseUrl = trimTrailingSlash(apiBaseUrl)
  if (explicitApiBaseUrl) return explicitApiBaseUrl

  const resolvedBaseUrl = trimTrailingSlash(baseUrl)
  if (!resolvedBaseUrl) {
    throw createN8nError({
      message: 'Live n8n workflow import requires a configured n8n base URL.',
      retryable: false,
      code: 'ERR_N8N_WORKFLOW_API_BASE_URL'
    })
  }

  return resolvedBaseUrl.endsWith('/api/v1')
    ? resolvedBaseUrl
    : `${resolvedBaseUrl}/api/v1`
}

function workflowUrl(apiBaseUrl, workflowId) {
  return `${apiBaseUrl}/workflows/${encodeURIComponent(workflowId)}?excludePinnedData=true`
}

function workflowsUrl(apiBaseUrl) {
  return `${apiBaseUrl}/workflows?excludePinnedData=true`
}

function parseSafeErrorResponse(responseText) {
  if (!responseText) return undefined

  try {
    return JSON.parse(responseText)
  } catch (error) {
    return {
      message: 'n8n returned a non-JSON error response.',
      length: responseText.length
    }
  }
}

function parseResponseJson(responseText, sensitiveValues) {
  if (!responseText) return {}
  if (responseText.length > MAX_RESPONSE_BYTES) {
    throw createN8nError({
      message: 'n8n workflow API response exceeded the import size limit.',
      retryable: false,
      code: 'ERR_N8N_WORKFLOW_API_RESPONSE_TOO_LARGE',
      details: {
        maxResponseBytes: MAX_RESPONSE_BYTES,
        responseBytes: responseText.length,
        sensitiveValues
      }
    })
  }

  try {
    return JSON.parse(responseText)
  } catch (error) {
    throw createN8nError({
      message: 'n8n workflow API returned invalid JSON.',
      retryable: false,
      code: 'ERR_N8N_WORKFLOW_API_INVALID_JSON',
      details: {
        responseBytes: responseText.length,
        sensitiveValues
      },
      cause: error
    })
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timeoutMs = Number.isFinite(Number(options.timeoutMs))
    ? Math.max(0, Number(options.timeoutMs))
    : DEFAULT_TIMEOUT_MS
  const timeout = timeoutMs > 0
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined
  const sensitiveValues = [options.apiKey].filter(Boolean)
  const headers = {
    Accept: 'application/json'
  }

  if (options.apiKey) {
    headers['X-N8N-API-KEY'] = options.apiKey
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    })
    const responseText = await response.text()

    if (!response.ok) {
      throw createN8nError({
        message: `n8n workflow API request failed with status ${response.status}.`,
        statusCode: response.status,
        retryable: isRetryableStatus(response.status),
        code: isRetryableStatus(response.status)
          ? 'ERR_N8N_WORKFLOW_API_RETRYABLE_STATUS'
          : 'ERR_N8N_WORKFLOW_API_HTTP_STATUS',
        details: {
          statusCode: response.status,
          response: parseSafeErrorResponse(responseText),
          sensitiveValues
        }
      })
    }

    return parseResponseJson(responseText, sensitiveValues)
  } catch (error) {
    if (error && error.source === 'n8n') throw error

    const timedOut = error && error.name === 'AbortError'
    throw createN8nError({
      message: timedOut
        ? 'n8n workflow API request timed out.'
        : 'n8n workflow API request failed before a response was received.',
      retryable: true,
      code: timedOut ? 'ERR_N8N_WORKFLOW_API_TIMEOUT' : 'ERR_N8N_WORKFLOW_API_NETWORK',
      details: {
        timeoutMs,
        sensitiveValues
      },
      cause: error
    })
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function fetchWorkflow(workflowId, options = {}) {
  if (typeof workflowId !== 'string' || !workflowId.trim()) {
    throw createN8nError({
      message: 'Live n8n workflow import requires a workflow ID.',
      retryable: false,
      code: 'ERR_N8N_WORKFLOW_API_WORKFLOW_ID'
    })
  }

  const apiBaseUrl = resolveApiBaseUrl(options)
  return fetchJson(workflowUrl(apiBaseUrl, workflowId.trim()), options)
}

async function fetchWorkflows(options = {}) {
  const apiBaseUrl = resolveApiBaseUrl(options)
  return fetchJson(workflowsUrl(apiBaseUrl), options)
}

module.exports = {
  fetchWorkflow,
  fetchWorkflows
}
