import {
  ICredentialDataDecryptedObject,
  IDataObject,
  IHttpRequestMethods,
  IHttpRequestOptions,
} from 'n8n-workflow'

type SapCapRequestContext = {
  getCredentials(type: string): Promise<ICredentialDataDecryptedObject>
  helpers: {
    httpRequest(options: IHttpRequestOptions): Promise<unknown>
  }
}

type EntitySetSelection = {
  entitySetSource?: string
  entitySet?: string
  entitySetManual?: string
}

type QueryRequestInput = {
  servicePath: unknown
  entitySetName: unknown
  filter?: unknown
  orderBy?: unknown
  select?: unknown
  top?: unknown
  skip?: unknown
}

type ReadRequestInput = {
  servicePath: unknown
  entitySetName: unknown
  keyPredicate?: unknown
  keyDescriptors?: MetadataKeyDescriptor[]
  keyParts?: KeyPartsInput
}

type MutationRequestInput = ReadRequestInput & {
  body: unknown
}

type DeleteRequestInput = ReadRequestInput

type ActionFunctionDescriptorInput = {
  kind?: unknown
  name?: unknown
  qualifiedName?: unknown
  importName?: unknown
  isBound?: unknown
  bindingType?: unknown
  entitySet?: unknown
  parameters?: unknown
}

type ActionFunctionRequestInput = {
  servicePath: unknown
  entitySetName?: unknown
  keyPredicate?: unknown
  keyDescriptors?: MetadataKeyDescriptor[]
  keyParts?: KeyPartsInput
  operationSource?: unknown
  operationDescriptor?: unknown
  operationKind?: unknown
  operationName?: unknown
  operationBinding?: unknown
  parameters: unknown
}

type ResolvedActionFunctionDescriptor = {
  kind: 'action' | 'function'
  name: string
  qualifiedName?: string
  importName?: string
  isBound: boolean
  entitySet?: string
  parameters: Array<{ name: string, type?: string }>
}

type MetadataKeyDescriptor = {
  name: unknown
  type?: unknown
}

type KeyPartEntry = {
  name?: unknown
  value?: unknown
}

type KeyPartsInput = Record<string, unknown> | KeyPartEntry[]

type SapCapApiRequestInput = {
  method?: IHttpRequestMethods
  path: string
  body?: IDataObject
  headers?: IDataObject
  responseFormat?: 'json' | 'text'
  errorContext?: 'metadata' | 'odata' | 'read' | 'delete' | 'actionFunction'
}

type FullHttpResponse = {
  statusCode: number
  body?: unknown
  headers?: IDataObject
}

type OAuth2TokenResponse = {
  access_token?: unknown
}

const metadataPathDefault = '/odata/v4/admin/$metadata'

export function normalizeBaseUrl(value: unknown) {
  return normalizeHttpUrl(value, 'Base URL must be a valid http or https URL.')
}

export function normalizeTokenUrl(value: unknown) {
  return normalizeHttpUrl(value, 'Token URL must be a valid http or https URL.')
}

function normalizeHttpUrl(value: unknown, message: string) {
  const raw = requireString(value, message)

  try {
    const parsed = new URL(raw)

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('invalid-url')
    }

    const normalizedPath = parsed.pathname.replace(/\/+$/, '')
    return `${parsed.origin}${normalizedPath === '/' ? '' : normalizedPath}`
  } catch (err) {
    throw createSapCapRequestError(message, {
      category: 'validation',
    })
  }
}

export function normalizeMetadataPath(value: unknown = metadataPathDefault) {
  const path = requireString(value, 'Metadata Path must start with /.')

  if (!path.startsWith('/') || path.includes('?') || path.includes('#')) {
    throw createSapCapRequestError('Metadata Path must start with /.', {
      category: 'validation',
    })
  }

  return path
}

export function normalizeServicePath(value: unknown) {
  const path = requireString(value, 'Service Path must start with / and must not include query strings.')

  if (!path.startsWith('/') || path.includes('?') || path.includes('#')) {
    throw createSapCapRequestError('Service Path must start with / and must not include query strings.', {
      category: 'validation',
    })
  }

  return path.replace(/\/+$/, '') || '/'
}

