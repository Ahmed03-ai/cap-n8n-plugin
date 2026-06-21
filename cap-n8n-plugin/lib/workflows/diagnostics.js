const { sanitizeDetails } = require('../errors')

const DEFAULT_REASONS = {
  ERR_N8N_WORKFLOW_REQUIRED_INPUT: 'required-input-missing',
  ERR_N8N_WORKFLOW_TYPE_MISMATCH: 'type-mismatch',
  WARN_N8N_WORKFLOW_EXTRA_INPUT: 'extra-input',
  WARN_N8N_WORKFLOW_UNKNOWN_REFERENCE: 'unknown-workflow-reference',
  WARN_N8N_WORKFLOW_UNTYPED: 'untyped-workflow-artifact'
}

function sanitizeScalar(value) {
  if (value === undefined || value === null) return undefined
  const sanitized = sanitizeDetails({ value })
  return sanitized.value
}

function addOptional(target, key, value) {
  const sanitized = sanitizeScalar(value)
  if (sanitized !== undefined && sanitized !== null && sanitized !== '') {
    target[key] = sanitized
  }
}

function workflowLabel(diagnostic) {
  if (diagnostic.workflowKey && diagnostic.workflowKey !== diagnostic.workflowReference) {
    return `${diagnostic.workflowReference} (${diagnostic.workflowKey})`
  }

  return diagnostic.workflowReference
}

function diagnosticMessage(diagnostic) {
  const base = `${diagnostic.code}: ${diagnostic.entity} ${diagnostic.annotation} references workflow ${workflowLabel(diagnostic)}`

  if (diagnostic.code === 'ERR_N8N_WORKFLOW_REQUIRED_INPUT') {
    return `${base} but required input ${diagnostic.input} is not mapped.`
  }

  if (diagnostic.code === 'ERR_N8N_WORKFLOW_TYPE_MISMATCH') {
    return `${base} but input ${diagnostic.input} maps ${diagnostic.fieldPath} as ${diagnostic.actualType}; expected ${diagnostic.expectedType}.`
  }

  if (diagnostic.code === 'WARN_N8N_WORKFLOW_EXTRA_INPUT') {
    return `${base} with extra input ${diagnostic.input} mapped from ${diagnostic.fieldPath}.`
  }

  if (diagnostic.code === 'WARN_N8N_WORKFLOW_UNKNOWN_REFERENCE') {
    return `${base} but no generated workflow artifact accepts this reference.`
  }

  if (diagnostic.code === 'WARN_N8N_WORKFLOW_UNTYPED') {
    return `${base} but the generated workflow artifact has no typed sidecar schema.`
  }

  return `${base}: ${diagnostic.reason || 'workflow-validation'}`
}

function createDiagnostic({
  severity,
  code,
  annotation = '@n8n.workflow.start',
  entity,
  workflowKey,
  workflowReference,
  input,
  fieldPath,
  expectedType,
  actualType,
  reason
} = {}) {
  const diagnostic = {
    source: 'n8n'
  }

  addOptional(diagnostic, 'severity', severity)
  addOptional(diagnostic, 'code', code)
  addOptional(diagnostic, 'annotation', annotation)
  addOptional(diagnostic, 'entity', entity)
  addOptional(diagnostic, 'workflowKey', workflowKey)
  addOptional(diagnostic, 'workflowReference', workflowReference)
  addOptional(diagnostic, 'input', input)
  addOptional(diagnostic, 'fieldPath', fieldPath)
  addOptional(diagnostic, 'expectedType', expectedType)
  addOptional(diagnostic, 'actualType', actualType)
  addOptional(diagnostic, 'reason', reason || DEFAULT_REASONS[code])

  diagnostic.message = diagnosticMessage(diagnostic)
  return diagnostic
}

function sortDiagnostics(diagnostics = []) {
  return [...diagnostics].sort((left, right) => {
    const leftKey = [
      left.entity || '',
      left.workflowKey || '',
      left.workflowReference || '',
      left.input || '',
      left.code || ''
    ].join('\u0000')
    const rightKey = [
      right.entity || '',
      right.workflowKey || '',
      right.workflowReference || '',
      right.input || '',
      right.code || ''
    ].join('\u0000')

    return leftKey.localeCompare(rightKey)
  })
}

function summarizeDiagnostics(diagnostics = []) {
  const sorted = sortDiagnostics(diagnostics)

  return {
    errors: sorted.filter((diagnostic) => diagnostic.severity === 'error'),
    warnings: sorted.filter((diagnostic) => diagnostic.severity === 'warning'),
    diagnostics: sorted
  }
}

module.exports = {
  createDiagnostic,
  summarizeDiagnostics
}
