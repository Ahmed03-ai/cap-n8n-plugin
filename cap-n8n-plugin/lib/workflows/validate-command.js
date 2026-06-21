const fs = require('node:fs/promises')
const path = require('node:path')
const cds = require('@sap/cds')
const { validateWorkflowAnnotations } = require('./validate')

const DEFAULT_MODEL_DIRS = ['db', 'srv', 'app', 'n8n']

function validateError(message, details = {}) {
  const error = new Error(message)
  error.code = 'ERR_N8N_WORKFLOW_VALIDATE'
  error.details = details
  return error
}

function resolveInputPath(file, cwd) {
  if (typeof file !== 'string' || !file.trim()) return undefined
  return path.resolve(cwd, file)
}

async function pathExists(file) {
  try {
    await fs.stat(file)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function modelRoots(appRoot) {
  const roots = []

  for (const dir of DEFAULT_MODEL_DIRS) {
    const modelRoot = path.join(appRoot, dir)
    if (await pathExists(modelRoot)) roots.push(modelRoot)
  }

  return roots
}

async function loadAppModel(appRoot) {
  const roots = await modelRoots(appRoot)

  if (roots.length === 0) {
    throw validateError('cap-n8n validate could not find CAP model folders under the app root.', {
      appRoot,
      modelDirs: DEFAULT_MODEL_DIRS
    })
  }

  return cds.load(roots, { cwd: appRoot })
}

function diagnosticField(label, value) {
  if (value === undefined || value === null || value === '') return undefined
  return `${label}=${value}`
}

function formatDiagnostic(diagnostic) {
  return [
    diagnosticField('severity', diagnostic.severity),
    diagnosticField('code', diagnostic.code),
    diagnosticField('entity', diagnostic.entity),
    diagnosticField('annotation', diagnostic.annotation),
    diagnosticField('workflow', diagnostic.workflowReference),
    diagnosticField('key', diagnostic.workflowKey),
    diagnosticField('input', diagnostic.input),
    diagnosticField('field', diagnostic.fieldPath),
    diagnosticField('expected', diagnostic.expectedType),
    diagnosticField('actual', diagnostic.actualType),
    diagnosticField('reason', diagnostic.reason)
  ].filter(Boolean).join(' | ')
}

function textOutput({ appRoot, result }) {
  if (result.diagnostics.length === 0) {
    return [`n8n workflow validation passed for ${appRoot}.`]
  }

  return result.diagnostics.map((diagnostic) => (
    `${formatDiagnostic(diagnostic)} | ${diagnostic.message}`
  ))
}

async function runValidateCommand(options = {}) {
  const cwd = options.cwd || process.cwd()
  const appRoot = resolveInputPath(options.app, cwd)

  if (!appRoot) {
    throw validateError('cap-n8n validate requires --app <app-root>.')
  }

  const csn = await loadAppModel(appRoot)
  const result = await validateWorkflowAnnotations({
    appRoot,
    csn
  })

  return {
    appRoot,
    exitCode: result.errors.length > 0 ? 1 : 0,
    result
  }
}

module.exports = {
  formatDiagnostic,
  runValidateCommand,
  textOutput
}
