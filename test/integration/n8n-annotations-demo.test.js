import { afterEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pluginModel = path.join(repoRoot, 'cap-n8n-plugin', 'index.cds')
const pluginLifecycle = path.join(repoRoot, 'cap-n8n-plugin', 'cds-plugin.js')
const adminServiceImpl = path.join(repoRoot, 'demo-app', 'srv', 'admin-service.js')
const adminServiceSource = path.join(repoRoot, 'demo-app', 'srv', 'admin-service.js')
const demoModelRoots = [
  pluginModel,
  path.join(repoRoot, 'demo-app', 'db'),
  path.join(repoRoot, 'demo-app', 'srv'),
  path.join(repoRoot, 'demo-app', 'app')
]
const workflowId = 'webhook-test/cap-test-trigger'
const serviceName = 'AdminService'
const sourceBooks = 'sap.capire.bookshop.Books'
const sourceAuthors = 'sap.capire.bookshop.Authors'
const demoGenreId = '10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const originalModel = cds.model
const originalN8nConfig = cds.env.requires?.n8n
const forbiddenDemoTriggerPatterns = [
  /cds\.connect\.to\('n8n'\)/,
  /n8n\.send\('start'\)/,
  /n8n\.start/
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

function ensurePluginLifecycle() {
  require(pluginLifecycle)
}

ensurePluginLifecycle()

async function loadDemoModel() {
  return cds.load(demoModelRoots)
}

async function serveDemoAdminService() {
  const csn = await loadDemoModel()
  cds.model = cds.compile.for.nodejs(csn)
  db = await cds.deploy(csn).to('sqlite::memory:')
  const srv = await cds.serve(serviceName).from(csn).with(require(adminServiceImpl))

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
    if (name === serviceName || name === 'CatalogService' || name.startsWith('AdminService.')) {
      delete cds.services[name]
    }
  }

  if (Array.isArray(cds.service?.providers)) {
    cds.service.providers = cds.service.providers.filter((srv) => (
      srv.name !== serviceName &&
      srv.name !== 'CatalogService' &&
      !srv.name?.startsWith('AdminService.')
    ))
  }
}

async function disconnectDb() {
  if (!db) return

  await cds.disconnect(db)
  db = undefined
  cds.model = originalModel
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
    const response = await respond(request, requests.length) || {}

    res.statusCode = response.statusCode ?? 200
    res.setHeader('content-type', response.contentType ?? 'application/json')
    res.end(response.body ?? JSON.stringify({
      received: true,
      executionId: `n8n-demo-${requests.length}`
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

async function seedAuthor(id) {
  await db.run(INSERT.into(sourceAuthors).entries({
    ID: id,
    name: `Demo Author ${id}`
  }))
}

async function seedBook(id, authorId, data = {}) {
  await db.run(INSERT.into(sourceBooks).entries({
    ID: id,
    title: data.title || `Demo Book ${id}`,
    stock: data.stock ?? 1,
    author_ID: authorId,
    genre_ID: data.genre_ID || demoGenreId
  }))
}

async function seedQueuedExecution(n8n, id, businessKey) {
  return n8n.store.createQueued({
    executionId: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    workflowId,
    businessKey,
    tag: 'admin-books',
    inputs: {
      event: 'DemoDeleteSeed'
    },
    dispatch: {
      workflowPath: workflowId,
      payload: {
        event: 'DemoDeleteSeed'
      }
    }
  })
}

function adminRun(srv, query) {
  const user = new cds.User({
    id: 'demo-admin',
    roles: ['admin']
  })

  return cds.tx({ user }, () => srv.run(query))
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

afterEach(async () => {
  await resetN8nService()
  resetServedServices()
  await disconnectDb()
})

describe('demo AdminService n8n annotations', () => {
  it('compiles n8n start and cancel annotations on the AdminService.Books projection only', async () => {
    const csn = await loadDemoModel()
    const adminBooks = csn.definitions['AdminService.Books']
    const domainBooks = csn.definitions[sourceBooks]
    const catalogBooks = csn.definitions['CatalogService.Books']

    expect(adminBooks).toMatchObject({
      '@n8n.workflow.start.workflowId': workflowId,
      '@n8n.workflow.start.on': ['CREATE', 'UPDATE'],
      '@n8n.workflow.start.inputs.authorId': 'author_ID',
      '@n8n.workflow.start.inputs.bookId': 'ID',
      '@n8n.workflow.start.inputs.currencyCode': 'currency_code',
      '@n8n.workflow.start.inputs.description': 'descr',
      '@n8n.workflow.start.inputs.genreId': 'genre_ID',
      '@n8n.workflow.start.inputs.price': 'price',
      '@n8n.workflow.start.inputs.stock': 'stock',
      '@n8n.workflow.start.inputs.title': 'title',
      '@n8n.workflow.start.if': 'stock > 0',
      '@n8n.workflow.start.businessKey': 'ID',
      '@n8n.workflow.start.tag': 'admin-books',
      '@n8n.workflow.cancel.workflowId': workflowId,
      '@n8n.workflow.cancel.on': ['DELETE'],
      '@n8n.workflow.cancel.businessKey': 'ID',
      '@n8n.workflow.cancel.tag': 'admin-books'
    })
    expect(Object.keys(domainBooks).filter((key) => key.startsWith('@n8n.workflow'))).toEqual([])
    expect(Object.keys(catalogBooks).filter((key) => key.startsWith('@n8n.workflow'))).toEqual([])
  })

  it('dispatches demo CREATE and UPDATE starts once and cancels matching executions on DELETE', async () => {
    const server = await createWebhookServer(() => undefined)

    try {
      configureN8n(server.baseUrl)
      const srv = await serveDemoAdminService()
      const n8n = await cds.connect.to('n8n')
      const authorId = 991
      const createId = 9901
      const deleteId = 9902

      await seedAuthor(authorId)

      await adminRun(srv, INSERT.into(srv.entities.Books).entries({
        ID: createId,
        title: 'Annotated Demo Create',
        descr: 'Payload includes book description',
        stock: 5,
        price: 10,
        currency_code: 'USD',
        author: { ID: authorId },
        genre: { ID: demoGenreId }
      }))
      expect(server.requests).toHaveLength(1)
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        url: `/${workflowId}`,
        body: {
          bookId: createId,
          title: 'Annotated Demo Create',
          description: 'Payload includes book description',
          authorId,
          genreId: demoGenreId,
          stock: 5,
          price: 10,
          currencyCode: 'USD'
        }
      })
      expectEventMetadata(server.requests[0].body, 'CREATE', { ID: createId })

      await adminRun(srv, UPDATE(srv.entities.Books, createId).with({ stock: 7 }))
      expect(server.requests).toHaveLength(2)
      expect(server.requests[1]).toMatchObject({
        method: 'POST',
        url: `/${workflowId}`,
        body: {
          bookId: createId,
          title: 'Annotated Demo Create',
          description: 'Payload includes book description',
          authorId,
          genreId: demoGenreId,
          stock: 7,
          price: 10,
          currencyCode: 'USD'
        }
      })
      expectEventMetadata(server.requests[1].body, 'UPDATE', { ID: createId })

      await seedBook(deleteId, authorId, {
        title: 'Annotated Demo Delete',
        stock: 3
      })
      const queued = await seedQueuedExecution(n8n, deleteId, String(deleteId))

      await adminRun(srv, DELETE.from(srv.entities.Books, deleteId))
      expect(server.requests).toHaveLength(2)
      await expect(n8n.getExecution(queued.executionId)).resolves.toMatchObject({
        executionId: queued.executionId,
        workflowId,
        businessKey: String(deleteId),
        tag: 'admin-books',
        status: 'cancelled',
        result: {
          cancelled: true
        }
      })
    } finally {
      await server.close()
    }
  })

  it('keeps demo service source free of hard-coded n8n start glue', () => {
    const source = fs.readFileSync(adminServiceSource, 'utf8')

    for (const pattern of forbiddenDemoTriggerPatterns) {
      expect(source).not.toMatch(pattern)
    }
  })
})
