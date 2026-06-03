import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const cliPath = path.join(repoRoot, 'cap-n8n-plugin', 'bin', 'cap-n8n.js')

const tempRoots = []
const liveApiKey = 'live-import-secret-api-key'
const typedSchema = {
  inputs: {
    bookId: { type: 'Integer', required: true },
    title: { type: 'String', required: true }
  }
}
const secretFragments = [
  liveApiKey,
  /authorization/i,
  /Bearer\s+/i,
  /request-body-secret/i,
  /live-response-secret/i,
  /stack trace should not be exposed/i
]

afterEach(async () => {
  while (tempRoots.length) {
    const entry = tempRoots.pop()
    if (entry?.close) {
      await entry.close()
    } else {
      rmSync(entry, { recursive: true, force: true })
    }
  }
})

function tempRoot(prefix = 'cap-n8n-live-import-') {
  const root = mkdtempSync(path.join(tmpdir(), prefix))
  tempRoots.push(root)
  return root
}

function liveWorkflow(overrides = {}) {
  return {
    id: 'live-workflow-id',
    name: 'Live CAP Hook',
    nodes: [{
      parameters: {
        httpMethod: 'POST',
        path: 'live-cap-hook',
        options: {}
      },
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.1,
      position: [0, 0],
      id: 'live-webhook-node',
      name: 'Webhook'
    }],
    connections: {},
    settings: {
      executionOrder: 'v1'
    },
    ...overrides
  }
}

function alternateWorkflow() {
  return liveWorkflow({
    id: 'second-live-workflow-id',
    name: 'Second Live Hook',
    nodes: [{
      parameters: {
        httpMethod: 'POST',
        path: 'second-live-hook',
        options: {}
      },
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.1,
      position: [0, 0],
      id: 'second-live-webhook-node',
      name: 'Webhook'
    }]
  })
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

async function writeAppPackage(appRoot, n8nConfig) {
  await writeJson(path.join(appRoot, 'package.json'), {
    name: 'tmp-live-import-app',
    cds: {
      requires: {
        n8n: n8nConfig
      }
    }
  })
}

async function createWorkflowServer(respond) {
  const requests = []
  const sockets = new Set()
  const server = createServer(async (req, res) => {
    req.setEncoding('utf8')
    let body = ''

    for await (const chunk of req) body += chunk

    const request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body
    }
    requests.push(request)

    const response = await respond(request, requests.length)
    res.statusCode = response.statusCode ?? 200
    res.setHeader('content-type', response.contentType ?? 'application/json')
    res.end(response.body ?? JSON.stringify(response.json ?? liveWorkflow()))
  })

  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const handle = {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve, reject) => {
      for (const socket of sockets) socket.destroy()
      server.close((error) => error ? reject(error) : resolve())
    })
  }
  tempRoots.push(handle)
  return handle
}

