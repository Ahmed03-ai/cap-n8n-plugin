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
const forbiddenPublicFragments = [
  'raw-dispatch-input-secret',
  'raw-retry-input-secret',
  'test-secret-api-key',
  'stack trace should not be exposed',
  'request-body-secret'
]

let db

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

async function deployExecutionModel() {
  const csn = await cds.load(pluginModel)
  db = await cds.deploy(csn).to('sqlite::memory:')
}

async function disconnectDb() {
  if (!db) return

  await cds.disconnect(db)
  db = undefined
}

async function selectOne(entity, where) {
  return db.run(SELECT.one.from(entity).where(where))
}

async function selectAll(entity, where) {
  return db.run(SELECT.from(entity).where(where))
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

function expectUuid(value) {
  expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
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

describe('n8n tracked dispatch integration', () => {
  it('queues a local execution inside a CAP transaction and dispatches only after commit', async () => {
    const server = await createWebhookServer(() => ({
      body: JSON.stringify({
        received: true,
        executionId: 'n8n-after-commit'
      })
    }))

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')
      let result

      await cds.tx(async () => {
        const req = cds.context
        result = await n8n.start('commit-workflow', {
          event: 'BookCreated',
          secret: 'raw-dispatch-input-secret'
        }, {
          correlationId: 'corr-commit-1',
          businessKey: 'book-commit-1',
          tag: 'admin-create',
          _req: req
        })

        expect(server.requests).toHaveLength(0)
        expect(result).toMatchObject({
          accepted: true,
          workflowId: 'commit-workflow',
          correlationId: 'corr-commit-1',
          businessKey: 'book-commit-1',
          tag: 'admin-create',
          status: 'queued'
        })
        expectUuid(result.executionId)

        const queued = await n8n.store.forRequest(req).getExecution(result.executionId)
        expect(queued).toMatchObject({
          executionId: result.executionId,
          workflowId: 'commit-workflow',
          status: 'queued',
          attempts: 0
        })
      })

      expect(server.requests).toHaveLength(1)
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        url: '/webhook/commit-workflow',
        body: {
          event: 'BookCreated',
          secret: 'raw-dispatch-input-secret'
        }
      })

      expect(result).toMatchObject({
        executionId: result.executionId,
        n8nExecutionId: 'n8n-after-commit',
        status: 'succeeded',
        result: {
          received: true,
          executionId: 'n8n-after-commit'
        }
      })

      const stored = await n8n.store.getExecution(result.executionId)
      expect(stored).toMatchObject({
        executionId: result.executionId,
        n8nExecutionId: 'n8n-after-commit',
        workflowId: 'commit-workflow',
        status: 'succeeded',
        attempts: 1
      })
      expect(stored.startedAt).toEqual(expect.any(String))
      expect(stored.finishedAt).toEqual(expect.any(String))
      expectPublicDtoIsSanitized(stored)
    } finally {
      await server.close()
    }
  })

  it('does not dispatch a queued workflow when the CAP transaction rolls back', async () => {
    const server = await createWebhookServer(() => ({
      body: JSON.stringify({ received: true })
    }))

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')

      await expect(cds.tx(async () => {
        await n8n.start('rollback-workflow', {
          event: 'BookCreated'
        }, {
          correlationId: 'corr-rollback-1',
          _req: cds.context
        })

        expect(server.requests).toHaveLength(0)
        throw new Error('force rollback after queued start')
      })).rejects.toThrow('force rollback')

      expect(server.requests).toHaveLength(0)

      const executions = await selectAll('cap.n8n.WorkflowExecutions', {
        workflowId: 'rollback-workflow'
      })
      const dispatches = await selectAll('cap.n8n.WorkflowDispatches', {
        workflowId: 'rollback-workflow'
      })

      expect(executions).toHaveLength(0)
      expect(dispatches).toHaveLength(0)
    } finally {
      await server.close()
    }
  })

  it('returns local execution IDs and stores n8n execution IDs separately for standalone starts', async () => {
    const server = await createWebhookServer(() => ({
      body: JSON.stringify({
        received: true,
        executionId: 'n8n-standalone-1'
      })
    }))

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')
      const result = await n8n.start('standalone-workflow', {
        event: 'StandaloneStart',
        secret: 'raw-dispatch-input-secret'
      }, {
        correlationId: 'corr-standalone-1',
        businessKey: 'book-standalone-1',
        tag: 'manual'
      })

      expect(server.requests).toHaveLength(1)
      expectUuid(result.executionId)
      expect(result.executionId).not.toBe('n8n-standalone-1')
      expect(result).toMatchObject({
        accepted: true,
        workflowId: 'standalone-workflow',
        n8nExecutionId: 'n8n-standalone-1',
        correlationId: 'corr-standalone-1',
        businessKey: 'book-standalone-1',
        tag: 'manual',
        status: 'succeeded',
        result: {
          received: true,
          executionId: 'n8n-standalone-1'
        }
      })

      const stored = await n8n.store.getExecution(result.executionId)
      const dispatch = await selectOne('cap.n8n.WorkflowDispatches', {
        executionId: result.executionId
      })

      expect(stored).toMatchObject({
        executionId: result.executionId,
        n8nExecutionId: 'n8n-standalone-1',
        status: 'succeeded',
        attempts: 1
      })
      expect(dispatch.payload).toContain('raw-dispatch-input-secret')
      expectPublicDtoIsSanitized(stored)
    } finally {
      await server.close()
    }
  })

  it('persists sanitized failed dispatch state and attempt counts', async () => {
    const secretApiKey = 'test-secret-api-key'
    const server = await createWebhookServer(() => ({
      statusCode: 503,
      body: JSON.stringify({
        error: 'temporary failure',
        apiKey: secretApiKey,
        stack: 'stack trace should not be exposed',
        requestBody: 'request-body-secret'
      })
    }))

    try {
      configureN8n(server.baseUrl, {
        credentials: {
          apiKey: secretApiKey
        },
        retries: 2,
        retryDelayMs: 5
      })

      const n8n = await cds.connect.to('n8n')

      await expect(n8n.start('failing-workflow', {
        event: 'Failure',
        secret: 'raw-dispatch-input-secret'
      }, {
        correlationId: 'corr-failure-1'
      })).rejects.toMatchObject({
        source: 'n8n',
        statusCode: 503,
        retryable: true
      })

      expect(server.requests).toHaveLength(2)

      const row = await selectOne('cap.n8n.WorkflowExecutions', {
        workflowId: 'failing-workflow'
      })
      const stored = await n8n.store.getExecution(row.executionId)

      expect(stored).toMatchObject({
        executionId: row.executionId,
        workflowId: 'failing-workflow',
        status: 'failed',
        attempts: 2,
        correlationId: 'corr-failure-1'
      })
      expect(stored.error).toMatchObject({
        source: 'n8n',
        statusCode: 503,
        retryable: true,
        code: 'ERR_N8N_RETRYABLE_STATUS',
        message: 'n8n webhook request failed with status 503.'
      })
      expect(stored.error.details.response).toEqual({ error: 'temporary failure' })
      expectPublicDtoIsSanitized(stored)
    } finally {
      await server.close()
    }
  })

  it('retries from the durable internal outbox payload through dispatchPending', async () => {
    const server = await createWebhookServer((request, count) => {
      if (count <= 2) {
        return {
          statusCode: 503,
          body: JSON.stringify({ error: 'temporary failure' })
        }
      }

      return {
        body: JSON.stringify({
          received: true,
          executionId: 'n8n-after-pending-retry'
        })
      }
    })

    try {
      configureN8n(server.baseUrl, {
        retries: 2,
        retryDelayMs: 5
      })

      const n8n = await cds.connect.to('n8n')

      await expect(n8n.start('retry-from-outbox', {
        event: 'Retry',
        secret: 'raw-retry-input-secret'
      }, {
        correlationId: 'corr-retry-outbox-1'
      })).rejects.toMatchObject({
        source: 'n8n',
        statusCode: 503
      })

      const failed = await selectOne('cap.n8n.WorkflowExecutions', {
        workflowId: 'retry-from-outbox'
      })
      expect(failed).toMatchObject({
        status: 'failed',
        attempts: 2
      })

      const retried = await n8n.dispatchPending({
        executionId: failed.executionId
      })

      expect(server.requests).toHaveLength(3)
      expect(server.requests[2]).toMatchObject({
        method: 'POST',
        url: '/webhook/retry-from-outbox',
        body: {
          event: 'Retry',
          secret: 'raw-retry-input-secret'
        }
      })
      expect(retried).toMatchObject({
        executionId: failed.executionId,
        n8nExecutionId: 'n8n-after-pending-retry',
        status: 'succeeded',
        attempts: 3,
        result: {
          received: true,
          executionId: 'n8n-after-pending-retry'
        }
      })

      const stored = await n8n.store.getExecution(failed.executionId)
      expectPublicDtoIsSanitized(stored)
    } finally {
      await server.close()
    }
  })

  it('warns about active duplicate starts by default while preserving dispatch', async () => {
    const server = await createWebhookServer(() => ({
      body: JSON.stringify({
        received: true,
        executionId: 'n8n-duplicate-warn'
      })
    }))

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')
      const active = await n8n.store.createQueued({
        workflowId: 'duplicate-warn-workflow',
        correlationId: 'corr-duplicate-warn',
        businessKey: 'book-duplicate-warn',
        tag: 'admin-create'
      })
      await n8n.store.markRunning(active.executionId)

      const result = await n8n.start('duplicate-warn-workflow', {
        event: 'DuplicateWarned',
        secret: 'raw-dispatch-input-secret'
      }, {
        correlationId: 'corr-duplicate-warn',
        businessKey: 'book-duplicate-warn',
        tag: 'admin-create'
      })

      expect(server.requests).toHaveLength(1)
      expect(result.executionId).not.toBe(active.executionId)
      expect(result).toMatchObject({
        accepted: true,
        workflowId: 'duplicate-warn-workflow',
        status: 'succeeded',
        duplicate: {
          policy: 'warn',
          activeExecutionIds: [active.executionId],
          ambiguous: false
        }
      })
      expectPublicDtoIsSanitized(result)

      const executions = await selectAll('cap.n8n.WorkflowExecutions', {
        workflowId: 'duplicate-warn-workflow'
      })
      expect(executions).toHaveLength(2)
    } finally {
      await server.close()
    }
  })
})
