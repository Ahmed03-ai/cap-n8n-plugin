const fs = require('node:fs/promises')
const path = require('node:path')
const { resolveN8nConfig } = require('../config')
const { writeWorkflowArtifacts } = require('./artifacts')
const {
  fetchWorkflow,
  fetchWorkflows
} = require('./live-client')
const { selectWorkflows } = require('./selection')

function importError(message, details = {}) {
  const error = new Error(message)
  error.code = 'ERR_N8N_WORKFLOW_IMPORT'
  error.details = details
  return error
}

function resolveInputPath(file, cwd) {
  if (typeof file !== 'string' || !file.trim()) return undefined
  return path.resolve(cwd, file)
}

async function readJsonFile(file, label) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch (error) {
    throw importError(`Could not read ${label} JSON file.`, {
      file,
      code: error.code,
      message: error.message
    })
  }
}

function resolveEnvPlaceholders(value, env) {
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

async function readAppN8nConfig(appRoot, env) {
  const packagePath = path.join(appRoot, 'package.json')

  try {
    const packageJson = await readJsonFile(packagePath, 'CAP app package')
    return resolveEnvPlaceholders(packageJson?.cds?.requires?.n8n || {}, env)
  } catch (error) {
    if (error.details?.code === 'ENOENT') return {}
    throw error
  }
}

function localSourcePayload(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.workflows)) return value.workflows
  if (value && typeof value === 'object') return value
  throw importError('Local n8n workflow export must be a workflow object or an array of workflows.')
}

async function resolveLiveConfig({ appRoot, options, env }) {
  const appConfig = await readAppN8nConfig(appRoot, env)
  const credentials = {
    ...(appConfig.credentials || {})
  }

  if (options.baseUrl) credentials.baseUrl = options.baseUrl
  if (options.apiBaseUrl) credentials.apiBaseUrl = options.apiBaseUrl

  const resolved = resolveN8nConfig({
    ...appConfig,
    kind: 'webhook',
    credentials,
    baseUrl: credentials.baseUrl,
    apiBaseUrl: credentials.apiBaseUrl,
    timeoutMs: options.timeoutMs || appConfig.timeoutMs || appConfig.credentials?.timeoutMs
  }, env)

  return {
    baseUrl: resolved.baseUrl,
    apiBaseUrl: credentials.apiBaseUrl || appConfig.apiBaseUrl,
    apiKey: resolved.apiKey,
    timeoutMs: resolved.timeoutMs
  }
}

function artifactInput({ selected, sourceType, schema }) {
  return selected.map((entry) => ({
    workflow: entry.workflow,
    workflowKey: entry.workflowKey,
    sourceType,
    schema
  }))
}

function workflowSummary(entry) {
  return {
    workflowKey: entry.workflowKey,
    typed: entry.typed,
    paths: entry.paths,
    source: entry.manifest.source
  }
}

async function importLiveSource({ appRoot, options, schema, env }) {
  if (!options.all && !options.workflow) {
    throw importError('Live cap-n8n import requires --workflow <id> or explicit --all.')
  }

  const liveConfig = await resolveLiveConfig({
    appRoot,
    options,
    env
  })
  const source = options.all
    ? await fetchWorkflows(liveConfig)
    : await fetchWorkflow(options.workflow, liveConfig)
  const selected = selectWorkflows({
    workflows: source,
    workflow: options.all ? undefined : options.workflow,
    key: options.key,
    all: options.all
  })

  return writeWorkflowArtifacts({
    appRoot,
    workflows: artifactInput({
      selected,
      sourceType: 'live',
      schema
    })
  })
}

async function importLocalSource({ appRoot, options, schema, cwd }) {
  const sourcePath = resolveInputPath(options.from, cwd)
  if (!sourcePath) {
    throw importError('Local cap-n8n import requires --from <workflow-export.json>.')
  }

  const source = localSourcePayload(await readJsonFile(sourcePath, 'workflow export'))
  const selected = selectWorkflows({
    workflows: source,
    workflow: options.workflow,
    key: options.key,
    all: options.all
  })

  return writeWorkflowArtifacts({
    appRoot,
    workflows: artifactInput({
      selected,
      sourceType: 'local',
      schema
    })
  })
}

async function importWorkflows(options = {}) {
  const cwd = options.cwd || process.cwd()
  const env = options.env || process.env
  const appRoot = resolveInputPath(options.app, cwd)
  if (!appRoot) {
    throw importError('cap-n8n import requires --app <app-root>.')
  }

  const schemaPath = resolveInputPath(options.schema, cwd)
  const schema = schemaPath ? await readJsonFile(schemaPath, 'workflow schema') : undefined
  const sourceType = options.live ? 'live' : 'local'
  const artifacts = options.live
    ? await importLiveSource({ appRoot, options, schema, env })
    : await importLocalSource({ appRoot, options, schema, cwd })

  return {
    sourceType,
    appRoot: artifacts.appRoot,
    artifactRoot: artifacts.artifactRoot,
    manifestPath: artifacts.manifestPath,
    cdsPath: artifacts.cdsPath,
    diagnostics: artifacts.diagnostics,
    workflows: artifacts.workflows.map(workflowSummary)
  }
}

module.exports = {
  importWorkflows
}
