const {
  acceptedReferences,
  resolveWorkflowKey
} = require('./manifest')

function selectionError(message, details = {}) {
  const error = new Error(message)
  error.code = 'ERR_N8N_WORKFLOW_SELECTION'
  error.details = details
  return error
}

function normalizedWorkflowList(source) {
  if (Array.isArray(source)) return source
  if (Array.isArray(source?.data)) return source.data
  if (Array.isArray(source?.workflows)) return source.workflows
  if (source && typeof source === 'object') return [source]
  return []
}

function workflowReferences(workflow, workflowKey) {
  return acceptedReferences({ workflow, workflowKey })
    .map((reference) => String(reference).trim())
    .filter(Boolean)
}

function matchesSelector(workflow, selector) {
  if (!selector) return false

  const candidateKey = resolveWorkflowKey({
    workflow,
    appendCollisionSuffix: false
  })
  const normalizedSelector = String(selector).trim()
  const references = workflowReferences(workflow, candidateKey)

  return references.some((reference) => reference === normalizedSelector)
}

function selectedEntry(workflow, workflowKey) {
  return {
    workflow,
    workflowKey
  }
}

function selectAll(workflows) {
  const existingKeys = new Set()

  return workflows.map((workflow) => {
    const workflowKey = resolveWorkflowKey({ workflow, existingKeys })
    existingKeys.add(workflowKey)
    return selectedEntry(workflow, workflowKey)
  })
}

function selectOne(workflows, { workflow: selector, key } = {}) {
  if (selector) {
    const matches = workflows.filter((candidate) => matchesSelector(candidate, selector))
    if (matches.length === 0) {
      throw selectionError(`No n8n workflow matched selector ${selector}.`, { selector })
    }
    if (matches.length > 1) {
      throw selectionError(`n8n workflow selector ${selector} matched multiple workflows.`, { selector })
    }

    return [selectedEntry(matches[0], resolveWorkflowKey({
      workflow: matches[0],
      explicitKey: key,
      appendCollisionSuffix: false
    }))]
  }

  if (workflows.length === 1) {
    return [selectedEntry(workflows[0], resolveWorkflowKey({
      workflow: workflows[0],
      explicitKey: key,
      appendCollisionSuffix: false
    }))]
  }

  throw selectionError(
    'Multiple n8n workflows are available. Pass --workflow to select one workflow or --all to import all workflows.',
    { workflowCount: workflows.length }
  )
}

function selectWorkflows({ workflows: source, workflow, key, all = false } = {}) {
  const workflows = normalizedWorkflowList(source)
  if (workflows.length === 0) {
    throw selectionError('No n8n workflows were found in the import source.')
  }

  if (all) {
    if (key) {
      throw selectionError('--key can only override the artifact key for a single selected workflow.')
    }
    return selectAll(workflows)
  }

  return selectOne(workflows, { workflow, key })
}

module.exports = {
  selectWorkflows
}
