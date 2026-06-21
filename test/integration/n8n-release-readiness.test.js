import { describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const cancellationFixturePath = path.join(repoRoot, 'test-workflows', 'cancellation-workflows.json')
const cancellationScriptPath = path.join(repoRoot, 'scripts', 'cancellation-showcase.js')
const manualShowcasePath = path.join(repoRoot, 'docs', 'manual-visual-showcase.md')
const stopApiTestPath = path.join(repoRoot, 'test', 'integration', 'n8n-cancellation-stop-api.test.js')

const forbiddenWorkflowKeys = new Set([
  'credentials',
  'shared',
  'project',
  'owner',
  'pindata',
  'staticdata',
  'updatedat',
  'createdat',
  'versionid',
  'activeversionid',
  'versioncounter',
  'triggercount'
])

const secretLikePatterns = [
  /ghp_[A-Za-z0-9_]+/,
  /gho_[A-Za-z0-9_]+/,
  /github_pat_[A-Za-z0-9_]+/,
  /sk-[A-Za-z0-9]{20,}/,
  /BEGIN [A-Z ]*PRIVATE KEY/,
  /Bearer\s+[A-Za-z0-9._-]{16,}/i,
  /Authorization:\s*Basic\s+[A-Za-z0-9+/=]{12,}/i,
  /workflow:owner/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /https:\/\/[^/\s]*prod[^/\s]*/i
]

function readText(file) {
  return readFileSync(file, 'utf8')
}

function readJson(file) {
  return JSON.parse(readText(file))
}

function sectionBetween(source, startHeading, endHeading) {
  const start = source.indexOf(startHeading)
  const end = source.indexOf(endHeading, start + startHeading.length)

  expect(start, `${startHeading} section must exist`).toBeGreaterThanOrEqual(0)
  expect(end, `${endHeading} boundary must exist`).toBeGreaterThan(start)

  return source.slice(start, end)
}

function assertNoForbiddenWorkflowFields(value, parts = []) {
  if (!value || typeof value !== 'object') return

  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenWorkflowFields(item, parts)
    return
  }

  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '')
    expect(forbiddenWorkflowKeys.has(normalized), `forbidden workflow field ${parts.concat(key).join('.')}`).toBe(false)
    assertNoForbiddenWorkflowFields(child, parts.concat(key))
  }
}

function assertNoSecrets(source, label) {
  for (const pattern of secretLikePatterns) {
    expect(source, `${label} must not contain ${pattern}`).not.toMatch(pattern)
  }
}

