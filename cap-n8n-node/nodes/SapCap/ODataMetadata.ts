import {
  ILoadOptionsFunctions,
  INodePropertyOptions,
} from 'n8n-workflow'

import {
  createSapCapRequestError,
  normalizeMetadataPath,
  sapCapApiRequest,
} from './GenericFunctions'

type EntitySetOption = INodePropertyOptions & {
  description?: string
}

export type EntityKeyDescriptor = {
  name: string
  type?: string
}

export type EntitySetDescriptor = {
  name: string
  entityType?: string
  keys: EntityKeyDescriptor[]
}

export type ActionFunctionParameterDescriptor = {
  name: string
  type?: string
}

export type ActionFunctionDescriptor = {
  kind: 'action' | 'function'
  name: string
  qualifiedName: string
  importName?: string
  isBound: boolean
  bindingType?: string
  entitySet?: string
  parameters: ActionFunctionParameterDescriptor[]
}

type EntitySetReference = {
  name: string
  entityType?: string
}

type ActionFunctionImportReference = {
  kind: 'action' | 'function'
  importName: string
  qualifiedName: string
}

export function extractEntitySetOptions(metadataXml: string): EntitySetOption[] {
  validateMetadataXml(metadataXml)

  const options: EntitySetOption[] = []

  for (const entitySet of extractEntitySets(metadataXml)) {
    const option: EntitySetOption = {
      name: entitySet.name,
      value: entitySet.name,
    }

    if (entitySet.entityType) {
      option.description = entitySet.entityType
    }

    options.push(option)
  }

  return options
}

export function extractEntitySetDescriptors(metadataXml: string): EntitySetDescriptor[] {
  validateMetadataXml(metadataXml)

  const entityTypes = extractEntityTypes(metadataXml)

  return extractEntitySets(metadataXml).map((entitySet) => ({
    name: entitySet.name,
    entityType: entitySet.entityType,
    keys: lookupEntityTypeKeys(entityTypes, entitySet.entityType),
  }))
}

export function extractEntityKeyDescriptors(metadataXml: string, entitySetName: string): EntityKeyDescriptor[] {
  const descriptor = extractEntitySetDescriptors(metadataXml)
    .find((entitySet) => entitySet.name === entitySetName)

  return descriptor?.keys ?? []
}

export function extractActionFunctionDescriptors(metadataXml: string): ActionFunctionDescriptor[] {
  validateMetadataXml(metadataXml)

  const entitySets = extractEntitySets(metadataXml)
  const operations = extractSchemaActionFunctions(metadataXml)
  const operationByName = new Map<string, ActionFunctionDescriptor>()

  for (const operation of operations) {
    operationByName.set(`${operation.kind}:${operation.qualifiedName}`, operation)
  }

  return [
    ...extractImportedActionFunctions(metadataXml, operationByName),
    ...expandBoundActionFunctions(operations, entitySets),
  ]
}

export function extractActionFunctionOptions(metadataXml: string): INodePropertyOptions[] {
  return extractActionFunctionDescriptors(metadataXml).map((descriptor) => ({
    name: actionFunctionOptionName(descriptor),
    value: JSON.stringify(descriptor),
    description: descriptor.qualifiedName,
  }))
}

export async function loadEntitySetOptions(this: ILoadOptionsFunctions) {
  const credentials = await this.getCredentials('sapCapApi')
  const metadataPath = normalizeMetadataPath(credentials.metadataPath)
  const metadataXml = await sapCapApiRequest(this, {
    method: 'GET',
    path: metadataPath,
    responseFormat: 'text',
    errorContext: 'metadata',
  }) as string

  return extractEntitySetOptions(metadataXml)
}

export async function loadActionFunctionOptions(this: ILoadOptionsFunctions) {
  const credentials = await this.getCredentials('sapCapApi')
  const metadataPath = normalizeMetadataPath(credentials.metadataPath)
  const metadataXml = await sapCapApiRequest(this, {
    method: 'GET',
    path: metadataPath,
    responseFormat: 'text',
    errorContext: 'metadata',
  }) as string

  return extractActionFunctionOptions(metadataXml)
}

function validateMetadataXml(metadataXml: string) {
  if (typeof metadataXml !== 'string' || !metadataXml.trim().startsWith('<')) {
    throw createSapCapRequestError('CAP metadata response is not valid XML.', {
      category: 'responseShape',
    })
  }

  if (!hasMetadataTag(metadataXml, 'Edmx') ||
    !hasMetadataTag(metadataXml, 'DataServices') ||
    !hasMetadataTag(metadataXml, 'EntityContainer')
  ) {
    throw createSapCapRequestError('CAP metadata response is not valid OData metadata.', {
      category: 'responseShape',
    })
  }
}

