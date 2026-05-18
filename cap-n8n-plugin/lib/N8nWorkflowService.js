const cds = require('@sap/cds')

class N8nWorkflowService extends cds.Service {
  async init() {
    // Read config from cds.requires.n8n
    this.baseUrl = this.options.credentials?.baseUrl || this.options.baseUrl || 'http://localhost:5678'
    this.apiKey = this.options.credentials?.apiKey || this.options.apiKey

    if (!this.baseUrl) {
      cds.log('n8n').warn('No baseUrl configured for n8n service')
    }

    // Programmatic start method
    this.on('start', async (req) => {
      const { workflowId, inputs } = req.data
      return this._triggerWebhook(workflowId, inputs)
    })

    await super.init()
  }

  async _triggerWebhook(workflowId, inputs) {
    // Construct the webhook URL using the workflowId as the path
    const safeBaseUrl = this.baseUrl.replace(/\/$/, '')
    let safePath = workflowId.replace(/^\//, '')
    
    // Auto-prepend 'webhook/' if the user just provided the name (e.g., 'cap-test-trigger')
    // This allows users to optionally specify 'webhook-test/...' for canvas debugging
    if (!safePath.startsWith('webhook/') && !safePath.startsWith('webhook-test/')) {
      safePath = `webhook/${safePath}`
    }
    
    const url = `${safeBaseUrl}/${safePath}`
    const headers = {
      'Content-Type': 'application/json'
    }

    // Add authentication header if an API key is provided in the configuration
    if (this.apiKey) {
      headers['X-N8N-API-KEY'] = this.apiKey
    }

    try {
      cds.log('n8n').info(`Triggering n8n workflow at ${url}`)
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(inputs || {})
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`n8n responded with status ${response.status}: ${errorText}`)
      }

      // n8n webhook might respond with empty body depending on "Respond" setting
      const responseText = await response.text()
      try {
        return responseText ? JSON.parse(responseText) : { success: true }
      } catch (e) {
        return { success: true, message: responseText }
      }
    } catch (err) {
      cds.log('n8n').error(`Failed to trigger n8n workflow: ${err.message}`)
      throw err
    }
  }
}

module.exports = N8nWorkflowService
