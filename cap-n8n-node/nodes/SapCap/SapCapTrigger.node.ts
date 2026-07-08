import {
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IPollFunctions,
  NodeConnectionTypes,
} from 'n8n-workflow'

import {
  buildQueryRequest,
  resolveEntitySetName,
  sapCapApiRequest,
} from './GenericFunctions'
import {
  loadEntitySetOptions,
  loadTimestampFieldOptions,
  searchEntitySets,
} from './ODataMetadata'
import {
  classifySapCapError,
  normalizeODataItems,
  toNodeOperationError,
} from './ODataResponse'

type FirstPollBehavior = 'startFromNow' | 'fetchAll'

export class SapCapTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SAP CAP Trigger',
    name: 'sapCapTrigger',
    icon: 'file:sapCap.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["entitySet"] || $parameter["entitySetManual"]}}',
    description: 'Poll a SAP CAP OData entity set for new or changed records',
    defaults: {
      name: 'SAP CAP Trigger',
    },
    polling: true,
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'sapCapApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Service Path',
        name: 'servicePath',
        type: 'string',
        default: '/odata/v4/admin',
        required: true,
        placeholder: '/odata/v4/admin',
        description: 'Path to the CAP OData service',
      },
      {
        displayName: 'Entity Set',
        name: 'entitySet',
        type: 'resourceLocator',
        default: { mode: 'list', value: '' },
        required: true,
        description: 'CAP entity set to poll. Pick it from $metadata, or switch to By Name to type it when metadata cannot be loaded.',
        modes: [
          {
            displayName: 'From List',
            name: 'list',
            type: 'list',
            typeOptions: {
              searchListMethod: 'searchEntitySets',
              searchable: true,
            },
          },
          {
            displayName: 'By Name',
            name: 'name',
            type: 'string',
            placeholder: 'Books',
            hint: 'Enter only the CAP entity set name, not a path or query string.',
          },
        ],
      },
      {
        displayName: 'Timestamp Field Name or ID',
        name: 'timestampField',
        type: 'options',
        default: 'modifiedAt',
        required: true,
        description: 'Entity property used to detect new or changed records. CAP managed fields such as modifiedAt are listed first. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
        typeOptions: {
          loadOptionsMethod: 'getTimestampFields',
          loadOptionsDependsOn: ['entitySet.value'],
        },
      },
      {
        displayName: 'First Poll',
        name: 'firstPollBehavior',
        type: 'options',
        options: [
          {
            name: 'Start From Now',
            value: 'startFromNow',
            description: 'On activation, record the current time and emit only records changed afterwards',
          },
          {
            name: 'Fetch All Existing',
            value: 'fetchAll',
            description: 'On the first poll, emit all existing records, then poll incrementally',
          },
        ],
        default: 'startFromNow',
        required: true,
        description: 'Behavior on the first poll when no previous timestamp has been stored',
      },
      {
        displayName: 'Additional Filter',
        name: 'additionalFilter',
        type: 'string',
        default: '',
        placeholder: "stock gt 0",
        description: 'Optional raw OData $filter expression combined with the timestamp condition',
      },
      {
        displayName: 'Max Records Per Poll',
        name: 'maxRecords',
        type: 'number',
        default: 200,
        description: 'Upper bound on records fetched in a single poll using $top',
      },
    ],
		usableAsTool: true,
  }

  methods = {
    loadOptions: {
      getEntitySets: loadEntitySetOptions,
      getTimestampFields: loadTimestampFieldOptions,
    },
    listSearch: {
      searchEntitySets,
    },
  }

  async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
    const node = this.getNode()
    const staticData = this.getWorkflowStaticData('node')

    try {
      const servicePath = this.getNodeParameter('servicePath') as string
      const entitySetName = resolveEntitySetName({
        entitySet: resourceLocatorValue(this.getNodeParameter('entitySet', '')),
      })
      const timestampField = (this.getNodeParameter('timestampField', 'modifiedAt') as string).trim()
      const firstPollBehavior = this.getNodeParameter('firstPollBehavior', 'startFromNow') as FirstPollBehavior
      const additionalFilter = (this.getNodeParameter('additionalFilter', '') as string).trim()
      const maxRecords = this.getNodeParameter('maxRecords', 200) as number

      const isManualTest = this.getMode() === 'manual'
      const lastPolledAt = typeof staticData.lastPolledAt === 'string' ? staticData.lastPolledAt : undefined
      const lastSeenKeys = Array.isArray(staticData.lastSeenKeys)
        ? (staticData.lastSeenKeys as string[])
        : []

      // First activation with "Start From Now": set the watermark and emit nothing
      // so the trigger does not replay historical records. Manual test runs ignore
      // this so the user still sees sample data.
      if (!lastPolledAt && !isManualTest && firstPollBehavior === 'startFromNow') {
        staticData.lastPolledAt = new Date().toISOString()
        staticData.lastSeenKeys = []
        return null
      }

      const filters: string[] = []

      if (additionalFilter) filters.push(`(${additionalFilter})`)
      // `ge` (not `gt`) re-fetches records sharing the boundary timestamp so a new
      // record written in the same second is not skipped; duplicates are removed by
      // the lastSeenKeys check below.
      if (lastPolledAt && !isManualTest) filters.push(`${timestampField} ge ${lastPolledAt}`)

      const request = buildQueryRequest({
        servicePath,
        entitySetName,
        filter: filters.join(' and '),
        orderBy: `${timestampField} asc`,
        top: maxRecords,
        skip: 0,
      })
      const response = await sapCapApiRequest(this, {
        ...request,
        responseFormat: 'json',
        errorContext: 'odata',
      })
      const items = normalizeODataItems('query', response, 0)
      // Records newer than the last watermark are always new (including the same record
      // changing again). Only records sitting exactly at the previous watermark might have
      // been emitted last poll, so de-duplicate just those by key.
      const fresh = items.filter((item) => {
        if (recordTimestamp(item.json, timestampField) !== lastPolledAt) return true

        return !lastSeenKeys.includes(recordKey(item.json))
      })

      if (!isManualTest) {
        const watermark = computeWatermark(items, timestampField) ?? lastPolledAt ?? new Date().toISOString()

        staticData.lastPolledAt = watermark
        staticData.lastSeenKeys = items
          .filter((item) => recordTimestamp(item.json, timestampField) === watermark)
          .map((item) => recordKey(item.json))
      }

      if (fresh.length === 0) return null

      return [fresh]
    } catch (err) {
      const safeError = classifySapCapError(err, { operation: 'query' })

      throw toNodeOperationError(node, safeError, 0)
    }
  }
}

