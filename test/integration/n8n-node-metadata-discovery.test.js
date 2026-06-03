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
const fakeClientId = 'cap-client-id-for-test'
const fakeClientSecret = 'cap-client-secret-for-test'
const fakeBearerToken = 'cap-bearer-token-for-test'
const fakeResponseBody = 'metadata-response-body-secret'
const keyPredicateBoundaryMessage = 'Key Predicate must not include /, \\, ?, or #.'

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

const metadataWithKeyDescriptors = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <edm:Schema Namespace="AdminService" xmlns:edm="http://docs.oasis-open.org/odata/ns/edm">
      <edm:EntityType Name="Book">
        <edm:Key>
          <edm:PropertyRef Name="ID" />
        </edm:Key>
        <edm:Property Name="ID" Type="Edm.Int32" Nullable="false" />
        <edm:Property Name="title" Type="Edm.String" />
      </edm:EntityType>
      <edm:EntityType Name="BookDraft">
        <edm:Key>
          <edm:PropertyRef Name="ID" />
          <edm:PropertyRef Name="IsActiveEntity" />
        </edm:Key>
        <edm:Property Name="ID" Type="Edm.Int32" Nullable="false" />
        <edm:Property Name="IsActiveEntity" Type="Edm.Boolean" Nullable="false" />
      </edm:EntityType>
      <edm:EntityContainer Name="AdminContainer">
        <edm:EntitySet Name="Books" EntityType="AdminService.Book" />
        <edm:EntitySet Name="BookDrafts" EntityType="AdminService.BookDraft" />
      </edm:EntityContainer>
    </edm:Schema>
    <Schema Namespace="CatalogService" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityType Name="CurrencyText">
        <Key>
          <PropertyRef Name="locale" />
          <PropertyRef Name="code" />
        </Key>
        <Property Name="locale" Type="Edm.String" Nullable="false" />
        <Property Name="code" Type="Edm.String" Nullable="false" />
      </EntityType>
      <EntityContainer Name="CatalogContainer">
        <EntitySet Name="CurrencyTexts" EntityType="CatalogService.CurrencyText" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`

const metadataWithActionFunctions = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <edm:Schema Namespace="CatalogService" xmlns:edm="http://docs.oasis-open.org/odata/ns/edm">
      <edm:EntityType Name="Book">
        <edm:Key>
          <edm:PropertyRef Name="ID" />
        </edm:Key>
        <edm:Property Name="ID" Type="Edm.Int32" Nullable="false" />
      </edm:EntityType>
      <edm:Action Name="submitOrder">
        <edm:Parameter Name="book" Type="Edm.Int32" />
        <edm:Parameter Name="quantity" Type="Edm.Int32" />
      </edm:Action>
      <edm:Function Name="bookAvailability">
        <edm:Parameter Name="book" Type="Edm.Int32" />
        <edm:ReturnType Type="Edm.Boolean" />
      </edm:Function>
      <edm:Action Name="restock" IsBound="true">
        <edm:Parameter Name="bindingParameter" Type="CatalogService.Book" />
        <edm:Parameter Name="quantity" Type="Edm.Int32" />
      </edm:Action>
      <edm:Function Name="inventoryValue" IsBound="true">
        <edm:Parameter Name="bindingParameter" Type="CatalogService.Book" />
        <edm:Parameter Name="currency" Type="Edm.String" />
        <edm:ReturnType Type="Edm.Decimal" />
      </edm:Function>
      <edm:EntityContainer Name="CatalogContainer">
        <edm:EntitySet Name="Books" EntityType="CatalogService.Book" />
        <edm:ActionImport Name="submitOrder" Action="CatalogService.submitOrder" />
        <edm:FunctionImport Name="bookAvailability" Function="CatalogService.bookAvailability" />
      </edm:EntityContainer>
    </edm:Schema>
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
    tokenUrl: '',
    clientId: '',
    clientSecret: fakeClientSecret,
    scope: '',
    ...overrides,
  }
}

function oauth2Credentials(baseUrl, tokenUrl, overrides = {}) {
  return basicCredentials(baseUrl, {
    authType: 'oauth2',
    username: '',
    password: '',
    tokenUrl,
    clientId: fakeClientId,
    clientSecret: fakeClientSecret,
    scope: 'openid',
    ...overrides,
  })
}

function serializedError(err) {
  return JSON.stringify({
    message: err.message,
    description: err.description,
    statusCode: err.statusCode,
    category: err.category,
  })
}

function expectBasicAuthHeader(request) {
  expect(request.headers.authorization).toBe(
    `Basic ${Buffer.from(`${fakeUsername}:${fakePassword}`).toString('base64')}`
  )
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

  it('loads entity sets from CAP metadata with OAuth2 Client Credentials', async () => {
    const { loadEntitySetOptions } = await importDistModule('dist/nodes/SapCap/ODataMetadata.js')
    const tokenServer = await createCapServer(() => ({
      contentType: 'application/json',
      body: JSON.stringify({ access_token: fakeBearerToken, token_type: 'bearer' }),
    }))
    const metadataServer = await createCapServer(() => ({
      body: metadataWithEntitySets,
    }))

    const options = await loadEntitySetOptions.call(createContext(oauth2Credentials(
      metadataServer.baseUrl,
      `${tokenServer.baseUrl}/oauth/token`
    )))

    expect(tokenServer.requests).toHaveLength(1)
    expect(tokenServer.requests[0]).toMatchObject({
      method: 'POST',
      url: '/oauth/token',
    })
    expect(tokenServer.requests[0].headers.authorization).toBe(
      `Basic ${Buffer.from(`${fakeClientId}:${fakeClientSecret}`).toString('base64')}`
    )
    expect(tokenServer.requests[0].body).toBe('grant_type=client_credentials&scope=openid')
    expect(metadataServer.requests).toHaveLength(1)
    expect(metadataServer.requests[0].headers.authorization).toBe(`Bearer ${fakeBearerToken}`)
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

  it('extracts entity-set key descriptors for single and composite keys', async () => {
    const {
      extractEntityKeyDescriptors,
      extractEntitySetDescriptors,
      extractEntitySetOptions,
    } = await importDistModule('dist/nodes/SapCap/ODataMetadata.js')

    expect(extractEntitySetOptions(metadataWithKeyDescriptors)).toEqual([
      { name: 'Books', value: 'Books', description: 'AdminService.Book' },
      { name: 'BookDrafts', value: 'BookDrafts', description: 'AdminService.BookDraft' },
      { name: 'CurrencyTexts', value: 'CurrencyTexts', description: 'CatalogService.CurrencyText' },
    ])
    expect(extractEntitySetDescriptors(metadataWithKeyDescriptors)).toEqual([
      {
        name: 'Books',
        entityType: 'AdminService.Book',
        keys: [
          { name: 'ID', type: 'Edm.Int32' },
        ],
      },
      {
        name: 'BookDrafts',
        entityType: 'AdminService.BookDraft',
        keys: [
          { name: 'ID', type: 'Edm.Int32' },
          { name: 'IsActiveEntity', type: 'Edm.Boolean' },
        ],
      },
      {
        name: 'CurrencyTexts',
        entityType: 'CatalogService.CurrencyText',
        keys: [
          { name: 'locale', type: 'Edm.String' },
          { name: 'code', type: 'Edm.String' },
        ],
      },
    ])
    expect(extractEntityKeyDescriptors(metadataWithKeyDescriptors, 'BookDrafts')).toEqual([
      { name: 'ID', type: 'Edm.Int32' },
      { name: 'IsActiveEntity', type: 'Edm.Boolean' },
    ])
    expect(extractEntityKeyDescriptors(metadataWithKeyDescriptors, 'CurrencyTexts')).toEqual([
      { name: 'locale', type: 'Edm.String' },
      { name: 'code', type: 'Edm.String' },
    ])
    expect(extractEntityKeyDescriptors(metadataWithKeyDescriptors, 'MissingSet')).toEqual([])
  })

  it('sanitizes metadata key extraction failures', async () => {
    const {
      extractEntityKeyDescriptors,
      extractEntitySetDescriptors,
    } = await importDistModule('dist/nodes/SapCap/ODataMetadata.js')
    const leakingHtml = [
      '<html>',
      `Authorization: Bearer ${fakeBearerToken}`,
      fakePassword,
      fakeClientSecret,
      fakeResponseBody,
      '</html>',
    ].join(' ')

    for (const fn of [
      () => extractEntitySetDescriptors(leakingHtml),
      () => extractEntityKeyDescriptors(leakingHtml, 'Books'),
    ]) {
      try {
        fn()
        throw new Error('Expected metadata extraction to fail')
      } catch (err) {
        const serialized = serializedError(err)

        expect(err).toMatchObject({
          message: 'CAP metadata response is not valid OData metadata.',
          category: 'responseShape',
        })
        expect(serialized).not.toContain(fakePassword)
        expect(serialized).not.toContain(fakeClientSecret)
        expect(serialized).not.toContain(fakeBearerToken)
        expect(serialized).not.toContain(fakeResponseBody)
        expect(serialized).not.toContain('Authorization')
      }
    }
  })

  it('extracts combined Action/Function descriptors and safe dropdown options', async () => {
    const {
      extractActionFunctionDescriptors,
      extractActionFunctionOptions,
    } = await importDistModule('dist/nodes/SapCap/ODataMetadata.js')

    const descriptors = extractActionFunctionDescriptors(metadataWithActionFunctions)
    const options = extractActionFunctionOptions(metadataWithActionFunctions)

    expect(descriptors).toEqual([
      {
        kind: 'action',
        name: 'submitOrder',
        qualifiedName: 'CatalogService.submitOrder',
        importName: 'submitOrder',
        isBound: false,
        parameters: [
          { name: 'book', type: 'Edm.Int32' },
          { name: 'quantity', type: 'Edm.Int32' },
        ],
      },
      {
        kind: 'function',
        name: 'bookAvailability',
        qualifiedName: 'CatalogService.bookAvailability',
        importName: 'bookAvailability',
        isBound: false,
        parameters: [
          { name: 'book', type: 'Edm.Int32' },
        ],
      },
      {
        kind: 'action',
        name: 'restock',
        qualifiedName: 'CatalogService.restock',
        isBound: true,
        bindingType: 'CatalogService.Book',
        entitySet: 'Books',
        parameters: [
          { name: 'quantity', type: 'Edm.Int32' },
        ],
      },
      {
        kind: 'function',
        name: 'inventoryValue',
        qualifiedName: 'CatalogService.inventoryValue',
        isBound: true,
        bindingType: 'CatalogService.Book',
        entitySet: 'Books',
        parameters: [
          { name: 'currency', type: 'Edm.String' },
        ],
      },
    ])
    expect(options.map((option) => option.name)).toEqual([
      'Action: submitOrder',
      'Function: bookAvailability',
      'Action: Books/restock',
      'Function: Books/inventoryValue',
    ])
    expect(options).toHaveLength(4)

    for (const option of options) {
      const descriptor = JSON.parse(option.value)
      const allowedFields = [
        'kind',
        'name',
        'qualifiedName',
        'importName',
        'isBound',
        'bindingType',
        'entitySet',
        'parameters',
      ]

      expect(Object.keys(descriptor).sort()).toEqual(
        Object.keys(descriptor).filter((field) => allowedFields.includes(field)).sort()
      )
      expect(JSON.stringify(descriptor)).not.toContain(fakePassword)
      expect(JSON.stringify(descriptor)).not.toContain(fakeClientSecret)
      expect(JSON.stringify(descriptor)).not.toContain(fakeBearerToken)
      expect(JSON.stringify(descriptor)).not.toContain('<edmx:Edmx')
      expect(JSON.stringify(descriptor)).not.toContain('Authorization')
      expect(JSON.stringify(descriptor)).not.toContain('body')
      expect(JSON.stringify(descriptor)).not.toContain('headers')
    }
  })

  it('loads combined Action/Function options from CAP metadata with Basic Auth', async () => {
    const { loadActionFunctionOptions } = await importDistModule('dist/nodes/SapCap/ODataMetadata.js')
    const server = await createCapServer(() => ({
      body: metadataWithActionFunctions,
    }))

    const options = await loadActionFunctionOptions.call(createContext(basicCredentials(server.baseUrl)))

    expect(server.requests).toHaveLength(1)
    expect(server.requests[0]).toMatchObject({
      method: 'GET',
      url: '/odata/v4/admin/$metadata',
    })
    expectBasicAuthHeader(server.requests[0])
    expect(options.map((option) => option.name)).toEqual([
      'Action: submitOrder',
      'Function: bookAvailability',
      'Action: Books/restock',
      'Function: Books/inventoryValue',
    ])
  })

  it('returns an empty Action/Function option list when valid metadata has no operations', async () => {
    const {
      extractActionFunctionDescriptors,
      extractActionFunctionOptions,
    } = await importDistModule('dist/nodes/SapCap/ODataMetadata.js')

    expect(extractActionFunctionDescriptors(metadataWithEntitySets)).toEqual([])
    expect(extractActionFunctionOptions(metadataWithEntitySets)).toEqual([])
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
    expect(normalizeBaseUrl('https://cap.example.test/app/')).toBe('https://cap.example.test/app')
    expect(normalizeMetadataPath('/odata/v4/admin/$metadata')).toBe('/odata/v4/admin/$metadata')
    expect(normalizeServicePath('/odata/v4/admin/')).toBe('/odata/v4/admin')
    expect(normalizeKeyPredicate('ID=201')).toBe('(ID=201)')
    expect(resolveEntitySetName({ entitySetSource: 'manual', entitySetManual: 'Books' })).toBe('Books')
    expect(() => normalizeBaseUrl('ftp://cap.example.test')).toThrow('Base URL must be a valid http or https URL.')
    expect(() => normalizeBaseUrl('https://cap.example.test/?tenant=a')).toThrow('Base URL must be a valid http or https URL.')
    expect(() => normalizeBaseUrl('https://cap.example.test/#/admin')).toThrow('Base URL must be a valid http or https URL.')
    expect(() => normalizeServicePath('/odata/v4/admin?$filter=ID')).toThrow('Service Path must start with / and must not include query strings.')
    expect(() => normalizeKeyPredicate('ID=201)?$expand=SensitiveNav')).toThrow(keyPredicateBoundaryMessage)
    expect(() => normalizeKeyPredicate('ID=201)/$value')).toThrow(keyPredicateBoundaryMessage)
    expect(() => normalizeKeyPredicate('ID=201)#fragment')).toThrow(keyPredicateBoundaryMessage)
    expect(() => normalizeKeyPredicate('ID=201)\\$value')).toThrow(keyPredicateBoundaryMessage)
    expect(() => normalizeKeyPredicate('ID=201%2F$value')).toThrow(keyPredicateBoundaryMessage)
    expect(() => normalizeKeyPredicate('ID=201%3F$expand=SensitiveNav')).toThrow(keyPredicateBoundaryMessage)
    expect(() => normalizeKeyPredicate('ID=201%23fragment')).toThrow(keyPredicateBoundaryMessage)
    expect(() => normalizeKeyPredicate('ID=201%5C$value')).toThrow(keyPredicateBoundaryMessage)
    expect(() => resolveEntitySetName({ entitySetSource: 'manual', entitySetManual: '../Books' })).toThrow('Enter a CAP entity set name, for example Books.')
    expect(() => resolveEntitySetName({ entitySetSource: 'manual', entitySetManual: '..' })).toThrow('Enter a CAP entity set name, for example Books.')
    expect(() => resolveEntitySetName({ entitySetSource: 'manual', entitySetManual: 'Books%2F$value' })).toThrow('Enter a CAP entity set name, for example Books.')
    expect(() => buildQueryRequest({
      servicePath: '/odata/v4/admin',
      entitySetName: 'Books',
      top: true,
    })).toThrow('Top must be a nonnegative integer.')
    expect(() => buildQueryRequest({
      servicePath: '/odata/v4/admin',
      entitySetName: 'Books',
      skip: [],
    })).toThrow('Skip must be a nonnegative integer.')
    expect(() => buildQueryRequest({
      servicePath: '/odata/v4/admin',
      entitySetName: 'Books',
      top: '   ',
    })).toThrow('Top must be a nonnegative integer.')
  })

  it('builds type-aware metadata key predicates while preserving manual fallback', async () => {
    const {
      buildKeyPredicateFromParts,
      buildReadRequest,
      formatODataKeyLiteral,
      normalizeKeyPredicate,
      resolveKeyPredicate,
    } = await importDistModule('dist/nodes/SapCap/GenericFunctions.js')
    const draftKeys = [
      { name: 'ID', type: 'Edm.Int32' },
      { name: 'IsActiveEntity', type: 'Edm.Boolean' },
    ]
    const textKeys = [
      { name: 'locale', type: 'Edm.String' },
      { name: 'code', type: 'Edm.String' },
    ]

    expect(normalizeKeyPredicate('ID=201')).toBe('(ID=201)')
    expect(formatODataKeyLiteral("O'Neil", 'Edm.String')).toBe("'O''Neil'")
    expect(formatODataKeyLiteral('201%27,quantity=999,%27', 'Edm.String')).toBe("'201%2527,quantity=999,%2527'")
    expect(formatODataKeyLiteral('201', 'Edm.Int32')).toBe('201')
    expect(formatODataKeyLiteral(true, 'Edm.Boolean')).toBe('true')
    expect(formatODataKeyLiteral('external-id', 'Custom.Identifier')).toBe("'external-id'")
    expect(buildKeyPredicateFromParts({
      keyDescriptors: draftKeys,
      keyParts: {
        ID: 201,
        IsActiveEntity: true,
      },
    })).toBe('(ID=201,IsActiveEntity=true)')
    expect(buildKeyPredicateFromParts({
      keyDescriptors: textKeys,
      keyParts: {
        locale: 'en-US',
        code: "USD'2026%2Ccurrency%3DEUR",
      },
    })).toBe("(locale='en-US',code='USD''2026%252Ccurrency%253DEUR')")
    expect(resolveKeyPredicate({
      keyPredicate: 'ID=201',
    })).toBe('(ID=201)')
    expect(resolveKeyPredicate({
      keyDescriptors: draftKeys,
      keyParts: {
        ID: '201',
        IsActiveEntity: 'true',
      },
    })).toBe('(ID=201,IsActiveEntity=true)')
    expect(buildReadRequest({
      servicePath: '/odata/v4/admin',
      entitySetName: 'BookDrafts',
      keyDescriptors: draftKeys,
      keyParts: {
        ID: 201,
        IsActiveEntity: true,
      },
    })).toEqual({
      method: 'GET',
      path: '/odata/v4/admin/BookDrafts(ID=201,IsActiveEntity=true)',
    })
    expect(buildReadRequest({
      servicePath: '/odata/v4/admin',
      entitySetName: 'Books',
      keyPredicate: 'ID=201',
    })).toEqual({
      method: 'GET',
      path: '/odata/v4/admin/Books(ID=201)',
    })
    expect(() => buildKeyPredicateFromParts({
      keyDescriptors: draftKeys,
      keyParts: {
        ID: 201,
      },
    })).toThrow('Every metadata-derived key part is required.')
    expect(() => buildKeyPredicateFromParts({
      keyDescriptors: [
        { name: 'ID', type: 'Edm.Int32' },
        { name: 'ID', type: 'Edm.Int32' },
      ],
      keyParts: {
        ID: 201,
      },
    })).toThrow('Metadata key descriptors must not contain duplicate key names.')
    expect(() => buildKeyPredicateFromParts({
      keyDescriptors: draftKeys,
      keyParts: [
        { name: 'ID', value: 201 },
        { name: 'ID', value: 202 },
        { name: 'IsActiveEntity', value: true },
      ],
    })).toThrow('Metadata key values must not contain duplicate key names.')
  })

  it('sanitizes metadata-derived key validation errors', async () => {
    const {
      buildKeyPredicateFromParts,
    } = await importDistModule('dist/nodes/SapCap/GenericFunctions.js')

    try {
      buildKeyPredicateFromParts({
        keyDescriptors: [
          { name: 'ID', type: 'Edm.String' },
        ],
        keyParts: {
          ID: `201/$value ${fakePassword} ${fakeClientSecret} ${fakeBearerToken} ${fakeResponseBody}`,
        },
      })
      throw new Error('Expected metadata key validation to fail')
    } catch (err) {
      const serialized = serializedError(err)

      expect(err).toMatchObject({
        message: 'Key values must not include /, \\, ?, or #.',
        category: 'validation',
      })
      expect(serialized).not.toContain(fakePassword)
      expect(serialized).not.toContain(fakeClientSecret)
      expect(serialized).not.toContain(fakeBearerToken)
      expect(serialized).not.toContain(fakeResponseBody)
      expect(serialized).not.toContain('201/$value')
      expect(serialized).not.toContain('Authorization')
    }
  })

  it('runs credential Test Connection through shared SAP CAP validation guards', async () => {
    const { SapCap } = await importDistModule('dist/nodes/SapCap/SapCap.node.js')
    const node = new SapCap()
    const requests = []
    const credentialTestContext = {
      helpers: {
        request: async (options) => {
          requests.push(options)

          if (options.method === 'POST') {
            return {
              statusCode: 200,
              body: JSON.stringify({ access_token: fakeBearerToken }),
            }
          }

          return {
            statusCode: 200,
            body: metadataWithEntitySets,
          }
        },
      },
    }

    const result = await node.methods.credentialTest.sapCapApiCredentialTest.call(
      credentialTestContext,
      { data: basicCredentials('https://cap.example.test/app/') }
    )

    expect(result).toEqual({
      status: 'OK',
      message: 'Connection successful',
    })
    expect(requests).toEqual([
      expect.objectContaining({
        method: 'GET',
        url: 'https://cap.example.test/app/odata/v4/admin/$metadata',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from(`${fakeUsername}:${fakePassword}`).toString('base64')}`,
        }),
      }),
    ])

    requests.length = 0
    const oauthResult = await node.methods.credentialTest.sapCapApiCredentialTest.call(
      credentialTestContext,
      { data: oauth2Credentials('https://cap.example.test/app/', 'https://auth.example.test/oauth/token') }
    )

    expect(oauthResult).toEqual({
      status: 'OK',
      message: 'Connection successful',
    })
    expect(requests).toEqual([
      expect.objectContaining({
        method: 'POST',
        url: 'https://auth.example.test/oauth/token',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from(`${fakeClientId}:${fakeClientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
        body: 'grant_type=client_credentials&scope=openid',
      }),
      expect.objectContaining({
        method: 'GET',
        url: 'https://cap.example.test/app/odata/v4/admin/$metadata',
        headers: expect.objectContaining({
          Authorization: `Bearer ${fakeBearerToken}`,
        }),
      }),
    ])

    requests.length = 0

    const htmlMetadataContext = {
      helpers: {
        request: async (options) => {
          requests.push(options)
          return {
            statusCode: 200,
            body: '<html><form>Login</form></html>',
          }
        },
      },
    }

    await expect(
      node.methods.credentialTest.sapCapApiCredentialTest.call(
        htmlMetadataContext,
        { data: basicCredentials('https://cap.example.test/app/') }
      )
    ).rejects.toMatchObject({
      message: 'CAP metadata response is not valid OData metadata.',
      category: 'responseShape',
    })
    expect(requests).toHaveLength(1)
    requests.length = 0

    const leakingErrorContext = {
      helpers: {
        request: async (options) => {
          requests.push(options)
          throw new Error([
            `Authorization ${options.headers?.Authorization}`,
            fakePassword,
            fakeClientSecret,
            fakeBearerToken,
            fakeResponseBody,
          ].join(' '))
        },
      },
    }

    let safeError
    try {
      await node.methods.credentialTest.sapCapApiCredentialTest.call(
        leakingErrorContext,
        { data: basicCredentials('https://cap.example.test/app/') }
      )
    } catch (err) {
      safeError = err
    }

    expect(safeError).toMatchObject({
      message: 'Could not reach CAP metadata endpoint. Check Base URL and network access from n8n.',
      category: 'network',
    })
    const serialized = serializedError(safeError)
    expect(serialized).not.toContain(fakePassword)
    expect(serialized).not.toContain(fakeClientSecret)
    expect(serialized).not.toContain(fakeBearerToken)
    expect(serialized).not.toContain(fakeResponseBody)
    expect(serialized).not.toContain('Authorization')
    expect(requests).toHaveLength(1)
    requests.length = 0

    await expect(
      node.methods.credentialTest.sapCapApiCredentialTest.call(
        credentialTestContext,
        { data: basicCredentials('https://cap.example.test/?tenant=a') }
      )
    ).rejects.toMatchObject({
      message: 'Base URL must be a valid http or https URL.',
      category: 'validation',
    })
    await expect(
      node.methods.credentialTest.sapCapApiCredentialTest.call(
        credentialTestContext,
        { data: basicCredentials('https://cap.example.test', { metadataPath: 'odata/v4/admin/$metadata' }) }
      )
    ).rejects.toMatchObject({
      message: 'Metadata Path must start with /.',
      category: 'validation',
    })
    await expect(
      node.methods.credentialTest.sapCapApiCredentialTest.call(
        credentialTestContext,
        { data: basicCredentials('https://cap.example.test', { authType: 'none' }) }
      )
    ).rejects.toMatchObject({
      message: 'SAP CAP authentication must use Basic Auth or OAuth2 Client Credentials.',
      category: 'configuration',
    })
    expect(requests).toHaveLength(0)
  })
})
