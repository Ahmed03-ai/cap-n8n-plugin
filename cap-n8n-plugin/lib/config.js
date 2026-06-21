const VALID_KINDS = new Set(['mock', 'webhook'])
const VALID_DUPLICATE_POLICIES = new Set(['warn', 'reject', 'reuseActive'])
const DEFAULT_DUPLICATE_POLICY = 'warn'
const DEFAULT_TIMEOUT_MS = 10000
const DEFAULT_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 250

function firstConfiguredValue(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (value !== undefined && value !== null && typeof value !== 'string') return value
  }
}

function resolveEnvPlaceholders(value, env = process.env) {
  if (typeof value === 'string') {
    const match = value.match(/^\{env\.([A-Za-z_][A-Za-z0-9_]*)\}$/)
    if (match) return env[match[1]]
    return value
  }

  if (Array.isArray(value)) return value.map((entry) => resolveEnvPlaceholders(entry, env))
  if (!value || typeof value !== 'object') return value

  const resolved = {}
  for (const [key, child] of Object.entries(value)) {
    const resolvedChild = resolveEnvPlaceholders(child, env)
    if (resolvedChild !== undefined) resolved[key] = resolvedChild
  }
  return resolved
}

function createConfigError(message, details = {}) {
  const error = new Error(message)
  error.code = 'ERR_N8N_CONFIG'
  error.source = 'n8n'
  error.statusCode = 500
  error.retryable = false
  error.details = details
  return error
}

function createDuplicatePolicyError(policy, statusCode = 500) {
  const error = createConfigError('Invalid n8n duplicate policy. Expected duplicatePolicy to be warn, reject, or reuseActive.', {
    field: 'duplicatePolicy',
    policy,
    allowed: [...VALID_DUPLICATE_POLICIES]
  })
  error.statusCode = statusCode
  return error
}

function normalizeNonNegativeInteger(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0, Math.trunc(number))
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'off'].includes(normalized)) return false
  }

  return Boolean(value)
}

function normalizeKind(kind) {
  if (kind === undefined || kind === null || kind === '') return undefined

  const normalizedKind = String(kind).trim().toLowerCase()
  if (!VALID_KINDS.has(normalizedKind)) {
    throw createConfigError('Invalid n8n runtime kind. Expected kind to be mock or webhook.', {
      field: 'kind',
      allowed: ['mock', 'webhook']
    })
  }

  return normalizedKind
}

function normalizeDuplicatePolicy(policy, fallback = DEFAULT_DUPLICATE_POLICY, statusCode = 500) {
  const value = firstConfiguredValue(policy, fallback, DEFAULT_DUPLICATE_POLICY)
  const normalizedPolicy = String(value).trim()
  const canonicalPolicy = normalizedPolicy === 'reuseactive' ? 'reuseActive' : normalizedPolicy

  if (!VALID_DUPLICATE_POLICIES.has(canonicalPolicy)) {
    throw createDuplicatePolicyError(policy, statusCode)
  }

  return canonicalPolicy
}

function profileNames(env = {}) {
  const rawProfiles = firstConfiguredValue(env.CDS_ENV, env.NODE_ENV)
  if (!rawProfiles) return []

  return String(rawProfiles)
    .split(',')
    .map((profile) => profile.trim().toLowerCase())
    .filter(Boolean)
}

function isDevelopmentEnv(env = {}) {
  const cdsProfiles = env.CDS_ENV
    ? String(env.CDS_ENV).split(',').map((profile) => profile.trim().toLowerCase()).filter(Boolean)
    : []

  if (cdsProfiles.length > 0) {
    return cdsProfiles.includes('development') || cdsProfiles.includes('dev') || cdsProfiles.includes('test')
  }

  return env.NODE_ENV !== 'production'
}

