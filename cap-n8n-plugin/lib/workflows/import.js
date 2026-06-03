const fs = require('node:fs/promises')
const path = require('node:path')
const { writeWorkflowArtifacts } = require('./artifacts')
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

function localSourcePayload(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.workflows)) return value.workflows
  if (value && typeof value === 'object') return value
  throw importError('Local n8n workflow export must be a workflow object or an array of workflows.')
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

async function importWorkflows(options = {}) {
  const cwd = options.cwd || process.cwd()
  const appRoot = resolveInputPath(options.app, cwd)
  if (!appRoot) {
    throw importError('cap-n8n import requires --app <app-root>.')
  }

  if (options.live) {
    throw importError('Live n8n workflow import is not implemented yet.')
  }

  const sourcePath = resolveInputPath(options.from, cwd)
  if (!sourcePath) {
    throw importError('Local cap-n8n import requires --from <workflow-export.json>.')
  }

  const schemaPath = resolveInputPath(options.schema, cwd)
  const source = localSourcePayload(await readJsonFile(sourcePath, 'workflow export'))
  const schema = schemaPath ? await readJsonFile(schemaPath, 'workflow schema') : undefined
  const selected = selectWorkflows({
    workflows: source,
    workflow: options.workflow,
    key: options.key,
    all: options.all
  })

  const artifacts = await writeWorkflowArtifacts({
    appRoot,
    workflows: artifactInput({
      selected,
      sourceType: 'local',
      schema
    })
  })

  return {
    sourceType: 'local',
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