async function runCli(args, options = {}) {
  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ...(options.env || {})
      }
    })

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr
    }
  } catch (error) {
    return {
      exitCode: error.code ?? 1,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    }
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

function expectNoSecretFragments(value) {
  for (const rule of secretFragments) {
    expect(value).not.toMatch(rule)
  }
}

async function expectOutputIsSafe(result) {
  expectNoSecretFragments(`${result.stdout}\n${result.stderr}`)
}

describe('cap-n8n live workflow import CLI', () => {
  it('fetches one selected live workflow through CAP n8n config and env-backed API key', async () => {
    const appRoot = tempRoot()
    const schemaPath = path.join(tempRoot(), 'schema.json')
    const server = await createWorkflowServer((request) => ({
      json: liveWorkflow()
    }))

    await writeJson(schemaPath, typedSchema)
    await writeAppPackage(appRoot, {
      kind: 'webhook',
      credentials: {
        baseUrl: server.baseUrl,
        apiKey: '{env.N8N_API_KEY}'
      }
    })

    const result = await runCli([
      'import',
      '--app', appRoot,
      '--live',
      '--workflow', 'live-workflow-id',
      '--schema', schemaPath
    ], {
      env: {
        N8N_API_KEY: liveApiKey
      }
    })

    expect(result.exitCode).toBe(0)
    await expectOutputIsSafe(result)
    expect(server.requests).toHaveLength(1)
    expect(server.requests[0]).toMatchObject({
      method: 'GET',
      url: '/api/v1/workflows/live-workflow-id?excludePinnedData=true'
    })
    expect(server.requests[0].headers['x-n8n-api-key']).toBe(liveApiKey)
    expect(result.stdout).toContain('live-cap-hook')
    expect(result.stdout).toContain('live')

    const manifest = await readJson(path.join(appRoot, 'n8n', 'workflows', 'live-cap-hook', 'manifest.json'))
    expect(manifest).toMatchObject({
      workflowKey: 'live-cap-hook',
      source: {
        type: 'live',
        workflowId: 'live-workflow-id',
        workflowName: 'Live CAP Hook',
        webhookPath: 'live-cap-hook'
      }
    })
  })

  it('omits X-N8N-API-KEY when no API key is resolved', async () => {
    const appRoot = tempRoot()
    const server = await createWorkflowServer(() => ({
      json: liveWorkflow()
    }))

    await writeAppPackage(appRoot, {
      kind: 'webhook',
      credentials: {
        baseUrl: server.baseUrl
      }
    })

    const result = await runCli([
      'import',
      '--app', appRoot,
      '--live',
      '--workflow', 'live-workflow-id'
    ])

    expect(result.exitCode).toBe(0)
    expect(server.requests[0].headers).not.toHaveProperty('x-n8n-api-key')
  })

  it('fetches the live workflow list only when --all is explicit', async () => {
    const appRoot = tempRoot()
    const server = await createWorkflowServer((request) => ({
      json: {
        data: [liveWorkflow(), alternateWorkflow()]
      }
    }))

    await writeAppPackage(appRoot, {
      kind: 'webhook',
      credentials: {
        baseUrl: server.baseUrl
      }
    })

    const implicit = await runCli([
      'import',
      '--app', appRoot,
      '--live'
    ])

    expect(implicit.exitCode).toBe(1)
    expect(server.requests).toHaveLength(0)
    expect(existsSync(path.join(appRoot, 'n8n', 'workflows'))).toBe(false)

    const explicit = await runCli([
      'import',
      '--app', appRoot,
      '--live',
      '--all'
    ])

    expect(explicit.exitCode).toBe(0)
    await expectOutputIsSafe(explicit)
    expect(server.requests).toHaveLength(1)
    expect(server.requests[0]).toMatchObject({
      method: 'GET',
      url: '/api/v1/workflows?excludePinnedData=true'
    })
    expect(existsSync(path.join(appRoot, 'n8n', 'workflows', 'live-cap-hook'))).toBe(true)
    expect(existsSync(path.join(appRoot, 'n8n', 'workflows', 'second-live-hook'))).toBe(true)
  })

  it('supports routing-only base URL overrides and keeps help free of literal secret flags', async () => {
    const appRoot = tempRoot()
    const server = await createWorkflowServer(() => ({
      json: liveWorkflow()
    }))

    await writeAppPackage(appRoot, {
      kind: 'webhook',
      credentials: {
        apiKey: '{env.N8N_API_KEY}'
      }
    })

    const result = await runCli([
      'import',
      '--app', appRoot,
      '--live',
      '--workflow', 'live-workflow-id',
      '--base-url', server.baseUrl
    ], {
      env: {
        N8N_API_KEY: liveApiKey
      }
    })
    const help = await runCli(['--help'])

    expect(result.exitCode).toBe(0)
    expect(server.requests[0].url).toBe('/api/v1/workflows/live-workflow-id?excludePinnedData=true')
    expect(server.requests[0].headers['x-n8n-api-key']).toBe(liveApiKey)
    expect(help.exitCode).toBe(0)
    expect(help.stdout).not.toContain('--api-key')
    expect(help.stdout).not.toContain('--apikey')
  })

  it('redacts live import failure diagnostics from CLI output', async () => {
    const appRoot = tempRoot()
    const server = await createWorkflowServer(() => ({
      statusCode: 500,
      json: {
        message: 'live-response-secret',
        apiKey: liveApiKey,
        headers: {
          authorization: 'Bearer live-response-secret'
        },
        requestBody: 'request-body-secret',
        stack: 'stack trace should not be exposed',
        workflow: liveWorkflow({
          staticData: {
            value: 'raw workflow payload'
          }
        })
      }
    }))

    await writeAppPackage(appRoot, {
      kind: 'webhook',
      credentials: {
        baseUrl: server.baseUrl,
        apiKey: '{env.N8N_API_KEY}'
      }
    })

    const result = await runCli([
      'import',
      '--app', appRoot,
      '--live',
      '--workflow', 'live-workflow-id'
    ], {
      env: {
        N8N_API_KEY: liveApiKey
      }
    })

    expect(result.exitCode).toBe(1)
    await expectOutputIsSafe(result)
    expect(`${result.stdout}\n${result.stderr}`).toContain('status 500')
    expect(existsSync(path.join(appRoot, 'n8n', 'workflows'))).toBe(false)
  })
})
