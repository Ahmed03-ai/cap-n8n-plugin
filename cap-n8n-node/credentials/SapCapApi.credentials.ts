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
      placeholder: 'http://localhost:3000',
      description: 'Root URL of the CAP OData service, without a trailing slash.',
    },
  ]

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/$metadata',
      method: 'GET',
    },
  }
}
