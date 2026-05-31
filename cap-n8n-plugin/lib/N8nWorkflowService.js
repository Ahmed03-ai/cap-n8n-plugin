const cds = require('@sap/cds')
const { resolveN8nConfig } = require('./config')
const { createStartResult, normalizeWebhookPath } = require('./result')

class N8nWorkflowService extends cds.Service {
  async init() {
    this.config = resolveN8nConfig({ ...(this.options || {}), kind: 'webhook' })
    this.baseUrl = this.config.baseUrl
    this.apiKey = this.config.apiKey

    this.on('start', (req) => this.start(req.data.workflowId, req.data.inputs, req.data.options || req.data))

    await super.init()
  }

  async start(workflowId, inputs = {}, options = {}) {
    return this._triggerWebhook(workflowId, inputs, options)
  }

  async _triggerWebhook(workflowId, inputs = {}, options = {}) {
    const safeBaseUrl = this.baseUrl.replace(/\/$/, '')
    const safePath = normalizeWebhookPath(workflowId)
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
      let result
      try {
        result = responseText ? JSON.parse(responseText) : { success: true }
      } catch (e) {
        result = { success: true, message: responseText }
      }

      return createStartResult({
        workflowId,
        executionId: result && typeof result === 'object' ? result.executionId : undefined,
        correlationId: options.correlationId,
        businessKey: options.businessKey,
        result
      })
    } catch (err) {
      cds.log('n8n').error(`Failed to trigger n8n workflow: ${err.message}`)
      throw err
    }
  }
}

module.exports = N8nWorkflowService
