import {
  IDataObject,
  INodeExecutionData,
} from 'n8n-workflow'

type ODataOperation = 'query' | 'read'

export type SapCapErrorCategory = 'responseShape'

export type SafeSapCapError = {
  message: string
  description?: string
  statusCode?: number
  category: SapCapErrorCategory
}

export function stripODataMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripODataMetadata(item))
  }

  if (!isPlainObject(value)) {
    return value
  }

  const cleaned: IDataObject = {}

  for (const [key, childValue] of Object.entries(value)) {
    if (key.startsWith('@odata.')) continue

    cleaned[key] = stripODataMetadata(childValue) as IDataObject[keyof IDataObject]
  }

  return cleaned
}

export function normalizeODataItems(
  operation: ODataOperation,
  response: unknown,
  itemIndex: number
): INodeExecutionData[] {
  if (operation === 'query') {
    if (!isPlainObject(response) || !Array.isArray(response.value)) {
      throw createResponseShapeError()
    }

    return response.value.map((record) => {
      if (!isPlainObject(record)) {
        throw createResponseShapeError()
      }

      return toItem(record, itemIndex)
    })
  }

  if (!isPlainObject(response)) {
    throw createResponseShapeError()
  }

  return [toItem(response, itemIndex)]
}

function toItem(value: IDataObject, itemIndex: number): INodeExecutionData {
  return {
    json: stripODataMetadata(value) as IDataObject,
    pairedItem: {
      item: itemIndex,
    },
  }
}

function createResponseShapeError(): Error & SafeSapCapError {
  const err = new Error('CAP response did not match the expected OData shape.') as Error & SafeSapCapError

  err.category = 'responseShape'
  return err
}

function isPlainObject(value: unknown): value is IDataObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
