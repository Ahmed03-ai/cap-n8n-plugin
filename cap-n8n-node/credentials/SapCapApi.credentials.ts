import {
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
      description: 'CAP OData $metadata endpoint used for Test Connection and entity discovery.',
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
      ],
      default: 'basicAuth',
      required: true,
      description: 'Authentication method for CAP OData requests.',
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      required: true,
      description: 'CAP username for Basic Auth.',
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
      required: true,
      description: 'CAP password for Basic Auth.',
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
      required: true,
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
      required: true,
      description: 'OAuth2 client ID.',
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
      required: true,
      description: 'OAuth2 client secret.',
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

}
