const path = require('node:path')

function slugValue(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function workflowKeyError(message) {
  const error = new Error(message)
  error.code = 'ERR_N8N_WORKFLOW_KEY'
  return error
}

function assertWorkflowKey(workflowKey) {
  if (typeof workflowKey !== 'string' || !workflowKey.trim()) {
    throw workflowKeyError('n8n workflow key must be a non-empty string.')
  }

  const normalized = workflowKey.trim()
  if (
    normalized.includes('..') ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    path.isAbsolute(normalized) ||
    !/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(normalized)
  ) {
    throw workflowKeyError(`n8n workflow key ${workflowKey} is not a safe local artifact key.`)
  }

  return normalized
}

function workflowSourceId(workflow = {}) {
  return workflow.id || workflow.workflowId || workflow.sourceWorkflowId
}

function workflowName(workflow = {}) {
  return workflow.name
}

function webhookPath(workflow = {}) {
  for (const node of workflow.nodes || []) {
    const nodeType = String(node?.type || '').toLowerCase()
    const pathValue = node?.parameters?.path
    if (nodeType.includes('webhook') && typeof pathValue === 'string' && pathValue.trim()) {
      return pathValue.trim().replace(/^\/+/, '').replace(/\/+$/g, '')
    }
  }
  return undefined
}

function sourceIdSuffix(workflow = {}) {
  const id = slugValue(workflowSourceId(workflow))
  return id ? id.slice(0, 8) : undefined
}

function resolveWorkflowKey({ workflow, explicitKey, existingKeys = new Set(), appendCollisionSuffix = true } = {}) {
  const candidates = [
    explicitKey,
    webhookPath(workflow),
    workflowName(workflow),
    workflowSourceId(workflow)
  ]

  const selected = candidates.map(slugValue).find(Boolean)
  if (!selected) throw workflowKeyError('n8n workflow key could not be resolved from workflow metadata.')

  let workflowKey = assertWorkflowKey(selected)
  if (existingKeys.has(workflowKey)) {
    if (!appendCollisionSuffix) {
      throw workflowKeyError(`n8n workflow key ${workflowKey} collides with another workflow.`)
    }
    const suffix = sourceIdSuffix(workflow)
    if (!suffix) throw workflowKeyError(`n8n workflow key ${workflowKey} collides and has no source ID suffix.`)
    workflowKey = assertWorkflowKey(`${workflowKey}-${suffix}`)
  }

  return workflowKey
}

function addReference(references, value) {
  if (typeof value === 'string' && value.trim()) references.add(value.trim())
}

function acceptedReferences({ workflowKey, workflow } = {}) {
  const references = new Set()
  const sourceId = workflowSourceId(workflow)
  const nameSlug = slugValue(workflowName(workflow))
  const hookPath = webhookPath(workflow)

  addReference(references, workflowKey)
  addReference(references, sourceId)
  addReference(references, nameSlug)
  addReference(references, hookPath)
  if (hookPath) {
    addReference(references, `webhook/${hookPath}`)
    addReference(references, `webhook-test/${hookPath}`)
  }

  return Array.from(references).sort()
}

function buildWorkflowManifest({
  workflowKey,
  workflow,
  sourceType = 'local',
  artifacts,
  typed,
  removedPaths = []
} = {}) {
  const source = {
    type: sourceType
  }
  const sourceId = workflowSourceId(workflow)
  const name = workflowName(workflow)
  const hookPath = webhookPath(workflow)

  if (sourceId) source.workflowId = sourceId
  if (name) source.workflowName = name
  if (hookPath) source.webhookPath = hookPath

  return {
    workflowKey,
    source,
    artifacts,
    acceptedReferences: acceptedReferences({ workflowKey, workflow }),
    typed: typed === true,
    sanitizer: {
      removedPaths: Array.from(new Set(removedPaths)).sort()
    }
  }
}

module.exports = {
  acceptedReferences,
  assertWorkflowKey,
  buildWorkflowManifest,
  resolveWorkflowKey,
  slugValue,
  webhookPath,
  workflowName,
  workflowSourceId
}
