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
    clientId: 'phase6-fake-client-id',
    clientSecret: fakeClientSecret,
    scope: 'openid',
    ...overrides,
  }
}

function defaultParameters(overrides = {}) {
  return {
    operation: 'query',
    servicePath: '/odata/v4/admin',
    entitySetSource: 'metadata',
    entitySet: 'Books',
    entitySetManual: '',
    filter: '',
    orderBy: '',
    select: '',
    top: 100,
    skip: 0,
    keyPredicate: '',
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
    getNodeParameter: (name, itemIndex, defaultValue) => {
      const parameters = parametersByItem[itemIndex]

      if (Object.prototype.hasOwnProperty.call(parameters, name)) {
        return parameters[name]
      }

      if (arguments.length >= 3) return defaultValue

      throw new Error(`Missing node parameter ${name}`)
    },
    helpers: {
      httpRequest: async (options) => {
        const response = await fetch(options.url, {
          method: options.method ?? 'GET',
          headers: options.headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
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
        entitySetSource: 'manual',
        entitySet: '',
        entitySetManual: 'Books',
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
        message: 'CAP entity was not found for the selected entity set and key predicate.',
        itemIndex: 0,
      }
    )
  })

  it('maps CAP and OData failures to sanitized continueOnFail items with paired item metadata', async () => {
    const cases = [
      [400, 'validation', 'CAP rejected the OData request. Check the OData options.'],
      [401, 'authentication', 'CAP authentication failed. Check the SAP CAP API credential.'],
      [403, 'authorization', 'CAP authorization failed. This credential cannot access the CAP service.'],
      [404, 'notFound', 'CAP entity was not found for the selected entity set and key predicate.'],
      [502, 'server', 'CAP service returned a server error. Try again or check the CAP service logs.'],
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

  it('rejects stale OAuth2 credentials before any CAP request is sent', async () => {
    const server = await createCapServer(() => ({
      body: JSON.stringify({ value: [] }),
    }))

    const result = await executeSapCap([
      defaultParameters(),
    ], {
      credentials: basicCredentials(server.baseUrl, {
        authType: 'oauth2',
      }),
      continueOnFail: true,
    })

    expect(server.requests).toHaveLength(0)
    expect(result[0]).toEqual([
      {
        json: {
          error: 'SAP CAP authentication currently supports Basic Auth only.',
          category: 'configuration',
        },
        pairedItem: { item: 0 },
      },
    ])
    expectNoSecrets(result)
  })

  it('rejects deferred mutation/action/trigger operations without sending CAP requests', async () => {
    const server = await createCapServer(() => ({
      statusCode: 500,
      body: JSON.stringify({ error: 'should not be reached' }),
    }))

    const result = await executeSapCap([
      defaultParameters({
        operation: 'create',
      }),
      defaultParameters({
        operation: 'delete',
      }),
      defaultParameters({
        operation: 'action',
      }),
      defaultParameters({
        operation: 'trigger',
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
      {
        json: {
          error: 'CAP rejected the OData request. Check the OData options.',
          category: 'validation',
        },
        pairedItem: { item: 3 },
      },
    ])
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
          error: 'SAP CAP authentication currently supports Basic Auth only.',
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

  it('keeps built node metadata and runtime source inside Phase 6 read-only scope', async () => {
    const SapCap = await importSapCapNode()
    const node = new SapCap()
    const propertyNames = node.description.properties.map((property) => property.name)
    const operation = node.description.properties.find((property) => property.name === 'operation')
    const operationValues = operation.options.map((option) => option.value)

    expect(operationValues).toEqual(['query', 'read'])
    expect(operationValues).not.toEqual(expect.arrayContaining([
      'create',
      'update',
      'delete',
      'action',
      'function',
      'trigger',
    ]))
    expect(propertyNames).not.toEqual(expect.arrayContaining([
      'body',
      'rawResponse',
      'rawODataResponse',
      'pollInterval',
      'actionName',
      'functionName',
      'entityKey',
    ]))

    const runtimeSource = [
      sourceWithoutComments('cap-n8n-node/nodes/SapCap/SapCap.node.ts'),
      sourceWithoutComments('cap-n8n-node/nodes/SapCap/GenericFunctions.ts'),
      sourceWithoutComments('cap-n8n-node/nodes/SapCap/ODataResponse.ts'),
    ].join('\n')

    expect(runtimeSource).not.toMatch(/console\./)
    expect(runtimeSource).not.toContain(fakePassword)
    expect(runtimeSource).not.toContain(fakeClientSecret)
    expect(runtimeSource).not.toContain(fakeBearerToken)
    expect(runtimeSource).not.toContain(fakeResponseBody)
    expect(runtimeSource).not.toMatch(/returnFullResponse:\s*false/)
    expect(runtimeSource).not.toMatch(/raw(?:OData)?Response/i)
    expect(runtimeSource).not.toMatch(/operation:\s*\[[^\]]*(create|update|delete|action|function|trigger)/i)
  })
})
