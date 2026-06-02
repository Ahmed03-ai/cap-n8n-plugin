const { compileCondition } = require('./ConditionEvaluator')

const START_PREFIX = '@n8n.workflow.start'
const CANCEL_PREFIX = '@n8n.workflow.cancel'
const VALID_EVENTS = new Set(['CREATE', 'UPDATE', 'DELETE'])
const START_FIELDS = new Set(['workflowId', 'on', 'inputs', 'if', 'businessKey', 'tag'])
const CANCEL_FIELDS = new Set(['workflowId', 'on', 'businessKey', 'tag'])

function createAnnotationError(message, details = {}) {
  const error = new Error(message)
  error.code = 'ERR_N8N_ANNOTATION'
  error.source = 'n8n'
  error.statusCode = 500
  error.retryable = false
  error.details = details
  return error
}

function entityName(entity = {}) {
  return entity.name || entity.kind || 'entity'
}

function ownEntries(definition = {}) {
  return Object.entries(definition).filter(([key]) => Object.prototype.hasOwnProperty.call(definition, key))
}

function assertObject(value, field, details = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createAnnotationError(`n8n workflow annotation "${field}" must be an object.`, {
      field,
      ...details
    })
  }
}

function assertNoNumericSegment(path, prefix, entity) {
  if (path.some((segment) => /^\d+$/.test(segment))) {
    throw createAnnotationError('n8n workflow annotations support one start and one cancel object per entity.', {
      annotation: prefix,
      entity: entityName(entity)
    })
  }
}

function assignNested(config, path, value, prefix, entity) {
  assertNoNumericSegment(path, prefix, entity)

  let cursor = config
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index]
    if (cursor[segment] === undefined) cursor[segment] = {}
    if (!cursor[segment] || typeof cursor[segment] !== 'object' || Array.isArray(cursor[segment])) {
      throw createAnnotationError('n8n workflow annotation has conflicting flattened keys.', {
        annotation: prefix,
        path: path.join('.'),
        entity: entityName(entity)
      })
    }
    cursor = cursor[segment]
  }

  cursor[path[path.length - 1]] = value
}

function mergeObject(target, source, prefix, entity) {
  if (Array.isArray(source)) {
    throw createAnnotationError('n8n workflow annotations support one start and one cancel object per entity.', {
      annotation: prefix,
      entity: entityName(entity)
    })
  }

  assertObject(source, prefix, {
    annotation: prefix,
    entity: entityName(entity)
  })

  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = target[key] || {}
      mergeObject(target[key], value, prefix, entity)
    } else {
      target[key] = value
    }
  }
}

function readRawConfig(definition, prefix, entity) {
  let found = false
  const config = {}

  for (const [key, value] of ownEntries(definition)) {
    if (key === prefix) {
      found = true
      mergeObject(config, value, prefix, entity)
      continue
    }

    if (!key.startsWith(`${prefix}.`)) continue
    found = true
    const path = key.slice(prefix.length + 1).split('.')
    assignNested(config, path, value, prefix, entity)
  }

  return found ? config : undefined
}

function assertAllowedFields(config, allowed, annotation, entity) {
  for (const field of Object.keys(config)) {
    if (!allowed.has(field)) {
      throw createAnnotationError(`Unsupported n8n workflow annotation field "${field}".`, {
        annotation,
        field,
        entity: entityName(entity)
      })
    }
  }
}

function normalizeWorkflowId(value, annotation, entity) {
  if (typeof value !== 'string' || !value.trim()) {
    throw createAnnotationError('n8n workflow annotation requires a non-empty workflowId.', {
      annotation,
      field: 'workflowId',
      entity: entityName(entity)
    })
  }

  return value.trim()
}

function normalizeTag(value, annotation, entity) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !value.trim()) {
    throw createAnnotationError('n8n workflow annotation tag must be a non-empty string.', {
      annotation,
      field: 'tag',
      entity: entityName(entity)
    })
  }

  return value.trim()
}

function normalizeEvents(value, defaults, annotation, entity) {
  const values = value === undefined || value === null || value === ''
    ? defaults
    : Array.isArray(value)
      ? value
      : [value]

  if (!Array.isArray(values) || values.length === 0) {
    throw createAnnotationError('n8n workflow annotation on must be an event string or array.', {
      annotation,
      field: 'on',
      entity: entityName(entity)
    })
  }

  const events = []
  for (const event of values) {
    if (typeof event !== 'string' || !event.trim()) {
      throw createAnnotationError('n8n workflow annotation on contains an invalid event.', {
        annotation,
        field: 'on',
        entity: entityName(entity)
      })
    }

    const normalized = event.trim().toUpperCase()
    if (!VALID_EVENTS.has(normalized)) {
      throw createAnnotationError('n8n workflow annotation on contains an unsupported event.', {
        annotation,
        field: 'on',
        event,
        allowed: [...VALID_EVENTS],
        entity: entityName(entity)
      })
    }

    if (!events.includes(normalized)) events.push(normalized)
  }

  return events
}

