import { afterEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')
const n8nPackageDir = resolve(repoRoot, 'cap-n8n-node')

const fakeUsername = 'cap-user'
const fakePassword = 'cap-password-for-test'
const fakeClientSecret = 'cap-client-secret-for-test'

const metadataWithEntitySets = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <edm:Schema Namespace="AdminService" xmlns:edm="http://docs.oasis-open.org/odata/ns/edm">
      <edm:EntityType Name="Book" />
      <edm:EntityType Name="Author" />
      <edm:EntityContainer Name="EntityContainer">
        <edm:EntitySet Name="Books" EntityType="AdminService.Book" />
        <edm:EntitySet Name="Authors" EntityType="AdminService.Author" />
      </edm:EntityContainer>
    </edm:Schema>
  </edmx:DataServices>
</edmx:Edmx>`

const metadataWithoutEntitySets = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="AdminService" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityContainer Name="EntityContainer" />
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`

const metadataWithSingleQuotedAttributes = `<?xml version='1.0' encoding='utf-8'?>
<edmx:Edmx Version='4.0' xmlns:edmx='http://docs.oasis-open.org/odata/ns/edmx'>
  <edmx:DataServices>
    <Schema Namespace='AdminService' xmlns='http://docs.oasis-open.org/odata/ns/edm'>
      <EntityContainer Name='EntityContainer'>
        <EntitySet Name='Books' EntityType='AdminService.Book' />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`

let servers = []

async function importDistModule(relativePath) {
  const modulePath = resolve(n8nPackageDir, relativePath)

  expect(existsSync(modulePath), `${relativePath} should exist after n8n package build`).toBe(true)
  return import(pathToFileURL(modulePath).href)
}

async function createCapServer(respond) {
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
      body,
    }

    requests.push(request)
    const response = await respond(request, requests.length)

    res.statusCode = response.statusCode ?? 200
    res.setHeader('content-type', response.contentType ?? 'application/xml')
    res.end(response.body ?? metadataWithEntitySets)
  })

  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  const { port } = server.address()
  const capServer = {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolveClose, rejectClose) => {
      for (const socket of sockets) socket.destroy()
      server.close((err) => err ? rejectClose(err) : resolveClose())
    }),
  }

  servers.push(capServer)
  return capServer
}

function createContext(credentials) {
  return {
    getCredentials: async () => credentials,
    helpers: {
      httpRequest: async (options) => {
        const response = await fetch(options.url, {
          method: options.method ?? 'GET',
          headers: options.headers,
          body: options.body,
        })
        const bodyText = await response.text()
        const body = options.encoding === 'text'
          ? bodyText
          : bodyText
            ? JSON.parse(bodyText)
            : undefined

        if (options.returnFullResponse) {
          return {
            statusCode: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            body,
          }
        }

        if (response.status >= 400 && !options.ignoreHttpStatusErrors) {
          const err = new Error(`HTTP ${response.status}`)
          err.statusCode = response.status
          err.response = { body }
          throw err
        }

        return body
      },
    },
  }
}

function basicCredentials(baseUrl, overrides = {}) {
  return {
    baseUrl,
    metadataPath: '/odata/v4/admin/$metadata',
    authType: 'basicAuth',
    username: fakeUsername,
    password: fakePassword,
    clientSecret: fakeClientSecret,
    ...overrides,
  }
}

function serializedError(err) {
  return JSON.stringify({
    message: err.message,
    description: err.description,
    statusCode: err.statusCode,
    category: err.category,
  })
}

afterEach(async () => {
  const pending = servers
  servers = []
  await Promise.all(pending.map((server) => server.close()))
})

