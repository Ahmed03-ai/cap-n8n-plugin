import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const require = createRequire(import.meta.url)
const { writeWorkflowArtifacts } = require('../../cap-n8n-plugin/lib/workflows/artifacts.js')

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const cliPath = path.join(repoRoot, 'cap-n8n-plugin', 'bin', 'cap-n8n.js')
const workflowFixturePath = path.join(repoRoot, 'test-workflows', 'workflows.json')
const tempRoots = []

const typedSchema = {
  inputs: {
    bookId: { type: 'Integer', required: true },
    title: { type: 'String', required: true },
    event: { type: 'JSON' }
  }
}

const secretFragments = [
  /phase5-secret-api-key/i,
  /Authorization:\s*Bearer/i,
  /Bearer\s+phase5/i,
  /raw request body/i,
  /stack trace should not be exposed/i,
  /"nodes"\s*:/i,
  /"connections"\s*:/i,
  /x-n8n-api-key/i,
  /\.env/i
]

afterEach(() => {
  while (tempRoots.length) {
    rmSync(tempRoots.pop(), { recursive: true, force: true })
  }
})

function fixtureWorkflow() {
  return JSON.parse(readFileSync(workflowFixturePath, 'utf8'))[0]
}

function tempAppRoot(prefix = 'cap-n8n-phase5-') {
  const root = mkdtempSync(path.join(tmpdir(), prefix))
  tempRoots.push(root)
  return root
}

async function writeText(file, source) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, source, 'utf8')
}

function inputsCds(inputs) {
  return Object.entries(inputs)
    .map(([name, field]) => `    ${name}: '${field}'`)
    .join(',\n')
}

async function createValidationApp({
  workflowId = 'webhook-test/cap-test-trigger',
  inputs = { bookId: 'ID', title: 'title' },
  schema = typedSchema
} = {}) {
  const appRoot = tempAppRoot()
  await writeText(path.join(appRoot, 'db', 'schema.cds'), `
    namespace test.phase5;

    entity Books {
      key ID    : Integer;
          title : String;
          stock : Integer;
    }
  `)
  await writeText(path.join(appRoot, 'srv', 'admin-service.cds'), `
    using { test.phase5 as my } from '../db/schema';

    service AdminService {
      entity Books as projection on my.Books;
    }

    annotate AdminService.Books with @n8n.workflow.start: {
      workflowId: '${workflowId}',
      on: ['CREATE', 'UPDATE'],
      inputs: {
${inputsCds(inputs)}
      },
      businessKey: 'ID',
      tag: 'admin-books'
    };
  `)
  await writeText(path.join(appRoot, 'package.json'), JSON.stringify({
    name: 'cap-n8n-phase5-validation-fixture',
    private: true,
    dependencies: {
      'cap-n8n-plugin': '*'
    }
  }, null, 2))
  await writeText(path.join(appRoot, '.env'), [
    'N8N_API_KEY=phase5-secret-api-key',
    'AUTHORIZATION=Bearer phase5-token',
    'REQUEST_BODY=raw request body',
    'STACK=stack trace should not be exposed',
    ''
  ].join('\n'))

  await writeWorkflowArtifacts({
    appRoot,
    workflows: [{
      workflow: fixtureWorkflow(),
      workflowKey: 'cap-test-trigger',
      sourceType: 'local',
      schema
    }]
  })

  return appRoot
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

function output(result) {
  return `${result.stdout}\n${result.stderr}`
}

function expectSafeOutput(result) {
  for (const rule of secretFragments) {
    expect(output(result), `validate output must not contain ${rule}`).not.toMatch(rule)
  }
}

describe('cap-n8n validate CLI', () => {
  it('validates demo-app annotations against generated workflow artifacts', async () => {
    const result = await runCli(['validate', '--app', 'demo-app'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('n8n workflow validation passed')
    expect(result.stdout).toContain('demo-app')
    expect(result.stderr).toBe('')
    expectSafeOutput(result)
  })

  it('emits parseable sanitized JSON diagnostics', async () => {
    const result = await runCli(['validate', '--app', 'demo-app', '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload).toEqual({
      appRoot: expect.stringMatching(/demo-app$/),
      errors: [],
      warnings: [],
      diagnostics: []
    })
    expect(result.stderr).toBe('')
    expectSafeOutput(result)
  })

  it('exits non-zero for typed validation errors with deterministic diagnostic context', async () => {
    const appRoot = await createValidationApp({
      inputs: {
        bookId: 'ID'
      }
    })

    const result = await runCli(['validate', '--app', appRoot])

    expect(result.exitCode).toBe(1)
    expect(output(result)).toContain('ERR_N8N_WORKFLOW_REQUIRED_INPUT')
    expect(output(result)).toContain('AdminService.Books')
    expect(output(result)).toContain('@n8n.workflow.start')
    expect(output(result)).toContain('workflow=webhook-test/cap-test-trigger')
    expect(output(result)).toContain('key=cap-test-trigger')
    expect(output(result)).toContain('input=title')
    expect(output(result)).toContain('severity=error')
    expect(output(result)).toContain('reason=required-input-missing')
    expectSafeOutput(result)
  })
})
