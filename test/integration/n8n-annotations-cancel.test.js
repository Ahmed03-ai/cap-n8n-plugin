import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pluginModel = path.join(repoRoot, 'cap-n8n-plugin', 'index.cds')
const pluginLifecycle = path.join(repoRoot, 'cap-n8n-plugin', 'cds-plugin.js')
const serviceName = 'test.annotations.AnnotationCancelService'
const sourceEntity = 'test.annotations.SourceBooks'
const originalN8nConfig = cds.env.requires?.n8n
const forbiddenPublicFragments = [
  'raw-cancel-input-secret',
  'annotation-cancel-api-key',
  'request-body-secret',
  'stack trace should not be exposed',
  'payload',
  'inputs',
  'headers',
  'requestBody',
  'stack'
]

let db

function cancellationResolver() {
  return require('../../cap-n8n-plugin/lib/annotations/CancellationResolver.js')
}

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

function annotationsModel(annotations = '') {
  return `
    namespace test.annotations;

    entity SourceBooks {
      key ID : Integer;
      title : String;
      stock : Integer;
      archived : Boolean default false;
    }

    service AnnotationCancelService {
      entity Books as projection on SourceBooks;
    }

    ${annotations}
  `
}

async function loadModel(annotations) {
  const executionCsn = await cds.load(pluginModel)
  const appCsn = cds.compile.to.csn(annotationsModel(annotations))

  return {
    ...executionCsn,
    $sources: [
      ...(executionCsn.$sources || []),
      ...(appCsn.$sources || [])
    ],
    definitions: {
      ...executionCsn.definitions,
      ...appCsn.definitions
    }
  }
}

function ensurePluginLifecycle() {
  require(pluginLifecycle)
}

ensurePluginLifecycle()