function extractEntitySets(metadataXml: string): EntitySetReference[] {
  const entitySetPattern = /<(?:(?:\w+):)?EntitySet\b([^>]*)\/?>/g
  const entitySets: EntitySetReference[] = []
  let match: RegExpExecArray | null

  while ((match = entitySetPattern.exec(metadataXml)) !== null) {
    const attributes = parseAttributes(match[1])
    const name = attributes.Name

    if (!name) continue

    const entitySet: EntitySetReference = { name }

    if (attributes.EntityType) {
      entitySet.entityType = attributes.EntityType
    }

    entitySets.push(entitySet)
  }

  return entitySets
}

function extractSchemaActionFunctions(metadataXml: string): ActionFunctionDescriptor[] {
  const schemaPattern = /<(?:(?:\w+):)?Schema\b([^>]*)>([\s\S]*?)<\/(?:(?:\w+):)?Schema>/g
  const operations: ActionFunctionDescriptor[] = []
  let schemaMatch: RegExpExecArray | null

  while ((schemaMatch = schemaPattern.exec(metadataXml)) !== null) {
    const schemaAttributes = parseAttributes(schemaMatch[1])
    const namespace = schemaAttributes.Namespace

    operations.push(
      ...extractOperationsFromSchema(schemaMatch[2], namespace, 'action'),
      ...extractOperationsFromSchema(schemaMatch[2], namespace, 'function')
    )
  }

  return operations
}

function extractOperationsFromSchema(
  schemaXml: string,
  namespace: string | undefined,
  kind: 'action' | 'function'
) {
  const tagName = kind === 'action' ? 'Action' : 'Function'
  const operationPattern = new RegExp(`<(?:(?:\\w+):)?${tagName}\\b([^>]*?)(\\/|>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tagName}>)`, 'g')
  const operations: ActionFunctionDescriptor[] = []
  let match: RegExpExecArray | null

  while ((match = operationPattern.exec(schemaXml)) !== null) {
    const attributes = parseAttributes(match[1])
    const name = attributes.Name

    if (!name) continue

    const isBound = attributes.IsBound === 'true'
    const rawParameters = extractOperationParameters(match[3] ?? '')
    const bindingType = isBound && rawParameters[0]?.type
      ? normalizeBindingType(rawParameters[0].type)
      : undefined
    const parameters = isBound ? rawParameters.slice(1) : rawParameters

    operations.push({
      kind,
      name,
      qualifiedName: namespace ? `${namespace}.${name}` : name,
      isBound,
      ...(bindingType ? { bindingType } : {}),
      parameters,
    })
  }

  return operations
}

function extractOperationParameters(operationXml: string): ActionFunctionParameterDescriptor[] {
  const parameterPattern = /<(?:(?:\w+):)?Parameter\b([^>]*)\/?>/g
  const parameters: ActionFunctionParameterDescriptor[] = []
  let match: RegExpExecArray | null

  while ((match = parameterPattern.exec(operationXml)) !== null) {
    const attributes = parseAttributes(match[1])

    if (!attributes.Name) continue

    parameters.push({
      name: attributes.Name,
      ...(attributes.Type ? { type: attributes.Type } : {}),
    })
  }

  return parameters
}

function extractImportedActionFunctions(
  metadataXml: string,
  operationByName: Map<string, ActionFunctionDescriptor>
) {
  const imports: ActionFunctionDescriptor[] = []

  for (const reference of extractActionFunctionImports(metadataXml)) {
    const operation = operationByName.get(`${reference.kind}:${reference.qualifiedName}`)
    const name = localName(reference.qualifiedName)

    imports.push({
      kind: reference.kind,
      name,
      qualifiedName: reference.qualifiedName,
      importName: reference.importName,
      isBound: false,
      parameters: operation?.parameters.map((parameter) => ({ ...parameter })) ?? [],
    })
  }

  return imports
}

function extractActionFunctionImports(metadataXml: string): ActionFunctionImportReference[] {
  return [
    ...extractOperationImports(metadataXml, 'action'),
    ...extractOperationImports(metadataXml, 'function'),
  ]
}

function extractOperationImports(metadataXml: string, kind: 'action' | 'function') {
  const tagName = kind === 'action' ? 'ActionImport' : 'FunctionImport'
  const targetAttribute = kind === 'action' ? 'Action' : 'Function'
  const importPattern = new RegExp(`<(?:(?:\\w+):)?${tagName}\\b([^>]*)\\/?>`, 'g')
  const imports: ActionFunctionImportReference[] = []
  let match: RegExpExecArray | null

  while ((match = importPattern.exec(metadataXml)) !== null) {
    const attributes = parseAttributes(match[1])

    if (!attributes.Name || !attributes[targetAttribute]) continue

    imports.push({
      kind,
      importName: attributes.Name,
      qualifiedName: attributes[targetAttribute],
    })
  }

  return imports
}

