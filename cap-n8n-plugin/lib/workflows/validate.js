const { readWorkflowAnnotations } = require('../annotations/AnnotationParser')
const { readWorkflowArtifacts } = require('./artifacts')
const { createDiagnostic, summarizeDiagnostics } = require('./diagnostics')
const cds = require('@sap/cds')

const ANNOTATION = '@n8n.workflow.start'
const TYPE_COMPATIBILITY = {
  String: new Set(['cds.String', 'cds.LargeString', 'cds.UUID']),
  Integer: new Set(['cds.Integer', 'cds.Int16', 'cds.Int32', 'cds.Int64']),
  Decimal: new Set(['cds.Decimal', 'cds.Double', 'cds.Integer', 'cds.Int16', 'cds.Int32', 'cds.Int64']),
  Boolean: new Set(['cds.Boolean']),
  Date: new Set(['cds.Date']),
  DateTime: new Set(['cds.DateTime', 'cds.Timestamp'])
}

async function safeReadArtifacts(appRoot) {
  try {
    return await readWorkflowArtifacts(appRoot)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        workflows: []
      }
    }

    throw error
  }
}

function buildReferenceIndex(workflows = []) {
  const references = new Map()

  for (const workflow of workflows) {
    const accepted = Array.isArray(workflow.manifest?.acceptedReferences)
      ? workflow.manifest.acceptedReferences
      : [workflow.workflowKey]

    for (const reference of accepted) {
      if (typeof reference === 'string' && reference.trim() && !references.has(reference.trim())) {
        references.set(reference.trim(), workflow)
      }
    }
  }

  return references
}

function entityName(name, definition = {}) {
  return definition.name || name || definition.kind || 'entity'
}

function effectiveDefinitions(csn = {}) {
  try {
    return cds.compile.for.nodejs(csn).definitions || csn.definitions || {}
  } catch (error) {
    return csn.definitions || {}
  }
}

function startAnnotations(csn = {}) {
  const starts = []
  const definitions = effectiveDefinitions(csn)

  for (const [name, definition] of Object.entries(definitions)) {
    if (!definition || definition.kind !== 'entity') continue

    const entity = {
      name,
      ...definition
    }
    const annotations = readWorkflowAnnotations(definition, { entity, name })

    if (!annotations.start) continue
    starts.push({
      entity,
      entityName: entityName(name, definition),
      start: annotations.start
    })
  }

  return starts
}

function schemaInputs(schema = {}) {
  const inputs = new Map()

  for (const input of schema.inputs || []) {
    inputs.set(input.name, input)
  }

  return inputs
}

function isTypeCompatible(expectedType, actualType) {
  if (expectedType === 'JSON') return Boolean(actualType)
  return TYPE_COMPATIBILITY[expectedType]?.has(actualType) === true
}

function mappingDiagnostics({ entityName, start, workflow, schema }) {
  const diagnostics = []
  const expectedInputs = schemaInputs(schema)
  const mappedInputs = start.inputs || {}
  const workflowReference = start.workflowId
  const workflowKey = workflow.workflowKey

  for (const input of schema.inputs || []) {
    const mapping = mappedInputs[input.name]

    if (input.required && !mapping) {
      diagnostics.push(createDiagnostic({
        severity: 'error',
        code: 'ERR_N8N_WORKFLOW_REQUIRED_INPUT',
        annotation: ANNOTATION,
        entity: entityName,
        workflowKey,
        workflowReference,
        input: input.name,
        expectedType: input.type
      }))
      continue
    }

    if (!mapping) continue
    if (!isTypeCompatible(input.type, mapping.type)) {
      diagnostics.push(createDiagnostic({
        severity: 'error',
        code: 'ERR_N8N_WORKFLOW_TYPE_MISMATCH',
        annotation: ANNOTATION,
        entity: entityName,
        workflowKey,
        workflowReference,
        input: input.name,
        fieldPath: mapping.path,
        expectedType: input.type,
        actualType: mapping.type
      }))
    }
  }

  for (const [inputName, mapping] of Object.entries(mappedInputs)) {
    if (expectedInputs.has(inputName)) continue

    diagnostics.push(createDiagnostic({
      severity: 'warning',
      code: 'WARN_N8N_WORKFLOW_EXTRA_INPUT',
      annotation: ANNOTATION,
      entity: entityName,
      workflowKey,
      workflowReference,
      input: inputName,
      fieldPath: mapping.path,
      actualType: mapping.type
    }))
  }

  return diagnostics
}

async function validateWorkflowAnnotations({ appRoot, csn } = {}) {
  const artifacts = await safeReadArtifacts(appRoot)
  const references = buildReferenceIndex(artifacts.workflows)
  const diagnostics = []

  for (const { entityName, start } of startAnnotations(csn)) {
    const workflowReference = start.workflowId
    const workflow = references.get(workflowReference)

    if (!workflow) {
      diagnostics.push(createDiagnostic({
        severity: 'warning',
        code: 'WARN_N8N_WORKFLOW_UNKNOWN_REFERENCE',
        annotation: ANNOTATION,
        entity: entityName,
        workflowReference
      }))
      continue
    }

    if (workflow.typed !== true || workflow.schema?.typed !== true) {
      diagnostics.push(createDiagnostic({
        severity: 'warning',
        code: 'WARN_N8N_WORKFLOW_UNTYPED',
        annotation: ANNOTATION,
        entity: entityName,
        workflowKey: workflow.workflowKey,
        workflowReference
      }))
      continue
    }

    diagnostics.push(...mappingDiagnostics({
      entityName,
      start,
      workflow,
      schema: workflow.schema
    }))
  }

  return summarizeDiagnostics(diagnostics)
}

module.exports = {
  validateWorkflowAnnotations
}