export function resolveEntitySetName(selection: EntitySetSelection) {
  const rawName = selection.entitySetSource === 'manual'
    ? selection.entitySetManual
    : selection.entitySet

  return normalizeEntitySetName(rawName)
}

export function normalizeKeyPredicate(value: unknown) {
  const keyPredicate = requireString(value, 'Key Predicate is required for Read.')

  if (containsUrlBoundary(keyPredicate)) {
    throw createSapCapRequestError('Key Predicate must not include /, \\, ?, or #.', {
      category: 'validation',
    })
  }

  return keyPredicate.startsWith('(') && keyPredicate.endsWith(')')
    ? keyPredicate
    : `(${keyPredicate})`
}

export function formatODataKeyLiteral(value: unknown, type: unknown) {
  const rawValue = normalizeScalarKeyValue(value)
  const typeName = typeof type === 'string' ? type.trim().toLowerCase() : ''

  if (containsUrlBoundary(rawValue)) {
    throw createSapCapRequestError('Key values must not include /, \\, ?, or #.', {
      category: 'validation',
    })
  }

  if (isBooleanEdmType(typeName)) {
    return formatBooleanLiteral(rawValue)
  }

  if (isNumericEdmType(typeName)) {
    return formatNumericLiteral(rawValue, typeName)
  }

  return `'${rawValue.replace(/'/g, '\'\'')}'`
}

export function buildKeyPredicateFromParts(input: {
  keyDescriptors: MetadataKeyDescriptor[]
  keyParts: KeyPartsInput
}) {
  const descriptors = normalizeKeyDescriptors(input.keyDescriptors)
  const keyValues = normalizeKeyPartValues(input.keyParts)

  const parts = descriptors.map((descriptor) => {
    if (!keyValues.has(descriptor.name) || isMissingKeyValue(keyValues.get(descriptor.name))) {
      throw createSapCapRequestError('Every metadata-derived key part is required.', {
        category: 'validation',
      })
    }

    return `${descriptor.name}=${formatODataKeyLiteral(keyValues.get(descriptor.name), descriptor.type)}`
  })

  return `(${parts.join(',')})`
}

export function resolveKeyPredicate(input: {
  keyPredicate?: unknown
  keyDescriptors?: MetadataKeyDescriptor[]
  keyParts?: KeyPartsInput
}) {
  if (Array.isArray(input.keyDescriptors) && input.keyDescriptors.length > 0) {
    return buildKeyPredicateFromParts({
      keyDescriptors: input.keyDescriptors,
      keyParts: input.keyParts ?? {},
    })
  }

  return normalizeKeyPredicate(input.keyPredicate)
}

export function buildQueryRequest(input: QueryRequestInput) {
  const servicePath = normalizeServicePath(input.servicePath)
  const entitySetName = normalizeEntitySetName(input.entitySetName)
  const params = new URLSearchParams()

  setTextQueryParam(params, '$filter', input.filter)
  setTextQueryParam(params, '$orderby', input.orderBy)
  setTextQueryParam(params, '$select', input.select)
  setIntegerQueryParam(params, '$top', input.top, 'Top must be a nonnegative integer.')
  setIntegerQueryParam(params, '$skip', input.skip, 'Skip must be a nonnegative integer.')

  const query = params.toString().replace(/\+/g, '%20')

  return {
    method: 'GET' as IHttpRequestMethods,
    path: `${servicePath}/${entitySetName}${query ? `?${query}` : ''}`,
  }
}

export function buildReadRequest(input: ReadRequestInput) {
  const servicePath = normalizeServicePath(input.servicePath)
  const entitySetName = normalizeEntitySetName(input.entitySetName)
  const keyPredicate = resolveKeyPredicate(input)

  return {
    method: 'GET' as IHttpRequestMethods,
    path: `${servicePath}/${entitySetName}${keyPredicate}`,
  }
}

export function buildCreateRequest(input: MutationRequestInput) {
  const servicePath = normalizeServicePath(input.servicePath)
  const entitySetName = normalizeEntitySetName(input.entitySetName)

  return {
    method: 'POST' as IHttpRequestMethods,
    path: `${servicePath}/${entitySetName}`,
    body: parseJsonObjectParameter(input.body, 'Body'),
    headers: {
      Prefer: 'return=representation',
    },
  }
}

