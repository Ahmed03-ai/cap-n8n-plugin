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

  const cleaned = Object.create(null) as IDataObject

  for (const [key, childValue] of Object.entries(value)) {
    if (isUnsafeObjectKey(key) || key.startsWith('@odata.') || key.includes('@odata.')) continue

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
  if (response === undefined) {
    return {
      json: {
        success: true,
      },
      pairedItem: {
        item: itemIndex,
      },
    }
  }

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
  const detail = extractCapErrorDetail(err)
  const resourcePath = extractResourcePath(err)
  const safeError: SafeSapCapError = {
    // A single, human-friendly sentence per failure so the developer understands it inside
    // the workflow. It names the HTTP status and the resource, interprets common cases into
    // plain language, and surfaces CAP's own reason (already reduced to error.message
    // upstream, so no credentials can leak) for the rest.
    message: buildErrorMessage(category, context.operation, statusCode, detail, resourcePath),
    category,
  }

  if (statusCode !== undefined) {
    safeError.statusCode = statusCode
  }

  return safeError
}

function extractCapErrorDetail(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'detail' in err) {
    const detail = (err as { detail?: unknown }).detail

    if (typeof detail === 'string' && detail.trim()) return detail.trim()
  }

  return undefined
}

function extractResourcePath(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'resourcePath' in err) {
    const path = (err as { resourcePath?: unknown }).resourcePath

    if (typeof path === 'string' && path.trim()) return path.trim()
  }

  return undefined
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

function isUnsafeObjectKey(key: string) {
  return key === '__proto__' || key === 'constructor' || key === 'prototype'
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

function buildErrorMessage(
  category: SapCapErrorCategory,
  operation?: string,
  statusCode?: number,
  detail?: string,
  resourcePath?: string
) {
  // A bare "not found" reason adds nothing over our own text, so treat it as absent.
  // Trailing periods are trimmed so appended punctuation never doubles up ("reason.. Check").
  const rawReason = detail && !/^not[\s_-]?found\.?$/i.test(detail.trim()) ? detail.trim() : undefined
  const reason = rawReason ? rawReason.replace(/\.+$/, '') : undefined
  const capDetail = reason ? ` — ${reason}` : ''
  const where = resourcePath ? ` on ${resourcePath}` : ''
  const opName = operation && operation !== 'metadata' ? operation : 'this request'

  // 1. Interpret a few unambiguous CAP/database conflicts into plain language. Anything
  //    else falls through and surfaces CAP's own message, so a greedy match can't mislabel
  //    an unrelated error (a draft conflict is NOT a duplicate key).
  if (reason && /draft.*already exists|draft_already_exists/i.test(reason)) {
    return 'Conflict (HTTP 409). A draft for this entity already exists — activate or discard the existing draft before editing it again.'
  }

  if (reason && /unique constraint|duplicate (key|entry)/i.test(reason)) {
    return 'Conflict. An entity with this key already exists — use a different key value.'
  }

  // 2. Connectivity / configuration / shape — CAP's own body is unhelpful here.
  if (category === 'configuration') {
    return 'SAP CAP authentication must use Basic Auth or OAuth2 Client Credentials.'
  }

  if (category === 'network') {
    return operation === 'metadata'
      ? 'Could not reach the CAP metadata endpoint. Check the Base URL and network access from n8n.'
      : 'Could not reach the CAP service. Check the Base URL and network access from n8n.'
  }

  if (category === 'responseShape') {
    return 'CAP response did not match the expected OData shape.'
  }

  // 3. Per HTTP status — includes the code and the resource for quick diagnosis.
  switch (statusCode) {
    case 400:
      return `Bad request (HTTP 400) for ${opName}${where}${capDetail}. Check your input parameters.`
    case 401:
      return 'Authentication failed (HTTP 401). Check the username and password in the SAP CAP credential.'
    case 403:
      return `Access denied (HTTP 403). This credential does not have permission for this operation.${capDetail}`
    case 404:
      if (operation === 'metadata') {
        return 'Not found (HTTP 404). The CAP metadata endpoint was not found. Check the Base URL and Metadata Path.'
      }

      if (reason) return `Not found (HTTP 404) — ${reason}.`

      if (operation === 'actionFunction') {
        return `Not found (HTTP 404). No action/function matches${where}. Check the operation, service path, and key.`
      }

      return `Not found (HTTP 404). No CAP entity matches${where || ' the selected entity set and key'}.`
    case 405: {
      const action = operation === 'create' ? 'Create'
        : operation === 'update' ? 'Update'
          : operation === 'delete' ? 'Delete'
            : 'This operation'

      return `Operation not allowed (HTTP 405). ${action} is not supported on this entity set — it may be read-only.`
    }
    case 409:
      return `Conflict (HTTP 409). The operation conflicts with existing data${where}${capDetail}.`
    case 503:
      return 'CAP service unavailable (HTTP 503). The service may be starting up or overloaded. Try again shortly.'
  }

  // 4. Categories without a numeric status (e.g. classified from a raw error).
  if (category === 'authentication') {
    return 'Authentication failed. Check the SAP CAP API credential.'
  }

  if (category === 'authorization') {
    return 'Access denied. This credential cannot access the CAP service.'
  }

  // 5. Any other server error — surface CAP's own reason when present.
  if (category === 'server' || (statusCode !== undefined && statusCode >= 500)) {
    return `CAP service error (HTTP ${statusCode ?? 500})${capDetail}. Check the CAP service logs.`
  }

  // 6. Any other rejected request.
  return reason
    ? `CAP rejected the request${where} — ${reason}.`
    : 'CAP rejected the OData request. Check the OData options.'
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
