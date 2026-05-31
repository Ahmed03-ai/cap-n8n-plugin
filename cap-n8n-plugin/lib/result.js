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

module.exports = {
  createStartResult,
  normalizeWebhookPath
}
