import {
  IDataObject,
  INode,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow'

type ODataOperation = 'query' | 'read' | 'create' | 'update' | 'delete' | 'actionFunction'

export type SapCapErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'configuration'
  | 'network'
  | 'notFound'
  | 'responseShape'
  | 'server'
  | 'validation'

export type SapCapErrorContext = {
  operation?: 'metadata' | ODataOperation | string
  statusCode?: number
  category?: SapCapErrorCategory
}

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
    if (key.startsWith('@odata.') || key.includes('@odata.')) continue

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

  if (operation === 'delete') {
    return [toDeleteConfirmationItem(response, itemIndex)]
  }

  if (operation === 'actionFunction') {
    return [toActionFunctionItem(response, itemIndex)]
  }

  return [toEntityItem(response, itemIndex)]
}

function toEntityItem(response: unknown, itemIndex: number): INodeExecutionData {
  if (!isPlainObject(response)) {
    throw createResponseShapeError()
  }

  const cleaned = stripODataMetadata(response)

  if (!isPlainObject(cleaned) || Object.keys(cleaned).length === 0) {
    throw createResponseShapeError()
  }

  return {
    json: cleaned as IDataObject,
    pairedItem: {
      item: itemIndex,
    },
  }
}

function toActionFunctionItem(response: unknown, itemIndex: number): INodeExecutionData {
  const cleaned = stripODataMetadata(response)

  if (isPlainObject(cleaned)) {
    if (Object.keys(cleaned).length === 0) {
      throw createResponseShapeError()
    }

    return {
      json: cleaned as IDataObject,
      pairedItem: {
        item: itemIndex,
      },
    }
  }

  return {
    json: {
      value: cleaned as IDataObject[keyof IDataObject],
    },
    pairedItem: {
      item: itemIndex,
    },
  }
}

export function classifySapCapError(
  err: unknown,
  context: SapCapErrorContext = {}
): SafeSapCapError {
  const statusCode = extractStatusCode(err, context)
  const category = resolveCategory(err, context, statusCode)
  const safeError: SafeSapCapError = {
    message: messageForCategory(category, context.operation, statusCode),
    category,
  }

  if (statusCode !== undefined) {
    safeError.statusCode = statusCode
  }

  return safeError
}

export function toContinueOnFailItem(
  safeError: SafeSapCapError,
  itemIndex: number
): INodeExecutionData {
  const json: IDataObject = {
    error: safeError.message,
    category: safeError.category,
  }

  if (safeError.statusCode !== undefined) {
    json.statusCode = safeError.statusCode
  }

  return {
    json,
    pairedItem: {
      item: itemIndex,
    },
  }
}

export function toNodeOperationError(
  node: INode,
  safeError: SafeSapCapError,
  itemIndex: number
): NodeOperationError {
  const err = new Error(safeError.message) as Error & { description?: string }

  if (safeError.description) {
    err.description = safeError.description
  }

  return new NodeOperationError(node, err, {
    message: safeError.message,
    description: safeError.description,
    itemIndex,
  })
}

function toItem(value: IDataObject, itemIndex: number): INodeExecutionData {
  return {
    json: stripODataMetadata(value) as IDataObject,
    pairedItem: {
      item: itemIndex,
    },
  }
}

function toDeleteConfirmationItem(response: unknown, itemIndex: number): INodeExecutionData {
  if (!isPlainObject(response) ||
    response.deleted !== true ||
    typeof response.entitySet !== 'string' ||
    !response.entitySet.trim() ||
    typeof response.key !== 'string' ||
    !response.key.trim()
  ) {
    throw createResponseShapeError()
  }

  return {
    json: {
      deleted: true,
      entitySet: response.entitySet,
      key: response.key,
    },
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

function extractStatusCode(err: unknown, context: SapCapErrorContext) {
  if (isStatusCode(context.statusCode)) return context.statusCode
  if (!isPlainObject(err)) return undefined

  if (isStatusCode(err.statusCode)) return err.statusCode as number
  if (isStatusCode(err.status)) return err.status as number
  if (isStatusCode(err.httpCode)) return err.httpCode as number

  const response = err.response
  if (isPlainObject(response)) {
    if (isStatusCode(response.statusCode)) return response.statusCode as number
    if (isStatusCode(response.status)) return response.status as number
  }

  return undefined
}

function resolveCategory(
  err: unknown,
  context: SapCapErrorContext,
  statusCode?: number
): SapCapErrorCategory {
  if (context.category) return context.category

  if (isPlainObject(err) && isSapCapErrorCategory(err.category)) {
    return err.category
  }

  if (statusCode === 401) return 'authentication'
  if (statusCode === 403) return 'authorization'
  if (statusCode === 404) return 'notFound'
  if (statusCode === 400) return 'validation'
  if (statusCode !== undefined && statusCode >= 500) return 'server'
  if (statusCode !== undefined) return 'validation'

  return 'network'
}

function messageForCategory(
  category: SapCapErrorCategory,
  operation?: string,
  statusCode?: number
) {
  if (category === 'authentication') {
    return 'CAP authentication failed. Check the SAP CAP API credential.'
  }

  if (category === 'authorization') {
    return 'CAP authorization failed. This credential cannot access the CAP service.'
  }

  if (category === 'configuration') {
    return 'SAP CAP authentication must use Basic Auth or OAuth2 Client Credentials.'
  }

  if (category === 'network') {
    return operation === 'metadata'
      ? 'Could not reach CAP metadata endpoint. Check Base URL and network access from n8n.'
      : 'Could not reach CAP service. Check Base URL and network access from n8n.'
  }

  if (category === 'notFound') {
    if (operation === 'metadata') {
      return 'CAP metadata endpoint was not found. Check Base URL and Metadata Path.'
    }

    if (operation === 'read') {
      return 'CAP entity was not found for the selected entity set and key predicate.'
    }

    if (operation === 'delete') {
      return 'CAP entity was not found for Delete. Check the selected entity set and key.'
    }

    if (operation === 'actionFunction') {
      return 'CAP action/function endpoint was not found. Check the selected operation, service path, and key.'
    }

    return 'CAP OData endpoint was not found. Check the service path and entity set.'
  }

  if (category === 'responseShape') {
    return 'CAP response did not match the expected OData shape.'
  }

  if (category === 'server' || (statusCode !== undefined && statusCode >= 500)) {
    return 'CAP service returned a server error. Try again or check the CAP service logs.'
  }

  return 'CAP rejected the OData request. Check the OData options.'
}

function isSapCapErrorCategory(value: unknown): value is SapCapErrorCategory {
  return value === 'authentication' ||
    value === 'authorization' ||
    value === 'configuration' ||
    value === 'network' ||
    value === 'notFound' ||
    value === 'responseShape' ||
    value === 'server' ||
    value === 'validation'
}

function isStatusCode(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}
