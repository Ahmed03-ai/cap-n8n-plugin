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
  keyPredicate: unknown
}

type SapCapApiRequestInput = {
  method?: IHttpRequestMethods
  path: string
  body?: IDataObject
  responseFormat?: 'json' | 'text'
  errorContext?: 'metadata' | 'odata' | 'read'
}

type FullHttpResponse = {
  statusCode: number
  body?: unknown
  headers?: IDataObject
}

const metadataPathDefault = '/odata/v4/admin/$metadata'

export function normalizeBaseUrl(value: unknown) {
  const raw = requireString(value, 'Base URL must be a valid http or https URL.')

  try {
    const parsed = new URL(raw)

    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error('invalid-url')
    }

    return raw.replace(/\/+$/, '')
  } catch (err) {
    throw createSapCapRequestError('Base URL must be a valid http or https URL.', {
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

  return keyPredicate.startsWith('(') && keyPredicate.endsWith(')')
    ? keyPredicate
    : `(${keyPredicate})`
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
  const keyPredicate = normalizeKeyPredicate(input.keyPredicate)

  return {
    method: 'GET' as IHttpRequestMethods,
    path: `${servicePath}/${entitySetName}${keyPredicate}`,
  }
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

  if (input.body) {
    headers['Content-Type'] = 'application/json'
  }

  applyAuthentication(headers, credentials)

  try {
    const response = await context.helpers.httpRequest({
      method: input.method ?? 'GET',
      url,
      headers,
      body: input.body,
      encoding: responseFormat === 'text' ? 'text' : 'json',
      json: responseFormat === 'json',
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
    }) as FullHttpResponse

    if (response.statusCode >= 400) {
      throw createHttpStatusError(response.statusCode, input.errorContext ?? 'odata')
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

  if (/[/?#]/.test(entitySetName)) {
    throw createSapCapRequestError('Enter a CAP entity set name, for example Books.', {
      category: 'validation',
    })
  }

  return entitySetName
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

  const numberValue = Number(value)

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw createSapCapRequestError(message, {
      category: 'validation',
    })
  }

  params.set(key, String(numberValue))
}

function applyAuthentication(headers: IDataObject, credentials: ICredentialDataDecryptedObject) {
  const authType = credentials.authType as string

  if (authType === 'basicAuth') {
    const token = Buffer.from(
      `${credentials.username || ''}:${credentials.password || ''}`
    ).toString('base64')
    headers.Authorization = `Basic ${token}`
    return
  }

  if (authType === 'oauth2') {
    throw createSapCapRequestError(
      'OAuth2 Client Credentials is not fully configured for this CAP service. Check the OAuth2 credential fields or use Basic Auth.',
      { category: 'configuration' }
    )
  }
}

function createHttpStatusError(statusCode: number, context: 'metadata' | 'odata' | 'read') {
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

function messageForStatus(statusCode: number, category: string, context: 'metadata' | 'odata' | 'read') {
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

  if (category === 'authentication') return 'CAP authentication failed. Check the SAP CAP API credential.'
  if (category === 'authorization') return 'CAP authorization failed. This credential cannot access the CAP service.'
  if (category === 'server') return 'CAP service returned a server error. Try again or check the CAP service logs.'

  return 'CAP rejected the OData request. Check the OData options.'
}

function networkMessage(context: 'metadata' | 'odata' | 'read') {
  if (context === 'metadata') {
    return 'Could not reach CAP metadata endpoint. Check Base URL and network access from n8n.'
  }

  return 'Could not reach CAP service. Check Base URL and network access from n8n.'
}

function isSapCapRequestError(err: unknown): err is Error & { category: string } {
  return err instanceof Error && typeof (err as Error & { category?: unknown }).category === 'string'
}
