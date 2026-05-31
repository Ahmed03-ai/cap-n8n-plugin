import {
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
} from 'n8n-workflow'

export class SapCap implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SAP CAP',
    name: 'sapCap',
    icon: 'fa:database',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Connect to SAP CAP OData services',
    defaults: {
      name: 'SAP CAP',
    },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    credentials: [
      {
        name: 'sapCapApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Validate Configuration',
            value: 'validateConfiguration',
            description: 'Loads the SAP CAP node and credential metadata without running CAP OData operations',
            action: 'Validate SAP CAP configuration',
          },
        ],
        default: 'validateConfiguration',
        description: 'CAP OData operations are added in later phases.',
      },
      {
        displayName: 'Phase 1 Loadability Only',
        name: 'phaseOneNotice',
        type: 'notice',
        default: '',
        description: 'This node currently verifies package loadability. CAP OData operations are intentionally deferred.',
      },
    ],
  }
}
