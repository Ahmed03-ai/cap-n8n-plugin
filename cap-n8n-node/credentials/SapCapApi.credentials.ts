import type { ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class SapCapApi implements ICredentialType {
  name = 'sapCapApi';
  displayName = 'SAP CAP API';
  documentationUrl = 'https://cap.cloud.sap/docs/';

  // Calls <baseUrl><testPath>. Should be used by the "Test" button in the n8n credential UI.
  // For OAuth2 this will fail (no token), so the button primarily validates Basic Auth / None.
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '={{$credentials.testPath || "/"}}',
    },
  };

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://localhost:3000',
      placeholder: 'https://your-app.cfapps.eu10.hana.ondemand.com',
      description: 'Root URL of the CAP application (no trailing slash)',
    },
    {
      displayName: 'Test Path',
      name: 'testPath',
      type: 'string',
      default: '/odata/v4/catalog/$metadata',
      placeholder: '/odata/v4/catalog/$metadata',
      description: 'Endpoint called by the Test button to verify connectivity',
    },
    {
      displayName: 'Authentication',
      name: 'authType',
      type: 'options',
      options: [
        { name: 'Basic Auth', value: 'basicAuth' },
        { name: 'OAuth2 Client Credentials', value: 'oauth2' },
        { name: 'None', value: 'none' },
      ],
      default: 'basicAuth',
    },

    // Basic Auth 
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      displayOptions: { show: { authType: ['basicAuth'] } },
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      displayOptions: { show: { authType: ['basicAuth'] } },
    },

    // OAuth2 Client Credentials 
    {
      displayName: 'Token URL',
      name: 'tokenUrl',
      type: 'string',
      default: '',
      placeholder: 'https://your-tenant.authentication.eu10.hana.ondemand.com/oauth/token',
      description: 'OAuth2 token endpoint (client_credentials grant)',
      displayOptions: { show: { authType: ['oauth2'] } },
    },
    {
      displayName: 'Client ID',
      name: 'clientId',
      type: 'string',
      default: '',
      displayOptions: { show: { authType: ['oauth2'] } },
    },
    {
      displayName: 'Client Secret',
      name: 'clientSecret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      displayOptions: { show: { authType: ['oauth2'] } },
    },
    {
      displayName: 'Scope',
      name: 'scope',
      type: 'string',
      default: '',
      placeholder: 'openid',
      description: 'Space-separated OAuth2 scopes (optional)',
      displayOptions: { show: { authType: ['oauth2'] } },
    },
  ];
}
