import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pluginModel = path.join(repoRoot, 'cap-n8n-plugin', 'index.cds')
const originalN8nConfig = cds.env.requires?.n8n
const secretApiKey = 'phase8-cancel-api-key'
const n8nApiKeyHeader = 'X-N8N-API-KEY'

let db

function configureN8n(baseUrl) {
  cds.env.requires ??= {}
  cds.env.requires.n8n = {
    impl: 'cap-n8n-plugin/service',
    kind: 'webhook',
    credentials: {
      baseUrl,
      apiKey: secretApiKey
    },
    cancel: {
      supported: true,
      apiBaseUrl: baseUrl
    },
    retries: 1,
    timeoutMs: 1000
  }
}

async function deployExecutionModel() {
  const csn = await cds.load(pluginModel)
  db = await cds.deploy(csn).to('sqlite::memory:')
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

async function disconnectDb() {
  if (!db) return

  await cds.disconnect(db)
  db = undefined
}

async function createN8nApiServer({ stopStatus = 200 } = {}) {
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

    if (request.url === '/webhook/cap-cancel-stoppable') {
      res.statusCode = 202
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        executionId: 'n8n-running-9001',
        status: 'running',
        keepRunning: true
      }))
      return
    }

    if (request.url === '/api/v1/executions/n8n-running-9001/stop') {
      res.statusCode = stopStatus
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        stopped: stopStatus < 400,
        apiKey: secretApiKey,
        headers: {
          'x-n8n-api-key': secretApiKey
        }
      }))
      return
    }

    res.statusCode = 404
    res.end(JSON.stringify({ error: 'unexpected request' }))
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

function expectNoSecret(value) {
  const serialized = JSON.stringify(value)

  expect(serialized).not.toContain(secretApiKey)
  expect(value).not.toHaveProperty('headers')
  expect(value).not.toHaveProperty('requestBody')
  expect(value).not.toHaveProperty('stack')
}

beforeEach(async () => {
  await deployExecutionModel()
})

afterEach(async () => {
  await resetN8nService()
  await disconnectDb()
})

describe('n8n cancellation stop API integration', () => {
  it('routes n8n.cancel through _stopN8nExecution for explicit running webhook responses', async () => {
    const server = await createN8nApiServer()

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')
      const started = await n8n.start('cap-cancel-stoppable', {
        event: 'Phase8Cancellation'
      }, {
        businessKey: 'phase8-cancellation-review',
        tag: 'phase8-review'
      })
      const storedRunning = await n8n.getExecution(started.executionId)
      const cancelled = await n8n.cancel(started.executionId)
      const storedCancelled = await n8n.getExecution(started.executionId)
      const stopRequest = server.requests.find((request) => request.url.includes('/stop'))

      expect(started).toMatchObject({
        accepted: true,
        workflowId: 'cap-cancel-stoppable',
        n8nExecutionId: 'n8n-running-9001',
        businessKey: 'phase8-cancellation-review',
        tag: 'phase8-review',
        status: 'running',
        result: {
          executionId: 'n8n-running-9001',
          status: 'running',
          keepRunning: true
        }
      })
      expect(storedRunning).toMatchObject({
        executionId: started.executionId,
        n8nExecutionId: 'n8n-running-9001',
        status: 'running'
      })
      expect(stopRequest).toMatchObject({
        method: 'POST',
        url: '/api/v1/executions/n8n-running-9001/stop'
      })
      expect(stopRequest.headers[n8nApiKeyHeader.toLowerCase()]).toBe(secretApiKey)
      expect(cancelled).toMatchObject({
        executionId: started.executionId,
        n8nExecutionId: 'n8n-running-9001',
        status: 'cancelled',
        cancelled: true,
        stopResult: {
          stopped: true
        }
      })
      expect(storedCancelled).toMatchObject({
        executionId: started.executionId,
        n8nExecutionId: 'n8n-running-9001',
        status: 'cancelled',
        result: {
          cancelled: true
        }
      })
      expectNoSecret(started)
      expectNoSecret(cancelled)
      expectNoSecret(storedCancelled)
    } finally {
      await server.close()
    }
  })

  it('redacts the n8n API key from stop errors', async () => {
    const server = await createN8nApiServer({ stopStatus: 500 })

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')
      const started = await n8n.start('cap-cancel-stoppable')
      const cancelled = await n8n.cancel(started.executionId)
      const stored = await n8n.getExecution(started.executionId)

      expect(cancelled).toMatchObject({
        executionId: started.executionId,
        n8nExecutionId: 'n8n-running-9001',
        status: 'cancel_requested',
        cancelled: false,
        noOp: true,
        error: {
          source: 'n8n',
          statusCode: 500,
          code: 'ERR_N8N_CANCEL_HTTP_STATUS'
        }
      })
      expect(stored).toMatchObject({
        status: 'cancel_requested',
        result: {
          error: {
            statusCode: 500
          }
        }
      })
      expectNoSecret(cancelled)
      expectNoSecret(stored)
    } finally {
      await server.close()
    }
  })
})
