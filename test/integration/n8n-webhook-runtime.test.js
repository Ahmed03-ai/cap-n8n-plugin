import { afterEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')

const originalN8nConfig = cds.env.requires?.n8n

function configureN8n(baseUrl, options = {}) {
  const { credentials = {}, ...serviceOptions } = options

  cds.env.requires ??= {}
  cds.env.requires.n8n = {
    impl: 'cap-n8n-plugin/service',
    kind: 'webhook',
    credentials: {
      baseUrl,
      ...credentials
    },
    ...serviceOptions
  }
}

async function resetN8nService() {
  try {
    await cds.disconnect('n8n')
  } catch (err) {
    // Service may not have been connected yet.
  }
  delete cds.services.n8n

  if (originalN8nConfig) {
    cds.env.requires.n8n = originalN8nConfig
  } else if (cds.env.requires) {
    delete cds.env.requires.n8n
  }
}

async function createWebhookServer(respond) {
  const requests = []
  const sockets = new Set()
  const server = createServer(async (req, res) => {
    let body = ''

    req.setEncoding('utf8')
    for await (const chunk of req) body += chunk

    const request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: body ? JSON.parse(body) : undefined
    }

    requests.push(request)
    const response = await respond(request, requests.length)
    if (response === undefined) return

    res.statusCode = response.statusCode ?? 200
    res.setHeader('content-type', response.contentType ?? 'application/json')
    res.end(response.body ?? JSON.stringify({ received: true, executionId: 'exec-1' }))
  })

  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  const { port } = server.address()
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve, reject) => {
      for (const socket of sockets) socket.destroy()
      server.close((err) => err ? reject(err) : resolve())
    })
  }
}

function timeoutGuard(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout was not enforced')), ms)
  })
}

afterEach(async () => {
  await resetN8nService()
})

describe('N8nWorkflowService webhook runtime reliability', () => {
  it('sends X-N8N-API-KEY only when an apiKey is configured', async () => {
    const secretApiKey = 'test-secret-api-key'
    const authedServer = await createWebhookServer(() => ({
      body: JSON.stringify({ received: true })
    }))
    const anonymousServer = await createWebhookServer(() => ({
      body: JSON.stringify({ received: true })
    }))

    try {
      configureN8n(authedServer.baseUrl, {
        credentials: {
          apiKey: secretApiKey
        }
      })

      let n8n = await cds.connect.to('n8n')
      await n8n.start('authed-workflow', { event: 'BookCreated' })

      expect(authedServer.requests).toHaveLength(1)
      expect(authedServer.requests[0].headers['x-n8n-api-key']).toBe(secretApiKey)

      await resetN8nService()
      configureN8n(anonymousServer.baseUrl)

      n8n = await cds.connect.to('n8n')
      await n8n.start('anonymous-workflow', { event: 'BookCreated' })

      expect(anonymousServer.requests).toHaveLength(1)
      expect(anonymousServer.requests[0].headers).not.toHaveProperty('x-n8n-api-key')
    } finally {
      await authedServer.close()
      await anonymousServer.close()
    }
  })

  it('retries HTTP 502 responses and preserves correlation metadata on success', async () => {
    const server = await createWebhookServer((request, count) => {
      if (count === 1) {
        return {
          statusCode: 502,
          body: JSON.stringify({ error: 'temporary gateway failure' })
        }
      }

      return {
        body: JSON.stringify({ received: true, executionId: 'exec-after-retry' })
      }
    })

    try {
      configureN8n(server.baseUrl, {
        retries: 3,
        retryDelayMs: 5
      })

      const n8n = await cds.connect.to('n8n')
      const result = await n8n.start(
        'retry-workflow',
        { event: 'BookCreated' },
        { correlationId: 'corr-retry-1' }
      )

      expect(server.requests).toHaveLength(2)
      expect(result).toMatchObject({
        accepted: true,
        workflowId: 'retry-workflow',
        executionId: 'exec-after-retry',
        correlationId: 'corr-retry-1'
      })
    } finally {
      await server.close()
    }
  })

  it('does not retry HTTP 400 responses', async () => {
    const server = await createWebhookServer(() => ({
      statusCode: 400,
      body: JSON.stringify({ error: 'invalid workflow input' })
    }))

    try {
      configureN8n(server.baseUrl, {
        retries: 3,
        retryDelayMs: 5
      })

      const n8n = await cds.connect.to('n8n')

      await expect(n8n.start('bad-request-workflow', { invalid: true })).rejects.toMatchObject({
        source: 'n8n',
        statusCode: 400,
        retryable: false
      })
      expect(server.requests).toHaveLength(1)
    } finally {
      await server.close()
    }
  })

  it('aborts never-responding webhook requests after the configured timeout', async () => {
    const server = await createWebhookServer(() => undefined)

    try {
      configureN8n(server.baseUrl, {
        timeoutMs: 25,
        retries: 1,
        retryDelayMs: 5
      })

      const n8n = await cds.connect.to('n8n')

      await expect(Promise.race([
        n8n.start('timeout-workflow', { event: 'Timeout' }, { correlationId: 'corr-timeout-1' }),
        timeoutGuard(500)
      ])).rejects.toMatchObject({
        source: 'n8n',
        code: 'ERR_N8N_TIMEOUT',
        retryable: true
      })
      expect(server.requests).toHaveLength(1)
    } finally {
      await server.close()
    }
  })

  it('throws sanitized structured errors for HTTP 500 responses', async () => {
    const secretApiKey = 'test-secret-api-key'
    const server = await createWebhookServer(() => ({
      statusCode: 500,
      body: JSON.stringify({
        error: 'workflow failed',
        apiKey: secretApiKey,
        stack: 'stack trace should not be exposed'
      })
    }))

    try {
      configureN8n(server.baseUrl, {
        credentials: {
          apiKey: secretApiKey
        },
        retries: 1
      })

      const n8n = await cds.connect.to('n8n')

      await expect(n8n.start('failing-workflow', { secret: 'payload-secret' })).rejects.toMatchObject({
        source: 'n8n',
        statusCode: 500,
        retryable: false
      })

      try {
        await n8n.start('failing-workflow', { secret: 'payload-secret' })
      } catch (err) {
        const serializedError = JSON.stringify({
          message: err.message,
          source: err.source,
          statusCode: err.statusCode,
          retryable: err.retryable,
          code: err.code,
          details: err.details
        })

        expect(err).toMatchObject({
          source: 'n8n',
          statusCode: 500,
          retryable: false
        })
        expect(serializedError).not.toContain(secretApiKey)
        expect(serializedError).not.toContain('payload-secret')
        expect(serializedError).not.toContain('stack trace should not be exposed')
      }
    } finally {
      await server.close()
    }
  })
})