export function buildUpdateRequest(input: MutationRequestInput) {
  const servicePath = normalizeServicePath(input.servicePath)
  const entitySetName = normalizeEntitySetName(input.entitySetName)
  const keyPredicate = resolveKeyPredicate(input)

  return {
    method: 'PATCH' as IHttpRequestMethods,
    path: `${servicePath}/${entitySetName}${keyPredicate}`,
    body: parseJsonObjectParameter(input.body, 'Body'),
    headers: {
      Prefer: 'return=representation',
    },
  }
}

export function buildDeleteRequest(input: DeleteRequestInput) {
  const servicePath = normalizeServicePath(input.servicePath)
  const entitySetName = normalizeEntitySetName(input.entitySetName)
  const keyPredicate = resolveKeyPredicate(input)

  return {
    method: 'DELETE' as IHttpRequestMethods,
    path: `${servicePath}/${entitySetName}${keyPredicate}`,
  }
}

export function buildActionFunctionRequest(input: ActionFunctionRequestInput) {
  const servicePath = normalizeServicePath(input.servicePath)
  const descriptor = resolveActionFunctionDescriptor(input)
  const parameters = parseJsonObjectParameter(input.parameters, 'Parameters')
  const operationSegment = normalizeActionFunctionPathSegment(
    descriptor.isBound
      ? descriptor.qualifiedName ?? descriptor.name
      : descriptor.importName ?? descriptor.name
  )
  const operationPath = descriptor.isBound
    ? buildBoundActionFunctionPath(servicePath, input, descriptor, operationSegment)
    : `${servicePath}/${operationSegment}`

  if (descriptor.kind === 'action') {
    return {
      method: 'POST' as IHttpRequestMethods,
      path: operationPath,
      body: parameters,
      headers: {
        Prefer: 'return=representation',
      },
    }
  }

  const parameterList = buildFunctionParameterList(parameters, descriptor.parameters)

  return {
    method: 'GET' as IHttpRequestMethods,
    path: `${operationPath}(${parameterList})`,
  }
}

export function parseJsonObjectParameter(value: unknown, fieldName: string) {
  if (typeof value === 'string' && !value.trim()) {
    throwJsonObjectParameterError(fieldName)
  }

  let parsed = value

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch (err) {
      throwJsonObjectParameterError(fieldName)
    }
  }

  if (!isPlainObject(parsed)) {
    throwJsonObjectParameterError(fieldName)
  }

  return parsed as IDataObject
}

export function isActionFunctionRequestBound(input: ActionFunctionRequestInput) {
  return resolveActionFunctionDescriptor(input).isBound
}

export function resolveActionFunctionEntitySet(input: ActionFunctionRequestInput) {
  return resolveActionFunctionDescriptor(input).entitySet
}

function resolveActionFunctionDescriptor(input: ActionFunctionRequestInput): ResolvedActionFunctionDescriptor {
  const operationSource = typeof input.operationSource === 'string' ? input.operationSource : 'metadata'

  if (operationSource === 'metadata') {
    return normalizeActionFunctionDescriptor(parseActionFunctionDescriptor(input.operationDescriptor))
  }

  if (operationSource === 'manual') {
    const kind = normalizeActionFunctionKind(input.operationKind)
    const name = normalizeActionFunctionPathSegment(input.operationName)
    const binding = typeof input.operationBinding === 'string' ? input.operationBinding : 'unbound'

    if (binding !== 'unbound' && binding !== 'bound') {
      throw createSapCapRequestError('Action/Function binding must be Bound or Unbound.', {
        category: 'validation',
      })
    }

    return {
      kind,
      name,
      qualifiedName: name,
      isBound: binding === 'bound',
      parameters: [],
    }
  }

  throw createSapCapRequestError('Action/Function source must use Metadata or Manual.', {
    category: 'validation',
  })
}

function parseActionFunctionDescriptor(value: unknown): ActionFunctionDescriptorInput {
  if (isPlainObject(value)) return value as ActionFunctionDescriptorInput

  if (typeof value !== 'string' || !value.trim()) {
    throw createSapCapRequestError('Select an Action/Function operation or use manual operation fields.', {
      category: 'validation',
    })
  }

  try {
    const parsed = JSON.parse(value)

    if (isPlainObject(parsed)) return parsed as ActionFunctionDescriptorInput
  } catch (err) {
    // Fall through to the sanitized validation error below.
  }

  throw createSapCapRequestError('Select an Action/Function operation or use manual operation fields.', {
    category: 'validation',
  })
}

