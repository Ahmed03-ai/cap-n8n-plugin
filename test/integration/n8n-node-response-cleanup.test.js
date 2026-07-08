import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')
const n8nPackageDir = resolve(repoRoot, 'cap-n8n-node')
const fakePassword = 'super-secret-password-for-test'
const fakeBearerToken = 'Bearer secret-bearer-token-for-test'
const fakeBasicToken = 'Basic dXNlcjpzdXBlci1zZWNyZXQ='
const fakeClientSecret = 'client-secret-value-for-test'
const fakeResponseBody = 'full CAP response should not be exposed'

async function importResponseHelpers() {
  const modulePath = resolve(n8nPackageDir, 'dist/nodes/SapCap/ODataResponse.js')

  expect(existsSync(modulePath), 'ODataResponse helper should exist after n8n package build').toBe(true)
  return import(pathToFileURL(modulePath).href)
}

function expectResponseShapeFailure(run) {
  try {
    run()
    throw new Error('Expected response shape validation to fail')
  } catch (err) {
    expect(err).toMatchObject({
      message: 'CAP response did not match the expected OData shape.',
      category: 'responseShape',
    })
  }
}

function statusError(statusCode, message = `HTTP ${statusCode}`) {
  return Object.assign(new Error(message), {
    statusCode,
    response: {
      statusCode,
      headers: {
        authorization: fakeBearerToken,
        cookie: 'cap-session-cookie-for-test',
      },
      body: {
        error: message,
        password: fakePassword,
        clientSecret: fakeClientSecret,
        responseBody: fakeResponseBody,
      },
    },
    request: {
      headers: {
        Authorization: fakeBasicToken,
      },
      body: {
        password: fakePassword,
      },
    },
  })
}

function expectSerializedSafeError(value) {
  const serialized = JSON.stringify(value)

  expect(serialized).not.toContain(fakePassword)
  expect(serialized).not.toContain(fakeBearerToken)
  expect(serialized).not.toContain(fakeBasicToken)
  expect(serialized).not.toContain(fakeClientSecret)
  expect(serialized).not.toContain(fakeResponseBody)
  expect(serialized).not.toContain('Authorization')
  expect(serialized).not.toContain('cookie')
  expect(serialized).not.toContain('cap-session-cookie-for-test')
  expect(serialized).not.toContain('stack')
}

