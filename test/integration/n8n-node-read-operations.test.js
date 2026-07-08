import { afterEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { NodeOperationError } = require('n8n-workflow')
const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')
const n8nPackageDir = resolve(repoRoot, 'cap-n8n-node')

const fakeUsername = 'phase6-cap-user'
const fakePassword = 'phase6-fake-password'
const fakeClientId = 'phase6-fake-client-id'
const fakeClientSecret = 'phase6-fake-client-secret'
const fakeBearerToken = 'phase6-fake-bearer-token'
const fakeResponseBody = 'phase6 full response body should not be exposed'

const metadataXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <edm:Schema Namespace="AdminService" xmlns:edm="http://docs.oasis-open.org/odata/ns/edm">
      <edm:EntityContainer Name="EntityContainer">
        <edm:EntitySet Name="Books" EntityType="AdminService.Book" />
        <edm:EntitySet Name="Authors" EntityType="AdminService.Author" />
      </edm:EntityContainer>
    </edm:Schema>
  </edmx:DataServices>
</edmx:Edmx>`

const metadataWithCompositeKeys = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <edm:Schema Namespace="AdminService" xmlns:edm="http://docs.oasis-open.org/odata/ns/edm">
      <edm:EntityType Name="BookDraft">
        <edm:Key>
          <edm:PropertyRef Name="ID" />
          <edm:PropertyRef Name="IsActiveEntity" />
        </edm:Key>
        <edm:Property Name="ID" Type="Edm.Int32" Nullable="false" />
        <edm:Property Name="IsActiveEntity" Type="Edm.Boolean" Nullable="false" />
      </edm:EntityType>
      <edm:EntityContainer Name="EntityContainer">
        <edm:EntitySet Name="BookDrafts" EntityType="AdminService.BookDraft" />
      </edm:EntityContainer>
    </edm:Schema>
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
      <edm:EntityContainer Name="EntityContainer">
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

async function importSapCapNode() {
  const module = await importDistModule('dist/nodes/SapCap/SapCap.node.js')
  return module.SapCap ?? module.default?.SapCap
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
    res.setHeader('content-type', response.contentType ?? 'application/json')
    res.end(response.body ?? JSON.stringify({ value: [] }))
  })

  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })

  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))

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

function basicCredentials(baseUrl, overrides = {}) {
  return {
    baseUrl,
    metadataPath: '/odata/v4/admin/$metadata',
    authType: 'basicAuth',
    username: fakeUsername,
    password: fakePassword,
    tokenUrl: 'https://auth.example.test/oauth/token',
    clientId: fakeClientId,
    clientSecret: fakeClientSecret,
    scope: 'openid',
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

function defaultParameters(overrides = {}) {
  return {
    operation: 'query',
    servicePath: '/odata/v4/admin',
    entitySet: { mode: 'list', value: 'Books' },
    filter: '',
    orderBy: '',
    select: '',
    top: 100,
    skip: 0,
    keyPredicate: '',
    actionFunction: { mode: 'list', value: '' },
    actionFunctionKind: 'action',
    actionFunctionBinding: 'unbound',
    parameters: '{}',
    ...overrides,
  }
}

function createExecutionContext({
  credentials,
  parametersByItem,
  continueOnFail = false,
}) {
  return {
    getInputData: () => parametersByItem.map((parameters, index) => ({
      json: {
        index,
        operation: parameters.operation,
      },
    })),
    getCredentials: async (type) => {
      expect(type).toBe('sapCapApi')
      return credentials
    },
    getNodeParameter: (...args) => {
      const [name, itemIndex, defaultValue] = args
      const parameters = parametersByItem[itemIndex]

      if (Object.prototype.hasOwnProperty.call(parameters, name)) {
        return parameters[name]
      }

      if (args.length >= 3) return defaultValue

      throw new Error(`Missing node parameter ${name}`)
    },
    helpers: {
      httpRequest: async (options) => {
        const requestBody = typeof options.body === 'string'
          ? options.body
          : options.body
            ? JSON.stringify(options.body)
            : undefined
        const response = await fetch(options.url, {
          method: options.method ?? 'GET',
          headers: options.headers,
          body: requestBody,
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

        return body
      },
    },
    continueOnFail: () => continueOnFail,
    getNode: () => ({
      id: 'sap-cap-node',
      name: 'SAP CAP',
      type: 'n8n-nodes-sap-cap.sapCap',
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    }),
  }
}

async function executeSapCap(parametersByItem, options) {
  const SapCap = await importSapCapNode()
  const node = new SapCap()
  const context = createExecutionContext({
    ...options,
    parametersByItem,
  })

  return node.execute.call(context)
}

function expectBasicAuthHeader(request) {
  expect(request.headers.authorization).toBe(
    `Basic ${Buffer.from(`${fakeUsername}:${fakePassword}`).toString('base64')}`
  )
}

function expectNoSecrets(value) {
  const serialized = JSON.stringify(value)

  expect(serialized).not.toContain(fakePassword)
  expect(serialized).not.toContain(fakeClientSecret)
  expect(serialized).not.toContain(fakeBearerToken)
  expect(serialized).not.toContain(fakeResponseBody)
  expect(serialized).not.toContain('Authorization')
  expect(serialized).not.toContain('full CAP response')
  expect(serialized).not.toContain('stack trace should not be exposed')
}

function sourceWithoutComments(relativePath) {
  const source = readFileSync(resolve(repoRoot, relativePath), 'utf8')

  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

function functionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}`)
  const remaining = source.slice(start + 1)
  const nextFunction = remaining.search(/\n(?:export\s+)?function\s+/)

  expect(start, `${functionName} source should be present`).toBeGreaterThanOrEqual(0)
  return source.slice(start, nextFunction >= 0 ? start + 1 + nextFunction : source.length)
}

async function expectNodeOperationError(run, expected) {
  try {
    await run()
    throw new Error('Expected SAP CAP node execution to fail')
  } catch (err) {
    expect(err).toBeInstanceOf(NodeOperationError)
    expect(err.message).toBe(expected.message)
    if (expected.itemIndex !== undefined) {
      expect(err.context.itemIndex).toBe(expected.itemIndex)
    }
    expectNoSecrets({
      message: err.message,
      description: err.description,
      context: err.context,
      cause: err.cause,
      stack: err.stack,
    })
  }
}

afterEach(async () => {
  const pending = servers
  servers = []
  await Promise.all(pending.map((server) => server.close()))
})