// A resourceLocator value is `{ mode, value }` in n8n; By-Name selections may also
// arrive as a plain string. Return the underlying entity-set name either way.
function resourceLocatorValue(raw: unknown): string {
  if (raw && typeof raw === 'object') {
    const value = (raw as { value?: unknown }).value

    return value === undefined || value === null ? '' : String(value)
  }

  return typeof raw === 'string' ? raw : ''
}

function recordTimestamp(record: IDataObject, timestampField: string): string {
  const value = record[timestampField]

  return value === undefined || value === null ? '' : String(value)
}

// Highest timestamp present in the batch; records are ordered ascending, so this is
// the last non-empty value and becomes the next poll's watermark.
function computeWatermark(items: INodeExecutionData[], timestampField: string): string | undefined {
  let watermark: string | undefined

  for (const item of items) {
    const value = recordTimestamp(item.json, timestampField)

    if (value && (watermark === undefined || value > watermark)) {
      watermark = value
    }
  }

  return watermark
}

// Stable per-record identity for de-duplication across polls. Prefers the common CAP
// key shape (ID plus draft flag) and falls back to a serialized record.
function recordKey(record: IDataObject): string {
  if (record.ID !== undefined) {
    return record.IsActiveEntity === undefined
      ? `ID:${String(record.ID)}`
      : `ID:${String(record.ID)}:${String(record.IsActiveEntity)}`
  }

  return JSON.stringify(record)
}