function normalizeRetry(options = {}) {
  const retryOptions = options.retry || {}
  const retryCredentials = options.credentials?.retry || {}
  const credentials = options.credentials || {}
  const retries = normalizeNonNegativeInteger(firstConfiguredValue(
    options.retries,
    credentials.retries,
    options.retryAttempts,
    credentials.retryAttempts,
    retryOptions.attempts,
    retryCredentials.attempts,
    DEFAULT_RETRIES
  ), DEFAULT_RETRIES)
  const retryDelayMs = normalizeNonNegativeInteger(firstConfiguredValue(
    options.retryDelayMs,
    credentials.retryDelayMs,
    retryOptions.delayMs,
    retryCredentials.delayMs,
    retryOptions.minDelayMs,
    retryCredentials.minDelayMs,
    DEFAULT_RETRY_DELAY_MS
  ), DEFAULT_RETRY_DELAY_MS)

  return {
    attempts: retries,
    minDelayMs: retryDelayMs,
    maxDelayMs: normalizeNonNegativeInteger(firstConfiguredValue(
      retryOptions.maxDelayMs,
      retryCredentials.maxDelayMs,
      Math.max(retryDelayMs, DEFAULT_RETRY_DELAY_MS * 4)
    ), Math.max(retryDelayMs, DEFAULT_RETRY_DELAY_MS * 4)),
    retries,
    retryDelayMs
  }
}

function assertWebhookConfig(config) {
  if (config.kind !== 'webhook') return config

  if (!config.baseUrl) {
    throw createConfigError('n8n webhook runtime requires credentials.baseUrl or baseUrl.', {
      field: 'baseUrl',
      kind: 'webhook'
    })
  }

  return config
}

function resolveN8nConfig(options = {}, env = process.env) {
  const resolvedOptions = resolveEnvPlaceholders(options, env) || {}
  const credentials = resolvedOptions.credentials || {}
  const duplicateOptions = resolvedOptions.duplicates || {}
  const duplicateCredentials = credentials.duplicates || {}
  const cancelOptions = resolvedOptions.cancel || resolvedOptions.cancellation || resolvedOptions.stop || {}
  const cancelCredentials = credentials.cancel || credentials.cancellation || credentials.stop || {}
  const configuredKind = normalizeKind(firstConfiguredValue(resolvedOptions.kind, resolvedOptions.mode))
  const baseUrl = firstConfiguredValue(credentials.baseUrl, resolvedOptions.baseUrl)
  const apiKey = firstConfiguredValue(credentials.apiKey, resolvedOptions.apiKey)
  const duplicatePolicy = normalizeDuplicatePolicy(firstConfiguredValue(
    resolvedOptions.duplicatePolicy,
    credentials.duplicatePolicy,
    duplicateOptions.policy,
    duplicateCredentials.policy,
    DEFAULT_DUPLICATE_POLICY
  ))
  const timeoutMs = normalizeNonNegativeInteger(firstConfiguredValue(
    resolvedOptions.timeoutMs,
    credentials.timeoutMs,
    resolvedOptions.timeout,
    credentials.timeout,
    DEFAULT_TIMEOUT_MS
  ), DEFAULT_TIMEOUT_MS)
  const retry = normalizeRetry(resolvedOptions)
  const cancelSupported = normalizeBoolean(firstConfiguredValue(
    cancelOptions.supported,
    cancelOptions.enabled,
    cancelCredentials.supported,
    cancelCredentials.enabled,
    false
  ), false)
  const cancelApiBaseUrl = firstConfiguredValue(
    cancelOptions.apiBaseUrl,
    cancelCredentials.apiBaseUrl,
    cancelOptions.baseUrl,
    cancelCredentials.baseUrl,
    resolvedOptions.apiBaseUrl,
    credentials.apiBaseUrl,
    cancelSupported ? baseUrl : undefined
  )

  let kind = configuredKind
  if (!kind) {
    kind = baseUrl ? 'webhook' : isDevelopmentEnv(env) ? 'mock' : 'webhook'
  }

  const config = {
    kind,
    timeoutMs,
    retries: retry.retries,
    retryDelayMs: retry.retryDelayMs,
    duplicatePolicy,
    cancel: {
      supported: cancelSupported
    },
    retry,
    profiles: profileNames(env)
  }

  if (baseUrl) config.baseUrl = baseUrl
  if (apiKey) config.apiKey = apiKey
  if (cancelApiBaseUrl) config.cancel.apiBaseUrl = cancelApiBaseUrl
  if (resolvedOptions.mock) config.mock = resolvedOptions.mock

  return assertWebhookConfig(config)
}

module.exports = {
  assertWebhookConfig,
  normalizeDuplicatePolicy,
  resolveEnvPlaceholders,
  resolveN8nConfig
}