function expandBoundActionFunctions(
  operations: ActionFunctionDescriptor[],
  entitySets: EntitySetReference[]
) {
  const descriptors: ActionFunctionDescriptor[] = []

  for (const operation of operations) {
    if (!operation.isBound) continue

    const matchingEntitySets = entitySets.filter((entitySet) =>
      normalizeBindingType(entitySet.entityType) === operation.bindingType
    )

    if (matchingEntitySets.length === 0) {
      descriptors.push({ ...operation, parameters: operation.parameters.map((parameter) => ({ ...parameter })) })
      continue
    }

    for (const entitySet of matchingEntitySets) {
      descriptors.push({
        ...operation,
        entitySet: entitySet.name,
        parameters: operation.parameters.map((parameter) => ({ ...parameter })),
      })
    }
  }

  return descriptors
}

function actionFunctionOptionName(descriptor: ActionFunctionDescriptor) {
  const kindLabel = descriptor.kind === 'action' ? 'Action' : 'Function'
  const operationName = descriptor.importName ?? descriptor.name

  return descriptor.isBound && descriptor.entitySet
    ? `${kindLabel}: ${descriptor.entitySet}/${operationName}`
    : `${kindLabel}: ${operationName}`
}

function normalizeBindingType(value: string | undefined) {
  if (!value) return undefined

  const collectionMatch = /^Collection\((.+)\)$/.exec(value)
  return collectionMatch ? collectionMatch[1] : value
}

function localName(qualifiedName: string) {
  return qualifiedName.split('.').pop() ?? qualifiedName
}

function extractEntityTypes(metadataXml: string) {
  const schemaPattern = /<(?:(?:\w+):)?Schema\b([^>]*)>([\s\S]*?)<\/(?:(?:\w+):)?Schema>/g
  const entityTypes = new Map<string, EntityKeyDescriptor[]>()
  let schemaMatch: RegExpExecArray | null

  while ((schemaMatch = schemaPattern.exec(metadataXml)) !== null) {
    const schemaAttributes = parseAttributes(schemaMatch[1])
    const namespace = schemaAttributes.Namespace

    extractEntityTypesFromSchema(schemaMatch[2], namespace, entityTypes)
  }

  return entityTypes
}

function extractEntityTypesFromSchema(
  schemaXml: string,
  namespace: string | undefined,
  entityTypes: Map<string, EntityKeyDescriptor[]>
) {
  const entityTypePattern = /<(?:(?:\w+):)?EntityType\b([^>]*?)(\/>|>([\s\S]*?)<\/(?:(?:\w+):)?EntityType>)/g
  let match: RegExpExecArray | null

  while ((match = entityTypePattern.exec(schemaXml)) !== null) {
    const attributes = parseAttributes(match[1])
    const name = attributes.Name

    if (!name) continue

    const keys = extractKeyDescriptors(match[3] ?? '')

    entityTypes.set(name, keys)
    if (namespace) entityTypes.set(`${namespace}.${name}`, keys)
  }
}

function extractKeyDescriptors(entityTypeXml: string): EntityKeyDescriptor[] {
  const keyBlock = /<(?:(?:\w+):)?Key\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?Key>/i.exec(entityTypeXml)

  if (!keyBlock) return []

  const propertyTypes = extractPropertyTypes(entityTypeXml)
  const propertyRefPattern = /<(?:(?:\w+):)?PropertyRef\b([^>]*)\/?>/g
  const keys: EntityKeyDescriptor[] = []
  let match: RegExpExecArray | null

  while ((match = propertyRefPattern.exec(keyBlock[1])) !== null) {
    const attributes = parseAttributes(match[1])
    const name = attributes.Name

    if (!name) continue

    const key: EntityKeyDescriptor = { name }
    const type = propertyTypes.get(name)

    if (type) key.type = type

    keys.push(key)
  }

  return keys
}

function extractPropertyTypes(entityTypeXml: string) {
  const propertyPattern = /<(?:(?:\w+):)?Property\b([^>]*)\/?>/g
  const propertyTypes = new Map<string, string>()
  let match: RegExpExecArray | null

  while ((match = propertyPattern.exec(entityTypeXml)) !== null) {
    const attributes = parseAttributes(match[1])

    if (attributes.Name && attributes.Type) {
      propertyTypes.set(attributes.Name, attributes.Type)
    }
  }

  return propertyTypes
}

function lookupEntityTypeKeys(
  entityTypes: Map<string, EntityKeyDescriptor[]>,
  entityType: string | undefined
) {
  if (!entityType) return []

  const localName = entityType.split('.').pop()
  const keys = entityTypes.get(entityType) ?? (localName ? entityTypes.get(localName) : undefined) ?? []

  return keys.map((key) => ({ ...key }))
}

function parseAttributes(rawAttributes: string) {
  const attributes: Record<string, string> = {}
  const attributePattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let match: RegExpExecArray | null

  while ((match = attributePattern.exec(rawAttributes)) !== null) {
    attributes[match[1]] = decodeXmlEntities(match[2] ?? match[3] ?? '')
  }

  return attributes
}

function hasMetadataTag(metadataXml: string, tagName: string) {
  return new RegExp(`<(?:(?:\\w+):)?${tagName}\\b`, 'i').test(metadataXml)
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
