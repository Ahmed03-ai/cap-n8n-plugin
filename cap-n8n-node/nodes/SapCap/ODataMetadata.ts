import {
  ILoadOptionsFunctions,
  INodeListSearchResult,
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

export type EntityFieldDescriptor = {
  name: string
  type?: string
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

// The dropdown option value is prefixed with the binding so that the node's
// displayOptions can reshape the downstream form (key inputs vs. parameters only)
// purely from the selection, without asking the user to restate the binding.
export const BOUND_OPTION_PREFIX = 'bound::'
export const UNBOUND_OPTION_PREFIX = 'unbound::'

export function actionFunctionOptionValue(descriptor: ActionFunctionDescriptor): string {
  const prefix = descriptor.isBound ? BOUND_OPTION_PREFIX : UNBOUND_OPTION_PREFIX

  return `${prefix}${JSON.stringify(descriptor)}`
}

export function extractActionFunctionOptions(metadataXml: string): INodePropertyOptions[] {
  return extractActionFunctionDescriptors(metadataXml).map((descriptor) => ({
    name: actionFunctionOptionName(descriptor),
    value: actionFunctionOptionValue(descriptor),
    description: descriptor.qualifiedName,
  }))
}

// CAP managed timestamp columns; surfaced first so the polling trigger defaults
// to a sensible change-detection field without the user hunting through the list.
const PREFERRED_TIMESTAMP_FIELDS = ['modifiedAt', 'createdAt']

export function extractEntityFieldDescriptors(
  metadataXml: string,
  entitySetName: string
): EntityFieldDescriptor[] {
  validateMetadataXml(metadataXml)

  const entitySet = extractEntitySets(metadataXml).find((candidate) => candidate.name === entitySetName)

  if (!entitySet?.entityType) return []

  const fieldsByType = extractEntityTypeFields(metadataXml)
  const localName = entitySet.entityType.split('.').pop()

  return fieldsByType.get(entitySet.entityType)
    ?? (localName ? fieldsByType.get(localName) : undefined)
    ?? []
}

export function extractTimestampFieldOptions(
  metadataXml: string,
  entitySetName: string
): INodePropertyOptions[] {
  const fields = extractEntityFieldDescriptors(metadataXml, entitySetName)
  // Only date/time fields are valid change markers for polling; non-temporal fields
  // (strings, keys, …) would break the timestamp watermark, so keep them out of the list.
  const temporal = fields.filter((field) => isTemporalEdmType(field.type))

  return sortPreferredFirst(temporal).map((field) => ({
    name: field.name,
    value: field.name,
    ...(field.type ? { description: field.type } : {}),
  }))
}

export async function loadTimestampFieldOptions(this: ILoadOptionsFunctions) {
  const rawEntitySet = this.getCurrentNodeParameter('entitySet')
  const entitySetName = rawEntitySet && typeof rawEntitySet === 'object'
    ? String((rawEntitySet as { value?: unknown }).value ?? '')
    : String(rawEntitySet ?? '')

  if (!entitySetName) return []

  return extractTimestampFieldOptions(await fetchDesignTimeMetadataXml(this), entitySetName)
}

export async function loadEntitySetOptions(this: ILoadOptionsFunctions) {
  return extractEntitySetOptions(await fetchDesignTimeMetadataXml(this))
}

// Dropdown loads prefer the node's Service Path so the entity and action lists reflect
// the service the user typed (e.g. /odata/v4/catalog surfaces submitOrder), falling back
// to the credential's Metadata Path when the Service Path is unavailable.
async function fetchDesignTimeMetadataXml(context: ILoadOptionsFunctions): Promise<string> {
  const credentials = await context.getCredentials('sapCapApi')

  return await sapCapApiRequest(context, {
    method: 'GET',
    path: resolveDesignTimeMetadataPath(context, credentials.metadataPath),
    responseFormat: 'text',
    errorContext: 'metadata',
  }) as string
}

function resolveDesignTimeMetadataPath(context: ILoadOptionsFunctions, credentialMetadataPath: unknown): string {
  const servicePath = typeof context.getCurrentNodeParameter === 'function'
    ? context.getCurrentNodeParameter('servicePath')
    : undefined

  if (typeof servicePath === 'string' && servicePath.trim()) {
    return normalizeMetadataPath(`${servicePath.replace(/\/+$/, '')}/$metadata`)
  }

  return normalizeMetadataPath(credentialMetadataPath)
}

// resourceLocator "From List" search backends. They reuse the option loaders and
// apply the editor's type-ahead filter, so the entity-set and action/function
// pickers no longer need a separate "From Metadata / Manual" source dropdown.
export async function searchEntitySets(
  this: ILoadOptionsFunctions,
  filter?: string
): Promise<INodeListSearchResult> {
  return toSearchResults(await loadEntitySetOptions.call(this), filter)
}

export async function searchActionFunctions(
  this: ILoadOptionsFunctions,
  filter?: string
): Promise<INodeListSearchResult> {
  return toSearchResults(await loadActionFunctionOptions.call(this), filter)
}

function toSearchResults(options: INodePropertyOptions[], filter?: string): INodeListSearchResult {
  const term = (filter ?? '').trim().toLowerCase()
  const results = options
    .filter((option) => !term || String(option.name).toLowerCase().includes(term))
    .map((option) => ({
      name: String(option.name),
      value: String(option.value),
      ...(option.description ? { description: option.description } : {}),
    }))

  return { results }
}

export async function loadActionFunctionOptions(this: ILoadOptionsFunctions) {
  return extractActionFunctionOptions(await fetchDesignTimeMetadataXml(this))
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

function extractEntityTypeFields(metadataXml: string) {
  const schemaPattern = /<(?:(?:\w+):)?Schema\b([^>]*)>([\s\S]*?)<\/(?:(?:\w+):)?Schema>/g
  const fieldsByType = new Map<string, EntityFieldDescriptor[]>()
  let schemaMatch: RegExpExecArray | null

  while ((schemaMatch = schemaPattern.exec(metadataXml)) !== null) {
    const schemaAttributes = parseAttributes(schemaMatch[1])
    const namespace = schemaAttributes.Namespace
    const entityTypePattern = /<(?:(?:\w+):)?EntityType\b([^>]*?)(\/>|>([\s\S]*?)<\/(?:(?:\w+):)?EntityType>)/g
    let typeMatch: RegExpExecArray | null

    while ((typeMatch = entityTypePattern.exec(schemaMatch[2])) !== null) {
      const name = parseAttributes(typeMatch[1]).Name

      if (!name) continue

      const fields = Array.from(extractPropertyTypes(typeMatch[3] ?? ''))
        .map(([fieldName, type]) => ({ name: fieldName, type }))

      fieldsByType.set(name, fields)
      if (namespace) fieldsByType.set(`${namespace}.${name}`, fields)
    }
  }

  return fieldsByType
}

function isTemporalEdmType(type: string | undefined) {
  if (!type) return false

  return /Edm\.(DateTimeOffset|Date|Time|Timestamp)/i.test(type)
}

function sortPreferredFirst(fields: EntityFieldDescriptor[]): EntityFieldDescriptor[] {
  const preferred = PREFERRED_TIMESTAMP_FIELDS
    .map((name) => fields.find((field) => field.name === name))
    .filter((field): field is EntityFieldDescriptor => Boolean(field))
  const rest = fields.filter((field) => !PREFERRED_TIMESTAMP_FIELDS.includes(field.name))

  return [...preferred, ...rest]
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