async function runScript(args) {
  try {
    const result = await execFileAsync(process.execPath, [cancellationScriptPath, ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        N8N_API_KEY: '',
        N8N_BASE_URL: '',
        N8N_CANCEL_SUPPORTED: '',
        N8N_CANCEL_API_BASE_URL: '',
        N8N_CANCEL_WORKFLOW_ID: ''
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

describe('Phase 8 cancellation release readiness', () => {
  it('keeps a dedicated sanitized stoppable workflow fixture', () => {
    const workflows = readJson(cancellationFixturePath)
    const workflow = workflows[0]
    const webhook = workflow.nodes.find((node) => node.type === 'n8n-nodes-base.webhook')
    const respond = workflow.nodes.find((node) => node.type === 'n8n-nodes-base.respondToWebhook')
    const wait = workflow.nodes.find((node) => node.type === 'n8n-nodes-base.wait')
    const serialized = JSON.stringify(workflow)

    expect(workflows).toHaveLength(1)
    expect(Object.keys(workflow).sort()).toEqual([
      'connections',
      'name',
      'nodes',
      'settings'
    ])
    expect(workflow.name).toBe('CAP n8n Cancellation Test')
    expect(workflow.settings).toEqual({ executionOrder: 'v1' })
    expect(webhook.parameters).toMatchObject({
      httpMethod: 'POST',
      path: 'cap-cancel-stoppable',
      responseMode: 'responseNode'
    })
    expect(respond.parameters.respondWith).toBe('json')
    expect(respond.parameters.responseBody).toContain('$execution.id')
    expect(respond.parameters.responseBody).toContain('executionId')
    expect(respond.parameters.responseBody).toContain('keepRunning')
    expect(respond.parameters.responseBody).toContain('running')
    expect(wait.parameters).toMatchObject({
      resume: 'timeInterval'
    })
    expect(serialized).toContain('n8n-nodes-base.wait')
    assertNoForbiddenWorkflowFields(workflow)
    assertNoSecrets(serialized, 'cancellation workflow fixture')
  })

  it('exposes dry-run and help without contacting n8n or printing secrets', async () => {
    const help = await runScript(['--help'])
    const dryRun = await runScript(['--dry-run'])
    const output = `${help.stdout}\n${help.stderr}\n${dryRun.stdout}\n${dryRun.stderr}`

    expect(help.exitCode).toBe(0)
    expect(dryRun.exitCode).toBe(0)
    expect(output).toContain('N8N_BASE_URL')
    expect(output).toContain('N8N_API_KEY')
    expect(output).toContain('N8N_CANCEL_SUPPORTED')
    expect(output).toContain('N8N_CANCEL_API_BASE_URL')
    expect(output).toContain('N8N_CANCEL_WORKFLOW_ID')
    expect(output).toContain('cap-cancel-stoppable')
    expect(output).toContain('n8n.cancel(executionId)')
    expect(output).toContain('No n8n requests were sent.')
    assertNoSecrets(output, 'cancellation showcase help and dry-run output')
  })

  it('documents the browser-first cancellation acceptance path', () => {
    const docs = readText(manualShowcasePath)
    const section = sectionBetween(docs, '## Step 8:', '## Step 9:')

    expect(section).toContain('CAP n8n Cancellation Test')
    expect(section).toContain('cap-cancel-stoppable')
    expect(section).toContain('docker compose exec n8n n8n import:workflow --input=/test-workflows/cancellation-workflows.json')
    expect(section).toContain('http://localhost:5678')
    expect(section).toContain('N8N_BASE_URL=http://localhost:5678')
    expect(section).toContain('N8N_CANCEL_SUPPORTED=true')
    expect(section).toContain('N8N_CANCEL_API_BASE_URL=http://localhost:5678')
    expect(section).toContain('N8N_API_KEY=<local-n8n-api-key>')
    expect(section).toContain('node scripts/cancellation-showcase.js')
    expect(section).toContain('explicit running webhook response contract')
    expect(section).toContain('n8n.cancel(executionId)')
    expect(section).toContain('execution stop')
    expect(section).toContain('browser')
    expect(section).toMatch(/stopped|cancelled/)
    expect(section).toContain('manual UAT required')
    expect(section).toContain('cap-n8n-plugin/lib/annotations/CancellationResolver.js')
    expect(section).not.toContain('cap-n8n-plugin/lib/CancellationResolver.js')
    assertNoSecrets(section, 'manual cancellation showcase section')
  })

  it('keeps fake-stop coverage and cancellation evidence source secret-safe', () => {
    const fixture = readText(cancellationFixturePath)
    const script = readText(cancellationScriptPath)
    const docs = sectionBetween(readText(manualShowcasePath), '## Step 8:', '## Step 9:')
    const stopApiTest = readText(stopApiTestPath)

    expect(stopApiTest).toContain('_stopN8nExecution')
    expect(stopApiTest).toContain('/api/v1/executions/n8n-running-9001/stop')
    expect(stopApiTest).toContain('X-N8N-API-KEY')
    expect(stopApiTest).toContain('n8n.cancel')

    assertNoSecrets(fixture, 'fixture source')
    assertNoSecrets(script, 'showcase script source')
    assertNoSecrets(docs, 'manual showcase section')
  })
})
