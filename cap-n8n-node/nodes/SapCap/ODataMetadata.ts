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

export function extractEntitySetOptions(metadataXml: string): EntitySetOption[] {
  if (typeof metadataXml !== 'string' || !metadataXml.trim().startsWith('<')) {
    throw createSapCapRequestError('CAP metadata response is not valid XML.', {
      category: 'responseShape',
    })
  }

  const entitySetPattern = /<(?:(?:\w+):)?EntitySet\b([^>]*)\/?>/g
  const options: EntitySetOption[] = []
  let match: RegExpExecArray | null

  while ((match = entitySetPattern.exec(metadataXml)) !== null) {
    const attributes = parseAttributes(match[1])
    const name = attributes.Name

    if (!name) continue

    const option: EntitySetOption = {
      name,
      value: name,
    }

    if (attributes.EntityType) {
      option.description = attributes.EntityType
    }

    options.push(option)
  }

  return options
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

function parseAttributes(rawAttributes: string) {
  const attributes: Record<string, string> = {}
  const attributePattern = /(\w+)\s*=\s*"([^"]*)"/g
  let match: RegExpExecArray | null

  while ((match = attributePattern.exec(rawAttributes)) !== null) {
    attributes[match[1]] = decodeXmlEntities(match[2])
  }

  return attributes
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
