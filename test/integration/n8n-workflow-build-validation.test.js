import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')
const { writeWorkflowArtifacts } = require('../../cap-n8n-plugin/lib/workflows/artifacts.js')
const { validateWorkflowAnnotations } = require('../../cap-n8n-plugin/lib/workflows/validate.js')
const { BuildValidationPlugin } = require('../../cap-n8n-plugin/lib/workflows/BuildValidationPlugin.js')

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const cdsBin = path.join(repoRoot, 'node_modules', '@sap', 'cds-dk', 'bin', 'cds.js')
const pluginPath = path.join(repoRoot, 'cap-n8n-plugin', 'cds-plugin.js')
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
  /secret-env-build-validation/i,
  /Bearer\s+build-validation-token/i,
  /Authorization:\s*Bearer/i,
  /raw request body/i,
  /stack trace should not be exposed/i,
  /"nodes"\s*:/i,
  /"connections"\s*:/i,
  /x-n8n-api-key/i
]

afterEach(() => {
  while (tempRoots.length) {
    rmSync(tempRoots.pop(), { recursive: true, force: true })
  }
})

function fixtureWorkflow() {
  return JSON.parse(readFileSync(workflowFixturePath, 'utf8'))[0]
}

function tempAppRoot(prefix = 'cap-n8n-build-validation-') {
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
    namespace test.validation;

    entity Books {
      key ID        : Integer;
          title     : String;
          stock     : Integer;
          price     : Decimal(9, 2);
          active    : Boolean;
          published : Date;
          changedAt : Timestamp;
    }
  `)
  await writeText(path.join(appRoot, 'srv', 'admin-service.cds'), `
    using { test.validation as my } from '../db/schema';

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
    name: 'cap-n8n-build-validation-fixture',
    private: true,
    dependencies: {
      'cap-n8n-plugin': '*'
    }
  }, null, 2))
  await writeText(path.join(appRoot, '.env'), [
    'N8N_API_KEY=secret-env-build-validation',
    'AUTHORIZATION=Bearer build-validation-token',
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

async function loadAppCsn(appRoot) {
  return cds.load([
    path.join(appRoot, 'db'),
    path.join(appRoot, 'srv')
  ], { cwd: appRoot })
}

async function validateApp(appRoot) {
  const csn = await loadAppCsn(appRoot)
  return validateWorkflowAnnotations({ appRoot, csn })
}

async function runCdsBuild(appRoot) {
  try {
    const result = await execFileAsync(process.execPath, [
      cdsBin,
      'build',
      '--project',
      appRoot,
      '--log-level',
      'warn'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CDS_PLUGINS: JSON.stringify({
          'cap-n8n-plugin': {
            impl: pluginPath
          }
        })
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

function expectSafeDiagnostics(value) {
  const serialized = JSON.stringify(value)
  for (const rule of secretFragments) {
    expect(serialized, `diagnostics must not contain ${rule}`).not.toMatch(rule)
  }
}

function expectDiagnosticContext(diagnostic, details = {}) {
  expect(diagnostic).toMatchObject({
    source: 'n8n',
    annotation: '@n8n.workflow.start',
    entity: 'AdminService.Books',
    workflowKey: 'cap-test-trigger',
    workflowReference: 'webhook-test/cap-test-trigger',
    ...details
  })
  expect(diagnostic.message).toContain(diagnostic.code)
  expect(diagnostic.message).toContain('AdminService.Books')
  expect(diagnostic.message).toContain(diagnostic.workflowReference)
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`
}

function expectSafeBuildOutput(result) {
  for (const rule of secretFragments) {
    expect(output(result), `build output must not contain ${rule}`).not.toMatch(rule)
  }
}

describe('n8n workflow build validation', () => {
  it('exports a CAP build plugin class for workflow validation', () => {
    expect(typeof BuildValidationPlugin).toBe('function')
    expect(BuildValidationPlugin.name).toBe('BuildValidationPlugin')
  })

  it('returns strict error diagnostics for missing required inputs and type mismatches', async () => {
    const missingApp = await createValidationApp({
      inputs: {
        bookId: 'ID'
      }
    })
    const mismatchApp = await createValidationApp({
      inputs: {
        bookId: 'title',
        title: 'title'
      }
    })

    const missing = await validateApp(missingApp)
    const mismatch = await validateApp(mismatchApp)

    expect(missing.errors).toHaveLength(1)
    expect(missing.warnings).toEqual([])
    expectDiagnosticContext(missing.errors[0], {
      severity: 'error',
      code: 'ERR_N8N_WORKFLOW_REQUIRED_INPUT',
      input: 'title',
      reason: 'required-input-missing'
    })
    expect(missing.errors[0]).not.toHaveProperty('fieldPath')
    expectSafeDiagnostics(missing)

    expect(mismatch.errors).toHaveLength(1)
    expect(mismatch.warnings).toEqual([])
    expectDiagnosticContext(mismatch.errors[0], {
      severity: 'error',
      code: 'ERR_N8N_WORKFLOW_TYPE_MISMATCH',
      input: 'bookId',
      fieldPath: 'title',
      actualType: 'cds.String',
      expectedType: 'Integer',
      reason: 'type-mismatch'
    })
    expectSafeDiagnostics(mismatch)
  })

  it('returns warning-only diagnostics for extra inputs, unknown references, and untyped artifacts', async () => {
    const extraApp = await createValidationApp({
      inputs: {
        bookId: 'ID',
        title: 'title',
        nickname: 'title'
      }
    })
    const unknownApp = await createValidationApp({
      workflowId: 'unknown-workflow',
      inputs: {
        bookId: 'ID'
      }
    })
    const untypedApp = await createValidationApp({
      schema: null,
      inputs: {
        bookId: 'ID'
      }
    })

    const extra = await validateApp(extraApp)
    const unknown = await validateApp(unknownApp)
    const untyped = await validateApp(untypedApp)

    expect(extra.errors).toEqual([])
    expect(extra.warnings).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'WARN_N8N_WORKFLOW_EXTRA_INPUT',
        entity: 'AdminService.Books',
        workflowReference: 'webhook-test/cap-test-trigger',
        workflowKey: 'cap-test-trigger',
        input: 'nickname',
        fieldPath: 'title',
        actualType: 'cds.String',
        reason: 'extra-input'
      })
    ])
    expect(unknown.errors).toEqual([])
    expect(unknown.warnings).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'WARN_N8N_WORKFLOW_UNKNOWN_REFERENCE',
        entity: 'AdminService.Books',
        workflowReference: 'unknown-workflow',
        reason: 'unknown-workflow-reference'
      })
    ])
    expect(untyped.errors).toEqual([])
    expect(untyped.warnings).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'WARN_N8N_WORKFLOW_UNTYPED',
        entity: 'AdminService.Books',
        workflowReference: 'webhook-test/cap-test-trigger',
        workflowKey: 'cap-test-trigger',
        reason: 'untyped-workflow-artifact'
      })
    ])

    expectSafeDiagnostics(extra)
    expectSafeDiagnostics(unknown)
    expectSafeDiagnostics(untyped)
  })

  it('fails cds build for typed missing inputs with the same sanitized diagnostic codes', async () => {
    const appRoot = await createValidationApp({
      inputs: {
        bookId: 'ID'
      }
    })
    const direct = await validateApp(appRoot)
    const build = await runCdsBuild(appRoot)

    expect(build.exitCode).not.toBe(0)
    expect(output(build)).toContain(direct.errors[0].code)
    expect(output(build)).toContain('AdminService.Books')
    expect(output(build)).toContain('webhook-test/cap-test-trigger')
    expect(output(build)).toContain('title')
    expectSafeBuildOutput(build)
  })

  it('fails cds build for typed input type mismatches with field and CAP type context', async () => {
    const appRoot = await createValidationApp({
      inputs: {
        bookId: 'title',
        title: 'title'
      }
    })
    const build = await runCdsBuild(appRoot)

    expect(build.exitCode).not.toBe(0)
    expect(output(build)).toContain('ERR_N8N_WORKFLOW_TYPE_MISMATCH')
    expect(output(build)).toContain('bookId')
    expect(output(build)).toContain('title')
    expect(output(build)).toContain('cds.String')
    expect(output(build)).toContain('Integer')
    expectSafeBuildOutput(build)
  })

  it('passes cds build for warning-only workflow validation cases', async () => {
    const appRoot = await createValidationApp({
      inputs: {
        bookId: 'ID',
        title: 'title',
        nickname: 'title'
      }
    })
    const build = await runCdsBuild(appRoot)

    expect(build.exitCode).toBe(0)
    expect(output(build)).toContain('WARN_N8N_WORKFLOW_EXTRA_INPUT')
    expect(output(build)).toContain('nickname')
    expect(existsSync(path.join(appRoot, 'gen'))).toBe(true)
    expectSafeBuildOutput(build)
  })
})