function normalizeActionFunctionDescriptor(
  descriptor: ActionFunctionDescriptorInput
): ResolvedActionFunctionDescriptor {
  const kind = normalizeActionFunctionKind(descriptor.kind)
  const name = normalizeActionFunctionPathSegment(descriptor.name)
  const qualifiedName = descriptor.qualifiedName === undefined
    ? undefined
    : normalizeActionFunctionPathSegment(descriptor.qualifiedName)
  const importName = descriptor.importName === undefined
    ? undefined
    : normalizeActionFunctionPathSegment(descriptor.importName)
  const entitySet = descriptor.entitySet === undefined
    ? undefined
    : normalizeEntitySetName(descriptor.entitySet)

  return {
    kind,
    name,
    ...(qualifiedName ? { qualifiedName } : {}),
    ...(importName ? { importName } : {}),
    ...(entitySet ? { entitySet } : {}),
    isBound: descriptor.isBound === true,
    parameters: normalizeActionFunctionParameters(descriptor.parameters),
  }
}

function normalizeActionFunctionKind(value: unknown) {
  if (value === 'action' || value === 'function') return value

  throw createSapCapRequestError('Action/Function kind must be Action or Function.', {
    category: 'validation',
  })
}

function normalizeActionFunctionPathSegment(value: unknown) {
  const segment = requireString(value, 'Action/Function name is required.')

  if (!/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(segment)) {
    throw createSapCapRequestError('Action/Function name is required.', {
      category: 'validation',
    })
  }

  return segment
}

function buildBoundActionFunctionPath(
  servicePath: string,
  input: ActionFunctionRequestInput,
  descriptor: ResolvedActionFunctionDescriptor,
  operationSegment: string
) {
  const entitySetName = descriptor.entitySet ?? normalizeEntitySetName(input.entitySetName)
  const keyPredicate = resolveKeyPredicate(input)

  return `${servicePath}/${entitySetName}${keyPredicate}/${operationSegment}`
}

function buildFunctionParameterList(
  parameters: IDataObject,
  parameterDescriptors: Array<{ name: string, type?: string }>
) {
  const parameterTypes = new Map(parameterDescriptors.map((parameter) => [parameter.name, parameter.type]))
  const parts: string[] = []

  for (const [name, value] of Object.entries(parameters)) {
    const parameterName = normalizeFunctionParameterName(name)

    if (!isPrimitiveFunctionParameterValue(value)) {
      throw createSapCapRequestError('Function parameter values must be primitive JSON values.', {
        category: 'validation',
      })
    }

    parts.push(`${parameterName}=${formatODataFunctionLiteral(value, parameterTypes.get(parameterName))}`)
  }

  return parts.join(',')
}

function normalizeActionFunctionParameters(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter(isPlainObject)
    .map((parameter) => ({
      name: normalizeFunctionParameterName(parameter.name),
      ...(typeof parameter.type === 'string' && parameter.type.trim()
        ? { type: parameter.type.trim() }
        : {}),
    }))
}

function normalizeFunctionParameterName(value: unknown) {
  const name = requireString(value, 'Function parameter names are invalid.')

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw createSapCapRequestError('Function parameter names are invalid.', {
      category: 'validation',
    })
  }

  return name
}

function isPrimitiveFunctionParameterValue(value: unknown) {
  return value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
}

function formatODataFunctionLiteral(value: IDataObject[keyof IDataObject], type: unknown) {
  if (value === null) return 'null'

  const rawValue = String(value).trim()
  const typeName = typeof type === 'string' ? type.trim().toLowerCase() : ''

  if (containsUrlBoundary(rawValue)) {
    throw createSapCapRequestError('Function parameter values must not include /, \\, ?, or #.', {
      category: 'validation',
    })
  }

  if (isBooleanEdmType(typeName) || (!typeName && typeof value === 'boolean')) {
    return formatBooleanLiteral(rawValue)
  }

  if (isNumericEdmType(typeName) || (!typeName && typeof value === 'number')) {
    return formatNumericLiteral(rawValue, typeName || 'edm.double')
  }

  return `'${rawValue.replace(/'/g, '\'\'')}'`
}

