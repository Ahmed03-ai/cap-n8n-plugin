const N8nWorkflowService = require('./lib/N8nWorkflowService.js')
const MockN8nWorkflowService = require('./lib/MockN8nWorkflowService.js')
const {
  SUPPORTED_WORKFLOW_INPUT_TYPES,
  normalizeWorkflowSchema
} = require('./lib/workflows/schema.js')
const { sanitizeWorkflow } = require('./lib/workflows/sanitize.js')
const {
  generateWorkflowCds,
  workflowTypeName
} = require('./lib/workflows/generate-cds.js')
const {
  readWorkflowArtifacts,
  writeWorkflowArtifacts
} = require('./lib/workflows/artifacts.js')
const { validateWorkflowAnnotations } = require('./lib/workflows/validate.js')

const workflowTools = {
  SUPPORTED_WORKFLOW_INPUT_TYPES,
  normalizeWorkflowSchema,
  sanitizeWorkflow,
  generateWorkflowCds,
  workflowTypeName,
  readWorkflowArtifacts,
  writeWorkflowArtifacts,
  validateWorkflowAnnotations
}

module.exports = {
  N8nWorkflowService,
  MockN8nWorkflowService,
  validateWorkflowAnnotations,
  workflowTools
}
