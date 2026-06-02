import {
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow'

export class SapCapApi implements ICredentialType {
  name = 'sapCapApi'

  displayName = 'SAP CAP API'

  icon = 'file:sapCap.svg' as const

  documentationUrl = 'https://github.com/Ahmed03-ai/cap-n8n-plugin#credentials'

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'http://host.docker.internal:3000',
      description: 'Root URL of the CAP application, without a trailing slash.',
    },
    {
      displayName: 'Metadata Path',
      name: 'metadataPath',
      type: 'string',
      default: '/odata/v4/admin/$metadata',
      required: true,
      placeholder: '/odata/v4/admin/$metadata',
      description: 'CAP OData metadata endpoint used by the credential test.',
    },
    {
      displayName: 'Authentication',
      name: 'authType',
      type: 'options',
      options: [
        {
          name: 'Basic Auth',
          value: 'basicAuth',
        },
        {
          name: 'OAuth2 Client Credentials',
          value: 'oauth2',
        },
        {
          name: 'None',
          value: 'none',
        },
      ],
      default: 'basicAuth',
      required: true,
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          authType: ['basicAuth'],
        },
      },
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      displayOptions: {
        show: {
          authType: ['basicAuth'],
        },
      },
    },
    {
      displayName: 'Token URL',
      name: 'tokenUrl',
      type: 'string',
      default: '',
      placeholder: 'https://your-tenant.authentication.eu10.hana.ondemand.com/oauth/token',
      description: 'OAuth2 token endpoint for the client credentials grant.',
      displayOptions: {
        show: {
          authType: ['oauth2'],
        },
      },
    },
    {
      displayName: 'Client ID',
      name: 'clientId',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          authType: ['oauth2'],
        },
      },
    },
    {
      displayName: 'Client Secret',
      name: 'clientSecret',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      displayOptions: {
        show: {
          authType: ['oauth2'],
        },
      },
    },
    {
      displayName: 'Scope',
      name: 'scope',
      type: 'string',
      default: '',
      placeholder: 'openid',
      description: 'Optional space-separated OAuth2 scopes.',
      displayOptions: {
        show: {
          authType: ['oauth2'],
        },
      },
    },
  ]

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '={{$credentials.metadataPath}}',
      method: 'GET',
    },
  }
}
