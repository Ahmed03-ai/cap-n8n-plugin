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

type EntitySetReference = {
  name: string
  entityType?: string
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
