import {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow'

export class SapCapApi implements ICredentialType {
  name = 'sapCapApi'

  displayName = 'SAP CAP API'

  documentationUrl = 'sapCap'

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
}