function isScalarElement(element) {
  if (!element || typeof element !== 'object') return false
  if (element.target || element.items || element.elements) return false
  if (element.type === 'cds.Association' || element.type === 'cds.Composition') return false
  return true
}

function normalizeScalarPath(path, field, entity, annotation) {
  if (typeof path !== 'string' || !path.trim()) {
    throw createAnnotationError('n8n workflow annotation mapping must be a non-empty scalar field path.', {
      annotation,
      field,
      entity: entityName(entity)
    })
  }

  const normalizedPath = path.trim()
  const segments = normalizedPath.split('.')
  if (segments.length !== 1) {
    throw createAnnotationError('n8n workflow annotation mapping only supports single scalar fields.', {
      annotation,
      field,
      path: normalizedPath,
      entity: entityName(entity)
    })
  }

  const element = entity?.elements?.[normalizedPath]
  if (!isScalarElement(element)) {
    throw createAnnotationError('n8n workflow annotation mapping references a missing or non-scalar field.', {
      annotation,
      field,
      path: normalizedPath,
      entity: entityName(entity)
    })
  }

  return {
    path: normalizedPath,
    key: element.key === true,
    type: element.type
  }
}

function normalizeBusinessKey(value, annotation, entity) {
  if (value === undefined || value === null || value === '') return undefined
  return normalizeScalarPath(value, 'businessKey', entity, annotation)
}

function normalizeInputs(value, events, annotation, entity) {
  if (value === undefined || value === null) return undefined
  assertObject(value, 'inputs', {
    annotation,
    entity: entityName(entity)
  })

  const inputs = {}
  for (const [name, path] of Object.entries(value)) {
    if (!name || /^\d+$/.test(name)) {
      throw createAnnotationError('n8n workflow input names must be non-empty strings.', {
        annotation,
        field: 'inputs',
        entity: entityName(entity)
      })
    }
    inputs[name] = normalizeScalarPath(path, `inputs.${name}`, entity, annotation)
  }

  if (events.includes('DELETE')) {
    for (const [name, mapping] of Object.entries(inputs)) {
      if (!mapping.key) {
        throw createAnnotationError('n8n workflow DELETE annotations only support key input mappings.', {
          annotation,
          field: `inputs.${name}`,
          path: mapping.path,
          entity: entityName(entity)
        })
      }
    }
  }

  return inputs
}

function normalizeStart(config, entity) {
  assertAllowedFields(config, START_FIELDS, START_PREFIX, entity)
  const on = normalizeEvents(config.on, ['CREATE'], START_PREFIX, entity)
  const start = {
    workflowId: normalizeWorkflowId(config.workflowId, START_PREFIX, entity),
    on
  }

  const inputs = normalizeInputs(config.inputs, on, START_PREFIX, entity)
  const businessKey = normalizeBusinessKey(config.businessKey, START_PREFIX, entity)
  const tag = normalizeTag(config.tag, START_PREFIX, entity)
  if (inputs) start.inputs = inputs
  if (businessKey) start.businessKey = businessKey
  if (tag) start.tag = tag
  if (config.if !== undefined && config.if !== null && config.if !== '') {
    start.if = config.if
    start.condition = compileCondition(config.if, entity)
  }

  return start
}

function normalizeCancel(config, entity) {
  assertAllowedFields(config, CANCEL_FIELDS, CANCEL_PREFIX, entity)
  const cancel = {
    workflowId: normalizeWorkflowId(config.workflowId, CANCEL_PREFIX, entity),
    on: normalizeEvents(config.on, ['DELETE'], CANCEL_PREFIX, entity)
  }

  const businessKey = normalizeBusinessKey(config.businessKey, CANCEL_PREFIX, entity)
  const tag = normalizeTag(config.tag, CANCEL_PREFIX, entity)
  if (businessKey) cancel.businessKey = businessKey
  if (tag) cancel.tag = tag

  return cancel
}

function readWorkflowAnnotations(definition, context = {}) {
  const entity = context.entity || definition
  const rawStart = readRawConfig(definition, START_PREFIX, entity)
  const rawCancel = readRawConfig(definition, CANCEL_PREFIX, entity)

  return {
    start: rawStart ? normalizeStart(rawStart, entity) : undefined,
    cancel: rawCancel ? normalizeCancel(rawCancel, entity) : undefined
  }
}

module.exports = {
  createAnnotationError,
  readWorkflowAnnotations
}