export async function sapCapApiRequest(
  context: SapCapRequestContext,
  input: SapCapApiRequestInput
) {
  const credentials = await context.getCredentials('sapCapApi')
  const url = `${normalizeBaseUrl(credentials.baseUrl)}${input.path}`
  const responseFormat = input.responseFormat ?? 'json'
  const headers: IDataObject = {
    Accept: responseFormat === 'text' ? 'application/xml, text/xml, */*' : 'application/json',
  }

  Object.assign(headers, input.headers ?? {})

  if (input.body) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    Object.assign(headers, await buildAuthenticationHeaders(context.helpers.httpRequest, credentials))

    const response = await context.helpers.httpRequest({
      method: input.method ?? 'GET',
      url,
      headers,
      body: input.body,
      encoding: 'text',
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
    }) as FullHttpResponse

    if (response.statusCode >= 400) {
      throw createHttpStatusError(response.statusCode, input.errorContext ?? 'odata')
    }

    if (responseFormat === 'json') {
      const bodyText = String(response.body ?? '')

      if (!bodyText.trim()) return undefined

      try {
        return JSON.parse(bodyText)
      } catch (err) {
        throw createSapCapRequestError('CAP response did not match the expected OData shape.', {
          category: 'responseShape',
        })
      }
    }

    return response.body
  } catch (err) {
    if (isSapCapRequestError(err)) throw err

    throw createSapCapRequestError(networkMessage(input.errorContext ?? 'odata'), {
      category: 'network',
    })
  }
}

export function createSapCapRequestError(
  message: string,
  options: { statusCode?: number, category: string }
) {
  const err = new Error(message) as Error & { statusCode?: number, category: string }

  err.statusCode = options.statusCode
  err.category = options.category

  return err
}

export function buildBasicAuthHeaders(credentials: ICredentialDataDecryptedObject) {
  const authType = credentials.authType as string

  if (authType !== 'basicAuth') {
    throw createSapCapRequestError(
      'SAP CAP authentication must use Basic Auth or OAuth2 Client Credentials.',
      { category: 'configuration' }
    )
  }

  const token = Buffer.from(
    `${credentials.username || ''}:${credentials.password || ''}`
  ).toString('base64')

  return {
    Authorization: `Basic ${token}`,
  }
}

export async function buildAuthenticationHeaders(
  httpRequest: SapCapRequestContext['helpers']['httpRequest'],
  credentials: ICredentialDataDecryptedObject
) {
  const authType = credentials.authType as string

  if (authType === 'basicAuth') {
    return buildBasicAuthHeaders(credentials)
  }

  if (authType === 'oauth2') {
    return {
      Authorization: `Bearer ${await requestOAuth2Token(httpRequest, credentials)}`,
    }
  }

  throw createSapCapRequestError(
    'SAP CAP authentication must use Basic Auth or OAuth2 Client Credentials.',
    { category: 'configuration' }
  )
}

function requireString(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw createSapCapRequestError(message, {
      category: 'validation',
    })
  }

  return value.trim()
}

function normalizeEntitySetName(value: unknown) {
  const entitySetName = requireString(value, 'Enter a CAP entity set name, for example Books.')

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(entitySetName)) {
    throw createSapCapRequestError('Enter a CAP entity set name, for example Books.', {
      category: 'validation',
    })
  }

  return entitySetName
}