describe('n8n SAP CAP OData response cleanup helpers', () => {
  it('unwraps Query collection responses into cleaned n8n items', async () => {
    const { normalizeODataItems, stripODataMetadata } = await importResponseHelpers()
    const response = {
      '@odata.context': '$metadata#Books',
      value: [
        {
          '@odata.etag': 'W/"1"',
          ID: 201,
          title: 'Dune',
          'title@odata.type': '#String',
          stock: 7,
          available: true,
          author: {
            '@odata.id': 'Authors(101)',
            ID: 101,
            name: 'Frank Herbert',
            'Books@odata.count': 12,
          },
          tags: [
            {
              '@odata.type': '#AdminService.Tag',
              code: 'sci-fi',
              'code@odata.type': '#String',
            },
          ],
          nullable: null,
        },
        {
          ID: 202,
          title: 'Neuromancer',
          stock: 0,
        },
      ],
    }

    expect(stripODataMetadata(response.value[0])).toEqual({
      ID: 201,
      title: 'Dune',
      stock: 7,
      available: true,
      author: {
        ID: 101,
        name: 'Frank Herbert',
      },
      tags: [
        {
          code: 'sci-fi',
        },
      ],
      nullable: null,
    })
    expect(normalizeODataItems('query', response, 3)).toEqual([
      {
        json: {
          ID: 201,
          title: 'Dune',
          stock: 7,
          available: true,
          author: {
            ID: 101,
            name: 'Frank Herbert',
          },
          tags: [
            {
              code: 'sci-fi',
            },
          ],
          nullable: null,
        },
        pairedItem: { item: 3 },
      },
      {
        json: {
          ID: 202,
          title: 'Neuromancer',
          stock: 0,
        },
        pairedItem: { item: 3 },
      },
    ])
  })

  it('returns zero Query items for empty OData collections', async () => {
    const { normalizeODataItems } = await importResponseHelpers()

    expect(normalizeODataItems('query', { value: [] }, 0)).toEqual([])
  })

  it('normalizes Read entity responses into one cleaned n8n item', async () => {
    const { normalizeODataItems } = await importResponseHelpers()

    expect(normalizeODataItems('read', {
      '@odata.context': '$metadata#Books/$entity',
      ID: 201,
      title: 'Dune',
      metadataLikeField: '@odata.should-stay-as-value',
      details: {
        '@odata.mediaEtag': 'hidden',
        IsActiveEntity: true,
      },
    }, 1)).toEqual([
      {
        json: {
          ID: 201,
          title: 'Dune',
          metadataLikeField: '@odata.should-stay-as-value',
          details: {
            IsActiveEntity: true,
          },
        },
        pairedItem: { item: 1 },
      },
    ])
  })

  it('drops unsafe object keys while recursively stripping OData metadata', async () => {
    const { stripODataMetadata } = await importResponseHelpers()
    const payload = JSON.parse(`{
      "__proto__": { "polluted": true },
      "constructor": { "prototype": { "polluted": true } },
      "prototype": { "polluted": true },
      "@odata.context": "$metadata#Books",
      "ID": 201,
      "details": {
        "__proto__": { "nested": true },
        "stock": 7
      }
    }`)
    const cleaned = stripODataMetadata(payload)

    expect(Object.getPrototypeOf(cleaned)).toBeNull()
    expect(cleaned).toMatchObject({
      ID: 201,
      details: {
        stock: 7,
      },
    })
    expect(cleaned).not.toHaveProperty('__proto__')
    expect(cleaned).not.toHaveProperty('constructor')
    expect(cleaned).not.toHaveProperty('prototype')
    expect(cleaned.details).not.toHaveProperty('__proto__')
    expect({}.polluted).toBeUndefined()
  })

  it('normalizes Create and Update returned entities into cleaned n8n items', async () => {
    const { normalizeODataItems } = await importResponseHelpers()

    expect(normalizeODataItems('create', {
      '@odata.context': '$metadata#Books/$entity',
      ID: 301,
      title: 'Created Entity',
      audit: {
        '@odata.type': '#AdminService.Audit',
        createdBy: 'cap-server',
      },
    }, 2)).toEqual([
      {
        json: {
          ID: 301,
          title: 'Created Entity',
          audit: {
            createdBy: 'cap-server',
          },
        },
        pairedItem: { item: 2 },
      },
    ])
    expect(normalizeODataItems('update', {
      '@odata.context': '$metadata#Books/$entity',
      ID: 201,
      price: 24.99,
      modifiedAt: '2026-06-03T17:00:00Z',
    }, 3)).toEqual([
      {
        json: {
          ID: 201,
          price: 24.99,
          modifiedAt: '2026-06-03T17:00:00Z',
        },
        pairedItem: { item: 3 },
      },
    ])
  })

  it('normalizes Action/Function returned values into one cleaned n8n item', async () => {
    const { normalizeODataItems } = await importResponseHelpers()

    expect(normalizeODataItems('actionFunction', {
      '@odata.context': '$metadata#submitOrder',
      stock: 5,
      audit: {
        '@odata.type': '#CatalogService.ActionAudit',
        status: 'accepted',
      },
    }, 4)).toEqual([
      {
        json: {
          stock: 5,
          audit: {
            status: 'accepted',
          },
        },
        pairedItem: { item: 4 },
      },
    ])
    expect(normalizeODataItems('actionFunction', {
      '@odata.context': '$metadata#bookAvailability',
      value: true,
    }, 5)).toEqual([
      {
        json: {
          value: true,
        },
        pairedItem: { item: 5 },
      },
    ])
    expect(normalizeODataItems('actionFunction', [
      {
        '@odata.etag': 'W/"1"',
        ID: 201,
      },
    ], 6)).toEqual([
      {
        json: {
          value: [
            {
              ID: 201,
            },
          ],
        },
        pairedItem: { item: 6 },
      },
    ])
    expect(normalizeODataItems('actionFunction', 1200, 7)).toEqual([
      {
        json: {
          value: 1200,
        },
        pairedItem: { item: 7 },
      },
    ])
    expect(normalizeODataItems('actionFunction', undefined, 8)).toEqual([
      {
        json: {
          success: true,
        },
        pairedItem: { item: 8 },
      },
    ])
  })

  it('normalizes Delete confirmation output and rejects unexpected Delete shapes', async () => {
    const { normalizeODataItems } = await importResponseHelpers()

    expect(normalizeODataItems('delete', {
      deleted: true,
      entitySet: 'Books',
      key: '(ID=202)',
    }, 4)).toEqual([
      {
        json: {
          deleted: true,
          entitySet: 'Books',
          key: '(ID=202)',
        },
        pairedItem: { item: 4 },
      },
    ])
    expectResponseShapeFailure(() => normalizeODataItems('delete', { ID: 202 }, 4))
    expectResponseShapeFailure(() => normalizeODataItems('delete', { value: [] }, 4))
  })

  it('rejects unexpected Query and Read response shapes as responseShape errors', async () => {
    const helpers = await importResponseHelpers()
    const { normalizeODataItems } = helpers

    expect(helpers).not.toHaveProperty('normalizeRawODataResponse')
    expectResponseShapeFailure(() => normalizeODataItems('query', { result: [] }, 0))
    expectResponseShapeFailure(() => normalizeODataItems('query', { value: {} }, 0))
    expectResponseShapeFailure(() => normalizeODataItems('read', [], 0))
    expectResponseShapeFailure(() => normalizeODataItems('read', null, 0))
    expectResponseShapeFailure(() => normalizeODataItems('create', { '@odata.context': '$metadata#Books/$entity' }, 0))
    expectResponseShapeFailure(() => normalizeODataItems('update', { '@odata.context': '$metadata#Books/$entity' }, 0))
    expectResponseShapeFailure(() => normalizeODataItems('actionFunction', { '@odata.context': '$metadata#submitOrder' }, 0))
  })

  it('classifies CAP and OData failures into sanitized n8n categories', async () => {
    const { classifySapCapError } = await importResponseHelpers()
    const cases = [
      [
        statusError(401),
        { operation: 'query' },
        {
          message: 'Authentication failed (HTTP 401). Check the username and password in the SAP CAP credential.',
          statusCode: 401,
          category: 'authentication',
        },
      ],
      [
        statusError(403),
        { operation: 'query' },
        {
          message: 'Access denied (HTTP 403). This credential does not have permission for this operation.',
          statusCode: 403,
          category: 'authorization',
        },
      ],
      [
        statusError(404),
        { operation: 'read' },
        {
          message: 'Not found (HTTP 404). No CAP entity matches the selected entity set and key.',
          statusCode: 404,
          category: 'notFound',
        },
      ],
      [
        statusError(404),
        { operation: 'delete' },
        {
          message: 'Not found (HTTP 404). No CAP entity matches the selected entity set and key.',
          statusCode: 404,
          category: 'notFound',
        },
      ],
      [
        statusError(404),
        { operation: 'actionFunction' },
        {
          message: 'Not found (HTTP 404). No action/function matches. Check the operation, service path, and key.',
          statusCode: 404,
          category: 'notFound',
        },
      ],
      [
        statusError(404),
        { operation: 'metadata' },
        {
          message: 'Not found (HTTP 404). The CAP metadata endpoint was not found. Check the Base URL and Metadata Path.',
          statusCode: 404,
          category: 'notFound',
        },
      ],
      [
        statusError(404),
        { operation: 'query' },
        {
          message: 'Not found (HTTP 404). No CAP entity matches the selected entity set and key.',
          statusCode: 404,
          category: 'notFound',
        },
      ],
      [
        statusError(400),
        { operation: 'query' },
        {
          message: 'Bad request (HTTP 400) for query. Check your input parameters.',
          statusCode: 400,
          category: 'validation',
        },
      ],
      [
        statusError(502),
        { operation: 'query' },
        {
          message: 'CAP service error (HTTP 502). Check the CAP service logs.',
          statusCode: 502,
          category: 'server',
        },
      ],
      [
        new Error(`getaddrinfo ENOTFOUND ${fakeBearerToken} ${fakePassword}`),
        { operation: 'query' },
        {
          message: 'Could not reach the CAP service. Check the Base URL and network access from n8n.',
          category: 'network',
        },
      ],
      [
        Object.assign(new Error('raw bad shape'), { category: 'responseShape' }),
        { operation: 'query' },
        {
          message: 'CAP response did not match the expected OData shape.',
          category: 'responseShape',
        },
      ],
      [
        Object.assign(new Error(`OAuth failed with ${fakeClientSecret}`), { category: 'configuration' }),
        { operation: 'query' },
        {
          message: 'SAP CAP authentication must use Basic Auth or OAuth2 Client Credentials.',
          category: 'configuration',
        },
      ],
    ]

    for (const [err, context, expected] of cases) {
      const safeError = classifySapCapError(err, context)

      expect(safeError).toEqual(expected)
      expectSerializedSafeError(safeError)
    }
  })

  it('omits auth headers, tokens, secrets, stack traces, and full response bodies from safe errors', async () => {
    const { classifySapCapError } = await importResponseHelpers()
    const err = statusError(500, `CAP exploded with ${fakeBearerToken} and ${fakePassword}`)
    err.stack = `Error: ${fakeClientSecret}\n    at unsafe-stack`

    const safeError = classifySapCapError(err, {
      operation: 'query',
      requestOptions: {
        headers: {
          Authorization: fakeBasicToken,
        },
        body: {
          password: fakePassword,
        },
      },
    })

    expect(safeError).toEqual({
      message: 'CAP service error (HTTP 500). Check the CAP service logs.',
      statusCode: 500,
      category: 'server',
    })
    expectSerializedSafeError(safeError)
  })

  it('creates continueOnFail items with safe structured error JSON', async () => {
    const { classifySapCapError, toContinueOnFailItem } = await importResponseHelpers()
    const safeValidationError = {
      message: 'Bad request (HTTP 400) for query. Check your input parameters.',
      statusCode: 400,
      category: 'validation',
    }
    const safeNetworkError = classifySapCapError(
      new Error(`network failed with ${fakeBearerToken} and ${fakeResponseBody}`),
      { operation: 'query' }
    )
    const safeDeleteNotFoundError = classifySapCapError(
      statusError(404, `missing row ${fakeBearerToken} ${fakeResponseBody}`),
      { operation: 'delete' }
    )
    const safeActionFunctionNotFoundError = classifySapCapError(
      statusError(404, `missing action ${fakeBearerToken} ${fakeResponseBody}`),
      { operation: 'actionFunction' }
    )

    expect(toContinueOnFailItem(safeValidationError, 4)).toEqual({
      json: {
        error: 'Bad request (HTTP 400) for query. Check your input parameters.',
        statusCode: 400,
        category: 'validation',
      },
      pairedItem: { item: 4 },
    })
    expect(toContinueOnFailItem(safeNetworkError, 5)).toEqual({
      json: {
        error: 'Could not reach the CAP service. Check the Base URL and network access from n8n.',
        category: 'network',
      },
      pairedItem: { item: 5 },
    })
    expect(toContinueOnFailItem(safeNetworkError, 5).json).not.toHaveProperty('statusCode')
    expect(toContinueOnFailItem(safeDeleteNotFoundError, 6)).toEqual({
      json: {
        error: 'Not found (HTTP 404). No CAP entity matches the selected entity set and key.',
        statusCode: 404,
        category: 'notFound',
      },
      pairedItem: { item: 6 },
    })
    expect(toContinueOnFailItem(safeActionFunctionNotFoundError, 7)).toEqual({
      json: {
        error: 'Not found (HTTP 404). No action/function matches. Check the operation, service path, and key.',
        statusCode: 404,
        category: 'notFound',
      },
      pairedItem: { item: 7 },
    })
    expectSerializedSafeError(toContinueOnFailItem(safeNetworkError, 5))
    expectSerializedSafeError(toContinueOnFailItem(safeDeleteNotFoundError, 6))
    expectSerializedSafeError(toContinueOnFailItem(safeActionFunctionNotFoundError, 7))
  })

  it('creates sanitized NodeOperationError instances without wrapping raw HTTP internals', async () => {
    const { NodeOperationError } = require('n8n-workflow')
    const { classifySapCapError, toNodeOperationError } = await importResponseHelpers()
    const rawError = statusError(500, `raw CAP failure ${fakeBearerToken} ${fakeResponseBody}`)
    rawError.stack = `Error: ${fakeClientSecret}\n    at unsafe-stack`
    const safeError = classifySapCapError(rawError, { operation: 'query' })
    const node = {
      id: 'sap-cap-node',
      name: 'SAP CAP',
      type: 'n8n-nodes-sap-cap.sapCap',
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    }
    const nodeError = toNodeOperationError(node, safeError, 6)
    const serialized = JSON.stringify({
      message: nodeError.message,
      description: nodeError.description,
      context: nodeError.context,
      cause: nodeError.cause,
      stack: nodeError.stack,
    })

    expect(nodeError).toBeInstanceOf(NodeOperationError)
    expect(nodeError.message).toBe('CAP service error (HTTP 500). Check the CAP service logs.')
    expect(nodeError.context.itemIndex).toBe(6)
    expect(serialized).not.toContain(fakePassword)
    expect(serialized).not.toContain(fakeBearerToken)
    expect(serialized).not.toContain(fakeBasicToken)
    expect(serialized).not.toContain(fakeClientSecret)
    expect(serialized).not.toContain(fakeResponseBody)
  })
})
