import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')
const n8nPackageDir = resolve(repoRoot, 'cap-n8n-node')

async function importDistModule(relativePath) {
  const modulePath = resolve(n8nPackageDir, relativePath)

  expect(existsSync(modulePath), `${relativePath} should exist after build`).toBe(true)
  return import(pathToFileURL(modulePath).href)
}

// Mirrors the error shape createHttpStatusError produces: a status code, a category,
// and (when CAP returned a body) the already-sanitized CAP error.message as `detail`.
function capError({ statusCode, category, detail } = {}) {
  return Object.assign(new Error('raw'), {
    ...(statusCode !== undefined ? { statusCode } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(detail !== undefined ? { detail } : {}),
  })
}

describe('SAP CAP node error messages', () => {
  it('produces a clear, human-friendly message for every failure case', async () => {
    const { classifySapCapError } = await importDistModule('dist/nodes/SapCap/ODataResponse.js')

    const cases = [
      // --- Interpreted, plain-language conflicts ---
      {
        name: 'duplicate primary key on create',
        err: { statusCode: 500, category: 'server', detail: 'UNIQUE constraint failed: AdminService_Books.ID' },
        context: { operation: 'create' },
        message: 'Conflict. An entity with this key already exists — use a different key value.',
      },
      {
        name: 'draft conflict on update',
        err: { statusCode: 409, category: 'validation', detail: 'A draft for this entity already exists' },
        context: { operation: 'update' },
        message: 'Conflict (HTTP 409). A draft for this entity already exists — activate or discard the existing draft before editing it again.',
      },
      // --- 405 read-only / unsupported, per operation ---
      {
        name: '405 create',
        err: { statusCode: 405, category: 'validation' },
        context: { operation: 'create' },
        message: 'Operation not allowed (HTTP 405). Create is not supported on this entity set — it may be read-only.',
      },
      {
        name: '405 update',
        err: { statusCode: 405, category: 'validation' },
        context: { operation: 'update' },
        message: 'Operation not allowed (HTTP 405). Update is not supported on this entity set — it may be read-only.',
      },
      {
        name: '405 delete',
        err: { statusCode: 405, category: 'validation' },
        context: { operation: 'delete' },
        message: 'Operation not allowed (HTTP 405). Delete is not supported on this entity set — it may be read-only.',
      },
      // --- Auth ---
      {
        name: '401 authentication',
        err: { statusCode: 401, category: 'authentication' },
        context: { operation: 'query' },
        message: 'Authentication failed (HTTP 401). Check the username and password in the SAP CAP credential.',
      },
      {
        name: '403 authorization',
        err: { statusCode: 403, category: 'authorization' },
        context: { operation: 'query' },
        message: 'Access denied (HTTP 403). This credential does not have permission for this operation.',
      },
      // --- Not found ---
      {
        name: '404 read (no detail)',
        err: { statusCode: 404, category: 'notFound' },
        context: { operation: 'read' },
        message: 'Not found (HTTP 404). No CAP entity matches the selected entity set and key.',
      },
      {
        name: '404 update (no detail)',
        err: { statusCode: 404, category: 'notFound' },
        context: { operation: 'update' },
        message: 'Not found (HTTP 404). No CAP entity matches the selected entity set and key.',
      },
      {
        name: '404 delete (no detail)',
        err: { statusCode: 404, category: 'notFound' },
        context: { operation: 'delete' },
        message: 'Not found (HTTP 404). No CAP entity matches the selected entity set and key.',
      },
      {
        name: '404 with a specific CAP reason',
        err: { statusCode: 404, category: 'notFound', detail: 'Invalid resource path "AdminService.DoesNotExist"' },
        context: { operation: 'query' },
        message: 'Not found (HTTP 404) — Invalid resource path "AdminService.DoesNotExist".',
      },
      {
        name: '404 with a bare "Not Found" reason is not repeated',
        err: { statusCode: 404, category: 'notFound', detail: 'Not Found' },
        context: { operation: 'read' },
        message: 'Not found (HTTP 404). No CAP entity matches the selected entity set and key.',
      },
      {
        name: '404 metadata',
        err: { statusCode: 404, category: 'notFound' },
        context: { operation: 'metadata' },
        message: 'Not found (HTTP 404). The CAP metadata endpoint was not found. Check the Base URL and Metadata Path.',
      },
      {
        name: '404 action/function',
        err: { statusCode: 404, category: 'notFound' },
        context: { operation: 'actionFunction' },
        message: 'Not found (HTTP 404). No action/function matches. Check the operation, service path, and key.',
      },
      {
        name: '404 generic (query)',
        err: { statusCode: 404, category: 'notFound' },
        context: { operation: 'query' },
        message: 'Not found (HTTP 404). No CAP entity matches the selected entity set and key.',
      },
      // --- Validation / server, surfacing CAP's own message ---
      {
        name: '400 with CAP reason',
        err: { statusCode: 400, category: 'validation', detail: 'Value of property "price" is above the allowed maximum.' },
        context: { operation: 'create' },
        message: 'Bad request (HTTP 400) for create — Value of property "price" is above the allowed maximum. Check your input parameters.',
      },
      {
        name: '400 without a reason',
        err: { statusCode: 400, category: 'validation' },
        context: { operation: 'query' },
        message: 'Bad request (HTTP 400) for query. Check your input parameters.',
      },
      {
        name: '409 generic conflict',
        err: { statusCode: 409, category: 'validation', detail: 'Some conflict' },
        context: { operation: 'create' },
        message: 'Conflict (HTTP 409). The operation conflicts with existing data — Some conflict.',
      },
      {
        name: '500 with CAP reason',
        err: { statusCode: 502, category: 'server', detail: 'Downstream service unavailable' },
        context: { operation: 'query' },
        message: 'CAP service error (HTTP 502) — Downstream service unavailable. Check the CAP service logs.',
      },
      {
        name: '500 without a reason',
        err: { statusCode: 500, category: 'server' },
        context: { operation: 'query' },
        message: 'CAP service error (HTTP 500). Check the CAP service logs.',
      },
      {
        name: '503 service unavailable',
        err: { statusCode: 503, category: 'server' },
        context: { operation: 'query' },
        message: 'CAP service unavailable (HTTP 503). The service may be starting up or overloaded. Try again shortly.',
      },
      // --- Non-HTTP categories ---
      {
        name: 'network failure',
        err: { category: 'network' },
        context: { operation: 'query' },
        message: 'Could not reach the CAP service. Check the Base URL and network access from n8n.',
      },
      {
        name: 'network failure loading metadata',
        err: { category: 'network' },
        context: { operation: 'metadata' },
        message: 'Could not reach the CAP metadata endpoint. Check the Base URL and network access from n8n.',
      },
      {
        name: 'configuration failure',
        err: { category: 'configuration' },
        context: { operation: 'query' },
        message: 'SAP CAP authentication must use Basic Auth or OAuth2 Client Credentials.',
      },
      {
        name: 'response shape failure',
        err: { category: 'responseShape' },
        context: { operation: 'query' },
        message: 'CAP response did not match the expected OData shape.',
      },
    ]

    for (const testCase of cases) {
      const safeError = classifySapCapError(capError(testCase.err), testCase.context)

      expect(safeError.message, testCase.name).toBe(testCase.message)
    }
  })

  it('never lets a draft conflict be mislabeled as a duplicate key', async () => {
    const { classifySapCapError } = await importDistModule('dist/nodes/SapCap/ODataResponse.js')

    const draft = classifySapCapError(
      capError({ statusCode: 409, category: 'validation', detail: 'A draft for this entity already exists' }),
      { operation: 'update' }
    )
    const duplicate = classifySapCapError(
      capError({ statusCode: 500, category: 'server', detail: 'UNIQUE constraint failed: Books.ID' }),
      { operation: 'create' }
    )

    expect(draft.message).not.toContain('key already exists')
    expect(draft.message).toContain('draft')
    expect(duplicate.message).toContain('key already exists')
    expect(duplicate.message).not.toContain('draft')
  })

  it('extracts only CAP error.message from a failed response, never credentials', async () => {
    const { sapCapApiRequest } = await importDistModule('dist/nodes/SapCap/GenericFunctions.js')
    const { classifySapCapError } = await importDistModule('dist/nodes/SapCap/ODataResponse.js')

    // A realistic CAP error body with sensitive fields sitting next to the message.
    const body = JSON.stringify({
      error: { message: 'Value of property "price" is above the allowed maximum.', code: 'ASSERT_RANGE' },
      Authorization: 'Bearer super-secret-token',
      password: 'super-secret-password',
      stack: 'at Object.<anonymous> secret stack frame',
    })
    const context = {
      getCredentials: async () => ({
        baseUrl: 'http://cap.test',
        metadataPath: '/odata/v4/admin/$metadata',
        authType: 'basicAuth',
        username: 'u',
        password: 'super-secret-password',
      }),
      helpers: {
        httpRequest: async () => ({ statusCode: 400, headers: {}, body }),
      },
    }

    let caught
    try {
      await sapCapApiRequest(context, { method: 'POST', path: '/odata/v4/admin/Books', body: { ID: 1 }, responseFormat: 'json', errorContext: 'odata' })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    const message = classifySapCapError(caught, { operation: 'create' }).message

    expect(message).toContain('Value of property "price" is above the allowed maximum.')
    expect(message).not.toContain('super-secret-token')
    expect(message).not.toContain('super-secret-password')
    expect(message).not.toContain('secret stack frame')
  })
})