function containsUrlBoundary(value: string) {
  return /[/?#\\]/.test(value) || /%(?:2f|3f|23|5c)/i.test(value)
}

function normalizeKeyDescriptors(descriptors: MetadataKeyDescriptor[]) {
  if (!Array.isArray(descriptors) || descriptors.length === 0) {
    throw createSapCapRequestError('Metadata key descriptors are required to build a key predicate.', {
      category: 'validation',
    })
  }

  const normalized: Array<{ name: string, type?: string }> = []
  const seen = new Set<string>()

  for (const descriptor of descriptors) {
    const name = normalizeKeyName(descriptor?.name)

    if (seen.has(name)) {
      throw createSapCapRequestError('Metadata key descriptors must not contain duplicate key names.', {
        category: 'validation',
      })
    }

    seen.add(name)
    normalized.push({
      name,
      type: typeof descriptor.type === 'string' ? descriptor.type : undefined,
    })
  }

  return normalized
}

function normalizeKeyPartValues(keyParts: KeyPartsInput) {
  if (!isPlainObject(keyParts) && !Array.isArray(keyParts)) {
    throw createSapCapRequestError('Metadata key values are required to build a key predicate.', {
      category: 'validation',
    })
  }

  const keyValues = new Map<string, unknown>()

  if (Array.isArray(keyParts)) {
    for (const part of keyParts) {
      if (!isPlainObject(part)) {
        throw createSapCapRequestError('Metadata key values are required to build a key predicate.', {
          category: 'validation',
        })
      }

      const name = normalizeKeyName(part.name)

      if (keyValues.has(name)) {
        throw createSapCapRequestError('Metadata key values must not contain duplicate key names.', {
          category: 'validation',
        })
      }

      keyValues.set(name, part.value)
    }

    return keyValues
  }

  for (const [name, value] of Object.entries(keyParts)) {
    keyValues.set(normalizeKeyName(name), value)
  }

  return keyValues
}

function normalizeKeyName(value: unknown) {
  const keyName = requireString(value, 'Metadata key names are invalid.')

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyName)) {
    throw createSapCapRequestError('Metadata key names are invalid.', {
      category: 'validation',
    })
  }

  return keyName
}

function normalizeScalarKeyValue(value: unknown) {
  if (isMissingKeyValue(value) ||
    typeof value === 'object' ||
    typeof value === 'function' ||
    typeof value === 'symbol'
  ) {
    throw createSapCapRequestError('Every metadata-derived key part is required.', {
      category: 'validation',
    })
  }

  return String(value).trim()
}

function isMissingKeyValue(value: unknown) {
  return value === undefined ||
    value === null ||
    (typeof value === 'string' && !value.trim())
}

function isBooleanEdmType(typeName: string) {
  return typeName === 'edm.boolean'
}

function isNumericEdmType(typeName: string) {
  return [
    'edm.byte',
    'edm.sbyte',
    'edm.int16',
    'edm.int32',
    'edm.int64',
    'edm.decimal',
    'edm.double',
    'edm.single',
  ].includes(typeName)
}

function formatBooleanLiteral(rawValue: string) {
  const normalized = rawValue.toLowerCase()

  if (normalized !== 'true' && normalized !== 'false') {
    throw createSapCapRequestError('Boolean key values must be true or false.', {
      category: 'validation',
    })
  }

  return normalized
}

function formatNumericLiteral(rawValue: string, typeName: string) {
  const integerTypes = new Set(['edm.byte', 'edm.sbyte', 'edm.int16', 'edm.int32', 'edm.int64'])
  const numberPattern = integerTypes.has(typeName)
    ? /^[+-]?\d+$/
    : /^[+-]?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/

  if (!numberPattern.test(rawValue) || !Number.isFinite(Number(rawValue))) {
    throw createSapCapRequestError('Numeric key values must be valid OData numbers.', {
      category: 'validation',
    })
  }

  return rawValue
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
}

function setTextQueryParam(params: URLSearchParams, key: string, value: unknown) {
  if (typeof value !== 'string') return

  const trimmed = value.trim()
  if (trimmed) params.set(key, trimmed)
}

function setIntegerQueryParam(
  params: URLSearchParams,
  key: string,
  value: unknown,
  message: string
) {
  if (value === undefined || value === null || value === '') return

  const rawValue = typeof value === 'string' ? value.trim() : value

  if (
    typeof rawValue !== 'number' &&
    (typeof rawValue !== 'string' || !/^\d+$/.test(rawValue))
  ) {
    throw createSapCapRequestError(message, {
      category: 'validation',
    })
  }

  const numberValue = typeof rawValue === 'number' ? rawValue : Number(rawValue)

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw createSapCapRequestError(message, {
      category: 'validation',
    })
  }

  params.set(key, String(numberValue))
}

function createHttpStatusError(statusCode: number, context: 'metadata' | 'odata' | 'read' | 'delete' | 'actionFunction') {
  const category = categoryForStatus(statusCode)
  const message = messageForStatus(statusCode, category, context)

  return createSapCapRequestError(message, {
    statusCode,
    category,
  })
}

