import { afterEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pluginModel = path.join(repoRoot, 'cap-n8n-plugin', 'index.cds')
const pluginLifecycle = path.join(repoRoot, 'cap-n8n-plugin', 'cds-plugin.js')
const serviceName = 'test.annotations.AnnotationStartService'
const executionEntity = 'cap.n8n.WorkflowExecutions'
const dispatchEntity = 'cap.n8n.WorkflowDispatches'
const originalN8nConfig = cds.env.requires?.n8n
const forbiddenPublicFragments = [
  'raw-annotation-secret',
  'annotation-test-api-key',
  'request-body-secret',
  'stack trace should not be exposed'
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

function annotationsModel(annotations = '') {
  return `
    namespace test.annotations;

    entity SourceBooks {
      key ID : Integer;
      title : String;
      stock : Integer;
      archived : Boolean default false;
    }

    service AnnotationStartService {
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

async function selectAll(entity, where) {
  const query = SELECT.from(entity)
  return db.run(where ? query.where(where) : query)
}

async function selectOne(entity, where) {
  return db.run(SELECT.one.from(entity).where(where))
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

    res.statusCode = response.statusCode ?? 200
    res.setHeader('content-type', response.contentType ?? 'application/json')
    res.end(response.body ?? JSON.stringify({
      received: true,
      executionId: `n8n-annotation-${requests.length}`
    }))
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

function startAnnotation({
  workflowId = 'annotation-start',
  on = "['CREATE']",
  inputs,
  condition,
  businessKey = 'ID',
  tag = 'annotation-start'
} = {}) {
  const inputBlock = inputs
    ? `inputs: ${inputs},`
    : ''
  const conditionBlock = condition
    ? `if: '${condition}',`
    : ''

  return `
    annotate AnnotationStartService.Books with @n8n.workflow.start: {
      workflowId: '${workflowId}',
      on: ${on},
      ${inputBlock}
      ${conditionBlock}
      businessKey: '${businessKey}',
      tag: '${tag}'
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

function expectEventMetadata(body, eventName, keys) {
  expect(body.event).toMatchObject({
    name: eventName,
    entity: `${serviceName}.Books`,
    service: serviceName,
    keys
  })
  expect(body.event.timestamp).toEqual(expect.any(String))
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
  await resetN8nService()
  resetServedServices()
  await disconnectDb()
})

describe('n8n annotation start integration', () => {
  it('queues annotated CREATE after the CAP write and dispatches only after commit', async () => {
    const server = await createWebhookServer(() => undefined)

    try {
      configureN8n(server.baseUrl)
      const srv = await serveAnnotatedService(startAnnotation({
        workflowId: 'annotation-create',
        inputs: `{
          bookId: 'ID',
          title: 'title'
        }`
      }))
      let requestsBeforeCommit

      srv.before('CREATE', srv.entities.Books, (req) => {
        req.before('commit', () => {
          requestsBeforeCommit = server.requests.length
        })
      })

      await srv.run(INSERT.into(srv.entities.Books).entries({
        ID: 101,
        title: 'CAP with n8n',
        stock: 7,
        archived: false
      }))

      expect(requestsBeforeCommit).toBe(0)
      expect(server.requests).toHaveLength(1)
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        url: '/webhook/annotation-create',
        body: {
          bookId: 101,
          title: 'CAP with n8n'
        }
      })
      expectEventMetadata(server.requests[0].body, 'CREATE', { ID: 101 })

      const execution = await selectOne(executionEntity, { workflowId: 'annotation-create' })
      const dispatch = await selectOne(dispatchEntity, { workflowId: 'annotation-create' })
      expect(execution).toMatchObject({
        workflowId: 'annotation-create',
        businessKey: '101',
        tag: 'annotation-start',
        status: 'succeeded',
        attempts: 1
      })
      expect(dispatch).toMatchObject({
        workflowId: 'annotation-create',
        status: 'succeeded',
        attempts: 1
      })
    } finally {
      await server.close()
    }
  })

  it('sends mapped UPDATE inputs from current row data and event keys', async () => {
    const server = await createWebhookServer(() => undefined)

    try {
      configureN8n(server.baseUrl)
      const srv = await serveAnnotatedService(startAnnotation({
        workflowId: 'annotation-update',
        on: "['UPDATE']",
        inputs: `{
          bookId: 'ID',
          title: 'title'
        }`
      }))

      await db.run(INSERT.into('test.annotations.SourceBooks').entries({
        ID: 102,
        title: 'Updated from db',
        stock: 1,
        archived: false
      }))
      await srv.run(UPDATE(srv.entities.Books, 102).with({ stock: 4 }))

      expect(server.requests).toHaveLength(1)
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        url: '/webhook/annotation-update',
        body: {
          bookId: 102,
          title: 'Updated from db'
        }
      })
      expectEventMetadata(server.requests[0].body, 'UPDATE', { ID: 102 })
      expect(server.requests[0].body).not.toHaveProperty('stock')
    } finally {
      await server.close()
    }
  })

  it('sends DELETE keys plus metadata without non-key row fields when inputs are omitted', async () => {
    const server = await createWebhookServer(() => undefined)

    try {
      configureN8n(server.baseUrl)
      const srv = await serveAnnotatedService(startAnnotation({
        workflowId: 'annotation-delete',
        on: "['DELETE']"
      }))

      await db.run(INSERT.into('test.annotations.SourceBooks').entries({
        ID: 103,
        title: 'Deleted title must not leak',
        stock: 9,
        archived: false
      }))
      await srv.run(DELETE.from(srv.entities.Books, 103))

      expect(server.requests).toHaveLength(1)
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        url: '/webhook/annotation-delete',
        body: {
          ID: 103
        }
      })
      expectEventMetadata(server.requests[0].body, 'DELETE', { ID: 103 })
      expect(server.requests[0].body).not.toHaveProperty('title')
      expect(server.requests[0].body).not.toHaveProperty('stock')
      expect(server.requests[0].body).not.toHaveProperty('archived')
    } finally {
      await server.close()
    }
  })

  it('honors true and false start conditions without creating skipped execution rows', async () => {
    const server = await createWebhookServer(() => undefined)

    try {
      configureN8n(server.baseUrl)
      const srv = await serveAnnotatedService(startAnnotation({
        workflowId: 'annotation-condition',
        condition: 'stock > 0 and archived = false'
      }))

      await srv.run(INSERT.into(srv.entities.Books).entries({
        ID: 104,
        title: 'Should start',
        stock: 5,
        archived: false
      }))
      await srv.run(INSERT.into(srv.entities.Books).entries({
        ID: 105,
        title: 'Should skip',
        stock: 0,
        archived: false
      }))

      expect(server.requests).toHaveLength(1)
      expect(server.requests[0].body).toMatchObject({
        ID: 104
      })
      expectEventMetadata(server.requests[0].body, 'CREATE', { ID: 104 })

      const executions = await selectAll(executionEntity, { workflowId: 'annotation-condition' })
      const dispatches = await selectAll(dispatchEntity, { workflowId: 'annotation-condition' })
      expect(executions).toHaveLength(1)
      expect(dispatches).toHaveLength(1)
    } finally {
      await server.close()
    }
  })

  it('rejects invalid mapped fields and invalid conditions while services are registered', async () => {
    configureN8n('http://127.0.0.1:1')

    await expect(serveAnnotatedService(startAnnotation({
      workflowId: 'annotation-invalid-input',
      inputs: `{
        title: 'missingField'
      }`
    }))).rejects.toMatchObject(expectAnnotationError())

    await disconnectDb()
    resetServedServices()

    await expect(serveAnnotatedService(startAnnotation({
      workflowId: 'annotation-invalid-condition',
      condition: "substring(title, 1, 2) = 'CA'"
    }))).rejects.toMatchObject(expectAnnotationError())
  })

  it('keeps CREATE UPDATE and DELETE writes committed when n8n side effects fail', async () => {
    const server = await createWebhookServer(() => ({
      statusCode: 503,
      body: JSON.stringify({
        error: 'temporary failure',
        apiKey: 'annotation-test-api-key',
        requestBody: 'request-body-secret',
        stack: 'stack trace should not be exposed'
      })
    }))

    try {
      configureN8n(server.baseUrl, {
        credentials: {
          apiKey: 'annotation-test-api-key'
        },
        retries: 1,
        retryDelayMs: 5
      })
      const srv = await serveAnnotatedService(startAnnotation({
        workflowId: 'annotation-failed-dispatch',
        on: "['CREATE', 'UPDATE', 'DELETE']",
        inputs: `{
          bookId: 'ID'
        }`
      }))

      await expect(srv.run(INSERT.into(srv.entities.Books).entries({
        ID: 106,
        title: 'Failure should not roll back create',
        stock: 2,
        archived: false
      }))).resolves.toBeDefined()
      await expect(srv.run(UPDATE(srv.entities.Books, 106).with({ stock: 3 }))).resolves.toBeDefined()
      await expect(srv.run(DELETE.from(srv.entities.Books, 106))).resolves.toBeDefined()

      expect(server.requests).toHaveLength(3)
      expect(await selectOne('test.annotations.SourceBooks', { ID: 106 })).toBeUndefined()

      const n8n = await cds.connect.to('n8n')
      const result = await n8n.queryExecutions({
        workflowId: 'annotation-failed-dispatch'
      })

      expect(result.items).toHaveLength(3)
      for (const item of result.items) {
        expect(item).toMatchObject({
          workflowId: 'annotation-failed-dispatch',
          status: 'failed',
          attempts: 1,
          error: {
            source: 'n8n',
            statusCode: 503,
            retryable: true,
            code: 'ERR_N8N_RETRYABLE_STATUS',
            message: 'n8n webhook request failed with status 503.'
          }
        })
        expectPublicDtoIsSanitized(item)
      }
    } finally {
      await server.close()
    }
  })
})
