const SUPPORTED_WORKFLOW_INPUT_TYPES = [
  'String',
  'Integer',
  'Decimal',
  'Boolean',
  'Date',
  'DateTime',
  'JSON'
]

const SUPPORTED_TYPES = new Set(SUPPORTED_WORKFLOW_INPUT_TYPES)
const INPUT_FIELDS = new Set(['type', 'required'])
const UNSUPPORTED_SCHEMA_FIELDS = new Set([
  '$schema',
  '$id',
  '$defs',
  'definitions',
  'properties',
  'items',
  'enum',
  'oneOf',
  'anyOf',
  'allOf'
])

function unsupportedSchemaError(message, details = {}) {
  const error = new Error(message)
  error.code = 'ERR_N8N_WORKFLOW_SCHEMA_UNSUPPORTED'
  error.details = details
  return error
}

function warningMissingSchema() {
  return {
    severity: 'warning',
    code: 'WARN_N8N_WORKFLOW_SCHEMA_MISSING',
    message: 'n8n workflow sidecar schema is missing; workflow artifact is untyped.'
  }
}

function assertPlainObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw unsupportedSchemaError(`n8n workflow schema ${field} must be an object.`, { field })
  }
}

function assertNoUnsupportedFields(value, field) {
  for (const key of Object.keys(value || {})) {
    if (UNSUPPORTED_SCHEMA_FIELDS.has(key)) {
      throw unsupportedSchemaError(`n8n workflow schema field ${key} is not supported in Phase 5.`, {
        field: field ? `${field}.${key}` : key
      })
    }
  }
}

function normalizeInputName(name) {
  if (typeof name !== 'string' || !name.trim() || /^\d+$/.test(name)) {
    throw unsupportedSchemaError('n8n workflow schema input names must be non-empty strings.', {
      field: 'inputs'
    })
  }

  return name.trim()
}

function normalizeInput(input, name) {
  assertPlainObject(input, `inputs.${name}`)
  assertNoUnsupportedFields(input, `inputs.${name}`)

  for (const key of Object.keys(input)) {
    if (!INPUT_FIELDS.has(key)) {
      throw unsupportedSchemaError(`n8n workflow schema input field ${key} is not supported in Phase 5.`, {
        field: `inputs.${name}.${key}`
      })
    }
  }

  if (!SUPPORTED_TYPES.has(input.type)) {
    throw unsupportedSchemaError(`n8n workflow schema input ${name} has unsupported type ${input.type}.`, {
      field: `inputs.${name}.type`,
      supportedTypes: SUPPORTED_WORKFLOW_INPUT_TYPES
    })
  }

  if (input.required !== undefined && typeof input.required !== 'boolean') {
    throw unsupportedSchemaError(`n8n workflow schema input ${name} required metadata must be boolean.`, {
      field: `inputs.${name}.required`
    })
  }

  return {
    name,
    type: input.type,
    required: input.required === true
  }
}

function normalizeNormalizedSchema(schema) {
  if (schema.typed === false) {
    return {
      typed: false,
      inputs: [],
      diagnostics: Array.isArray(schema.diagnostics) ? schema.diagnostics : [warningMissingSchema()]
    }
  }

  if (schema.typed === true && Array.isArray(schema.inputs)) {
    const inputs = schema.inputs
      .map((input) => normalizeInput({
        type: input.type,
        required: input.required
      }, normalizeInputName(input.name)))
      .sort((left, right) => left.name.localeCompare(right.name))

    return {
      typed: true,
      diagnostics: [],
      inputs
    }
  }

  return undefined
}

function normalizeWorkflowSchema(schema) {
  if (schema === undefined || schema === null) {
    return {
      typed: false,
      inputs: [],
      diagnostics: [warningMissingSchema()]
    }
  }

  assertPlainObject(schema, 'root')
  assertNoUnsupportedFields(schema)

  const normalized = normalizeNormalizedSchema(schema)
  if (normalized) return normalized

  const fields = Object.keys(schema)
  if (!fields.includes('inputs') || fields.some((field) => field !== 'inputs')) {
    throw unsupportedSchemaError('n8n workflow schema must contain only an inputs object.', {
      fields
    })
  }

  assertPlainObject(schema.inputs, 'inputs')
  assertNoUnsupportedFields(schema.inputs, 'inputs')

  const inputs = Object.entries(schema.inputs)
    .map(([name, input]) => normalizeInput(input, normalizeInputName(name)))
    .sort((left, right) => left.name.localeCompare(right.name))

  return {
    typed: true,
    diagnostics: [],
    inputs
  }
}

module.exports = {
  SUPPORTED_WORKFLOW_INPUT_TYPES,
  normalizeWorkflowSchema
}
