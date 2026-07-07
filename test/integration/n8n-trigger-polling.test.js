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

const metadataWithTimestamps = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <edm:Schema Namespace="AdminService" xmlns:edm="http://docs.oasis-open.org/odata/ns/edm">
      <edm:EntityType Name="Book">
        <edm:Key>
          <edm:PropertyRef Name="ID" />
        </edm:Key>
        <edm:Property Name="ID" Type="Edm.Int32" Nullable="false" />
        <edm:Property Name="title" Type="Edm.String" />
        <edm:Property Name="createdAt" Type="Edm.DateTimeOffset" />
        <edm:Property Name="modifiedAt" Type="Edm.DateTimeOffset" />
      </edm:EntityType>
      <edm:EntityContainer Name="EntityContainer">
        <edm:EntitySet Name="Books" EntityType="AdminService.Book" />
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

// Mock CAP service: serves $metadata as XML and entity-set queries as OData JSON.
async function createCapServer(respondToQuery) {
  const requests = []
  const sockets = new Set()
  const server = createServer(async (req, res) => {
    const request = { method: req.method, url: req.url, headers: req.headers }

    requests.push(request)

    if (req.url.includes('$metadata')) {
      res.statusCode = 200
      res.setHeader('content-type', 'application/xml')
      res.end(metadataWithTimestamps)
      return
    }

    const result = respondToQuery(request, requests.length)

    res.statusCode = result.statusCode ?? 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(result.body ?? { value: [] }))
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

function basicCredentials(baseUrl) {
  return {
    baseUrl,
    metadataPath: '/odata/v4/admin/$metadata',
    authType: 'basicAuth',
    username: fakeUsername,
    password: fakePassword,
  }
}

function httpHelpers() {
  return {
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

      return body
    },
  }
}

function pollContext(credentials, params, { staticData = {}, mode = 'trigger' } = {}) {
  return {
    getCredentials: async () => credentials,
    helpers: httpHelpers(),
    getNode: () => ({ name: 'SAP CAP Trigger', type: 'sapCapTrigger', typeVersion: 1 }),
    getMode: () => mode,
    getWorkflowStaticData: () => staticData,
    getNodeParameter: (name, fallback) => (name in params ? params[name] : fallback),
  }
}

function triggerParams(baseUrl, overrides = {}) {
  return {
    servicePath: '/odata/v4/admin',
    entitySet: { mode: 'list', value: 'Books' },
    timestampField: 'modifiedAt',
    firstPollBehavior: 'startFromNow',
    additionalFilter: '',
    maxRecords: 200,
    ...overrides,
  }
}

async function newTrigger() {
  const { SapCapTrigger } = await importDistModule('dist/nodes/SapCap/SapCapTrigger.node.js')

  return new SapCapTrigger()
}

afterEach(async () => {
  await Promise.all(servers.map((server) => server.close()))
  servers = []
})

describe('SAP CAP polling trigger', () => {
  it('records a watermark and emits nothing on the first Start From Now poll', async () => {
    const trigger = await newTrigger()
    const server = await createCapServer(() => ({ body: { value: [{ ID: 1, modifiedAt: '2024-01-01T00:00:00Z' }] } }))
    const staticData = {}

    const result = await trigger.poll.call(
      pollContext(basicCredentials(server.baseUrl), triggerParams(server.baseUrl), { staticData })
    )

    expect(result).toBeNull()
    expect(typeof staticData.lastPolledAt).toBe('string')
    // No data query should be issued; the trigger only sets its starting point.
    expect(server.requests).toHaveLength(0)
  })

  it('fetches all existing records on the first poll when configured to', async () => {
    const trigger = await newTrigger()
    const server = await createCapServer(() => ({
      body: {
        value: [
          { ID: 1, title: 'A', modifiedAt: '2024-01-01T10:00:00Z' },
          { ID: 2, title: 'B', modifiedAt: '2024-01-02T10:00:00Z' },
        ],
      },
    }))
    const staticData = {}

    const result = await trigger.poll.call(
      pollContext(
        basicCredentials(server.baseUrl),
        triggerParams(server.baseUrl, { firstPollBehavior: 'fetchAll' }),
        { staticData }
      )
    )

    expect(result).toEqual([[
      { json: { ID: 1, title: 'A', modifiedAt: '2024-01-01T10:00:00Z' }, pairedItem: { item: 0 } },
      { json: { ID: 2, title: 'B', modifiedAt: '2024-01-02T10:00:00Z' }, pairedItem: { item: 0 } },
    ]])
    expect(staticData.lastPolledAt).toBe('2024-01-02T10:00:00Z')
    expect(staticData.lastSeenKeys).toEqual(['ID:2'])

    const dataRequest = server.requests.find((request) => request.url.includes('/Books'))
    expect(dataRequest.url).toContain('%24orderby=modifiedAt+asc'.replace(/\+/g, '%20'))
    expect(dataRequest.url).not.toContain('%24filter')
  })

  it('fetches incrementally and de-duplicates the boundary record', async () => {
    const trigger = await newTrigger()
    const server = await createCapServer(() => ({
      body: {
        value: [
          // Already emitted last time (same timestamp as the stored watermark).
          { ID: 2, title: 'B', modifiedAt: '2024-01-02T10:00:00Z' },
          // New record written in the same second as the watermark.
          { ID: 3, title: 'C', modifiedAt: '2024-01-02T10:00:00Z' },
          { ID: 4, title: 'D', modifiedAt: '2024-01-03T09:00:00Z' },
        ],
      },
    }))
    const staticData = {
      lastPolledAt: '2024-01-02T10:00:00Z',
      lastSeenKeys: ['ID:2'],
    }

    const result = await trigger.poll.call(
      pollContext(basicCredentials(server.baseUrl), triggerParams(server.baseUrl), { staticData })
    )

    expect(result).toEqual([[
      { json: { ID: 3, title: 'C', modifiedAt: '2024-01-02T10:00:00Z' }, pairedItem: { item: 0 } },
      { json: { ID: 4, title: 'D', modifiedAt: '2024-01-03T09:00:00Z' }, pairedItem: { item: 0 } },
    ]])
    expect(staticData.lastPolledAt).toBe('2024-01-03T09:00:00Z')
    expect(staticData.lastSeenKeys).toEqual(['ID:4'])

    const dataRequest = server.requests.find((request) => request.url.includes('/Books'))
    expect(decodeURIComponent(dataRequest.url)).toContain('$filter=modifiedAt ge 2024-01-02T10:00:00Z')
  })

  it('combines an additional filter with the timestamp condition', async () => {
    const trigger = await newTrigger()
    const server = await createCapServer(() => ({ body: { value: [] } }))

    await trigger.poll.call(
      pollContext(
        basicCredentials(server.baseUrl),
        triggerParams(server.baseUrl, { additionalFilter: 'stock gt 0' }),
        { staticData: { lastPolledAt: '2024-01-02T10:00:00Z', lastSeenKeys: [] } }
      )
    )

    const dataRequest = server.requests.find((request) => request.url.includes('/Books'))
    expect(decodeURIComponent(dataRequest.url)).toContain('$filter=(stock gt 0) and modifiedAt ge 2024-01-02T10:00:00Z')
  })

  it('re-emits the same record when it changes again with a newer timestamp', async () => {
    const trigger = await newTrigger()
    const server = await createCapServer(() => ({
      // Book 2 was already emitted at the last watermark, then changed AGAIN (newer ts).
      body: { value: [{ ID: 2, title: 'B', modifiedAt: '2024-01-02T10:05:00Z' }] },
    }))
    const staticData = { lastPolledAt: '2024-01-02T10:00:00Z', lastSeenKeys: ['ID:2'] }

    const result = await trigger.poll.call(
      pollContext(basicCredentials(server.baseUrl), triggerParams(server.baseUrl), { staticData })
    )

    expect(result).toEqual([[
      { json: { ID: 2, title: 'B', modifiedAt: '2024-01-02T10:05:00Z' }, pairedItem: { item: 0 } },
    ]])
    expect(staticData.lastPolledAt).toBe('2024-01-02T10:05:00Z')
    expect(staticData.lastSeenKeys).toEqual(['ID:2'])
  })

  it('returns null when an incremental poll finds no new records', async () => {
    const trigger = await newTrigger()
    const server = await createCapServer(() => ({ body: { value: [] } }))
    const staticData = { lastPolledAt: '2024-01-02T10:00:00Z', lastSeenKeys: ['ID:2'] }

    const result = await trigger.poll.call(
      pollContext(basicCredentials(server.baseUrl), triggerParams(server.baseUrl), { staticData })
    )

    expect(result).toBeNull()
  })

  it('emits sample data in manual mode without advancing the watermark', async () => {
    const trigger = await newTrigger()
    const server = await createCapServer(() => ({
      body: { value: [{ ID: 9, title: 'Z', modifiedAt: '2024-05-01T00:00:00Z' }] },
    }))
    const staticData = {}

    const result = await trigger.poll.call(
      pollContext(basicCredentials(server.baseUrl), triggerParams(server.baseUrl), { staticData, mode: 'manual' })
    )

    expect(result).toEqual([[
      { json: { ID: 9, title: 'Z', modifiedAt: '2024-05-01T00:00:00Z' }, pairedItem: { item: 0 } },
    ]])
    // Manual test runs must not persist polling state.
    expect(staticData.lastPolledAt).toBeUndefined()
  })

  it('raises a sanitized node error when the CAP query fails', async () => {
    const trigger = await newTrigger()
    const server = await createCapServer(() => ({ statusCode: 500, body: { error: 'boom' } }))
    const staticData = { lastPolledAt: '2024-01-02T10:00:00Z', lastSeenKeys: [] }

    await expect(
      trigger.poll.call(pollContext(basicCredentials(server.baseUrl), triggerParams(server.baseUrl), { staticData }))
    ).rejects.toThrow()
  })

  it('lists only date/time fields, with CAP managed columns first', async () => {
    const { extractTimestampFieldOptions } = await importDistModule('dist/nodes/SapCap/ODataMetadata.js')

    const options = extractTimestampFieldOptions(metadataWithTimestamps, 'Books')

    // Non-temporal fields (ID, title, …) must not appear — only valid change markers.
    expect(options.map((option) => option.value)).toEqual([
      'modifiedAt',
      'createdAt',
    ])
  })
})
