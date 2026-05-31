import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')
const n8nPackageDir = resolve(repoRoot, 'cap-n8n-node')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

async function importManifestModules(manifestPaths) {
  const modules = []

  for (const manifestPath of manifestPaths) {
    const modulePath = resolve(n8nPackageDir, manifestPath)

    expect(existsSync(modulePath), `${manifestPath} should exist after n8n package build`).toBe(true)
    modules.push(await import(pathToFileURL(modulePath).href))
  }

  return modules
}

function hasFunctionExport(moduleNamespace) {
  const exportedValues = [
    ...Object.values(moduleNamespace),
    ...Object.values(moduleNamespace.default ?? {}),
  ]

  return exportedValues.some((value) => typeof value === 'function')
}

describe('package boundaries', () => {
  it('loads the CAP plugin through its package name', () => {
    const plugin = require('cap-n8n-plugin')
    const service = require('cap-n8n-plugin/service')

    expect(plugin).toHaveProperty('N8nWorkflowService')
    expect(typeof plugin.N8nWorkflowService).toBe('function')
    expect(plugin.N8nWorkflowService).toBe(service)
  })

  it('loads every n8n manifest-referenced node and credential module after build', async () => {
    const packageJson = readJson(resolve(n8nPackageDir, 'package.json'))
    const nodeManifestPaths = packageJson.n8n?.nodes ?? []
    const credentialManifestPaths = packageJson.n8n?.credentials ?? []

    expect(nodeManifestPaths.length).toBeGreaterThan(0)
    expect(credentialManifestPaths.length).toBeGreaterThan(0)

    const nodeModules = await importManifestModules(nodeManifestPaths)
    const credentialModules = await importManifestModules(credentialManifestPaths)

    expect(nodeModules.some(hasFunctionExport)).toBe(true)
    expect(credentialModules.some(hasFunctionExport)).toBe(true)
  })
})
