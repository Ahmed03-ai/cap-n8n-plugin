import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const require = createRequire(import.meta.url)
const { writeWorkflowArtifacts } = require('../../cap-n8n-plugin/lib/workflows/artifacts.js')

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const cliPath = path.join(repoRoot, 'cap-n8n-plugin', 'bin', 'cap-n8n.js')
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

const artifactSecretFragments = [
  /phase5-secret-api-key/i,
  /api[_-]?key\s*[:=]/i,
  /Authorization:\s*Bearer/i,
  /Bearer\s+phase5/i,
  /raw request body/i,
  /stack trace should not be exposed/i,
  /gmail\.com/i,
  /workflow:owner/i,
  /vOi5AQTrVKHTEmJ2/i,
  /d7be463a-dd71-4f81-9145-c0990e357703/i,
  /ab025689-52e7-4e3a-9168-028f55d0e28e/i
]

const forbiddenWorkflowKeys = new Set([
  'credential',
  'credentials',
  'credentialid',
  'authorization',
  'apikey',
  'headers',
  'owner',
  'shared',
  'project',
  'pinneddata',
  'pindata',
  'staticdata',
  'requestbody',
  'responsebody',
  'stack',
  'versionid',
  'activeversionid',
  'versioncounter',
  'triggercount',
  'createdat',
  'updatedat'
])

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

