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

function exportedConstructor(moduleNamespace, name) {
  return moduleNamespace[name] ?? moduleNamespace.default?.[name]
}

function propertyByName(properties, name) {
  return properties.find((property) => property.name === name)
}

describe('package boundaries', () => {
  it('loads the CAP plugin through its package name', () => {
    const plugin = require('cap-n8n-plugin')
    const service = require('cap-n8n-plugin/service')
    const mockService = require('cap-n8n-plugin/mock-service')

    expect(plugin).toHaveProperty('N8nWorkflowService')
    expect(plugin).toHaveProperty('MockN8nWorkflowService')
    expect(typeof plugin.N8nWorkflowService).toBe('function')
    expect(typeof plugin.MockN8nWorkflowService).toBe('function')
    expect(plugin.N8nWorkflowService).toBe(service)
    expect(plugin.MockN8nWorkflowService).toBe(mockService)
    expect(require.resolve('cap-n8n-plugin/cds-plugin')).toMatch(/cds-plugin\.js$/)
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

  it('exposes SAP CAP credentials and Phase 7 operation metadata', async () => {
    const [nodeModule] = await importManifestModules(['dist/nodes/SapCap/SapCap.node.js'])
    const [credentialModule] = await importManifestModules(['dist/credentials/SapCapApi.credentials.js'])
    const SapCap = exportedConstructor(nodeModule, 'SapCap')
    const SapCapApi = exportedConstructor(credentialModule, 'SapCapApi')
    const node = new SapCap()
    const credential = new SapCapApi()
    const operation = propertyByName(node.description.properties, 'operation')
    const operationValues = operation.options.map((option) => option.value)
    const propertyNames = node.description.properties.map((property) => property.name)
    const credentialFields = credential.properties.map((property) => property.name)

    expect(node.methods.loadOptions.getEntitySets).toEqual(expect.any(Function))
    expect(node.methods.loadOptions.getActionFunctions).toEqual(expect.any(Function))
    expect(node.methods.credentialTest.sapCapApiCredentialTest).toEqual(expect.any(Function))
    expect(node.description.credentials).toEqual([
      expect.objectContaining({
        name: 'sapCapApi',
        required: true,
        testedBy: 'sapCapApiCredentialTest',
      }),
    ])
    expect(propertyNames).toEqual([
      'operation',
      'servicePath',
      'entitySetSource',
      'entitySet',
      'entitySetManual',
      'operationSource',
      'actionFunction',
      'actionFunctionKind',
      'actionFunctionName',
      'actionFunctionBinding',
      'filter',
      'orderBy',
      'select',
      'top',
      'skip',
      'keyInputMode',
      'keyParts',
      'keyPredicate',
      'body',
      'parameters',
    ])
    expect(operationValues).toEqual([
      'query',
      'read',
      'create',
      'update',
      'delete',
      'actionFunction',
    ])
    expect(operation.options).toEqual([
      expect.objectContaining({
        name: 'Query',
        value: 'query',
        description: 'Retrieve a filtered, sorted, or paged collection of CAP entities.',
        action: 'Query CAP entities',
      }),
      expect.objectContaining({
        name: 'Read',
        value: 'read',
        description: 'Retrieve one CAP entity by key predicate.',
        action: 'Read a CAP entity',
      }),
      expect.objectContaining({
        name: 'Create',
        value: 'create',
        description: 'Create one CAP entity from an explicit JSON Body.',
        action: 'Create a CAP entity',
      }),
      expect.objectContaining({
        name: 'Update',
        value: 'update',
        description: 'Patch one CAP entity by key using an explicit JSON Body.',
        action: 'Update a CAP entity',
      }),
      expect.objectContaining({
        name: 'Delete',
        value: 'delete',
        description: 'Delete one CAP entity by key.',
        action: 'Delete a CAP entity',
      }),
      expect.objectContaining({
        name: 'Action/Function',
        value: 'actionFunction',
        description: 'Invoke a CAP action or function using metadata or manual operation details.',
        action: 'Invoke a CAP action or function',
      }),
    ])
    expect(propertyByName(node.description.properties, 'servicePath')).toMatchObject({
      default: '/odata/v4/admin',
    })
    expect(propertyByName(node.description.properties, 'entitySetSource')).toMatchObject({
      default: 'metadata',
      options: [
        { name: 'From Metadata', value: 'metadata' },
        { name: 'Manual', value: 'manual' },
      ],
    })
    expect(propertyByName(node.description.properties, 'entitySet')).toMatchObject({
      type: 'options',
      typeOptions: {
        loadOptionsMethod: 'getEntitySets',
      },
      displayOptions: {
        show: {
          entitySetSource: ['metadata'],
        },
      },
    })
    expect(propertyByName(node.description.properties, 'entitySetManual')).toMatchObject({
      displayName: 'Entity Set Name',
      placeholder: 'Books',
      displayOptions: {
        show: {
          entitySetSource: ['manual'],
        },
      },
    })
    expect(propertyByName(node.description.properties, 'filter')).toMatchObject({
      displayName: 'Filter',
      placeholder: "title eq 'Dune'",
    })
    expect(propertyByName(node.description.properties, 'orderBy')).toMatchObject({
      displayName: 'Order By',
      placeholder: 'title asc, stock desc',
    })
    expect(propertyByName(node.description.properties, 'select')).toMatchObject({
      displayName: 'Select Fields',
      placeholder: 'ID,title,stock',
    })
    expect(propertyByName(node.description.properties, 'top')).toMatchObject({
      default: 100,
    })
    expect(propertyByName(node.description.properties, 'skip')).toMatchObject({
      default: 0,
    })
    expect(propertyByName(node.description.properties, 'keyPredicate')).toMatchObject({
      displayName: 'Key Predicate',
      placeholder: 'ID=201,IsActiveEntity=true',
      displayOptions: {
        show: {
          operation: ['read', 'update', 'delete', 'actionFunction'],
          keyInputMode: ['manual'],
        },
      },
    })
    expect(propertyByName(node.description.properties, 'keyInputMode')).toMatchObject({
      default: 'manual',
      options: [
        { name: 'Metadata Key Parts', value: 'metadata' },
        { name: 'Manual Key Predicate', value: 'manual' },
      ],
      displayOptions: {
        show: {
          operation: ['read', 'update', 'delete', 'actionFunction'],
        },
      },
    })
    expect(propertyByName(node.description.properties, 'keyParts')).toMatchObject({
      displayName: 'Key Parts (JSON)',
      type: 'json',
      displayOptions: {
        show: {
          operation: ['read', 'update', 'delete', 'actionFunction'],
          keyInputMode: ['metadata'],
        },
      },
    })
    expect(propertyByName(node.description.properties, 'body')).toMatchObject({
      displayName: 'Body (JSON)',
      type: 'json',
      displayOptions: {
        show: {
          operation: ['create', 'update'],
        },
      },
    })
    expect(propertyByName(node.description.properties, 'operationSource')).toMatchObject({
      default: 'metadata',
      options: [
        { name: 'From Metadata', value: 'metadata' },
        { name: 'Manual', value: 'manual' },
      ],
      displayOptions: {
        show: {
          operation: ['actionFunction'],
        },
      },
    })
    expect(propertyByName(node.description.properties, 'actionFunction')).toMatchObject({
      displayName: 'Action/Function',
      type: 'options',
      typeOptions: {
        loadOptionsMethod: 'getActionFunctions',
      },
      displayOptions: {
        show: {
          operation: ['actionFunction'],
          operationSource: ['metadata'],
        },
      },
    })
    expect(propertyByName(node.description.properties, 'actionFunctionKind')).toMatchObject({
      default: 'action',
      options: [
        { name: 'Action', value: 'action' },
        { name: 'Function', value: 'function' },
      ],
    })
    expect(propertyByName(node.description.properties, 'actionFunctionName')).toMatchObject({
      displayName: 'Operation Name',
      placeholder: 'submitOrder',
    })
    expect(propertyByName(node.description.properties, 'actionFunctionBinding')).toMatchObject({
      default: 'unbound',
      options: [
        { name: 'Unbound', value: 'unbound' },
        { name: 'Bound to Entity', value: 'bound' },
      ],
    })
    expect(propertyByName(node.description.properties, 'parameters')).toMatchObject({
      displayName: 'Parameters (JSON)',
      type: 'json',
      default: '{}',
      displayOptions: {
        show: {
          operation: ['actionFunction'],
        },
      },
    })
    expect(propertyByName(node.description.properties, 'actionName')).toBeUndefined()
    expect(propertyByName(node.description.properties, 'functionName')).toBeUndefined()
    expect(propertyByName(node.description.properties, 'entityKey')).toBeUndefined()
    expect(propertyByName(node.description.properties, 'deleteConfirmation')).toBeUndefined()
    expect(propertyByName(node.description.properties, 'confirmDelete')).toBeUndefined()
    expect(propertyByName(node.description.properties, 'entityProperty')).toBeUndefined()
    expect(propertyByName(node.description.properties, 'entityProperties')).toBeUndefined()
    expect(operationValues).not.toEqual(expect.arrayContaining(['action', 'function', 'trigger']))
    expect(credentialFields).toEqual(expect.arrayContaining([
      'baseUrl',
      'metadataPath',
      'authType',
      'username',
      'password',
      'tokenUrl',
      'clientId',
      'clientSecret',
      'scope',
    ]))
    expect(propertyByName(credential.properties, 'baseUrl')).toMatchObject({
      placeholder: 'http://host.docker.internal:3000',
    })
    expect(propertyByName(credential.properties, 'metadataPath')).toMatchObject({
      default: '/odata/v4/admin/$metadata',
      required: true,
      description: 'CAP OData $metadata endpoint used for Test Connection and entity discovery.',
    })
    expect(propertyByName(credential.properties, 'authType')).toMatchObject({
      default: 'basicAuth',
      required: true,
      description: 'Authentication method for CAP OData requests.',
    })
    expect(propertyByName(credential.properties, 'authType').options.map((option) => option.value)).toEqual([
      'basicAuth',
      'oauth2',
    ])
    expect(propertyByName(credential.properties, 'username')).toMatchObject({
      required: true,
      description: 'CAP username for Basic Auth.',
    })
    expect(propertyByName(credential.properties, 'password')).toMatchObject({
      required: true,
      typeOptions: {
        password: true,
      },
      description: 'CAP password for Basic Auth.',
    })
    expect(propertyByName(credential.properties, 'tokenUrl')).toMatchObject({
      required: true,
      placeholder: 'https://your-tenant.authentication.eu10.hana.ondemand.com/oauth/token',
      displayOptions: {
        show: {
          authType: ['oauth2'],
        },
      },
    })
    expect(propertyByName(credential.properties, 'clientId')).toMatchObject({
      required: true,
      description: 'OAuth2 client ID.',
    })
    expect(propertyByName(credential.properties, 'clientSecret')).toMatchObject({
      required: true,
      typeOptions: {
        password: true,
      },
    })
    expect(propertyByName(credential.properties, 'scope')).toMatchObject({
      placeholder: 'openid',
    })
    expect(credential.test).toBeUndefined()
  })
})