describe('n8n SAP CAP metadata discovery helpers', () => {
  it('loads entity sets from CAP metadata with Basic Auth', async () => {
    const { loadEntitySetOptions } = await importDistModule('dist/nodes/SapCap/ODataMetadata.js')
    const server = await createCapServer(() => ({
      body: metadataWithEntitySets,
    }))

    const options = await loadEntitySetOptions.call(createContext(basicCredentials(server.baseUrl)))

    expect(server.requests).toHaveLength(1)
    expect(server.requests[0]).toMatchObject({
      method: 'GET',
      url: '/odata/v4/admin/$metadata',
    })
    expect(server.requests[0].headers.authorization).toBe(
      `Basic ${Buffer.from(`${fakeUsername}:${fakePassword}`).toString('base64')}`
    )
    expect(options).toEqual([
      { name: 'Books', value: 'Books', description: 'AdminService.Book' },
      { name: 'Authors', value: 'Authors', description: 'AdminService.Author' },
    ])
  })

  it('extracts namespace-prefixed entity sets and distinguishes empty or invalid metadata', async () => {
    const { extractEntitySetOptions } = await importDistModule('dist/nodes/SapCap/ODataMetadata.js')

    expect(extractEntitySetOptions(metadataWithEntitySets)).toEqual([
      { name: 'Books', value: 'Books', description: 'AdminService.Book' },
      { name: 'Authors', value: 'Authors', description: 'AdminService.Author' },
    ])
    expect(extractEntitySetOptions(metadataWithSingleQuotedAttributes)).toEqual([
      { name: 'Books', value: 'Books', description: 'AdminService.Book' },
    ])
    expect(extractEntitySetOptions(metadataWithoutEntitySets)).toEqual([])
    expect(() => extractEntitySetOptions('not xml')).toThrow('CAP metadata response is not valid XML.')
    expect(() => extractEntitySetOptions('<html><form>Login</form></html>')).toThrow('CAP metadata response is not valid OData metadata.')
  })

  it('rejects HTML metadata responses returned with HTTP 200', async () => {
    const { loadEntitySetOptions } = await importDistModule('dist/nodes/SapCap/ODataMetadata.js')
    const server = await createCapServer(() => ({
      contentType: 'text/html',
      body: '<html><body>Login required</body></html>',
    }))

    await expect(
      loadEntitySetOptions.call(createContext(basicCredentials(server.baseUrl)))
    ).rejects.toMatchObject({
      message: 'CAP metadata response is not valid OData metadata.',
      category: 'responseShape',
    })

    expect(server.requests).toHaveLength(1)
  })

  it('classifies metadata HTTP failures without serializing credentials or response bodies', async () => {
    const { loadEntitySetOptions } = await importDistModule('dist/nodes/SapCap/ODataMetadata.js')
    const cases = [
      [400, 'validation'],
      [401, 'authentication'],
      [403, 'authorization'],
      [404, 'notFound'],
      [500, 'server'],
    ]

    for (const [statusCode, category] of cases) {
      const server = await createCapServer(() => ({
        statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'metadata failure',
          Authorization: `Basic ${Buffer.from(`${fakeUsername}:${fakePassword}`).toString('base64')}`,
          password: fakePassword,
          clientSecret: fakeClientSecret,
          responseBody: 'full CAP response should not be exposed',
        }),
      }))

      try {
        await loadEntitySetOptions.call(createContext(basicCredentials(server.baseUrl)))
        throw new Error(`Expected ${statusCode} to fail`)
      } catch (err) {
        const serialized = serializedError(err)

        expect(err).toMatchObject({
          statusCode,
          category,
        })
        expect(serialized).not.toContain(fakePassword)
        expect(serialized).not.toContain(fakeClientSecret)
        expect(serialized).not.toContain('Authorization')
        expect(serialized).not.toContain('full CAP response should not be exposed')
      }
    }
  })

  it('builds safe Query and Read request paths from raw OData controls', async () => {
    const {
      buildQueryRequest,
      buildReadRequest,
      normalizeBaseUrl,
      normalizeKeyPredicate,
      normalizeMetadataPath,
      normalizeServicePath,
      resolveEntitySetName,
    } = await importDistModule('dist/nodes/SapCap/GenericFunctions.js')

    const queryRequest = buildQueryRequest({
      servicePath: '/odata/v4/admin/',
      entitySetName: 'Books',
      filter: "title eq 'Dune'",
      orderBy: 'title asc, stock desc',
      select: 'ID,title,stock',
      top: 0,
      skip: 0,
    })
    const queryUrl = new URL(queryRequest.path, 'http://example.test')

    expect(queryRequest.method).toBe('GET')
    expect(queryUrl.pathname).toBe('/odata/v4/admin/Books')
    expect(queryUrl.searchParams.get('$filter')).toBe("title eq 'Dune'")
    expect(queryUrl.searchParams.get('$orderby')).toBe('title asc, stock desc')
    expect(queryUrl.searchParams.get('$select')).toBe('ID,title,stock')
    expect(queryUrl.searchParams.get('$top')).toBe('0')
    expect(queryUrl.searchParams.get('$skip')).toBe('0')

    expect(buildReadRequest({
      servicePath: '/odata/v4/admin',
      entitySetName: 'Books',
      keyPredicate: 'ID=201,IsActiveEntity=true',
    })).toEqual({
      method: 'GET',
      path: '/odata/v4/admin/Books(ID=201,IsActiveEntity=true)',
    })
    expect(normalizeBaseUrl('https://cap.example.test/')).toBe('https://cap.example.test')
    expect(normalizeMetadataPath('/odata/v4/admin/$metadata')).toBe('/odata/v4/admin/$metadata')
    expect(normalizeServicePath('/odata/v4/admin/')).toBe('/odata/v4/admin')
    expect(normalizeKeyPredicate('ID=201')).toBe('(ID=201)')
    expect(resolveEntitySetName({ entitySetSource: 'manual', entitySetManual: 'Books' })).toBe('Books')
    expect(() => normalizeBaseUrl('ftp://cap.example.test')).toThrow('Base URL must be a valid http or https URL.')
    expect(() => normalizeServicePath('/odata/v4/admin?$filter=ID')).toThrow('Service Path must start with / and must not include query strings.')
    expect(() => normalizeKeyPredicate('ID=201)?$expand=SensitiveNav')).toThrow('Key Predicate must not include /, ?, or #.')
    expect(() => normalizeKeyPredicate('ID=201)/$value')).toThrow('Key Predicate must not include /, ?, or #.')
    expect(() => resolveEntitySetName({ entitySetSource: 'manual', entitySetManual: '../Books' })).toThrow('Enter a CAP entity set name, for example Books.')
  })
})
