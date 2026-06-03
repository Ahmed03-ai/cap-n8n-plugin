#!/usr/bin/env node

const path = require('node:path')
const readline = require('node:readline')
const cds = require('@sap/cds')

const repoRoot = path.resolve(__dirname, '..')
const pluginModel = path.join(repoRoot, 'cap-n8n-plugin', 'index.cds')
const serviceImpl = path.join(repoRoot, 'cap-n8n-plugin', 'lib', 'N8nWorkflowService.js')
const defaultWorkflowId = 'cap-cancel-stoppable'
const businessKey = 'phase8-cancellation-review'
const tag = 'phase8-review'

function printHelp() {
  console.log(`
CAP n8n cancellation showcase

Starts the dedicated local n8n workflow, waits while you confirm the execution is visible in the n8n browser UI, then cancels it through n8n.cancel(executionId).

Usage:
  node scripts/cancellation-showcase.js [--dry-run]
  node scripts/cancellation-showcase.js --help

Environment:
  N8N_BASE_URL=http://localhost:5678
  N8N_CANCEL_SUPPORTED=true
  N8N_CANCEL_API_BASE_URL=http://localhost:5678
  N8N_CANCEL_WORKFLOW_ID=cap-cancel-stoppable
  N8N_API_KEY=<local-n8n-api-key>

The script prints CAP/plugin execution IDs and n8n execution IDs, but never prints the API key.
`.trim())
}

function readBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value

  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false

  return fallback
}

function loadConfig(env = process.env) {
  const baseUrl = env.N8N_BASE_URL || 'http://localhost:5678'

  return {
    baseUrl,
    apiKey: env.N8N_API_KEY || '',
    cancelSupported: readBoolean(env.N8N_CANCEL_SUPPORTED, false),
    cancelApiBaseUrl: env.N8N_CANCEL_API_BASE_URL || baseUrl,
    workflowId: env.N8N_CANCEL_WORKFLOW_ID || defaultWorkflowId
  }
}

function redact(value, secrets) {
  let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)

  for (const secret of secrets.filter(Boolean)) {
    text = text.split(secret).join('[redacted]')
  }

  return text
}

function printConfig(config) {
  console.log('Cancellation showcase configuration:')
  console.log(`- N8N_BASE_URL=${config.baseUrl}`)
  console.log(`- N8N_CANCEL_SUPPORTED=${config.cancelSupported}`)
  console.log(`- N8N_CANCEL_API_BASE_URL=${config.cancelApiBaseUrl}`)
  console.log(`- N8N_CANCEL_WORKFLOW_ID=${config.workflowId}`)
  console.log(`- N8N_API_KEY=${config.apiKey ? '<set>' : '<missing>'}`)
}

function assertRunnableConfig(config) {
  if (!config.cancelSupported) {
    throw new Error('Set N8N_CANCEL_SUPPORTED=true so CAP/plugin cancellation calls the n8n stop API.')
  }

  if (!config.apiKey) {
    throw new Error('Set N8N_API_KEY to a local n8n API key before running the cancellation showcase.')
  }
}

async function prepareN8n(config) {
  const csn = await cds.load(pluginModel)
  await cds.deploy(csn).to('sqlite::memory:')

  cds.env.requires ??= {}
  cds.env.requires.n8n = {
    impl: serviceImpl,
    kind: 'webhook',
    credentials: {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey
    },
    cancel: {
      supported: config.cancelSupported,
      apiBaseUrl: config.cancelApiBaseUrl
    },
    timeoutMs: 10000,
    retries: 1
  }

  return cds.connect.to('n8n')
}

function waitForOperator() {
  if (!process.stdin.isTTY) {
    console.log('Non-interactive stdin detected; continuing without an operator pause.')
    return Promise.resolve()
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question('Confirm the n8n execution is visible and waiting/running in the browser, then press Enter to cancel it. ', () => {
      rl.close()
      resolve()
    })
  })
}

async function run() {
  const args = process.argv.slice(2)
  const config = loadConfig()

  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    return
  }

  if (args.includes('--dry-run')) {
    printConfig(config)
    console.log(`Would start workflow "${config.workflowId}" with business key "${businessKey}" and tag "${tag}".`)
    console.log('Would wait for browser confirmation, then call n8n.cancel(executionId) through the CAP plugin API.')
    console.log('No n8n requests were sent.')
    return
  }

  assertRunnableConfig(config)
  printConfig(config)

  const n8n = await prepareN8n(config)
  const started = await n8n.start(config.workflowId, {
    businessKey,
    tag,
    requestedBy: 'phase8-review'
  }, {
    businessKey,
    tag
  })

  console.log('Started cancellation showcase execution:')
  console.log(redact({
    executionId: started.executionId,
    n8nExecutionId: started.n8nExecutionId,
    workflowId: started.workflowId,
    status: started.status,
    businessKey: started.businessKey,
    tag: started.tag
  }, [config.apiKey]))

  if (!started.executionId || !started.n8nExecutionId || started.status !== 'running') {
    throw new Error('The workflow did not return a running execution with an n8n execution ID. Check the explicit running webhook response contract.')
  }

  await waitForOperator()

  const cancelled = await n8n.cancel(started.executionId)
  console.log('Cancellation result:')
  console.log(redact(cancelled, [config.apiKey]))

  if (!cancelled.cancelled) {
    process.exitCode = 1
  }
}

run().catch((err) => {
  const config = loadConfig()
  console.error(redact({
    message: err.message,
    code: err.code,
    statusCode: err.statusCode
  }, [config.apiKey]))
  process.exitCode = 1
})
