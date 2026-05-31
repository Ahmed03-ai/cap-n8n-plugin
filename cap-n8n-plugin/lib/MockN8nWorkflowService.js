const cds = require('@sap/cds')
const { createStartResult } = require('./result')
const { resolveN8nConfig } = require('./config')

function createMockFailure(workflowId) {
  const error = new Error(`Configured mock n8n workflow failed for workflowId "${workflowId}"`)
  error.code = 'ERR_N8N_MOCK_FAILURE'
  error.source = 'n8n'
  error.statusCode = 500
  error.retryable = false
  error.mock = true
  return error
}

function configuredFailures(...configs) {
  const workflows = []

  for (const config of configs) {
    const failWorkflows = config?.mock?.failWorkflows ?? config?.failWorkflows
    if (Array.isArray(failWorkflows)) workflows.push(...failWorkflows)
    else if (failWorkflows instanceof Set) workflows.push(...failWorkflows)
    else if (typeof failWorkflows === 'string' && failWorkflows.trim()) workflows.push(failWorkflows.trim())
  }

  return workflows
}

function addOptionalValue(target, key, value) {
  if (value !== undefined && value !== null) {
    target[key] = value
  }
}

class MockN8nWorkflowService extends cds.Service {
  async init() {
    this.config = resolveN8nConfig({ ...(this.options || {}), kind: 'mock' })
    this.executions = []
    this._nextExecution = 1

    this.on('start', (req) => this.start(req.data.workflowId, req.data.inputs, req.data.options || req.data))

    await super.init()
  }

  async start(workflowId, inputs = {}, options = {}) {
    const failures = configuredFailures(this.config, this.options, options)
    const executionId = `mock-exec-${this._nextExecution++}`
    const startedAt = new Date().toISOString()
    const record = {
      executionId,
      workflowId,
      inputs: inputs || {},
      status: 'success',
      startedAt
    }

    addOptionalValue(record, 'correlationId', options.correlationId)
    addOptionalValue(record, 'businessKey', options.businessKey)

    if (failures.includes(workflowId)) {
      record.status = 'failed'
      record.finishedAt = new Date().toISOString()
      this.executions.push(record)
      throw createMockFailure(workflowId)
    }

    record.finishedAt = new Date().toISOString()
    this.executions.push(record)

    return createStartResult({
      workflowId,
      executionId,
      correlationId: options.correlationId,
      businessKey: options.businessKey,
      result: record,
      mock: true
    })
  }
}

module.exports = MockN8nWorkflowService