async function writeJson(file, value) {
  await writeText(file, `${JSON.stringify(value, null, 2)}\n`)
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

async function createImportApp(inputs = { bookId: 'ID', title: 'title' }) {
  const appRoot = tempAppRoot('cap-n8n-phase5-import-')
  await writeText(path.join(appRoot, 'db', 'schema.cds'), `
    namespace test.phase5.imported;

    entity Books {
      key ID    : Integer;
          title : String;
          stock : Integer;
    }
  `)
  await writeText(path.join(appRoot, 'srv', 'admin-service.cds'), `
    using { test.phase5.imported as my } from '../db/schema';

    service AdminService {
      entity Books as projection on my.Books;
    }

    annotate AdminService.Books with @n8n.workflow.start: {
      workflowId: 'webhook-test/cap-test-trigger',
      on: ['CREATE', 'UPDATE'],
      inputs: {
${inputsCds(inputs)}
      },
      businessKey: 'ID',
      tag: 'admin-books'
    };
  `)
  await writeJson(path.join(appRoot, 'package.json'), {
    name: 'cap-n8n-phase5-import-fixture',
    private: true,
    dependencies: {
      'cap-n8n-plugin': '*'
    }
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

async function runCds(args, options = {}) {
  try {
    const result = await execFileAsync(process.execPath, [cdsBin, ...args], {
      cwd: options.cwd || repoRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CDS_PLUGINS: JSON.stringify({
          'cap-n8n-plugin': {
            impl: pluginPath
          }
        }),
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

async function collectFiles(root, filter = () => true) {
  const files = []

  async function walk(dir) {
    if (!existsSync(dir)) return

    for (const entry of await readdir(dir)) {
      const file = path.join(dir, entry)
      const fileStat = await stat(file)
      if (fileStat.isDirectory()) {
        await walk(file)
      } else if (filter(file)) {
        files.push(file)
      }
    }
  }

  await walk(root)
  return files.sort()
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`
}

function expectSafeOutput(result) {
  for (const rule of secretFragments) {
    expect(output(result), `validate output must not contain ${rule}`).not.toMatch(rule)
  }
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

async function expectArtifactJsonSafe(root) {
  const files = await collectFiles(root, (file) => file.endsWith('.json'))

  for (const file of files) {
    const serialized = await readFile(file, 'utf8')
    for (const rule of artifactSecretFragments) {
      expect(serialized, `${file} must not contain ${rule}`).not.toMatch(rule)
    }

    if (file.endsWith(`${path.sep}workflow.json`)) {
      assertNoForbiddenWorkflowFields(JSON.parse(serialized))
    }
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

describe('Phase 5 aggregate workflow import and validation evidence', () => {
  it('imports local workflow artifacts, validates annotations, compiles CDS, and runs CAP build validation', async () => {
    const appRoot = await createImportApp()
    const exportPath = path.join(tempAppRoot(), 'workflow-export.json')
    const schemaPath = path.join(tempAppRoot(), 'schema.json')

    await writeJson(exportPath, fixtureWorkflow())
    await writeJson(schemaPath, typedSchema)

    const imported = await runCli([
      'import',
      '--app', appRoot,
      '--from', exportPath,
      '--schema', schemaPath
    ])
    const validated = await runCli(['validate', '--app', appRoot])
    const compiled = await runCds([
      'compile',
      path.join(appRoot, 'db'),
      path.join(appRoot, 'srv'),
      path.join(appRoot, 'n8n'),
      '--to',
      'csn'
    ])
    const built = await runCds([
      'build',
      '--project',
      appRoot,
      '--log-level',
      'warn'
    ])

    expect(imported.exitCode).toBe(0)
    expect(validated.exitCode).toBe(0)
    expect(compiled.exitCode).toBe(0)
    expect(built.exitCode).toBe(0)
    expect(validated.stdout).toContain('n8n workflow validation passed')
    expect(existsSync(path.join(appRoot, 'n8n', 'workflows', 'cap-test-trigger', 'workflow.json'))).toBe(true)
    expect(existsSync(path.join(appRoot, 'gen'))).toBe(true)
    expectSafeOutput(imported)
    expectSafeOutput(validated)
    expectSafeOutput(compiled)
    expectSafeOutput(built)
    await expectArtifactJsonSafe(path.join(appRoot, 'n8n'))
  })

  it('resolves demo-app AdminService.Books annotations through manifest accepted references', async () => {
    const manifest = await readJson(path.join(repoRoot, 'demo-app', 'n8n', 'workflows', 'cap-test-trigger', 'manifest.json'))
    const result = await runCli(['validate', '--app', 'demo-app', '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(manifest.acceptedReferences).toEqual(expect.arrayContaining([
      'cap-test-trigger',
      'webhook/cap-test-trigger',
      'webhook-test/cap-test-trigger'
    ]))
    expect(payload.diagnostics).toEqual([])
    expectSafeOutput(result)
  })

  it('passes warning-only fixtures and fails typed error fixtures with sanitized diagnostics', async () => {
    const warningApp = await createValidationApp({
      inputs: {
        bookId: 'ID',
        title: 'title',
        nickname: 'title'
      }
    })
    const errorApp = await createValidationApp({
      inputs: {
        bookId: 'ID'
      }
    })

    const warning = await runCli(['validate', '--app', warningApp])
    const error = await runCli(['validate', '--app', errorApp])

    expect(warning.exitCode).toBe(0)
    expect(warning.stdout).toContain('WARN_N8N_WORKFLOW_EXTRA_INPUT')
    expect(warning.stdout).toContain('severity=warning')
    expect(warning.stdout).toContain('input=nickname')
    expect(error.exitCode).toBe(1)
    expect(output(error)).toContain('ERR_N8N_WORKFLOW_REQUIRED_INPUT')
    expect(output(error)).toContain('severity=error')
    expect(output(error)).toContain('input=title')
    expectSafeOutput(warning)
    expectSafeOutput(error)
  })

  it('keeps implementation sources, demo artifacts, and CLI output free of leaked secret values', async () => {
    const sourceRoots = [
      path.join(repoRoot, 'cap-n8n-plugin', 'bin'),
      path.join(repoRoot, 'cap-n8n-plugin', 'lib', 'workflows')
    ]
    const sourceFiles = []

    for (const root of sourceRoots) {
      sourceFiles.push(...await collectFiles(root, (file) => file.endsWith('.js')))
    }

    for (const file of sourceFiles) {
      const source = await readFile(file, 'utf8')
      expect(source, `${file} must not contain literal sample secrets`).not.toMatch(/ghp_|gho_|github_pat_|sk-[A-Za-z0-9]|BEGIN .*PRIVATE KEY|N8N_API_KEY=.*[A-Za-z0-9]/)
      expect(source, `${file} must not ingest .env files`).not.toMatch(/dotenv|readFile(?:Sync)?\([^)]*\.env|\.env\.local/i)
      expect(source, `${file} must not log concrete auth headers`).not.toMatch(/console\.(?:log|error|warn).*authorization|console\.(?:log|error|warn).*x-n8n-api-key/i)
    }

    const help = await runCli(['--help'])
    const json = await runCli(['validate', '--app', 'demo-app', '--json'])

    expect(help.exitCode).toBe(0)
    expect(help.stdout).not.toContain('--api-key')
    expect(help.stdout).not.toContain('--apikey')
    expect(json.exitCode).toBe(0)
    expectSafeOutput(help)
    expectSafeOutput(json)
    await expectArtifactJsonSafe(path.join(repoRoot, 'demo-app', 'n8n'))
  })

  it('keeps npm test wired through the integration suite that includes Phase 5 tests', () => {
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))

    expect(packageJson.scripts.test).toContain('npm run test:integration')
    expect(packageJson.scripts['test:integration']).toBe('vitest run test/integration')
    expect(packageJson.scripts['n8n:workflow:validate']).toContain('cap-n8n.js validate')
    expect(existsSync(path.join(repoRoot, 'test', 'integration', 'n8n-workflow-artifacts.test.js'))).toBe(true)
    expect(existsSync(path.join(repoRoot, 'test', 'integration', 'n8n-workflow-import.test.js'))).toBe(true)
    expect(existsSync(path.join(repoRoot, 'test', 'integration', 'n8n-workflow-live-import.test.js'))).toBe(true)
    expect(existsSync(path.join(repoRoot, 'test', 'integration', 'n8n-workflow-build-validation.test.js'))).toBe(true)
    expect(existsSync(path.join(repoRoot, 'test', 'integration', 'n8n-workflow-phase5.test.js'))).toBe(true)
  })
})
