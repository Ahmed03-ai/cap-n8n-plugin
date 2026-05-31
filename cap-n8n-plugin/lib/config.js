const VALID_KINDS = new Set(['mock', 'webhook'])
const DEFAULT_TIMEOUT_MS = 10000
const DEFAULT_RETRY = {
  attempts: 3,
  minDelayMs: 100,
  maxDelayMs: 1000
}

function firstConfiguredValue(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (value !== undefined && value !== null && typeof value !== 'string') return value
  }
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

  return {
    attempts: Number(firstConfiguredValue(
      retryOptions.attempts,
      retryCredentials.attempts,
      options.retries,
      options.retryAttempts,
      DEFAULT_RETRY.attempts
    )),
    minDelayMs: Number(firstConfiguredValue(
      retryOptions.minDelayMs,
      retryCredentials.minDelayMs,
      DEFAULT_RETRY.minDelayMs
    )),
    maxDelayMs: Number(firstConfiguredValue(
      retryOptions.maxDelayMs,
      retryCredentials.maxDelayMs,
      DEFAULT_RETRY.maxDelayMs
    ))
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
  const credentials = options.credentials || {}
  const configuredKind = normalizeKind(firstConfiguredValue(options.kind, options.mode))
  const baseUrl = firstConfiguredValue(credentials.baseUrl, options.baseUrl)
  const apiKey = firstConfiguredValue(credentials.apiKey, options.apiKey)
  const timeoutMs = Number(firstConfiguredValue(
    options.timeoutMs,
    credentials.timeoutMs,
    options.timeout,
    credentials.timeout,
    DEFAULT_TIMEOUT_MS
  ))

  let kind = configuredKind
  if (!kind) {
    kind = baseUrl ? 'webhook' : isDevelopmentEnv(env) ? 'mock' : 'webhook'
  }

  const config = {
    kind,
    timeoutMs,
    retry: normalizeRetry(options),
    profiles: profileNames(env)
  }

  if (baseUrl) config.baseUrl = baseUrl
  if (apiKey) config.apiKey = apiKey
  if (options.mock) config.mock = options.mock

  return assertWebhookConfig(config)
}

module.exports = {
  assertWebhookConfig,
  resolveN8nConfig
}
