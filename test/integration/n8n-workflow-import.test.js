import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const cliPath = path.join(repoRoot, 'cap-n8n-plugin', 'bin', 'cap-n8n.js')
const fixturePath = path.join(repoRoot, 'test-workflows', 'workflows.json')

const tempRoots = []
const typedSchema = {
  inputs: {
    bookId: { type: 'Integer', required: true },
    event: { type: 'JSON' },
    title: { type: 'String', required: true }
  }
}
const secretFragments = [
  /api[_-]?key/i,
  /authorization/i,
  /credential/i,
  /gmail\.com/i,
  /workflow:owner/i,
  /vOi5AQTrVKHTEmJ2/i,
  /d7be463a-dd71-4f81-9145-c0990e357703/i,
  /ab025689-52e7-4e3a-9168-028f55d0e28e/i
]

afterEach(() => {
  while (tempRoots.length) {
    rmSync(tempRoots.pop(), { recursive: true, force: true })
  }
})

function tempRoot(prefix = 'cap-n8n-import-') {
  const root = mkdtempSync(path.join(tmpdir(), prefix))
  tempRoots.push(root)
  return root
}

function fixtureWorkflow() {
  return JSON.parse(readFileSync(fixturePath, 'utf8'))[0]
}

function alternateWorkflow() {
  return {
    ...fixtureWorkflow(),
    id: 'alternate-workflow-id',
    name: 'Alternate CAP Hook',
    nodes: [{
      parameters: {
        httpMethod: 'POST',
        path: 'alternate-cap-hook',
        options: {}
      },
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.1,
      position: [0, 0],
      id: 'alternate-webhook-node',
      name: 'Webhook'
    }]
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
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

async function collectFiles(root) {
  const files = []

  async function walk(dir) {
    if (!existsSync(dir)) return

    for (const entry of await readdir(dir)) {
      const file = path.join(dir, entry)
      const fileStat = await stat(file)
      if (fileStat.isDirectory()) {
        await walk(file)
      } else {
        files.push(file)
      }
    }
  }

  await walk(root)
  return files.sort()
}

function expectNoSecretFragments(value) {
  for (const rule of secretFragments) {
    expect(value).not.toMatch(rule)
  }
}

async function expectOutputIsSafe(result) {
  expectNoSecretFragments(`${result.stdout}\n${result.stderr}`)
}

async function expectArtifactTreeSafe(appRoot) {
  for (const file of await collectFiles(path.join(appRoot, 'n8n'))) {
    expectNoSecretFragments(await readFile(file, 'utf8'))
  }
}

async function readArtifactBytes(appRoot) {
  const files = await collectFiles(path.join(appRoot, 'n8n'))
  const bytes = {}

  for (const file of files) {
    bytes[path.relative(appRoot, file).replace(/\\/g, '/')] = await readFile(file, 'utf8')
  }

  return bytes
}

describe('cap-n8n local workflow import CLI', () => {
  it('imports a single local workflow export into deterministic app-root artifacts', async () => {
    const appRoot = tempRoot()
    const exportPath = path.join(tempRoot(), 'single-workflow.json')
    const schemaPath = path.join(tempRoot(), 'schema.json')

    await writeJson(exportPath, fixtureWorkflow())
    await writeJson(schemaPath, typedSchema)

    const first = await runCli([
      'import',
      '--app', appRoot,
      '--from', exportPath,
      '--schema', schemaPath
    ])
    const firstBytes = await readArtifactBytes(appRoot)
    const second = await runCli([
      'import',
      '--app', appRoot,
      '--from', exportPath,
      '--schema', schemaPath
    ])
    const secondBytes = await readArtifactBytes(appRoot)

    expect(first.exitCode).toBe(0)
    expect(second.exitCode).toBe(0)
    await expectOutputIsSafe(first)
    await expectOutputIsSafe(second)
    expect(first.stdout).toContain('cap-test-trigger')
    expect(first.stdout).toContain('local')
    expect(first.stdout).toContain(path.join('n8n', 'workflows', 'cap-test-trigger'))
    expect(secondBytes).toEqual(firstBytes)

    const workflowRoot = path.join(appRoot, 'n8n', 'workflows', 'cap-test-trigger')
    const workflow = await readJson(path.join(workflowRoot, 'workflow.json'))
    const schema = await readJson(path.join(workflowRoot, 'schema.json'))
    const manifest = await readJson(path.join(workflowRoot, 'manifest.json'))
    const aggregate = await readJson(path.join(appRoot, 'n8n', 'manifest.json'))
    const cdsSource = await readFile(path.join(appRoot, 'n8n', 'index.cds'), 'utf8')

    expect(workflow.nodes[0].parameters.path).toBe('cap-test-trigger')
    expect(schema.inputs).toEqual({
      bookId: { type: 'Integer', required: true },
      event: { type: 'JSON', required: false },
      title: { type: 'String', required: true }
    })
    expect(manifest).toMatchObject({
      workflowKey: 'cap-test-trigger',
      source: {
        type: 'local',
        workflowName: 'CAP n8n Test',
        webhookPath: 'cap-test-trigger'
      }
    })
    expect(aggregate.workflows).toEqual([
      expect.objectContaining({
        workflowKey: 'cap-test-trigger',
        typed: true
      })
    ])
    expect(cdsSource).toContain('type CapTestTriggerInputs')
    expect(cdsSource).toContain('action capTestTrigger')
    await expectArtifactTreeSafe(appRoot)
  })

  it('rejects ambiguous multi-workflow exports without writing workflow folders', async () => {
    const appRoot = tempRoot()
    const exportPath = path.join(tempRoot(), 'multi-workflow.json')

    await writeJson(exportPath, [fixtureWorkflow(), alternateWorkflow()])

    const result = await runCli([
      'import',
      '--app', appRoot,
      '--from', exportPath
    ])

    expect(result.exitCode).toBe(1)
    await expectOutputIsSafe(result)
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/multiple|ambiguous|workflow/i)
    expect(existsSync(path.join(appRoot, 'n8n', 'workflows'))).toBe(false)
  })

  it('imports every workflow from a local export only when --all is explicit', async () => {
    const appRoot = tempRoot()
    const exportPath = path.join(tempRoot(), 'multi-workflow.json')
    const schemaPath = path.join(tempRoot(), 'schema.json')

    await writeJson(exportPath, [fixtureWorkflow(), alternateWorkflow()])
    await writeJson(schemaPath, typedSchema)

    const result = await runCli([
      'import',
      '--app', appRoot,
      '--from', exportPath,
      '--schema', schemaPath,
      '--all'
    ])

    expect(result.exitCode).toBe(0)
    await expectOutputIsSafe(result)
    expect(result.stdout).toContain('cap-test-trigger')
    expect(result.stdout).toContain('alternate-cap-hook')
    expect(existsSync(path.join(appRoot, 'n8n', 'workflows', 'cap-test-trigger'))).toBe(true)
    expect(existsSync(path.join(appRoot, 'n8n', 'workflows', 'alternate-cap-hook'))).toBe(true)
    await expectArtifactTreeSafe(appRoot)
  })

  it('selects a workflow by webhook path and can override the local artifact key', async () => {
    const appRoot = tempRoot()
    const exportPath = path.join(tempRoot(), 'multi-workflow.json')

    await writeJson(exportPath, [fixtureWorkflow(), alternateWorkflow()])

    const result = await runCli([
      'import',
      '--app', appRoot,
      '--from', exportPath,
      '--workflow', 'cap-test-trigger',
      '--key', 'book-created'
    ])

    expect(result.exitCode).toBe(0)
    await expectOutputIsSafe(result)
    expect(result.stdout).toContain('book-created')
    expect(existsSync(path.join(appRoot, 'n8n', 'workflows', 'book-created'))).toBe(true)
    expect(existsSync(path.join(appRoot, 'n8n', 'workflows', 'alternate-cap-hook'))).toBe(false)

    const manifest = await readJson(path.join(appRoot, 'n8n', 'workflows', 'book-created', 'manifest.json'))
    expect(manifest).toMatchObject({
      workflowKey: 'book-created',
      source: {
        type: 'local',
        webhookPath: 'cap-test-trigger'
      }
    })
  })
})
