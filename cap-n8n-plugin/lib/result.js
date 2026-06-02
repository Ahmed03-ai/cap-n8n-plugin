function workflowIdError(message) {
  const error = new TypeError(message)
  error.code = 'ERR_N8N_WORKFLOW_ID'
  error.statusCode = 400
  return error
}

function normalizeWebhookPath(workflowId) {
  if (typeof workflowId !== 'string') {
    throw workflowIdError('n8n workflowId must be a non-empty string')
  }

  const safePath = workflowId.replace(/^\//, '')
  if (!safePath.trim()) {
    throw workflowIdError('n8n workflowId must be a non-empty string')
  }

  if (safePath.startsWith('webhook/') || safePath.startsWith('webhook-test/')) {
    return safePath
  }

  return `webhook/${safePath}`
}

function addOptionalValue(target, key, value) {
  if (value !== undefined && value !== null) {
    target[key] = value
  }
}

function parseJsonEnvelope(value) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch (e) {
    return { message: value }
  }
}

function normalizeTimestamp(value) {
  if (value instanceof Date) return value.toISOString()
  return value
}

function createStartResult({
  workflowId,
  executionId,
  n8nExecutionId,
  correlationId,
  businessKey,
  tag,
  status,
  attempts,
  result,
  error,
  duplicate,
  mock
}) {
  const startResult = {
    accepted: true,
    workflowId
  }

  addOptionalValue(startResult, 'executionId', executionId)
  addOptionalValue(startResult, 'n8nExecutionId', n8nExecutionId)
  addOptionalValue(startResult, 'correlationId', correlationId)
  addOptionalValue(startResult, 'businessKey', businessKey)
  addOptionalValue(startResult, 'tag', tag)
  addOptionalValue(startResult, 'status', status)
  addOptionalValue(startResult, 'attempts', attempts)
  addOptionalValue(startResult, 'result', result)
  addOptionalValue(startResult, 'error', error)
  addOptionalValue(startResult, 'duplicate', duplicate)

  if (mock === true) {
    startResult.mock = true
  }

  return startResult
}

function createExecutionNotFoundResult(executionId) {
  return {
    executionId,
    notFound: true
  }
}

function createExecutionResult(record = {}) {
  const execution = {}

  for (const key of [
    'executionId',
    'n8nExecutionId',
    'correlationId',
    'workflowId',
    'status',
    'businessKey',
    'tag',
    'attempts',
    'createdAt',
    'startedAt',
    'finishedAt',
    'updatedAt'
  ]) {
    addOptionalValue(execution, key, normalizeTimestamp(record[key]))
  }

  addOptionalValue(execution, 'result', parseJsonEnvelope(record.result))
  addOptionalValue(execution, 'error', parseJsonEnvelope(record.error))

  return execution
}

function createQueryResult(items = [], page = {}) {
  const limit = Number.isFinite(Number(page.limit)) ? Number(page.limit) : items.length
  const offset = Number.isFinite(Number(page.offset)) ? Number(page.offset) : 0
  const hasMore = Boolean(page.hasMore)

  return {
    items: items.map((item) => createExecutionResult(item)),
    pageInfo: {
      limit,
      offset,
      nextOffset: hasMore ? offset + limit : undefined,
      hasMore
    }
  }
}

function createDuplicateResult({ policy, duplicates = [] } = {}) {
  return {
    policy,
    activeExecutionIds: duplicates
      .map((execution) => execution.executionId)
      .filter(Boolean),
    ambiguous: duplicates.length > 1
  }
}

function createCancelResult({
  executionId,
  n8nExecutionId,
  status,
  cancelled,
  noOp,
  notFound,
  unsupported,
  reason,
  stopResult,
  error
} = {}) {
  const result = {}

  addOptionalValue(result, 'executionId', executionId)
  addOptionalValue(result, 'n8nExecutionId', n8nExecutionId)
  addOptionalValue(result, 'status', status)
  addOptionalValue(result, 'cancelled', cancelled)
  addOptionalValue(result, 'noOp', noOp)
  addOptionalValue(result, 'notFound', notFound)
  addOptionalValue(result, 'unsupported', unsupported)
  addOptionalValue(result, 'reason', reason)
  addOptionalValue(result, 'stopResult', stopResult)
  addOptionalValue(result, 'error', error)

  return result
}

module.exports = {
  createCancelResult,
  createDuplicateResult,
  createExecutionNotFoundResult,
  createExecutionResult,
  createQueryResult,
  createStartResult,
  normalizeWebhookPath
}
