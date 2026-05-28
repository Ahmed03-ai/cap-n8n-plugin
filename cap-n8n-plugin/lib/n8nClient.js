// Real n8n client - connects to actual n8n instance
class N8nClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  async startWorkflow(id, inputData) {
    // TODO: implement real n8n API call
    throw new Error('Not implemented yet')
  }

  async cancelWorkflow(executionId) {
    // TODO: implement real n8n API call
    throw new Error('Not implemented yet')
  }

  async getExecution(executionId) {
    // TODO: implement real n8n API call
    throw new Error('Not implemented yet')
  }
}

module.exports = N8nClient