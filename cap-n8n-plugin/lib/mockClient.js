class MockN8nClient {
  constructor() {
    this.executions = {}
  }

  async startWorkflow(id, inputData) {
    console.log(`[n8n MOCK] Starting workflow: ${id}`, inputData)
    return { success: true, workflowId: id, status: 'running' }
  }

  async cancelWorkflow(executionId) {
    console.log(`[n8n MOCK] Cancelling execution: ${executionId}`)
    return { success: true, status: 'cancelled' }
  }

  async getExecution(executionId) {
    return this.executions[executionId] || null
  }
}

module.exports = MockN8nClient