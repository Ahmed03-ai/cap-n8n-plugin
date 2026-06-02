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

function createStartResult({ workflowId, executionId, correlationId, businessKey, result, mock }) {
  const startResult = {
    accepted: true,
    workflowId
  }

  addOptionalValue(startResult, 'executionId', executionId)
  addOptionalValue(startResult, 'correlationId', correlationId)
  addOptionalValue(startResult, 'businessKey', businessKey)
  addOptionalValue(startResult, 'result', result)

  if (mock === true) {
    startResult.mock = true
  }

  return startResult
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

function createCancelResult({
  executionId,
  status,
  cancelled,
  noOp,
  unsupported,
  reason
} = {}) {
  const result = {}

  addOptionalValue(result, 'executionId', executionId)
  addOptionalValue(result, 'status', status)
  addOptionalValue(result, 'cancelled', cancelled)
  addOptionalValue(result, 'noOp', noOp)
  addOptionalValue(result, 'unsupported', unsupported)
  addOptionalValue(result, 'reason', reason)

  return result
}

module.exports = {
  createCancelResult,
  createExecutionResult,
  createQueryResult,
  createStartResult,
  normalizeWebhookPath
}
