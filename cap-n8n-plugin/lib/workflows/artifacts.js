const fs = require('node:fs/promises')
const path = require('node:path')
const { generateWorkflowCds } = require('./generate-cds')
const {
  assertWorkflowKey,
  buildWorkflowManifest,
  resolveWorkflowKey
} = require('./manifest')
const { normalizeWorkflowSchema } = require('./schema')
const { sanitizeWorkflow } = require('./sanitize')

function absoluteRoot(appRoot) {
  if (typeof appRoot !== 'string' || !appRoot.trim()) {
    throw new Error('n8n workflow artifact appRoot must be a non-empty string.')
  }

  return path.resolve(appRoot)
}

function assertInside(root, target) {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(target)
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`n8n workflow artifact path ${resolvedTarget} is outside app root ${resolvedRoot}.`)
  }
  return resolvedTarget
}

function relativeArtifactPath(root, target) {
  return path.relative(root, target).split(path.sep).join('/')
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value

  const stable = {}
  for (const key of Object.keys(value).sort()) {
    stable[key] = stableValue(value[key])
  }
  return stable
}

function stableJson(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`
}

async function writeJson(file, value) {
  await fs.writeFile(file, stableJson(value), 'utf8')
}

function schemaArtifact(schema) {
  const inputs = {}
  for (const input of schema.inputs) {
    inputs[input.name] = {
      type: input.type,
      required: input.required === true
    }
  }
  return { inputs }
}

function workflowEntryPaths(n8nRoot, workflowKey) {
  const workflowDir = assertInside(n8nRoot, path.join(n8nRoot, 'workflows', workflowKey))
  return {
    dir: workflowDir,
    workflow: assertInside(n8nRoot, path.join(workflowDir, 'workflow.json')),
    schema: assertInside(n8nRoot, path.join(workflowDir, 'schema.json')),
    manifest: assertInside(n8nRoot, path.join(workflowDir, 'manifest.json'))
  }
}

async function writeWorkflowArtifacts({ appRoot, workflows = [] } = {}) {
  const root = absoluteRoot(appRoot)
  const n8nRoot = assertInside(root, path.join(root, 'n8n'))
  const aggregateManifestPath = assertInside(n8nRoot, path.join(n8nRoot, 'manifest.json'))
  const cdsPath = assertInside(n8nRoot, path.join(n8nRoot, 'index.cds'))
  const diagnostics = []
  const existingKeys = new Set()
  const entries = []

  await fs.mkdir(n8nRoot, { recursive: true })

  for (const entry of workflows) {
    const workflow = entry.workflow || {}
    const workflowKey = assertWorkflowKey(entry.workflowKey || resolveWorkflowKey({
      workflow,
      explicitKey: entry.key,
      existingKeys
    }))
    existingKeys.add(workflowKey)

    const paths = workflowEntryPaths(n8nRoot, workflowKey)
    const schema = normalizeWorkflowSchema(entry.schema)
    const { workflow: sanitizedWorkflow, removedPaths } = sanitizeWorkflow(workflow)
    const typed = schema.typed === true
    const artifacts = {
      workflow: relativeArtifactPath(n8nRoot, paths.workflow),
      manifest: relativeArtifactPath(n8nRoot, paths.manifest),
      cds: relativeArtifactPath(n8nRoot, cdsPath)
    }

    if (typed) artifacts.schema = relativeArtifactPath(n8nRoot, paths.schema)

    const manifest = buildWorkflowManifest({
      workflowKey,
      workflow,
      sourceType: entry.sourceType || 'local',
      artifacts,
      typed,
      removedPaths
    })

    await fs.mkdir(paths.dir, { recursive: true })
    await writeJson(paths.workflow, sanitizedWorkflow)
    if (typed) {
      await writeJson(paths.schema, schemaArtifact(schema))
    } else {
      await fs.rm(paths.schema, { force: true })
    }
    await writeJson(paths.manifest, manifest)

    for (const diagnostic of schema.diagnostics || []) {
      diagnostics.push({
        ...diagnostic,
        workflowKey
      })
    }

    entries.push({
      workflowKey,
      typed,
      paths: {
        workflow: paths.workflow,
        schema: typed ? paths.schema : undefined,
        manifest: paths.manifest,
        cds: cdsPath
      },
      workflow: sanitizedWorkflow,
      schema,
      manifest
    })
  }

  const cdsSource = generateWorkflowCds(entries.map((entry) => ({
    workflowKey: entry.workflowKey,
    schema: entry.schema
  })))
  await fs.writeFile(cdsPath, cdsSource, 'utf8')

  const aggregate = {
    workflows: entries.map((entry) => {
      const artifact = {
        workflowKey: entry.workflowKey,
        manifest: relativeArtifactPath(n8nRoot, entry.paths.manifest),
        workflow: relativeArtifactPath(n8nRoot, entry.paths.workflow)
      }

      if (entry.typed) artifact.schema = relativeArtifactPath(n8nRoot, entry.paths.schema)

      artifact.cds = relativeArtifactPath(n8nRoot, entry.paths.cds)
      artifact.typed = entry.typed
      return artifact
    }).sort((left, right) => left.workflowKey.localeCompare(right.workflowKey))
  }
  await writeJson(aggregateManifestPath, aggregate)

  return {
    appRoot: root,
    artifactRoot: n8nRoot,
    manifestPath: aggregateManifestPath,
    cdsPath,
    diagnostics,
    workflows: entries.sort((left, right) => left.workflowKey.localeCompare(right.workflowKey))
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function readWorkflowArtifacts(appRoot) {
  const root = absoluteRoot(appRoot)
  const n8nRoot = assertInside(root, path.join(root, 'n8n'))
  const aggregateManifestPath = assertInside(n8nRoot, path.join(n8nRoot, 'manifest.json'))
  const aggregate = await readJson(aggregateManifestPath)
  const workflows = []

  for (const entry of aggregate.workflows || []) {
    const workflowKey = assertWorkflowKey(entry.workflowKey)
    const workflowPath = assertInside(n8nRoot, path.join(n8nRoot, entry.workflow))
    const manifestPath = assertInside(n8nRoot, path.join(n8nRoot, entry.manifest))
    const schemaPath = entry.schema
      ? assertInside(n8nRoot, path.join(n8nRoot, entry.schema))
      : undefined

    workflows.push({
      workflowKey,
      typed: entry.typed === true,
      paths: {
        workflow: workflowPath,
        schema: schemaPath,
        manifest: manifestPath,
        cds: assertInside(n8nRoot, path.join(n8nRoot, entry.cds || 'index.cds'))
      },
      workflow: await readJson(workflowPath),
      schema: schemaPath ? normalizeWorkflowSchema(await readJson(schemaPath)) : normalizeWorkflowSchema(undefined),
      manifest: await readJson(manifestPath)
    })
  }

  return {
    appRoot: root,
    artifactRoot: n8nRoot,
    manifestPath: aggregateManifestPath,
    workflows
  }
}

module.exports = {
  readWorkflowArtifacts,
  writeWorkflowArtifacts
}