async function serveAnnotatedService(annotations) {
  const csn = await loadModel(annotations)
  db = await cds.deploy(csn).to('sqlite::memory:')
  const srv = await cds.serve(serviceName).from(csn)

  ensurePluginLifecycle()
  await cds.emit('served', cds.services)

  return srv
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

function resetServedServices() {
  for (const name of Object.keys(cds.services)) {
    if (name === serviceName || name.startsWith('test.annotations.')) {
      delete cds.services[name]
    }
  }

  if (Array.isArray(cds.service?.providers)) {
    cds.service.providers = cds.service.providers.filter((srv) => srv.name !== serviceName)
  }
}

async function disconnectDb() {
  if (!db) return

  await cds.disconnect(db)
  db = undefined
}

async function insertBook(id, data = {}) {
  await db.run(INSERT.into(sourceEntity).entries({
    ID: id,
    title: data.title || `Book ${id}`,
    stock: data.stock ?? 1,
    archived: data.archived ?? false
  }))
}

async function seedActiveExecution(n8n, data = {}) {
  const execution = await n8n.store.createQueued({
    executionId: data.executionId,
    workflowId: data.workflowId,
    n8nExecutionId: data.n8nExecutionId,
    correlationId: data.correlationId,
    businessKey: data.businessKey,
    tag: data.tag,
    inputs: {
      event: 'AnnotationCancelSeeded',
      secret: 'raw-cancel-input-secret'
    },
    dispatch: {
      workflowPath: `webhook/${data.workflowId || 'annotation-cancel'}`,
      payload: {
        event: 'AnnotationCancelSeeded',
        secret: 'raw-cancel-input-secret'
      }
    }
  })

  if (data.status === 'dispatching') {
    await n8n.store.markDispatching(execution.executionId)
  } else if (data.status === 'running') {
    await n8n.store.markRunning(execution.executionId, {
      n8nExecutionId: data.n8nExecutionId
    })
  } else if (data.status === 'cancel_requested') {
    await n8n.store.requestCancel(execution.executionId, {
      result: {
        noOp: true,
        unsupported: true,
        reason: 'Seeded cancel_requested execution.'
      }
    })
  }

  return n8n.getExecution(execution.executionId)
}

function cancelAnnotation({
  workflowId = 'annotation-cancel',
  on,
  businessKey = 'ID',
  tag = 'admin-books'
} = {}) {
  const onBlock = on === undefined ? '' : `on: ${on},`
  const businessKeyBlock = businessKey === undefined ? '' : `businessKey: '${businessKey}',`
  const tagBlock = tag === undefined ? '' : `tag: '${tag}',`

  return `
    annotate AnnotationCancelService.Books with @n8n.workflow.cancel: {
      workflowId: '${workflowId}',
      ${onBlock}
      ${businessKeyBlock}
      ${tagBlock}
    };
  `
}

function expectAnnotationError() {
  return expect.objectContaining({
    code: 'ERR_N8N_ANNOTATION',
    source: 'n8n',
    statusCode: 500
  })
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

afterEach(async () => {
  vi.restoreAllMocks()
  await resetN8nService()
  resetServedServices()
  await disconnectDb()
})

describe('declarative cancellation resolver matching', () => {
  it('deduplicates matching active executions before cancel calls', async () => {
    const { cancelMatchingExecutions } = cancellationResolver()
    const queryExecutions = vi.fn(async (filters, page) => {
      expect(filters).toMatchObject({
        workflowId: 'resolver-dedupe',
        businessKey: 'book-301',
        tag: 'admin-books'
      })
      expect(page).toMatchObject({
        limit: 100,
        offset: 0
      })

      const byStatus = {
        queued: [
          { executionId: 'exec-queued' },
          { executionId: 'exec-shared' }
        ],
        running: [
          { executionId: 'exec-shared' },
          { executionId: 'exec-running' }
        ],
        cancel_requested: [
          { executionId: 'exec-running' }
        ]
      }

      return {
        items: byStatus[filters.status] || [],
        pageInfo: {
          limit: 100,
          offset: 0,
          hasMore: false
        }
      }
    })
    const cancel = vi.fn(async (executionId) => ({
      executionId,
      status: executionId === 'exec-queued' ? 'cancelled' : 'cancel_requested'
    }))

    const result = await cancelMatchingExecutions({
      queryExecutions,
      cancel
    }, {
      workflowId: 'resolver-dedupe',
      businessKey: 'book-301',
      tag: 'admin-books'
    })

    expect(cancel).toHaveBeenCalledTimes(3)
    expect(cancel.mock.calls.map(([executionId]) => executionId)).toEqual([
      'exec-queued',
      'exec-shared',
      'exec-running'
    ])
    expect(result).toMatchObject({
      workflowId: 'resolver-dedupe',
      matchedCount: 3,
      cancelledCount: 3,
      noMatch: false
    })
    expectPublicDtoIsSanitized(result)
  })

  it('returns no-op metadata when no active executions match', async () => {
    const { cancelMatchingExecutions } = cancellationResolver()
    const result = await cancelMatchingExecutions({
      queryExecutions: async () => ({
        items: [],
        pageInfo: {
          limit: 100,
          offset: 0,
          hasMore: false
        }
      }),
      cancel: vi.fn()
    }, {
      workflowId: 'resolver-no-match',
      businessKey: 'book-302'
    })

    expect(result).toMatchObject({
      workflowId: 'resolver-no-match',
      matchedCount: 0,
      cancelledCount: 0,
      noMatch: true
    })
    expectPublicDtoIsSanitized(result)
  })
})

describe('n8n annotation cancellation integration', () => {
  it('cancels matching active executions on DELETE when cancel on is omitted', async () => {
    configureN8n('http://127.0.0.1:1')
    const srv = await serveAnnotatedService(cancelAnnotation({
      workflowId: 'annotation-cancel-delete'
    }))
    const n8n = await cds.connect.to('n8n')

    await insertBook(201)
    const matching = await seedActiveExecution(n8n, {
      executionId: testUuid(201),
      workflowId: 'annotation-cancel-delete',
      businessKey: '201',
      tag: 'admin-books',
      status: 'queued'
    })
    const wrongTag = await seedActiveExecution(n8n, {
      executionId: testUuid(202),
      workflowId: 'annotation-cancel-delete',
      businessKey: '201',
      tag: 'manual',
      status: 'queued'
    })

    await expect(srv.run(DELETE.from(srv.entities.Books, 201))).resolves.toBeDefined()

    const cancelled = await n8n.getExecution(matching.executionId)
    const notMatched = await n8n.getExecution(wrongTag.executionId)
    const queryResult = await n8n.queryExecutions({
      workflowId: 'annotation-cancel-delete'
    })

    expect(cancelled).toMatchObject({
      executionId: matching.executionId,
      workflowId: 'annotation-cancel-delete',
      status: 'cancelled',
      result: {
        cancelled: true
      }
    })
    expect(notMatched).toMatchObject({
      executionId: wrongTag.executionId,
      status: 'queued'
    })
    expect(queryResult.items.map((item) => item.executionId)).toContain(matching.executionId)
    expect(await db.run(SELECT.one.from(sourceEntity).where({ ID: 201 }))).toBeUndefined()
    expectPublicDtoIsSanitized(cancelled)
    expectPublicDtoIsSanitized(queryResult)
  })

  it('cancels all matching queued running and cancel-requested executions', async () => {
    configureN8n('http://127.0.0.1:1')
    const srv = await serveAnnotatedService(cancelAnnotation({
      workflowId: 'annotation-cancel-many'
    }))
    const n8n = await cds.connect.to('n8n')

    await insertBook(202)
    const queued = await seedActiveExecution(n8n, {
      executionId: testUuid(211),
      workflowId: 'annotation-cancel-many',
      businessKey: '202',
      tag: 'admin-books',
      status: 'queued'
    })
    const running = await seedActiveExecution(n8n, {
      executionId: testUuid(212),
      workflowId: 'annotation-cancel-many',
      businessKey: '202',
      tag: 'admin-books',
      status: 'running'
    })
    const requested = await seedActiveExecution(n8n, {
      executionId: testUuid(213),
      workflowId: 'annotation-cancel-many',
      businessKey: '202',
      tag: 'admin-books',
      status: 'cancel_requested'
    })

    await srv.run(DELETE.from(srv.entities.Books, 202))

    const cancelledQueued = await n8n.getExecution(queued.executionId)
    const cancelledRunning = await n8n.getExecution(running.executionId)
    const repeatedRequest = await n8n.getExecution(requested.executionId)

    expect(cancelledQueued).toMatchObject({
      status: 'cancelled',
      result: {
        cancelled: true
      }
    })
    expect(cancelledRunning).toMatchObject({
      status: 'cancel_requested',
      result: {
        noOp: true,
        unsupported: true
      }
    })
    expect(repeatedRequest).toMatchObject({
      status: 'cancel_requested',
      result: {
        noOp: true
      }
    })

    for (const result of [cancelledQueued, cancelledRunning, repeatedRequest]) {
      expectPublicDtoIsSanitized(result)
    }
  })

  it('warns without rolling back DELETE when no active execution matches', async () => {
    configureN8n('http://127.0.0.1:1')
    const logger = cds.log('n8n')
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const srv = await serveAnnotatedService(cancelAnnotation({
      workflowId: 'annotation-cancel-no-match'
    }))
    const n8n = await cds.connect.to('n8n')

    await insertBook(203)

    await expect(srv.run(DELETE.from(srv.entities.Books, 203))).resolves.toBeDefined()

    expect(await db.run(SELECT.one.from(sourceEntity).where({ ID: 203 }))).toBeUndefined()
    await expect(n8n.queryExecutions({
      workflowId: 'annotation-cancel-no-match'
    })).resolves.toMatchObject({
      items: []
    })
    expect(warn).toHaveBeenCalledWith('No active n8n executions matched annotated cancellation', expect.objectContaining({
      workflowId: 'annotation-cancel-no-match',
      event: 'DELETE',
      entity: `${serviceName}.Books`,
      service: serviceName,
      businessKey: '203',
      tag: 'admin-books'
    }))
  })

  it('logs cancellation failures without rolling back the CAP write or leaking raw details', async () => {
    configureN8n('http://127.0.0.1:1', {
      credentials: {
        apiKey: 'annotation-cancel-api-key'
      }
    })
    const logger = cds.log('n8n')
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const srv = await serveAnnotatedService(cancelAnnotation({
      workflowId: 'annotation-cancel-failure'
    }))
    const n8n = await cds.connect.to('n8n')

    await insertBook(204)
    const active = await seedActiveExecution(n8n, {
      executionId: testUuid(214),
      workflowId: 'annotation-cancel-failure',
      businessKey: '204',
      tag: 'admin-books',
      status: 'queued'
    })
    n8n.cancel = async () => {
      const err = new Error('cancel failed')
      err.code = 'ERR_N8N_CANCEL_TEST'
      err.details = {
        apiKey: 'annotation-cancel-api-key',
        requestBody: 'request-body-secret',
        stack: 'stack trace should not be exposed'
      }
      throw err
    }

    await expect(srv.run(DELETE.from(srv.entities.Books, 204))).resolves.toBeDefined()

    const stored = await n8n.getExecution(active.executionId)
    const serializedLogs = JSON.stringify(error.mock.calls)

    expect(await db.run(SELECT.one.from(sourceEntity).where({ ID: 204 }))).toBeUndefined()
    expect(stored).toMatchObject({
      executionId: active.executionId,
      status: 'queued'
    })
    expect(error).toHaveBeenCalledWith('Annotated n8n workflow cancellation failed', expect.objectContaining({
      workflowId: 'annotation-cancel-failure',
      event: 'DELETE',
      entity: `${serviceName}.Books`,
      service: serviceName,
      businessKey: '204',
      tag: 'admin-books',
      reason: 'cancel failed',
      code: 'ERR_N8N_CANCEL_TEST'
    }))
    for (const fragment of forbiddenPublicFragments) {
      expect(serializedLogs).not.toContain(fragment)
    }
    expectPublicDtoIsSanitized(stored)
  })

  it('runs explicit UPDATE cancellation only on UPDATE and not CREATE or DELETE', async () => {
    configureN8n('http://127.0.0.1:1')
    const srv = await serveAnnotatedService(cancelAnnotation({
      workflowId: 'annotation-cancel-update',
      on: "['UPDATE']"
    }))
    const n8n = await cds.connect.to('n8n')

    const createMatch = await seedActiveExecution(n8n, {
      executionId: testUuid(221),
      workflowId: 'annotation-cancel-update',
      businessKey: '205',
      tag: 'admin-books',
      status: 'queued'
    })
    await srv.run(INSERT.into(srv.entities.Books).entries({
      ID: 205,
      title: 'Create should not cancel',
      stock: 1,
      archived: false
    }))
    expect(await n8n.getExecution(createMatch.executionId)).toMatchObject({
      status: 'queued'
    })

    const deleteMatch = await seedActiveExecution(n8n, {
      executionId: testUuid(222),
      workflowId: 'annotation-cancel-update',
      businessKey: '206',
      tag: 'admin-books',
      status: 'queued'
    })
    await insertBook(206)
    await srv.run(DELETE.from(srv.entities.Books, 206))
    expect(await n8n.getExecution(deleteMatch.executionId)).toMatchObject({
      status: 'queued'
    })

    await srv.run(UPDATE(srv.entities.Books, 205).with({ stock: 2 }))
    expect(await n8n.getExecution(createMatch.executionId)).toMatchObject({
      status: 'cancelled',
      result: {
        cancelled: true
      }
    })
  })

  it('rejects cancel annotations that cannot resolve business key or tag match metadata', async () => {
    configureN8n('http://127.0.0.1:1')

    await expect(serveAnnotatedService(cancelAnnotation({
      workflowId: 'annotation-cancel-invalid',
      businessKey: undefined,
      tag: undefined
    }))).rejects.toMatchObject(expectAnnotationError())
  })
})
