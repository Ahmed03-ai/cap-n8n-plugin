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
      try {
        return JSON.parse(String(response.body ?? ''))
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
