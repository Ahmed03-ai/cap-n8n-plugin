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
const missingExecutionId = '00000000-0000-4000-8000-000000000404'
const forbiddenPublicFragments = [
  'raw-cancel-input-secret',
  'raw-mock-input-secret',
  'raw-mock-result-secret',
  'raw-mock-error-secret',
  'payload',
  'headers',
  'requestBody',
  'stack'
]

let db

function testUuid(value) {
  return `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
}

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

function configureMockN8n(options = {}) {
  cds.env.requires ??= {}
  cds.env.requires.n8n = {
    kind: 'mock',
    impl: require.resolve('../../cap-n8n-plugin/lib/MockN8nWorkflowService.js'),
    ...options
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
    res.end(response.body ?? JSON.stringify({ received: true }))
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

async function seedExecution(store, data = {}) {
  const execution = await store.createQueued({
    executionId: data.executionId,
    workflowId: data.workflowId,
    n8nExecutionId: data.n8nExecutionId,
    correlationId: data.correlationId,
    businessKey: data.businessKey,
    tag: data.tag
  })

  if (data.status && data.status !== 'queued') {
    await store.updateStatus(execution.executionId, data.status, {
      n8nExecutionId: data.n8nExecutionId
    })
  }

  return store.getExecution(execution.executionId)
}

function expectPublicDtoIsSanitized(value) {
  const serialized = JSON.stringify(value)

  for (const fragment of forbiddenPublicFragments) {
    expect(serialized).not.toContain(fragment)
  }

  expect(value).not.toHaveProperty('payload')
  expect(value).not.toHaveProperty('inputs')
  expect(value).not.toHaveProperty('headers')
  expect(value).not.toHaveProperty('request')
  expect(value).not.toHaveProperty('requestBody')
}

beforeEach(async () => {
  await deployExecutionModel()
})

afterEach(async () => {
  await resetN8nService()
  await disconnectDb()
})

describe('n8n state-aware cancellation integration', () => {
  it('cancels queued executions before dispatch and skips webhook delivery', async () => {
    const server = await createWebhookServer(() => ({
      body: JSON.stringify({
        received: true,
        executionId: 'n8n-should-not-dispatch'
      })
    }))

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')
      const queued = await n8n.store.createQueued({
        workflowId: 'queued-cancel-workflow',
        correlationId: 'corr-cancel-queued',
        inputs: {
          event: 'BookCreated',
          secret: 'raw-cancel-input-secret'
        },
        dispatch: {
          workflowPath: 'webhook/queued-cancel-workflow',
          payload: {
            event: 'BookCreated',
            secret: 'raw-cancel-input-secret'
          }
        }
      })

      const cancelled = await n8n.cancel(queued.executionId)
      const dispatched = await n8n.dispatchPending({ executionId: queued.executionId })
      const stored = await n8n.getExecution(queued.executionId)

      expect(cancelled).toMatchObject({
        executionId: queued.executionId,
        status: 'cancelled',
        cancelled: true
      })
      expect(dispatched).toMatchObject({
        executionId: queued.executionId,
        status: 'cancelled'
      })
      expect(stored).toMatchObject({
        executionId: queued.executionId,
        status: 'cancelled',
        result: {
          cancelled: true
        }
      })
      expect(server.requests).toHaveLength(0)
      expectPublicDtoIsSanitized(cancelled)
      expectPublicDtoIsSanitized(stored)
    } finally {
      await server.close()
    }
  })

  it('returns an unsupported no-op for running webhook executions without stop support', async () => {
    configureN8n('http://127.0.0.1:1')

    const n8n = await cds.connect.to('n8n')
    const running = await seedExecution(n8n.store, {
      executionId: testUuid(1),
      workflowId: 'running-no-stop-workflow',
      status: 'running',
      businessKey: 'book-running-no-stop'
    })

    const cancelled = await n8n.cancel(running.executionId)
    const repeated = await n8n.send('cancel', {
      executionId: running.executionId
    })
    const stored = await n8n.getExecution(running.executionId)

    expect(cancelled).toMatchObject({
      executionId: running.executionId,
      status: 'cancel_requested',
      cancelled: false,
      noOp: true,
      unsupported: true
    })
    expect(cancelled.reason).toMatch(/unsupported|not supported/i)
    expect(repeated).toMatchObject({
      executionId: running.executionId,
      status: 'cancel_requested',
      noOp: true
    })
    expect(stored).toMatchObject({
      executionId: running.executionId,
      status: 'cancel_requested',
      result: {
        unsupported: true,
        noOp: true
      }
    })
    expect(stored.status).not.toBe('cancelled')
    expectPublicDtoIsSanitized(cancelled)
    expectPublicDtoIsSanitized(stored)
  })

  it('returns terminal no-op results for succeeded, failed, and cancelled executions', async () => {
    configureN8n('http://127.0.0.1:1')

    const n8n = await cds.connect.to('n8n')
    const statuses = ['succeeded', 'failed', 'cancelled']

    for (const [index, status] of statuses.entries()) {
      const execution = await seedExecution(n8n.store, {
        executionId: testUuid(index + 2),
        workflowId: `terminal-${status}`,
        status
      })

      const cancelled = await n8n.cancel(execution.executionId)
      const stored = await n8n.getExecution(execution.executionId)

      expect(cancelled).toMatchObject({
        executionId: execution.executionId,
        status,
        noOp: true
      })
      expect(cancelled.reason).toEqual(expect.any(String))
      expect(stored).toMatchObject({
        executionId: execution.executionId,
        status
      })
      expectPublicDtoIsSanitized(cancelled)
    }
  })

  it('returns a meaningful not-found result for missing executions', async () => {
    configureN8n('http://127.0.0.1:1')

    const n8n = await cds.connect.to('n8n')
    const cancelled = await n8n.cancel(missingExecutionId)

    expect(cancelled).toMatchObject({
      executionId: missingExecutionId,
      notFound: true,
      noOp: true
    })
    expect(cancelled.reason).toMatch(/not found/i)
  })
})

describe('MockN8nWorkflowService Phase 3 parity', () => {
  it('supports running records, deterministic completion/failure, query paging, and cancel', async () => {
    configureMockN8n({
      mock: {
        holdRunning: true
      }
    })

    const n8n = await cds.connect.to('n8n')
    const running = await n8n.start('mock-running-workflow', {
      event: 'BookCreated',
      secret: 'raw-mock-input-secret'
    }, {
      correlationId: 'corr-mock-running',
      businessKey: 'book-mock-running',
      tag: 'mock-tag'
    })
    const completing = await n8n.start('mock-complete-workflow', {
      secret: 'raw-mock-input-secret'
    })
    const failing = await n8n.start('mock-fail-workflow', {
      secret: 'raw-mock-input-secret'
    })

    const queriedRunning = await n8n.getExecution(running.executionId)
    const throughSend = await n8n.send('getExecution', {
      executionId: running.executionId
    })
    const cancelled = await n8n.cancel(running.executionId)
    const completed = await n8n.completeMockExecution(completing.executionId, {
      ok: true,
      inputs: {
        secret: 'raw-mock-result-secret'
      }
    })
    const failed = await n8n.failMockExecution(failing.executionId, {
      message: 'mock failed',
      requestBody: 'raw-mock-error-secret',
      stack: 'stack should not leak'
    })
    const terminalCancel = await n8n.send('cancel', {
      executionId: completed.executionId
    })
    const firstPage = await n8n.queryExecutions({}, {
      limit: 2,
      offset: 0
    })
    const secondPage = await n8n.queryExecutions({}, {
      limit: 2,
      offset: 2
    })
    const missing = await n8n.getExecution(missingExecutionId)

    expect(running).toMatchObject({
      accepted: true,
      workflowId: 'mock-running-workflow',
      executionId: 'mock-exec-1',
      status: 'running',
      correlationId: 'corr-mock-running',
      businessKey: 'book-mock-running',
      tag: 'mock-tag',
      mock: true
    })
    expect(queriedRunning).toMatchObject({
      executionId: running.executionId,
      workflowId: 'mock-running-workflow',
      status: 'running',
      correlationId: 'corr-mock-running'
    })
    expect(throughSend).toEqual(queriedRunning)
    expect(cancelled).toMatchObject({
      executionId: running.executionId,
      status: 'cancelled',
      cancelled: true
    })
    expect(completed).toMatchObject({
      executionId: completing.executionId,
      status: 'succeeded',
      result: {
        ok: true
      }
    })
    expect(failed).toMatchObject({
      executionId: failing.executionId,
      status: 'failed',
      error: {
        message: 'mock failed'
      }
    })
    expect(terminalCancel).toMatchObject({
      executionId: completed.executionId,
      status: 'succeeded',
      noOp: true
    })
    expect(firstPage.items).toHaveLength(2)
    expect(firstPage.pageInfo).toEqual({
      limit: 2,
      offset: 0,
      nextOffset: 2,
      hasMore: true
    })
    expect(secondPage.items).toHaveLength(1)
    expect(secondPage.pageInfo).toEqual({
      limit: 2,
      offset: 2,
      nextOffset: undefined,
      hasMore: false
    })
    expect(missing).toMatchObject({
      executionId: missingExecutionId,
      notFound: true
    })

    for (const publicValue of [
      running,
      queriedRunning,
      cancelled,
      completed,
      failed,
      terminalCancel,
      firstPage,
      secondPage
    ]) {
      expectPublicDtoIsSanitized(publicValue)
    }

    expect(n8n.executions[0]).toMatchObject({
      executionId: running.executionId,
      inputs: {
        secret: 'raw-mock-input-secret'
      }
    })
  })
})
