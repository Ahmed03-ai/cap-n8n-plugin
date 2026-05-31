const RETRYABLE_STATUS_CODES = new Set([502, 503, 504])
const SENSITIVE_KEYS = new Set([
  'apikey',
  'api_key',
  'authorization',
  'x-n8n-api-key',
  'headers',
  'stack',
  'input',
  'inputs',
  'payload',
  'request',
  'requestbody'
])
const MAX_DETAIL_DEPTH = 4
const MAX_STRING_LENGTH = 500

function isRetryableStatus(statusCode) {
  return RETRYABLE_STATUS_CODES.has(Number(statusCode))
}

function normalizeKey(key) {
  return String(key).replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function collectSensitiveValues(details) {
  const values = []

  function visit(value, key, depth) {
    if (depth > MAX_DETAIL_DEPTH || value === undefined || value === null) return

    const normalizedKey = key ? normalizeKey(key) : ''
    if (normalizedKey && SENSITIVE_KEYS.has(normalizedKey)) {
      if (typeof value === 'string' && value) values.push(value)
      return
    }

    if (Array.isArray(value)) {
      for (const item of value) visit(item, undefined, depth + 1)
      return
    }

    if (typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) {
        visit(childValue, childKey, depth + 1)
      }
    }
  }

  visit(details, undefined, 0)

  if (Array.isArray(details?.sensitiveValues)) {
    for (const value of details.sensitiveValues) {
      if (typeof value === 'string' && value) values.push(value)
    }
  }

  return values
}

function sanitizeString(value, sensitiveValues) {
  let sanitized = value

  for (const sensitiveValue of sensitiveValues) {
    sanitized = sanitized.split(sensitiveValue).join('[redacted]')
  }

  if (sanitized.length > MAX_STRING_LENGTH) {
    return `${sanitized.slice(0, MAX_STRING_LENGTH)}...`
  }

  return sanitized
}

function sanitizeValue(value, sensitiveValues, depth = 0) {
  if (depth > MAX_DETAIL_DEPTH) return '[omitted]'
  if (value === undefined || value === null) return value
  if (typeof value === 'string') return sanitizeString(value, sensitiveValues)
  if (typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, sensitiveValues, depth + 1))
  }

  const sanitized = {}
  for (const [key, childValue] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key)
    if (normalizedKey === 'sensitivevalues' || SENSITIVE_KEYS.has(normalizedKey)) continue

    const safeChild = sanitizeValue(childValue, sensitiveValues, depth + 1)
    if (safeChild !== undefined) sanitized[key] = safeChild
  }

  return sanitized
}

function sanitizeDetails(details = {}) {
  if (!details || typeof details !== 'object') return {}
  return sanitizeValue(details, collectSensitiveValues(details))
}

function createN8nError({ message, statusCode, retryable = false, code, details, cause } = {}) {
  const error = cause
    ? new Error(message || 'n8n request failed.', { cause })
    : new Error(message || 'n8n request failed.')

  error.source = 'n8n'
  error.statusCode = statusCode
  error.retryable = Boolean(retryable)
  error.code = code
  error.details = sanitizeDetails(details)

  return error
}

module.exports = {
  createN8nError,
  isRetryableStatus
}
