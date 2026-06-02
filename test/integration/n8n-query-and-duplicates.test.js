import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')
const { UPDATE } = cds.ql

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pluginModel = path.join(repoRoot, 'cap-n8n-plugin', 'index.cds')
const originalN8nConfig = cds.env.requires?.n8n
const missingExecutionId = '00000000-0000-4000-8000-000000000999'
const rawDuplicateSecret = 'raw-duplicate-input-secret'
const forbiddenPublicFragments = [
  rawDuplicateSecret,
  'raw-query-input-secret',
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
    correlationId: data.correlationId,
    businessKey: data.businessKey,
    tag: data.tag
  })

  if (data.status && data.status !== 'queued') {
    await store.updateStatus(execution.executionId, data.status)
  }

  const patch = {}
  for (const field of ['createdAt', 'updatedAt', 'startedAt', 'finishedAt']) {
    if (data[field] !== undefined) patch[field] = data[field]
  }

  if (Object.keys(patch).length > 0) {
    await db.run(UPDATE('cap.n8n.WorkflowExecutions').set(patch).where({
      executionId: execution.executionId
    }))
  }

  return store.getExecution(execution.executionId)
}

function expectUuid(value) {
  expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
}

function expectPublicResultIsSanitized(value) {
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

describe('n8n execution query integration', () => {
  it('returns sanitized execution DTOs and meaningful not-found results', async () => {
    const server = await createWebhookServer(() => ({
      body: JSON.stringify({
        received: true,
        executionId: 'n8n-query-1'
      })
    }))

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')
      const started = await n8n.start('query-workflow', {
        event: 'QueryStarted',
        secret: 'raw-query-input-secret'
      }, {
        correlationId: 'corr-query-1',
        businessKey: 'book-query-1',
        tag: 'query-tag'
      })

      const direct = await n8n.getExecution(started.executionId)
      const throughSend = await n8n.send('getExecution', {
        executionId: started.executionId
      })
      const missing = await n8n.getExecution(missingExecutionId)

      expect(direct).toMatchObject({
        executionId: started.executionId,
        n8nExecutionId: 'n8n-query-1',
        workflowId: 'query-workflow',
        correlationId: 'corr-query-1',
        businessKey: 'book-query-1',
        tag: 'query-tag',
        status: 'succeeded'
      })
      expect(direct.result).toEqual({
        received: true,
        executionId: 'n8n-query-1'
      })
      expect(throughSend).toEqual(direct)
      expect(missing).toMatchObject({
        executionId: missingExecutionId,
        notFound: true
      })
      expectPublicResultIsSanitized(direct)
    } finally {
      await server.close()
    }
  })

  it('filters executions by executionId, workflowId, businessKey, tag, and status', async () => {
    configureN8n('http://127.0.0.1:1')

    const n8n = await cds.connect.to('n8n')
    const alpha = await seedExecution(n8n.store, {
      executionId: testUuid(1),
      workflowId: 'wf-alpha',
      businessKey: 'book-alpha',
      tag: 'admin-create',
      status: 'running'
    })
    await seedExecution(n8n.store, {
      executionId: testUuid(2),
      workflowId: 'wf-alpha',
      businessKey: 'book-beta',
      tag: 'manual',
      status: 'succeeded'
    })
    await seedExecution(n8n.store, {
      executionId: testUuid(3),
      workflowId: 'wf-beta',
      businessKey: 'book-alpha',
      tag: 'admin-create',
      status: 'failed'
    })

    await expect(n8n.queryExecutions({
      executionId: alpha.executionId
    })).resolves.toMatchObject({
      items: [{ executionId: alpha.executionId }],
      pageInfo: {
        limit: 50,
        offset: 0,
        hasMore: false
      }
    })

    await expect(n8n.queryExecutions({ workflowId: 'wf-alpha' })).resolves.toMatchObject({
      items: [
        expect.objectContaining({ workflowId: 'wf-alpha' }),
        expect.objectContaining({ workflowId: 'wf-alpha' })
      ]
    })
    await expect(n8n.queryExecutions({ businessKey: 'book-alpha' })).resolves.toMatchObject({
      items: [
        expect.objectContaining({ businessKey: 'book-alpha' }),
        expect.objectContaining({ businessKey: 'book-alpha' })
      ]
    })
    await expect(n8n.queryExecutions({ tag: 'manual' })).resolves.toMatchObject({
      items: [expect.objectContaining({ tag: 'manual' })]
    })
    await expect(n8n.queryExecutions({ status: 'failed' })).resolves.toMatchObject({
      items: [expect.objectContaining({ status: 'failed' })]
    })

    const sendResult = await n8n.send('queryExecutions', {
      filters: { status: 'running' },
      page: { limit: 10, offset: 0 }
    })
    expect(sendResult.items).toHaveLength(1)
    expect(sendResult.items[0]).toMatchObject({
      executionId: alpha.executionId,
      status: 'running'
    })

    await expect(n8n.queryExecutions({ status: 'not-valid' })).rejects.toMatchObject({
      code: 'ERR_N8N_EXECUTION_STATUS',
      statusCode: 400
    })
  })

  it('pages results and orders by updatedAt desc then createdAt desc by default', async () => {
    configureN8n('http://127.0.0.1:1')

    const n8n = await cds.connect.to('n8n')
    const olderCreated = await seedExecution(n8n.store, {
      executionId: testUuid(10),
      workflowId: 'ordered-workflow',
      createdAt: '2026-06-02T10:00:00.000Z',
      updatedAt: '2026-06-02T11:00:00.000Z'
    })
    const newestUpdated = await seedExecution(n8n.store, {
      executionId: testUuid(11),
      workflowId: 'ordered-workflow',
      createdAt: '2026-06-02T09:00:00.000Z',
      updatedAt: '2026-06-02T12:00:00.000Z'
    })
    const newestCreatedTie = await seedExecution(n8n.store, {
      executionId: testUuid(12),
      workflowId: 'ordered-workflow',
      createdAt: '2026-06-02T10:30:00.000Z',
      updatedAt: '2026-06-02T11:00:00.000Z'
    })

    const ordered = await n8n.queryExecutions({
      workflowId: 'ordered-workflow'
    }, {
      limit: 10
    })

    expect(ordered.items.map((item) => item.executionId)).toEqual([
      newestUpdated.executionId,
      newestCreatedTie.executionId,
      olderCreated.executionId
    ])

    const firstPage = await n8n.queryExecutions({
      workflowId: 'ordered-workflow'
    }, {
      limit: 2,
      offset: 0
    })
    const secondPage = await n8n.queryExecutions({
      workflowId: 'ordered-workflow'
    }, {
      limit: 2,
      offset: 2
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
  })

  it('rejects and reuses active duplicate executions without creating new starts', async () => {
    const server = await createWebhookServer(() => ({
      body: JSON.stringify({
        received: true,
        executionId: 'n8n-should-not-run'
      })
    }))

    try {
      configureN8n(server.baseUrl)

      const n8n = await cds.connect.to('n8n')
      const active = await seedExecution(n8n.store, {
        executionId: testUuid(20),
        workflowId: 'duplicate-policy-workflow',
        businessKey: 'book-duplicate',
        tag: 'admin-create',
        status: 'running'
      })

      await expect(n8n.start('duplicate-policy-workflow', {
        event: 'DuplicateRejected',
        secret: rawDuplicateSecret
      }, {
        businessKey: 'book-duplicate',
        tag: 'admin-create',
        duplicatePolicy: 'reject'
      })).rejects.toMatchObject({
        code: 'ERR_N8N_DUPLICATE_EXECUTION',
        statusCode: 409,
        details: {
          duplicate: {
            policy: 'reject',
            activeExecutionIds: [active.executionId],
            ambiguous: false
          }
        }
      })

      const reused = await n8n.start('duplicate-policy-workflow', {
        event: 'DuplicateReused',
        secret: rawDuplicateSecret
      }, {
        businessKey: 'book-duplicate',
        tag: 'admin-create',
        duplicatePolicy: 'reuseActive'
      })

      expect(server.requests).toHaveLength(0)
      expect(reused).toMatchObject({
        accepted: true,
        executionId: active.executionId,
        workflowId: 'duplicate-policy-workflow',
        status: 'running',
        duplicate: {
          policy: 'reuseActive',
          activeExecutionIds: [active.executionId],
          ambiguous: false
        }
      })
      expectPublicResultIsSanitized(reused)

      const queried = await n8n.queryExecutions({
        workflowId: 'duplicate-policy-workflow'
      })
      expect(queried.items).toHaveLength(1)
      expect(queried.items[0].executionId).toBe(active.executionId)
    } finally {
      await server.close()
    }
  })
})
