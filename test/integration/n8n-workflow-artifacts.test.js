import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')
const {
  SUPPORTED_WORKFLOW_INPUT_TYPES,
  normalizeWorkflowSchema
} = require('../../cap-n8n-plugin/lib/workflows/schema.js')
const { sanitizeWorkflow } = require('../../cap-n8n-plugin/lib/workflows/sanitize.js')
const {
  generateWorkflowCds,
  workflowTypeName
} = require('../../cap-n8n-plugin/lib/workflows/generate-cds.js')
const {
  writeWorkflowArtifacts,
  readWorkflowArtifacts
} = require('../../cap-n8n-plugin/lib/workflows/artifacts.js')

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const workflowFixturePath = path.join(repoRoot, 'test-workflows', 'workflows.json')

const typedSchema = {
  inputs: {
    bookId: { type: 'Integer', required: true },
    title: { type: 'String', required: true },
    price: { type: 'Decimal' },
    active: { type: 'Boolean' },
    publishDate: { type: 'Date' },
    changedAt: { type: 'DateTime' },
    event: { type: 'JSON' }
  }
}

const capTestSchema = {
  inputs: {
    bookId: { type: 'Integer', required: true },
    title: { type: 'String', required: true },
    event: { type: 'JSON' }
  }
}

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

const secretFragments = [
  /Bearer\s+/i,
  /api[_-]?key\s*[:=]/i,
  /gmail\.com/i,
  /leon/i,
  /workflow:owner/i,
  /vOi5AQTrVKHTEmJ2/i,
  /d7be463a-dd71-4f81-9145-c0990e357703/i,
  /ab025689-52e7-4e3a-9168-028f55d0e28e/i
]

const tempRoots = []

afterEach(() => {
  while (tempRoots.length) {
    rmSync(tempRoots.pop(), { recursive: true, force: true })
  }
})

function tempAppRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'cap-n8n-artifacts-'))
  tempRoots.push(root)
  return root
}

function fixtureWorkflow() {
  return JSON.parse(readFileSync(workflowFixturePath, 'utf8'))[0]
}

function unsafeFixtureWorkflow() {
  const workflow = fixtureWorkflow()

  return {
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    id: 'xS2pbMEOrVWMxiT0',
    active: true,
    isArchived: false,
    ...workflow,
    nodes: workflow.nodes.map((node) => ({
      ...node,
      webhookId: '897fd062-93ee-4390-9dda-78fcb556745c',
      credentials: {
        sapCapApi: {
          id: 'unsafe-credential-id',
          name: 'Unsafe SAP CAP API'
        }
      }
    })),
    settings: {
      ...workflow.settings,
      binaryMode: 'separate',
      timeSavedMode: 'fixed',
      callerPolicy: 'workflowsFromSameOwner',
      availableInMCP: false,
      timezone: 'Europe/Berlin',
      saveExecutionProgress: true
    },
    staticData: null,
    meta: {
      templateCredsSetupCompleted: true
    },
    pinData: {},
    versionId: 'ab025689-52e7-4e3a-9168-028f55d0e28e',
    activeVersionId: 'ab025689-52e7-4e3a-9168-028f55d0e28e',
    versionCounter: 18,
    triggerCount: 1,
    tags: [],
    shared: [
      {
        role: 'workflow:owner',
        workflowId: 'xS2pbMEOrVWMxiT0',
        projectId: 'unsafe-project-id',
        project: {
          id: 'unsafe-project-id',
          name: 'Fixture Owner <owner@example.invalid>',
          type: 'personal',
          creatorId: 'unsafe-creator-id'
        }
      }
    ],
    versionMetadata: {
      name: 'Version 1',
      description: ''
    }
  }
}

function sortedInputNames(schema) {
  return schema.inputs.map((input) => input.name)
}

