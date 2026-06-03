const { normalizeWorkflowSchema } = require('./schema')
const { slugValue } = require('./manifest')

const CDS_TYPES = {
  String: 'String',
  Integer: 'Integer',
  Decimal: 'Decimal',
  Boolean: 'Boolean',
  Date: 'Date',
  DateTime: 'DateTime',
  JSON: 'LargeString'
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function workflowTypeName(workflowKey) {
  const slug = slugValue(workflowKey)
  const name = slug
    .split('-')
    .filter(Boolean)
    .map(capitalize)
    .join('')

  return `${/^[A-Z]/.test(name) ? name : `Workflow${name}`}Inputs`
}

function workflowActionName(workflowKey) {
  const parts = slugValue(workflowKey).split('-').filter(Boolean)
  const name = parts
    .map((part, index) => index === 0 ? part : capitalize(part))
    .join('')

  return /^[a-z]/.test(name) ? name : `workflow${capitalize(name)}`
}

function normalizeSchema(schema) {
  return schema?.typed === true || schema?.typed === false
    ? normalizeWorkflowSchema(schema)
    : normalizeWorkflowSchema(schema)
}

function fieldLine(input) {
  return `  ${input.name} : ${CDS_TYPES[input.type]};`
}

function generateWorkflowCds(workflows = []) {
  const typedWorkflows = workflows
    .map((workflow) => ({
      workflowKey: workflow.workflowKey,
      schema: normalizeSchema(workflow.schema)
    }))
    .filter((workflow) => workflow.schema.typed)
    .sort((left, right) => left.workflowKey.localeCompare(right.workflowKey))

  const lines = [
    'namespace cap.n8n.workflows;',
    ''
  ]

  for (const workflow of typedWorkflows) {
    lines.push(`type ${workflowTypeName(workflow.workflowKey)} {`)
    for (const input of workflow.schema.inputs) {
      lines.push(fieldLine(input))
    }
    lines.push('}')
    lines.push('')
  }

  lines.push('service WorkflowInputContracts {')
  for (const workflow of typedWorkflows) {
    lines.push(`  action ${workflowActionName(workflow.workflowKey)}(inputs : ${workflowTypeName(workflow.workflowKey)}) returns Boolean;`)
  }
  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

module.exports = {
  generateWorkflowCds,
  workflowTypeName
}
