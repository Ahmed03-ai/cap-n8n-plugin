import { afterEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')

const originalN8nConfig = cds.env.requires?.n8n
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pluginModel = path.join(repoRoot, 'cap-n8n-plugin', 'index.cds')

let db

function configureN8n(baseUrl) {
  cds.env.requires ??= {}
  cds.env.requires.n8n = {
    impl: 'cap-n8n-plugin/service',
    credentials: {
      baseUrl
    }
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

async function deployExecutionModel() {
  const csn = await cds.load(pluginModel)
  db = await cds.deploy(csn).to('sqlite::memory:')
}

async function disconnectDb() {
  if (!db) return

  await cds.disconnect(db)
  db = undefined
}

async function createWebhookServer(respond) {
  const requests = []
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
    const response = await respond(request)

    res.statusCode = response.statusCode ?? 200
    res.setHeader('content-type', response.contentType ?? 'application/json')
    res.end(response.body ?? JSON.stringify({ received: true, executionId: 'exec-1' }))
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  const { port } = server.address()
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve())
    })
  }
}

function expectUuid(value) {
  expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
}

afterEach(async () => {
  await resetN8nService()
  await disconnectDb()
})

describe('N8nWorkflowService contract', () => {
  it('loads the service implementation through the public package boundary', () => {
    const plugin = require('cap-n8n-plugin')
    const service = require('cap-n8n-plugin/service')

    expect(plugin).toHaveProperty('N8nWorkflowService')
    expect(plugin.N8nWorkflowService).toBe(service)
  })

  it('connects through CAP and starts workflows with metadata', async () => {
    await deployExecutionModel()
    const server = await createWebhookServer(() => ({
      body: JSON.stringify({ received: true, executionId: 'exec-1' })
    }))

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')

      expect(n8n.start).toBeTypeOf('function')

      const result = await n8n.start(
        'cap-test-trigger',
        { event: 'BookCreated' },
        { correlationId: 'corr-1', businessKey: 'book-1' }
      )

      expect(server.requests).toHaveLength(1)
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        url: '/webhook/cap-test-trigger',
        body: { event: 'BookCreated' }
      })
      expect(result).toMatchObject({
        accepted: true,
        workflowId: 'cap-test-trigger',
        n8nExecutionId: 'exec-1',
        correlationId: 'corr-1',
        businessKey: 'book-1',
        status: 'succeeded',
        result: {
          received: true,
          executionId: 'exec-1'
        }
      })
      expectUuid(result.executionId)
      expect(result.executionId).not.toBe('exec-1')
      expect(result.result).toBeTypeOf('object')
    } finally {
      await server.close()
    }
  })

  it('preserves CAP send compatibility for start events', async () => {
    await deployExecutionModel()
    const server = await createWebhookServer(() => ({
      body: JSON.stringify({ received: true })
    }))

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')
      const result = await n8n.send('start', {
        workflowId: 'cap-test-trigger',
        inputs: { event: 'BookCreated' }
      })

      expect(server.requests).toHaveLength(1)
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        url: '/webhook/cap-test-trigger',
        body: { event: 'BookCreated' }
      })
      expect(result).toMatchObject({
        accepted: true,
        workflowId: 'cap-test-trigger',
        status: 'succeeded',
        result: { received: true }
      })
      expectUuid(result.executionId)
    } finally {
      await server.close()
    }
  })

  it('accepts successful webhook responses without an executionId', async () => {
    await deployExecutionModel()
    const server = await createWebhookServer(() => ({
      body: JSON.stringify({ received: true })
    }))

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')
      const result = await n8n.start('no-execution-id-workflow', { event: 'NoExecutionId' })

      expect(result).toMatchObject({
        accepted: true,
        workflowId: 'no-execution-id-workflow',
        status: 'succeeded',
        result: { received: true }
      })
      expectUuid(result.executionId)
      expect(result).not.toHaveProperty('n8nExecutionId')
    } finally {
      await server.close()
    }
  })

  it('preserves explicit webhook-test paths', async () => {
    await deployExecutionModel()
    const server = await createWebhookServer(() => ({
      body: JSON.stringify({ received: true })
    }))

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')
      await n8n.start('webhook-test/cap-test-trigger', { event: 'BookCreated' })

      expect(server.requests).toHaveLength(1)
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        url: '/webhook-test/cap-test-trigger',
        body: { event: 'BookCreated' }
      })
    } finally {
      await server.close()
    }
  })
})