function expectUnsupported(schema) {
  expect(() => normalizeWorkflowSchema(schema)).toThrowError(
    expect.objectContaining({ code: 'ERR_N8N_WORKFLOW_SCHEMA_UNSUPPORTED' })
  )
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

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

async function collectJsonFiles(root) {
  const files = []
  async function walk(dir) {
    for (const entry of await readdir(dir)) {
      const file = path.join(dir, entry)
      const fileStat = await stat(file)
      if (fileStat.isDirectory()) {
        await walk(file)
      } else if (entry.endsWith('.json')) {
        files.push(file)
      }
    }
  }
  await walk(root)
  return files.sort()
}

async function assertNoSecretFragments(root) {
  for (const file of await collectJsonFiles(root)) {
    const serialized = await readFile(file, 'utf8')
    for (const rule of secretFragments) {
      expect(serialized, `${file} must not contain ${rule}`).not.toMatch(rule)
    }
  }
}

describe('n8n workflow artifact contract', () => {
  it('normalizes Phase 5 scalar sidecar schemas deterministically', () => {
    const normalized = normalizeWorkflowSchema(typedSchema)

    expect(SUPPORTED_WORKFLOW_INPUT_TYPES).toEqual([
      'String',
      'Integer',
      'Decimal',
      'Boolean',
      'Date',
      'DateTime',
      'JSON'
    ])
    expect(normalized).toEqual({
      typed: true,
      diagnostics: [],
      inputs: [
        { name: 'active', type: 'Boolean', required: false },
        { name: 'bookId', type: 'Integer', required: true },
        { name: 'changedAt', type: 'DateTime', required: false },
        { name: 'event', type: 'JSON', required: false },
        { name: 'price', type: 'Decimal', required: false },
        { name: 'publishDate', type: 'Date', required: false },
        { name: 'title', type: 'String', required: true }
      ]
    })
    expect(sortedInputNames(normalized)).toEqual([
      'active',
      'bookId',
      'changedAt',
      'event',
      'price',
      'publishDate',
      'title'
    ])
  })

  it('rejects unsupported full JSON Schema shapes and invalid scalar metadata', () => {
    expectUnsupported({ $schema: 'https://json-schema.org/draft/2020-12/schema', inputs: {} })
    expectUnsupported({ inputs: { nested: { type: 'String', properties: { name: { type: 'String' } } } } })
    expectUnsupported({ inputs: { tags: { type: 'String', items: { type: 'String' } } } })
    expectUnsupported({ inputs: { status: { type: 'String', enum: ['new'] } } })
    expectUnsupported({ inputs: { value: { oneOf: [{ type: 'String' }] } } })
    expectUnsupported({ inputs: { value: { anyOf: [{ type: 'String' }] } } })
    expectUnsupported({ inputs: { value: { allOf: [{ type: 'String' }] } } })
    expectUnsupported({ inputs: { value: { type: 'Number' } } })
    expectUnsupported({ inputs: { value: { type: 'String', required: 'yes' } } })
  })

  it('treats missing sidecar schemas as untyped artifacts with warning diagnostics', () => {
    const normalized = normalizeWorkflowSchema(undefined)

    expect(normalized).toEqual({
      typed: false,
      inputs: [],
      diagnostics: [
        expect.objectContaining({
          severity: 'warning',
          code: 'WARN_N8N_WORKFLOW_SCHEMA_MISSING'
        })
      ]
    })
  })

  it('generates compile-tested CDS workflow input contracts from sidecar schemas', () => {
    const schema = normalizeWorkflowSchema(capTestSchema)
    const cdsSource = generateWorkflowCds([
      { workflowKey: 'cap-test-trigger', schema }
    ])
    const csn = cds.compile.to.csn(cdsSource)
    const inputType = csn.definitions['cap.n8n.workflows.CapTestTriggerInputs']
    const contractAction = csn.definitions['cap.n8n.workflows.WorkflowInputContracts.capTestTrigger']

    expect(workflowTypeName('cap-test-trigger')).toBe('CapTestTriggerInputs')
    expect(inputType).toBeDefined()
    expect(inputType.elements.bookId.type).toBe('cds.Integer')
    expect(inputType.elements.title.type).toBe('cds.String')
    expect(inputType.elements.event.type).toBe('cds.LargeString')
    expect(contractAction.params.inputs.type).toBe('cap.n8n.workflows.CapTestTriggerInputs')
    expect(contractAction.returns.type).toBe('cds.Boolean')
  })

  it('sanitizes workflow JSON recursively while preserving reviewable webhook structure', () => {
    const { workflow, removedPaths } = sanitizeWorkflow(unsafeFixtureWorkflow())

    expect(workflow).toEqual({
      name: 'CAP n8n Test',
      nodes: [
        expect.objectContaining({
          id: '9fd6a43a-1249-4032-9506-56de71fc3c13',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 2.1,
          position: [0, 0],
          parameters: {
            httpMethod: 'POST',
            path: 'cap-test-trigger',
            options: {}
          }
        })
      ],
      connections: {},
      settings: {
        executionOrder: 'v1'
      }
    })
    expect(removedPaths).toEqual(expect.arrayContaining([
      'updatedAt',
      'createdAt',
      'id',
      'staticData',
      'pinData',
      'versionId',
      'shared'
    ]))
    assertNoForbiddenWorkflowFields(workflow)
    expect(JSON.stringify(workflow)).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|workflow:owner|versionCounter/i)
  })

  it('writes byte-stable app-root workflow artifacts, manifests, schemas, and generated CDS', async () => {
    const appRoot = tempAppRoot()
    const rawWorkflow = unsafeFixtureWorkflow()

    const first = await writeWorkflowArtifacts({
      appRoot,
      workflows: [{
        workflow: rawWorkflow,
        workflowKey: 'cap-test-trigger',
        sourceType: 'local',
        schema: capTestSchema
      }]
    })
    const workflowPath = path.join(appRoot, 'n8n', 'workflows', 'cap-test-trigger', 'workflow.json')
    const schemaPath = path.join(appRoot, 'n8n', 'workflows', 'cap-test-trigger', 'schema.json')
    const manifestPath = path.join(appRoot, 'n8n', 'workflows', 'cap-test-trigger', 'manifest.json')
    const aggregateManifestPath = path.join(appRoot, 'n8n', 'manifest.json')
    const cdsPath = path.join(appRoot, 'n8n', 'index.cds')
    const firstBytes = {
      workflow: await readFile(workflowPath, 'utf8'),
      schema: await readFile(schemaPath, 'utf8'),
      manifest: await readFile(manifestPath, 'utf8'),
      aggregate: await readFile(aggregateManifestPath, 'utf8'),
      cds: await readFile(cdsPath, 'utf8')
    }
    const second = await writeWorkflowArtifacts({
      appRoot,
      workflows: [{
        workflow: rawWorkflow,
        workflowKey: 'cap-test-trigger',
        sourceType: 'local',
        schema: capTestSchema
      }]
    })

    expect(first.diagnostics).toEqual([])
    expect(second.diagnostics).toEqual([])
    expect(first.workflows[0].paths.workflow).toBe(workflowPath)
    expect(first.workflows[0].paths.workflow.startsWith(path.join(appRoot, 'n8n'))).toBe(true)
    expect(await readFile(workflowPath, 'utf8')).toBe(firstBytes.workflow)
    expect(await readFile(schemaPath, 'utf8')).toBe(firstBytes.schema)
    expect(await readFile(manifestPath, 'utf8')).toBe(firstBytes.manifest)
    expect(await readFile(aggregateManifestPath, 'utf8')).toBe(firstBytes.aggregate)
    expect(await readFile(cdsPath, 'utf8')).toBe(firstBytes.cds)

    const workflow = await readJson(workflowPath)
    const schema = await readJson(schemaPath)
    const manifest = await readJson(manifestPath)
    const aggregate = await readJson(aggregateManifestPath)
    const csn = cds.compile.to.csn(firstBytes.cds)

    assertNoForbiddenWorkflowFields(workflow)
    await assertNoSecretFragments(path.join(appRoot, 'n8n'))
    expect(schema.inputs).toEqual({
      bookId: { type: 'Integer', required: true },
      event: { type: 'JSON', required: false },
      title: { type: 'String', required: true }
    })
    expect(manifest).toMatchObject({
      workflowKey: 'cap-test-trigger',
      source: {
        type: 'local',
        workflowId: 'xS2pbMEOrVWMxiT0',
        workflowName: 'CAP n8n Test',
        webhookPath: 'cap-test-trigger'
      },
      artifacts: {
        workflow: 'workflows/cap-test-trigger/workflow.json',
        schema: 'workflows/cap-test-trigger/schema.json',
        manifest: 'workflows/cap-test-trigger/manifest.json',
        cds: 'index.cds'
      },
      acceptedReferences: expect.arrayContaining([
        'cap-test-trigger',
        'xS2pbMEOrVWMxiT0',
        'cap-n8n-test',
        'webhook/cap-test-trigger',
        'webhook-test/cap-test-trigger'
      ]),
      sanitizer: {
        removedPaths: expect.arrayContaining(['shared', 'pinData', 'staticData', 'versionId'])
      }
    })
    expect(aggregate.workflows).toEqual([
      {
        workflowKey: 'cap-test-trigger',
        manifest: 'workflows/cap-test-trigger/manifest.json',
        workflow: 'workflows/cap-test-trigger/workflow.json',
        schema: 'workflows/cap-test-trigger/schema.json',
        cds: 'index.cds',
        typed: true
      }
    ])
    expect(csn.definitions['cap.n8n.workflows.CapTestTriggerInputs']).toBeDefined()
    expect(csn.definitions['cap.n8n.workflows.WorkflowInputContracts.capTestTrigger']).toBeDefined()

    const readBack = await readWorkflowArtifacts(appRoot)
    expect(readBack.workflows[0].workflowKey).toBe('cap-test-trigger')
    expect(readBack.workflows[0].schema.typed).toBe(true)
  })

  it('writes untyped artifacts without schema files and rejects traversal keys', async () => {
    const appRoot = tempAppRoot()

    const untyped = await writeWorkflowArtifacts({
      appRoot,
      workflows: [{
        workflow: fixtureWorkflow(),
        workflowKey: 'cap-test-trigger',
        sourceType: 'local'
      }]
    })

    expect(untyped.workflows[0].typed).toBe(false)
    expect(untyped.workflows[0].paths.schema).toBeUndefined()
    expect(untyped.diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'WARN_N8N_WORKFLOW_SCHEMA_MISSING',
        workflowKey: 'cap-test-trigger'
      })
    ])

    await expect(writeWorkflowArtifacts({
      appRoot,
      workflows: [{
        workflow: fixtureWorkflow(),
        workflowKey: '../escape',
        sourceType: 'local',
        schema: capTestSchema
      }]
    })).rejects.toThrow(/workflow key/i)
  })
})