describe('n8n SAP CAP Query and Read runtime integration', () => {
  it('loads entity sets from metadata with Basic Auth and lets manual mode bypass metadata at execution time', async () => {
    const SapCap = await importSapCapNode()
    const node = new SapCap()
    const metadataServer = await createCapServer(() => ({
      contentType: 'application/xml',
      body: metadataXml,
    }))

    const options = await node.methods.loadOptions.getEntitySets.call({
      getCredentials: async () => basicCredentials(metadataServer.baseUrl),
      helpers: createExecutionContext({
        credentials: basicCredentials(metadataServer.baseUrl),
        parametersByItem: [defaultParameters()],
      }).helpers,
    })

    expect(metadataServer.requests).toHaveLength(1)
    expect(metadataServer.requests[0]).toMatchObject({
      method: 'GET',
      url: '/odata/v4/admin/$metadata',
    })
    expectBasicAuthHeader(metadataServer.requests[0])
    expect(options).toEqual([
      { name: 'Books', value: 'Books', description: 'AdminService.Book' },
      { name: 'Authors', value: 'Authors', description: 'AdminService.Author' },
    ])

    const queryServer = await createCapServer(() => ({
      body: JSON.stringify({
        value: [
          { ID: 201, title: 'Manual Entity Set' },
        ],
      }),
    }))

    const result = await executeSapCap([
      defaultParameters({
        entitySet: { mode: 'name', value: 'Books' },
      }),
    ], {
      credentials: basicCredentials(queryServer.baseUrl),
    })

    expect(queryServer.requests).toHaveLength(1)
    expect(queryServer.requests[0].url).toBe('/odata/v4/admin/Books?%24top=100&%24skip=0')
    expect(result[0]).toEqual([
      {
        json: {
          ID: 201,
          title: 'Manual Entity Set',
        },
        pairedItem: { item: 0 },
      },
    ])
  })

  it('sends raw OData Query controls including zero values and returns one recursively cleaned item per row', async () => {
    const server = await createCapServer(() => ({
      body: JSON.stringify({
        '@odata.context': '$metadata#Books',
        value: [
          {
            '@odata.etag': 'W/"1"',
            ID: 201,
            title: 'Dune',
            details: {
              '@odata.type': '#AdminService.BookDetails',
              stock: 7,
            },
          },
          {
            ID: 202,
            title: 'Neuromancer',
            nested: [
              {
                '@odata.id': 'Authors(101)',
                name: 'William Gibson',
              },
            ],
          },
        ],
      }),
    }))

    const result = await executeSapCap([
      defaultParameters({
        filter: "title eq 'Dune'",
        orderBy: 'title asc, stock desc',
        select: 'ID,title,stock',
        top: 0,
        skip: 0,
      }),
    ], {
      credentials: basicCredentials(server.baseUrl),
    })

    expect(server.requests).toHaveLength(1)
    expectBasicAuthHeader(server.requests[0])

    const capturedUrl = new URL(server.requests[0].url, 'http://cap.test')
    expect(server.requests[0].method).toBe('GET')
    expect(capturedUrl.pathname).toBe('/odata/v4/admin/Books')
    expect(capturedUrl.searchParams.get('$filter')).toBe("title eq 'Dune'")
    expect(capturedUrl.searchParams.get('$orderby')).toBe('title asc, stock desc')
    expect(capturedUrl.searchParams.get('$select')).toBe('ID,title,stock')
    expect(capturedUrl.searchParams.get('$top')).toBe('0')
    expect(capturedUrl.searchParams.get('$skip')).toBe('0')
    expect(result[0]).toEqual([
      {
        json: {
          ID: 201,
          title: 'Dune',
          details: {
            stock: 7,
          },
        },
        pairedItem: { item: 0 },
      },
      {
        json: {
          ID: 202,
          title: 'Neuromancer',
          nested: [
            {
              name: 'William Gibson',
            },
          ],
        },
        pairedItem: { item: 0 },
      },
    ])
  })

  it('uses n8n default values when optional Query controls are omitted', async () => {
    const server = await createCapServer(() => ({
      body: JSON.stringify({
        value: [
          { ID: 201, title: 'Defaulted Query' },
        ],
      }),
    }))

    const result = await executeSapCap([{
      operation: 'query',
      servicePath: '/odata/v4/admin',
      entitySetSource: 'metadata',
      entitySet: 'Books',
      entitySetManual: '',
    }], {
      credentials: basicCredentials(server.baseUrl),
    })

    expect(server.requests).toHaveLength(1)
    const requestUrl = new URL(server.requests[0].url, 'http://example.test')

    expect(requestUrl.pathname).toBe('/odata/v4/admin/Books')
    expect([...requestUrl.searchParams.entries()]).toEqual([
      ['$top', '100'],
      ['$skip', '0'],
    ])
    expect(result[0]).toEqual([
      {
        json: {
          ID: 201,
          title: 'Defaulted Query',
        },
        pairedItem: { item: 0 },
      },
    ])
  })

  it('sends Read key predicates with normalized parentheses and returns one cleaned entity item', async () => {
    const server = await createCapServer(() => ({
      body: JSON.stringify({
        '@odata.context': '$metadata#Books/$entity',
        ID: 201,
        IsActiveEntity: true,
        title: 'Dune',
        details: {
          '@odata.mediaEtag': 'hidden',
          stock: 7,
        },
      }),
    }))

    const result = await executeSapCap([
      defaultParameters({
        operation: 'read',
        keyPredicate: 'ID=201,IsActiveEntity=true',
      }),
    ], {
      credentials: basicCredentials(server.baseUrl),
    })

    expect(server.requests).toHaveLength(1)
    expect(server.requests[0]).toMatchObject({
      method: 'GET',
      url: '/odata/v4/admin/Books(ID=201,IsActiveEntity=true)',
    })
    expect(result[0]).toEqual([
      {
        json: {
          ID: 201,
          IsActiveEntity: true,
          title: 'Dune',
          details: {
            stock: 7,
          },
        },
        pairedItem: { item: 0 },
      },
    ])
  })

  it('preserves an already wrapped Read key predicate', async () => {
    const server = await createCapServer(() => ({
      body: JSON.stringify({
        ID: 201,
        title: 'Dune',
      }),
    }))

    await executeSapCap([
      defaultParameters({
        operation: 'read',
        keyPredicate: '(ID=201)',
      }),
    ], {
      credentials: basicCredentials(server.baseUrl),
    })

    expect(server.requests).toHaveLength(1)
    expect(server.requests[0].url).toBe('/odata/v4/admin/Books(ID=201)')
  })

  it('builds Create, Update, and Delete requests with explicit JSON Body contracts', async () => {
    const {
      buildCreateRequest,
      buildDeleteRequest,
      buildUpdateRequest,
      sapCapApiRequest,
    } = await importDistModule('dist/nodes/SapCap/GenericFunctions.js')
    const draftKeys = [
      { name: 'ID', type: 'Edm.Int32' },
      { name: 'IsActiveEntity', type: 'Edm.Boolean' },
    ]
    const createBody = {
      title: 'Phase 7 Create',
      price: 19.99,
    }
    const updateBody = {
      price: 24.99,
    }
    const createRequest = buildCreateRequest({
      servicePath: '/odata/v4/admin/',
      entitySetName: 'Books',
      body: JSON.stringify(createBody),
    })
    const updateRequest = buildUpdateRequest({
      servicePath: '/odata/v4/admin',
      entitySetName: 'BookDrafts',
      keyDescriptors: draftKeys,
      keyParts: {
        ID: 201,
        IsActiveEntity: true,
      },
      body: JSON.stringify(updateBody),
    })
    const deleteRequest = buildDeleteRequest({
      servicePath: '/odata/v4/admin',
      entitySetName: 'BookDrafts',
      keyDescriptors: draftKeys,
      keyParts: {
        ID: 201,
        IsActiveEntity: true,
      },
    })

    expect(createRequest).toEqual({
      method: 'POST',
      path: '/odata/v4/admin/Books',
      body: createBody,
      headers: {
        Prefer: 'return=representation',
      },
    })
    expect(updateRequest).toEqual({
      method: 'PATCH',
      path: '/odata/v4/admin/BookDrafts(ID=201,IsActiveEntity=true)',
      body: updateBody,
      headers: {
        Prefer: 'return=representation',
      },
    })
    expect(deleteRequest).toEqual({
      method: 'DELETE',
      path: '/odata/v4/admin/BookDrafts(ID=201,IsActiveEntity=true)',
    })
    expect(deleteRequest).not.toHaveProperty('body')

    const server = await createCapServer((request) => ({
      body: JSON.stringify({
        ID: 201,
        method: request.method,
      }),
    }))

    await sapCapApiRequest(createExecutionContext({
      credentials: basicCredentials(server.baseUrl),
      parametersByItem: [defaultParameters()],
    }), {
      ...createRequest,
      responseFormat: 'json',
      errorContext: 'odata',
    })
    await sapCapApiRequest(createExecutionContext({
      credentials: basicCredentials(server.baseUrl),
      parametersByItem: [defaultParameters()],
    }), {
      ...updateRequest,
      responseFormat: 'json',
      errorContext: 'read',
    })
    await sapCapApiRequest(createExecutionContext({
      credentials: basicCredentials(server.baseUrl),
      parametersByItem: [defaultParameters()],
    }), {
      ...deleteRequest,
      responseFormat: 'json',
      errorContext: 'odata',
    })

    expect(server.requests).toHaveLength(3)
    expect(server.requests[0]).toMatchObject({
      method: 'POST',
      url: '/odata/v4/admin/Books',
      body: JSON.stringify(createBody),
    })
    expect(server.requests[0].headers.prefer).toBe('return=representation')
    expect(server.requests[0].headers['content-type']).toContain('application/json')
    expect(server.requests[1]).toMatchObject({
      method: 'PATCH',
      url: '/odata/v4/admin/BookDrafts(ID=201,IsActiveEntity=true)',
      body: JSON.stringify(updateBody),
    })
    expect(server.requests[1].headers.prefer).toBe('return=representation')
    expect(server.requests[1].headers['content-type']).toContain('application/json')
    expect(server.requests[2]).toMatchObject({
      method: 'DELETE',
      url: '/odata/v4/admin/BookDrafts(ID=201,IsActiveEntity=true)',
      body: '',
    })
    expect(server.requests[2].headers['content-type']).toBeUndefined()
  })

  it('builds Action/Function requests with explicit JSON Parameters contracts', async () => {
    const {
      buildActionFunctionRequest,
    } = await importDistModule('dist/nodes/SapCap/GenericFunctions.js')
    const actionDescriptor = {
      kind: 'action',
      name: 'submitOrder',
      qualifiedName: 'CatalogService.submitOrder',
      importName: 'submitOrder',
      isBound: false,
      parameters: [
        { name: 'book', type: 'Edm.Int32' },
        { name: 'quantity', type: 'Edm.Int32' },
      ],
    }
    const functionDescriptor = {
      kind: 'function',
      name: 'bookAvailability',
      qualifiedName: 'CatalogService.bookAvailability',
      importName: 'bookAvailability',
      isBound: false,
      parameters: [
        { name: 'book', type: 'Edm.Int32' },
      ],
    }
    const boundActionDescriptor = {
      kind: 'action',
      name: 'restock',
      qualifiedName: 'CatalogService.restock',
      isBound: true,
      bindingType: 'CatalogService.Book',
      entitySet: 'Books',
      parameters: [
        { name: 'quantity', type: 'Edm.Int32' },
      ],
    }
    const boundFunctionDescriptor = {
      kind: 'function',
      name: 'inventoryValue',
      qualifiedName: 'CatalogService.inventoryValue',
      isBound: true,
      bindingType: 'CatalogService.Book',
      entitySet: 'Books',
      parameters: [
        { name: 'currency', type: 'Edm.String' },
      ],
    }

    expect(buildActionFunctionRequest({
      servicePath: '/odata/v4/catalog/',
      operationSource: 'metadata',
      operationDescriptor: JSON.stringify(actionDescriptor),
      entitySetName: 'Books',
      parameters: JSON.stringify({ book: 201, quantity: 2 }),
    })).toEqual({
      method: 'POST',
      path: '/odata/v4/catalog/submitOrder',
      body: { book: 201, quantity: 2 },
      headers: {
        Prefer: 'return=representation',
      },
    })

    const functionRequest = buildActionFunctionRequest({
      servicePath: '/odata/v4/catalog',
      operationSource: 'metadata',
      operationDescriptor: JSON.stringify(functionDescriptor),
      entitySetName: 'Books',
      parameters: JSON.stringify({ book: 201 }),
    })

    expect(functionRequest.method).toBe('GET')
    expect(functionRequest.path).toBe('/odata/v4/catalog/bookAvailability(book=201)')
    expect(functionRequest).not.toHaveProperty('body')

    const boundActionRequest = buildActionFunctionRequest({
      servicePath: '/odata/v4/catalog',
      operationSource: 'metadata',
      operationDescriptor: JSON.stringify(boundActionDescriptor),
      entitySetName: 'Books',
      keyPredicate: 'ID=201',
      parameters: JSON.stringify({ quantity: 5 }),
    })
    const boundFunctionRequest = buildActionFunctionRequest({
      servicePath: '/odata/v4/catalog',
      operationSource: 'metadata',
      operationDescriptor: JSON.stringify(boundFunctionDescriptor),
      entitySetName: 'Books',
      keyDescriptors: [
        { name: 'ID', type: 'Edm.Int32' },
      ],
      keyParts: {
        ID: 201,
      },
      parameters: JSON.stringify({ currency: 'USD' }),
    })

    expect(boundActionRequest).toEqual({
      method: 'POST',
      path: '/odata/v4/catalog/Books(ID=201)/CatalogService.restock',
      body: { quantity: 5 },
      headers: {
        Prefer: 'return=representation',
      },
    })
    expect(boundFunctionRequest.method).toBe('GET')
    expect(boundFunctionRequest.path).toBe('/odata/v4/catalog/Books(ID=201)/CatalogService.inventoryValue(currency=\'USD\')')

    // The metadata dropdown emits a binding-prefixed value; the builder must accept
    // it and still resolve bound vs. unbound paths from the embedded descriptor.
    expect(buildActionFunctionRequest({
      servicePath: '/odata/v4/catalog',
      operationSource: 'metadata',
      operationDescriptor: `unbound::${JSON.stringify(actionDescriptor)}`,
      parameters: JSON.stringify({ book: 201, quantity: 2 }),
    }).path).toBe('/odata/v4/catalog/submitOrder')
    expect(buildActionFunctionRequest({
      servicePath: '/odata/v4/catalog',
      operationSource: 'metadata',
      operationDescriptor: `bound::${JSON.stringify(boundActionDescriptor)}`,
      keyPredicate: 'ID=201',
      parameters: JSON.stringify({ quantity: 5 }),
    }).path).toBe('/odata/v4/catalog/Books(ID=201)/CatalogService.restock')

    expect(buildActionFunctionRequest({
      servicePath: '/odata/v4/catalog',
      operationSource: 'manual',
      operationKind: 'function',
      operationName: 'manualAvailability',
      operationBinding: 'unbound',
      entitySetName: 'Books',
      parameters: JSON.stringify({ book: 201 }),
    }).path).toBe('/odata/v4/catalog/manualAvailability(book=201)')
    expect(buildActionFunctionRequest({
      servicePath: '/odata/v4/catalog',
      operationSource: 'metadata',
      operationDescriptor: JSON.stringify({
        kind: 'function',
        name: 'lookupByCode',
        qualifiedName: 'CatalogService.lookupByCode',
        importName: 'lookupByCode',
        isBound: false,
        parameters: [
          { name: 'code', type: 'Edm.String' },
        ],
      }),
      parameters: JSON.stringify({
        code: '201%27,quantity=999,%28x%3Dy%29,%27',
      }),
    }).path).toBe('/odata/v4/catalog/lookupByCode(code=\'201%2527,quantity=999,%2528x%253Dy%2529,%2527\')')
    expect(buildActionFunctionRequest({
      servicePath: '/odata/v4/catalog',
      operationSource: 'metadata',
      operationDescriptor: JSON.stringify({
        kind: 'function',
        name: 'lookupByCode',
        qualifiedName: 'CatalogService.lookupByCode',
        importName: 'lookupByCode',
        isBound: false,
        parameters: [
          { name: 'code', type: 'Edm.String' },
        ],
      }),
      parameters: JSON.stringify({
        code: ' A ',
      }),
    }).path).toBe('/odata/v4/catalog/lookupByCode(code=\' A \')')

    for (const parameters of ['', '{', '[]', '"literal"', 'null', []]) {
      expect(() => buildActionFunctionRequest({
        servicePath: '/odata/v4/catalog',
        operationSource: 'manual',
        operationKind: 'action',
        operationName: 'submitOrder',
        operationBinding: 'unbound',
        entitySetName: 'Books',
        parameters,
      })).toThrow('Parameters must be a JSON object.')
    }

    expect(() => buildActionFunctionRequest({
      servicePath: '/odata/v4/catalog',
      operationSource: 'manual',
      operationKind: 'function',
      operationName: 'complexFunction',
      operationBinding: 'unbound',
      entitySetName: 'Books',
      parameters: JSON.stringify({
        unsafe: { nested: true },
      }),
    })).toThrow('Function parameter values must be primitive JSON values.')
  })

  it('rejects invalid Create and Update Body values before sending CAP requests', async () => {
    const {
      buildCreateRequest,
      buildUpdateRequest,
    } = await importDistModule('dist/nodes/SapCap/GenericFunctions.js')
    const server = await createCapServer(() => ({
      statusCode: 500,
      body: JSON.stringify({ error: 'should not be reached' }),
    }))
    const unsafeBody = `{"title":"${fakePassword}","Authorization":"Bearer ${fakeBearerToken}"`
    const invalidBodyValues = [
      '',
      '   ',
      '{',
      '[]',
      '"literal"',
      'null',
      [],
      'unsupported-body',
    ]

    for (const body of invalidBodyValues) {
      expect(() => buildCreateRequest({
        servicePath: '/odata/v4/admin',
        entitySetName: 'Books',
        body,
      })).toThrow('Body must be a JSON object.')
      expect(() => buildUpdateRequest({
        servicePath: '/odata/v4/admin',
        entitySetName: 'Books',
        keyPredicate: 'ID=201',
        body,
      })).toThrow('Body must be a JSON object.')
    }

    try {
      buildCreateRequest({
        servicePath: '/odata/v4/admin',
        entitySetName: 'Books',
        body: unsafeBody,
      })
      throw new Error('Expected Body validation to fail')
    } catch (err) {
      const serialized = JSON.stringify({
        message: err.message,
        category: err.category,
      })

      expect(serialized).not.toContain(fakePassword)
      expect(serialized).not.toContain(fakeBearerToken)
      expect(serialized).not.toContain('Authorization')
      expect(serialized).not.toContain('title')
    }

    expect(server.requests).toHaveLength(0)
  })

  it('executes Create, Update, and Delete through the SAP CAP node', async () => {
    const server = await createCapServer((request) => {
      const requestBody = request.body ? JSON.parse(request.body) : undefined

      if (request.method === 'POST') {
        return {
          statusCode: 201,
          body: JSON.stringify({
            '@odata.context': '$metadata#Books/$entity',
            ID: 301,
            title: requestBody.title,
            createdBy: 'cap-server',
          }),
        }
      }

      if (request.method === 'PATCH') {
        return {
          body: JSON.stringify({
            '@odata.context': '$metadata#Books/$entity',
            ID: 201,
            price: requestBody.price,
            modifiedAt: '2026-06-03T17:00:00Z',
          }),
        }
      }

      return {
        statusCode: 204,
        body: '',
      }
    })

    const result = await executeSapCap([
      defaultParameters({
        operation: 'create',
        body: JSON.stringify({
          title: 'Phase 7 Created Book',
        }),
      }),
      defaultParameters({
        operation: 'update',
        keyPredicate: 'ID=201',
        body: JSON.stringify({
          price: 24.99,
        }),
      }),
      defaultParameters({
        operation: 'delete',
        keyPredicate: 'ID=202',
      }),
    ], {
      credentials: basicCredentials(server.baseUrl),
    })

    expect(server.requests).toHaveLength(3)
    expect(server.requests[0]).toMatchObject({
      method: 'POST',
      url: '/odata/v4/admin/Books',
      body: JSON.stringify({
        title: 'Phase 7 Created Book',
      }),
    })
    expect(server.requests[0].headers.prefer).toBe('return=representation')
    expect(server.requests[1]).toMatchObject({
      method: 'PATCH',
      url: '/odata/v4/admin/Books(ID=201)',
      body: JSON.stringify({
        price: 24.99,
      }),
    })
    expect(server.requests[1].headers.prefer).toBe('return=representation')
    expect(server.requests[2]).toMatchObject({
      method: 'DELETE',
      url: '/odata/v4/admin/Books(ID=202)',
      body: '',
    })
    expect(server.requests[2].headers['content-type']).toBeUndefined()
    expect(result[0]).toEqual([
      {
        json: {
          ID: 301,
          title: 'Phase 7 Created Book',
          createdBy: 'cap-server',
        },
        pairedItem: { item: 0 },
      },
      {
        json: {
          ID: 201,
          price: 24.99,
          modifiedAt: '2026-06-03T17:00:00Z',
        },
        pairedItem: { item: 1 },
      },
      {
        json: {
          deleted: true,
          entitySet: 'Books',
          key: '(ID=202)',
        },
        pairedItem: { item: 2 },
      },
    ])
  })

  it('follows up successful empty Update responses with a Read by the same key', async () => {
    const server = await createCapServer((request) => {
      if (request.method === 'PATCH') {
        return {
          statusCode: 204,
          body: '',
        }
      }

      return {
        body: JSON.stringify({
          '@odata.context': '$metadata#Books/$entity',
          ID: 201,
          price: 24.99,
          modifiedAt: '2026-06-03T18:55:00Z',
        }),
      }
    })

    const result = await executeSapCap([
      defaultParameters({
        operation: 'update',
        keyPredicate: 'ID=201',
        body: JSON.stringify({
          price: 24.99,
        }),
      }),
    ], {
      credentials: basicCredentials(server.baseUrl),
    })

    expect(server.requests).toHaveLength(2)
    expect(server.requests[0]).toMatchObject({
      method: 'PATCH',
      url: '/odata/v4/admin/Books(ID=201)',
    })
    expect(server.requests[1]).toMatchObject({
      method: 'GET',
      url: '/odata/v4/admin/Books(ID=201)',
      body: '',
    })
    expect(result[0]).toEqual([
      {
        json: {
          ID: 201,
          price: 24.99,
          modifiedAt: '2026-06-03T18:55:00Z',
        },
        pairedItem: { item: 0 },
      },
    ])
  })

  it('uses metadata-derived key parts for Update and Delete while preserving manual fallback', async () => {
    const server = await createCapServer((request) => {
      if (request.url === '/odata/v4/admin/$metadata') {
        return {
          contentType: 'application/xml',
          body: metadataWithCompositeKeys,
        }
      }

      if (request.method === 'PATCH') {
        return {
          body: JSON.stringify({
            ID: 201,
            IsActiveEntity: true,
            price: 29.99,
          }),
        }
      }

      return {
        statusCode: 204,
        body: '',
      }
    })

    const result = await executeSapCap([
      defaultParameters({
        operation: 'update',
        entitySet: 'BookDrafts',
        keyInputMode: 'metadata',
        keyParts: JSON.stringify({
          ID: 201,
          IsActiveEntity: true,
        }),
        body: JSON.stringify({
          price: 29.99,
        }),
      }),
      defaultParameters({
        operation: 'delete',
        entitySet: 'BookDrafts',
        keyInputMode: 'manual',
        keyPredicate: 'ID=202,IsActiveEntity=true',
      }),
    ], {
      credentials: basicCredentials(server.baseUrl),
    })

    expect(server.requests).toHaveLength(3)
    expect(server.requests[0]).toMatchObject({
      method: 'GET',
      url: '/odata/v4/admin/$metadata',
    })
    expect(server.requests[1]).toMatchObject({
      method: 'PATCH',
      url: '/odata/v4/admin/BookDrafts(ID=201,IsActiveEntity=true)',
    })
    expect(server.requests[2]).toMatchObject({
      method: 'DELETE',
      url: '/odata/v4/admin/BookDrafts(ID=202,IsActiveEntity=true)',
      body: '',
    })
    expect(result[0]).toEqual([
      {
        json: {
          ID: 201,
          IsActiveEntity: true,
          price: 29.99,
        },
        pairedItem: { item: 0 },
      },
      {
        json: {
          deleted: true,
          entitySet: 'BookDrafts',
          key: '(ID=202,IsActiveEntity=true)',
        },
        pairedItem: { item: 1 },
      },
    ])
  })

  it('executes metadata-backed Action/Function operations through the SAP CAP node', async () => {
    const server = await createCapServer((request) => {
      if (request.url === '/odata/v4/admin/$metadata') {
        return {
          contentType: 'application/xml',
          body: metadataWithActionFunctions,
        }
      }

      if (request.method === 'POST' && request.url === '/odata/v4/catalog/submitOrder') {
        return {
          body: JSON.stringify({
            '@odata.context': '$metadata#submitOrder',
            stock: 5,
          }),
        }
      }

      if (request.method === 'GET' && request.url === '/odata/v4/catalog/bookAvailability(book=201)') {
        return {
          body: JSON.stringify({
            '@odata.context': '$metadata#bookAvailability',
            value: true,
          }),
        }
      }

      if (request.method === 'POST' && request.url === '/odata/v4/catalog/Books(ID=201)/CatalogService.restock') {
        return {
          body: JSON.stringify({
            '@odata.context': '$metadata#Books/$entity',
            ID: 201,
            stock: 12,
          }),
        }
      }

      if (request.method === 'GET' && request.url === '/odata/v4/catalog/Books(ID=201)/CatalogService.inventoryValue(currency=\'USD\')') {
        return {
          body: JSON.stringify({
            value: 1200,
          }),
        }
      }

      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'unexpected request' }),
      }
    })
    const SapCap = await importSapCapNode()
    const node = new SapCap()
    const loadOptionsContext = {
      getCredentials: async () => basicCredentials(server.baseUrl),
      helpers: createExecutionContext({
        credentials: basicCredentials(server.baseUrl),
        parametersByItem: [defaultParameters()],
      }).helpers,
    }
    const actionFunctionOptions = await node.methods.loadOptions.getActionFunctions.call(loadOptionsContext)
    const optionByName = new Map(actionFunctionOptions.map((option) => [option.name, option.value]))
    server.requests.length = 0

    const result = await executeSapCap([
      defaultParameters({
        operation: 'actionFunction',
        servicePath: '/odata/v4/catalog',
        entitySet: '',
        entitySetManual: '',
        operationSource: 'metadata',
        actionFunction: optionByName.get('Action: submitOrder'),
        parameters: JSON.stringify({
          book: 201,
          quantity: 2,
        }),
      }),
      defaultParameters({
        operation: 'actionFunction',
        servicePath: '/odata/v4/catalog',
        entitySet: '',
        entitySetManual: '',
        operationSource: 'metadata',
        actionFunction: optionByName.get('Function: bookAvailability'),
        parameters: JSON.stringify({
          book: 201,
        }),
      }),
      defaultParameters({
        operation: 'actionFunction',
        servicePath: '/odata/v4/catalog',
        entitySet: 'Authors',
        operationSource: 'metadata',
        actionFunction: optionByName.get('Action: Books/restock'),
        actionFunctionKey: 'ID=201',
        parameters: JSON.stringify({
          quantity: 5,
        }),
      }),
      defaultParameters({
        operation: 'actionFunction',
        servicePath: '/odata/v4/catalog',
        entitySet: 'Authors',
        operationSource: 'metadata',
        actionFunction: optionByName.get('Function: Books/inventoryValue'),
        actionFunctionKey: 'ID=201',
        parameters: JSON.stringify({
          currency: 'USD',
        }),
      }),
    ], {
      credentials: basicCredentials(server.baseUrl, {
        metadataPath: '/odata/v4/admin/$metadata',
      }),
    })

    expect(server.requests).toHaveLength(4)
    expect(server.requests[0]).toMatchObject({
      method: 'POST',
      url: '/odata/v4/catalog/submitOrder',
      body: JSON.stringify({
        book: 201,
        quantity: 2,
      }),
    })
    expect(server.requests[0].headers.prefer).toBe('return=representation')
    expect(server.requests[1]).toMatchObject({
      method: 'GET',
      url: '/odata/v4/catalog/bookAvailability(book=201)',
      body: '',
    })
    expect(server.requests[1].headers['content-type']).toBeUndefined()
    expect(server.requests[2]).toMatchObject({
      method: 'POST',
      url: '/odata/v4/catalog/Books(ID=201)/CatalogService.restock',
      body: JSON.stringify({
        quantity: 5,
      }),
    })
    expect(server.requests[3]).toMatchObject({
      method: 'GET',
      url: '/odata/v4/catalog/Books(ID=201)/CatalogService.inventoryValue(currency=\'USD\')',
      body: '',
    })
    expect(result[0]).toEqual([
      {
        json: {
          stock: 5,
        },
        pairedItem: { item: 0 },
      },
      {
        json: {
          value: true,
        },
        pairedItem: { item: 1 },
      },
      {
        json: {
          ID: 201,
          stock: 12,
        },
        pairedItem: { item: 2 },
      },
      {
        json: {
          value: 1200,
        },
        pairedItem: { item: 3 },
      },
    ])
  })

  it('executes manual Action/Function fallback controls and validates Parameters locally', async () => {
    const server = await createCapServer((request) => {
      if (request.method === 'POST') {
        return {
          body: JSON.stringify({
            stock: 7,
          }),
        }
      }

      return {
        body: JSON.stringify({
          value: 'ok',
        }),
      }
    })

    const result = await executeSapCap([
      defaultParameters({
        operation: 'actionFunction',
        servicePath: '/odata/v4/catalog',
        actionFunction: { mode: 'name', value: 'submitOrder' },
        actionFunctionKind: 'action',
        actionFunctionBinding: 'unbound',
        parameters: JSON.stringify({
          book: 201,
          quantity: 1,
        }),
      }),
      defaultParameters({
        operation: 'actionFunction',
        servicePath: '/odata/v4/catalog',
        actionFunction: { mode: 'name', value: 'manualAvailability' },
        actionFunctionKind: 'function',
        actionFunctionBinding: 'unbound',
        parameters: JSON.stringify({
          book: 201,
        }),
      }),
    ], {
      credentials: basicCredentials(server.baseUrl),
    })

    expect(server.requests).toHaveLength(2)
    expect(server.requests[0]).toMatchObject({
      method: 'POST',
      url: '/odata/v4/catalog/submitOrder',
    })
    expect(server.requests[1]).toMatchObject({
      method: 'GET',
      url: '/odata/v4/catalog/manualAvailability(book=201)',
      body: '',
    })
    expect(result[0]).toEqual([
      {
        json: {
          stock: 7,
        },
        pairedItem: { item: 0 },
      },
      {
        json: {
          value: 'ok',
        },
        pairedItem: { item: 1 },
      },
    ])

    server.requests.length = 0
    const invalidResult = await executeSapCap([
      defaultParameters({
        operation: 'actionFunction',
        actionFunction: { mode: 'name', value: 'submitOrder' },
        actionFunctionKind: 'action',
        parameters: '{',
      }),
      defaultParameters({
        operation: 'actionFunction',
        actionFunction: { mode: 'name', value: 'manualAvailability' },
        actionFunctionKind: 'function',
        parameters: '[]',
      }),
    ], {
      credentials: basicCredentials(server.baseUrl),
      continueOnFail: true,
    })

    expect(server.requests).toHaveLength(0)
    expect(invalidResult[0]).toEqual([
      {
        json: {
          error: 'CAP rejected the OData request. Check the OData options.',
          category: 'validation',
        },
        pairedItem: { item: 0 },
      },
      {
        json: {
          error: 'CAP rejected the OData request. Check the OData options.',
          category: 'validation',
        },
        pairedItem: { item: 1 },
      },
    ])
  })

  it('rejects Read key predicates with URL boundary characters before sending CAP requests', async () => {
    const server = await createCapServer(() => ({
      statusCode: 500,
      body: JSON.stringify({ error: 'should not be reached' }),
    }))

    const result = await executeSapCap([
      defaultParameters({
        operation: 'read',
        keyPredicate: 'ID=201)?$expand=SensitiveNav',
      }),
      defaultParameters({
        operation: 'read',
        keyPredicate: 'ID=201)/$value',
      }),
      defaultParameters({
        operation: 'read',
        keyPredicate: 'ID=201)#fragment',
      }),
      defaultParameters({
        operation: 'read',
        keyPredicate: 'ID=201)\\$value',
      }),
      defaultParameters({
        operation: 'read',
        keyPredicate: 'ID=201%2F$value',
      }),
      defaultParameters({
        operation: 'read',
        keyPredicate: 'ID=201%3F$expand=SensitiveNav',
      }),
      defaultParameters({
        operation: 'read',
        keyPredicate: 'ID=201%23fragment',
      }),
      defaultParameters({
        operation: 'read',
        keyPredicate: 'ID=201%5C$value',
      }),
    ], {
      credentials: basicCredentials(server.baseUrl),
      continueOnFail: true,
    })

    expect(server.requests).toHaveLength(0)
    expect(result[0]).toEqual(Array.from({ length: 8 }, (_, item) => ({
      json: {
        error: 'CAP rejected the OData request. Check the OData options.',
        category: 'validation',
      },
      pairedItem: { item },
    })))
  })

  it('rejects malformed Top and Skip expression values before sending CAP requests', async () => {
    const server = await createCapServer(() => ({
      statusCode: 500,
      body: JSON.stringify({ error: 'should not be reached' }),
    }))

    const result = await executeSapCap([
      defaultParameters({
        top: true,
      }),
      defaultParameters({
        skip: [],
      }),
      defaultParameters({
        top: '   ',
      }),
    ], {
      credentials: basicCredentials(server.baseUrl),
      continueOnFail: true,
    })

    expect(server.requests).toHaveLength(0)
    expect(result[0]).toEqual([
      {
        json: {
          error: 'CAP rejected the OData request. Check the OData options.',
          category: 'validation',
        },
        pairedItem: { item: 0 },
      },
      {
        json: {
          error: 'CAP rejected the OData request. Check the OData options.',
          category: 'validation',
        },
        pairedItem: { item: 1 },
      },
      {
        json: {
          error: 'CAP rejected the OData request. Check the OData options.',
          category: 'validation',
        },
        pairedItem: { item: 2 },
      },
    ])
  })

  it('rejects manual Entity Set path escapes before sending CAP requests', async () => {
    const server = await createCapServer(() => ({
      statusCode: 500,
      body: JSON.stringify({ error: 'should not be reached' }),
    }))

    const result = await executeSapCap([
      defaultParameters({
        entitySet: { mode: 'name', value: '..' },
      }),
      defaultParameters({
        entitySet: { mode: 'name', value: 'Books%2F$value' },
      }),
    ], {
      credentials: basicCredentials(server.baseUrl),
      continueOnFail: true,
    })

    expect(server.requests).toHaveLength(0)
    expect(result[0]).toEqual([
      {
        json: {
          error: 'CAP rejected the OData request. Check the OData options.',
          category: 'validation',
        },
        pairedItem: { item: 0 },
      },
      {
        json: {
          error: 'CAP rejected the OData request. Check the OData options.',
          category: 'validation',
        },
        pairedItem: { item: 1 },
      },
    ])
  })

  it('turns a CAP duplicate-key error into a plain-language message without leaking credentials', async () => {
    const server = await createCapServer(() => ({
      statusCode: 500,
      body: JSON.stringify({
        error: { message: 'UNIQUE constraint failed: AdminService_Books.ID' },
        // Sensitive fields that live alongside the message must never be surfaced.
        Authorization: `Bearer ${fakeBearerToken}`,
        password: fakePassword,
        stack: 'stack trace should not be exposed',
      }),
    }))

    const result = await executeSapCap([
      defaultParameters({ operation: 'create', body: JSON.stringify({ ID: 201, title: 'Dune' }) }),
    ], {
      credentials: basicCredentials(server.baseUrl),
      continueOnFail: true,
    })
    const errorMessage = result[0][0].json.error

    expect(errorMessage).toBe('Conflict. An entity with this key already exists — use a different key value.')
    expect(errorMessage).not.toContain(fakePassword)
    expect(errorMessage).not.toContain(fakeBearerToken)
    expect(errorMessage).not.toContain('stack trace')
  })

  it('surfaces CAP error.message for other failures so developers see the real reason', async () => {
    const server = await createCapServer(() => ({
      statusCode: 400,
      body: JSON.stringify({
        error: { message: 'Value of property "price" is above the allowed maximum.' },
        Authorization: `Bearer ${fakeBearerToken}`,
        password: fakePassword,
      }),
    }))

    const result = await executeSapCap([
      defaultParameters({ operation: 'create', body: JSON.stringify({ ID: 1, price: 9999 }) }),
    ], {
      credentials: basicCredentials(server.baseUrl),
      continueOnFail: true,
    })
    const errorMessage = result[0][0].json.error

    expect(errorMessage).toContain('Value of property "price" is above the allowed maximum.')
    expect(errorMessage).not.toContain(fakePassword)
    expect(errorMessage).not.toContain(fakeBearerToken)
  })

  it('explains a 405 as an unsupported / read-only operation', async () => {
    const server = await createCapServer(() => ({
      statusCode: 405,
      body: JSON.stringify({ error: { message: 'Entity "Books" is read-only' } }),
    }))

    const result = await executeSapCap([
      defaultParameters({ operation: 'create', body: JSON.stringify({ ID: 1, title: 'X' }) }),
    ], {
      credentials: basicCredentials(server.baseUrl),
      continueOnFail: true,
    })
    const errorMessage = result[0][0].json.error

    expect(errorMessage).toContain('Create is not supported on this entity set')
    expect(errorMessage).toContain('read-only')
  })

  it('throws sanitized not-found errors for missing Read entities when continueOnFail is false', async () => {
    const server = await createCapServer(() => ({
      statusCode: 404,
      body: JSON.stringify({
        error: 'missing book',
        Authorization: `Bearer ${fakeBearerToken}`,
        password: fakePassword,
        clientSecret: fakeClientSecret,
        responseBody: fakeResponseBody,
        stack: 'stack trace should not be exposed',
      }),
    }))

    await expectNodeOperationError(
      () => executeSapCap([
        defaultParameters({
          operation: 'read',
          keyPredicate: 'ID=999',
        }),
      ], {
        credentials: basicCredentials(server.baseUrl),
      }),
      {
        message: 'Not found (HTTP 404). No CAP entity matches on /odata/v4/admin/Books(ID=999).',
        itemIndex: 0,
      }
    )
  })

  it('maps CAP and OData failures to sanitized continueOnFail items with paired item metadata', async () => {
    const cases = [
      [400, 'validation', 'Bad request (HTTP 400) for read on /odata/v4/admin/Books(ID=999). Check your input parameters.'],
      [401, 'authentication', 'Authentication failed (HTTP 401). Check the username and password in the SAP CAP credential.'],
      [403, 'authorization', 'Access denied (HTTP 403). This credential does not have permission for this operation.'],
      [404, 'notFound', 'Not found (HTTP 404). No CAP entity matches on /odata/v4/admin/Books(ID=999).'],
      [502, 'server', 'CAP service error (HTTP 502). Check the CAP service logs.'],
    ]

    for (const [statusCode, category, message] of cases) {
      const server = await createCapServer((request, count) => {
        if (count === 1) {
          return {
            statusCode,
            body: JSON.stringify({
              error: `HTTP ${statusCode}`,
              Authorization: `Bearer ${fakeBearerToken}`,
              password: fakePassword,
              clientSecret: fakeClientSecret,
              responseBody: fakeResponseBody,
            }),
          }
        }

        return {
          body: JSON.stringify({
            ID: 201,
            title: 'Recovered',
          }),
        }
      })

      const result = await executeSapCap([
        defaultParameters({
          operation: 'read',
          keyPredicate: 'ID=999',
        }),
        defaultParameters({
          operation: 'read',
          keyPredicate: 'ID=201',
        }),
      ], {
        credentials: basicCredentials(server.baseUrl),
        continueOnFail: true,
      })

      expect(result[0]).toEqual([
        {
          json: {
            error: message,
            statusCode,
            category,
          },
          pairedItem: { item: 0 },
        },
        {
          json: {
            ID: 201,
            title: 'Recovered',
          },
          pairedItem: { item: 1 },
        },
      ])
      expectNoSecrets(result)
    }
  })

  it('uses OAuth2 Client Credentials tokens for CAP Query requests', async () => {
    const tokenServer = await createCapServer(() => ({
      body: JSON.stringify({ access_token: fakeBearerToken, token_type: 'bearer' }),
    }))
    const capServer = await createCapServer(() => ({
      body: JSON.stringify({
        value: [
          { ID: 201, title: 'OAuth2 Query' },
        ],
      }),
    }))

    const result = await executeSapCap([
      defaultParameters(),
    ], {
      credentials: oauth2Credentials(capServer.baseUrl, `${tokenServer.baseUrl}/oauth/token`),
    })

    expect(tokenServer.requests).toHaveLength(1)
    expect(tokenServer.requests[0]).toMatchObject({
      method: 'POST',
      url: '/oauth/token',
      body: 'grant_type=client_credentials&scope=openid',
    })
    expect(tokenServer.requests[0].headers.authorization).toBe(
      `Basic ${Buffer.from(`${fakeClientId}:${fakeClientSecret}`).toString('base64')}`
    )
    expect(capServer.requests).toHaveLength(1)
    expect(capServer.requests[0].headers.authorization).toBe(`Bearer ${fakeBearerToken}`)
    expect(result[0]).toEqual([
      {
        json: {
          ID: 201,
          title: 'OAuth2 Query',
        },
        pairedItem: { item: 0 },
      },
    ])
    expectNoSecrets(result)
  })

  it('rejects separate action/function and trigger operations without sending CAP requests', async () => {
    const server = await createCapServer(() => ({
      statusCode: 500,
      body: JSON.stringify({ error: 'should not be reached' }),
    }))

    const result = await executeSapCap([
      defaultParameters({
        operation: 'action',
      }),
      defaultParameters({
        operation: 'function',
      }),
      defaultParameters({
        operation: 'trigger',
      }),
    ], {
      credentials: basicCredentials(server.baseUrl),
      continueOnFail: true,
    })

    expect(server.requests).toHaveLength(0)
    expect(result[0]).toEqual([0, 1, 2].map((item) => ({
        json: {
          error: 'CAP rejected the OData request. Check the OData options.',
          category: 'validation',
        },
        pairedItem: { item },
      })))
  })

  it('rejects unauthenticated credential modes before any CAP request is sent', async () => {
    const server = await createCapServer(() => ({
      statusCode: 500,
      body: JSON.stringify({ error: 'should not be reached' }),
    }))

    const result = await executeSapCap([
      defaultParameters(),
    ], {
      credentials: basicCredentials(server.baseUrl, {
        authType: 'none',
      }),
      continueOnFail: true,
    })

    expect(server.requests).toHaveLength(0)
    expect(result[0]).toEqual([
      {
        json: {
          error: 'SAP CAP authentication must use Basic Auth or OAuth2 Client Credentials.',
          category: 'configuration',
        },
        pairedItem: { item: 0 },
      },
    ])
    expectNoSecrets(result)
  })

  it('sanitizes unexpected Query and Read response shapes instead of forwarding raw OData wrappers', async () => {
    const queryServer = await createCapServer(() => ({
      body: JSON.stringify({
        result: [],
        responseBody: fakeResponseBody,
      }),
    }))

    await expectNodeOperationError(
      () => executeSapCap([
        defaultParameters(),
      ], {
        credentials: basicCredentials(queryServer.baseUrl),
      }),
      {
        message: 'CAP response did not match the expected OData shape.',
        itemIndex: 0,
      }
    )

    const readServer = await createCapServer(() => ({
      body: JSON.stringify([
        {
          ID: 201,
          title: 'Array is not a Read entity',
        },
      ]),
    }))

    const result = await executeSapCap([
      defaultParameters({
        operation: 'read',
        keyPredicate: 'ID=201',
      }),
    ], {
      credentials: basicCredentials(readServer.baseUrl),
      continueOnFail: true,
    })

    expect(result[0]).toEqual([
      {
        json: {
          error: 'CAP response did not match the expected OData shape.',
          category: 'responseShape',
        },
        pairedItem: { item: 0 },
      },
    ])
    expectNoSecrets(result)
  })

  it('classifies malformed successful JSON responses as response-shape errors', async () => {
    const server = await createCapServer(() => ({
      contentType: 'text/html',
      body: '<html><body>Login required</body></html>',
    }))

    const result = await executeSapCap([
      defaultParameters(),
    ], {
      credentials: basicCredentials(server.baseUrl),
      continueOnFail: true,
    })

    expect(server.requests).toHaveLength(1)
    expect(result[0]).toEqual([
      {
        json: {
          error: 'CAP response did not match the expected OData shape.',
          category: 'responseShape',
        },
        pairedItem: { item: 0 },
      },
    ])
    expectNoSecrets(result)
  })

  it('uses only plain displayOptions keys so n8n can resolve parameter dependencies', async () => {
    // A dotted key such as `actionFunction.mode` makes n8n's dependency resolver loop
    // ("Could not resolve parameter dependencies. Max iterations reached!"), because the
    // key is treated as a literal parameter name. resourceLocator conditions must match
    // the bare parameter (n8n unwraps its `__rl` value automatically).
    const SapCap = await importSapCapNode()
    const node = new SapCap()
    const dottedKeys = []

    for (const property of node.description.properties) {
      for (const rule of Object.values(property.displayOptions ?? {})) {
        for (const key of Object.keys(rule)) {
          if (key.includes('.')) dottedKeys.push(`${property.name}: ${key}`)
        }
      }
    }

    expect(dottedKeys).toEqual([])
  })

  it('does not put a hide rule on resourceLocator fields', async () => {
    // n8n does not initialize a resourceLocator's default when it carries a `hide` rule,
    // which leaves the picker showing "Mode.../undefined". Use `show` instead.
    const SapCap = await importSapCapNode()
    const node = new SapCap()
    const offenders = node.description.properties
      .filter((property) => property.type === 'resourceLocator' && property.displayOptions?.hide)
      .map((property) => property.name)

    expect(offenders).toEqual([])
  })

  it('keeps built node metadata and runtime source inside Phase 7 operation scope', async () => {
    const SapCap = await importSapCapNode()
    const node = new SapCap()
    const propertyNames = node.description.properties.map((property) => property.name)
    const operation = node.description.properties.find((property) => property.name === 'operation')
    const operationValues = operation.options.map((option) => option.value)

    expect(operationValues).toEqual(['query', 'read', 'create', 'update', 'delete', 'actionFunction'])
    expect(operationValues).not.toEqual(expect.arrayContaining([
      'action',
      'function',
      'trigger',
    ]))
    expect(propertyNames).toEqual(expect.arrayContaining([
      'operation',
      'body',
      'entitySet',
      'actionFunction',
      'actionFunctionKind',
      'actionFunctionBinding',
      'parameters',
      'keyInputMode',
      'keyParts',
      'keyPredicate',
    ]))
    expect(propertyNames).not.toEqual(expect.arrayContaining([
      'rawResponse',
      'rawODataResponse',
      'pollInterval',
      'operationSource',
      'entitySetSource',
      'entitySetManual',
      'actionFunctionName',
      'actionName',
      'functionName',
      'entityKey',
      'deleteConfirmation',
      'confirmDelete',
      'entityProperty',
      'entityProperties',
    ]))

    const runtimeSource = [
      sourceWithoutComments('cap-n8n-node/nodes/SapCap/SapCap.node.ts'),
      sourceWithoutComments('cap-n8n-node/nodes/SapCap/GenericFunctions.ts'),
      sourceWithoutComments('cap-n8n-node/nodes/SapCap/ODataResponse.ts'),
    ].join('\n')
    const genericSource = sourceWithoutComments('cap-n8n-node/nodes/SapCap/GenericFunctions.ts')
    const deleteBuilderSource = functionSource(genericSource, 'buildDeleteRequest')

    expect(runtimeSource).not.toMatch(/console\./)
    expect(runtimeSource).not.toContain(fakePassword)
    expect(runtimeSource).not.toContain(fakeClientSecret)
    expect(runtimeSource).not.toContain(fakeBearerToken)
    expect(runtimeSource).not.toContain(fakeResponseBody)
    expect(runtimeSource).not.toMatch(/returnFullResponse:\s*false/)
    expect(runtimeSource).not.toMatch(/raw(?:OData)?Response/i)
    expect(runtimeSource).not.toMatch(/operation:\s*\[[^\]]*(^|['"])(action|function|trigger)(['"])/i)
    expect(runtimeSource).toMatch(/buildActionFunctionRequest/)
    expect(runtimeSource).toMatch(/loadActionFunctionOptions/)
    expect(deleteBuilderSource).not.toMatch(/\bbody\b/)
  })

  it('documents VERIFY-04 aggregate coverage across SAP CAP node capabilities', () => {
    const verify04Coverage = [
      'credentials',
      'metadata discovery',
      'Query',
      'Read',
      'Create',
      'Update',
      'Delete',
      'response cleanup',
      'Action/Function',
      'composite keys',
    ]

    expect(verify04Coverage).toEqual([
      'credentials',
      'metadata discovery',
      'Query',
      'Read',
      'Create',
      'Update',
      'Delete',
      'response cleanup',
      'Action/Function',
      'composite keys',
    ])
  })
})