function categoryForStatus(statusCode: number) {
  if (statusCode === 401) return 'authentication'
  if (statusCode === 403) return 'authorization'
  if (statusCode === 404) return 'notFound'
  if (statusCode === 400) return 'validation'
  if (statusCode >= 500) return 'server'
  return 'validation'
}

function messageForStatus(statusCode: number, category: string, context: 'metadata' | 'odata' | 'read' | 'delete' | 'actionFunction') {
  if (context === 'metadata') {
    if (statusCode === 401) return 'Authentication failed for CAP metadata. Check the SAP CAP API credential.'
    if (statusCode === 403) return 'CAP metadata access is forbidden for this credential.'
    if (statusCode === 404) return 'CAP metadata endpoint was not found. Check Base URL and Metadata Path.'
    if (statusCode === 400) return 'CAP metadata request was rejected. Check Metadata Path.'
    return 'CAP service returned an error while loading metadata. Try again or check the CAP service logs.'
  }

  if (context === 'read' && statusCode === 404) {
    return 'CAP entity was not found for the selected entity set and key predicate.'
  }

  if (context === 'delete' && statusCode === 404) {
    return 'CAP entity was not found for Delete. Check the selected entity set and key.'
  }

  if (context === 'actionFunction' && statusCode === 404) {
    return 'CAP action/function endpoint was not found. Check the selected operation, service path, and key.'
  }

  if (category === 'authentication') return 'CAP authentication failed. Check the SAP CAP API credential.'
  if (category === 'authorization') return 'CAP authorization failed. This credential cannot access the CAP service.'
  if (category === 'server') return 'CAP service returned a server error. Try again or check the CAP service logs.'

  return 'CAP rejected the OData request. Check the OData options.'
}

function networkMessage(context: 'metadata' | 'odata' | 'read' | 'delete' | 'actionFunction') {
  if (context === 'metadata') {
    return 'Could not reach CAP metadata endpoint. Check Base URL and network access from n8n.'
  }

  return 'Could not reach CAP service. Check Base URL and network access from n8n.'
}

function isSapCapRequestError(err: unknown): err is Error & { category: string } {
  return err instanceof Error && typeof (err as Error & { category?: unknown }).category === 'string'
}

function throwJsonObjectParameterError(fieldName: string): never {
  throw createSapCapRequestError(`${fieldName} must be a JSON object.`, {
    category: 'validation',
  })
}

async function requestOAuth2Token(
  httpRequest: SapCapRequestContext['helpers']['httpRequest'],
  credentials: ICredentialDataDecryptedObject
) {
  const tokenUrl = normalizeTokenUrl(credentials.tokenUrl)
  const clientId = requireString(credentials.clientId, 'OAuth2 Client ID is required.')
  const clientSecret = requireString(credentials.clientSecret, 'OAuth2 Client Secret is required.')
  const scope = typeof credentials.scope === 'string' ? credentials.scope.trim() : ''
  const body = new URLSearchParams({ grant_type: 'client_credentials' })

  if (scope) body.set('scope', scope)

  try {
    const response = await httpRequest({
      method: 'POST',
      url: tokenUrl,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      encoding: 'text',
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
    }) as FullHttpResponse

    if (response.statusCode >= 400) {
      throw createSapCapRequestError('OAuth2 token request failed. Check the OAuth2 credential fields.', {
        statusCode: response.statusCode,
        category: response.statusCode === 401 || response.statusCode === 403 ? 'authentication' : 'configuration',
      })
    }

    const tokenBody = parseTokenBody(response.body)

    if (typeof tokenBody.access_token !== 'string' || !tokenBody.access_token.trim()) {
      throw createSapCapRequestError('OAuth2 token response did not include an access token.', {
        category: 'responseShape',
      })
    }

    return tokenBody.access_token
  } catch (err) {
    if (isSapCapRequestError(err)) throw err

    throw createSapCapRequestError('Could not reach OAuth2 token endpoint. Check Token URL and network access from n8n.', {
      category: 'network',
    })
  }
}

function parseTokenBody(body: unknown): OAuth2TokenResponse {
  if (typeof body === 'object' && body !== null) return body as OAuth2TokenResponse

  try {
    return JSON.parse(String(body ?? '')) as OAuth2TokenResponse
  } catch (err) {
    throw createSapCapRequestError('OAuth2 token response did not include an access token.', {
      category: 'responseShape',
    })
  }
}
