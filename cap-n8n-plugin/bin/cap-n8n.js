#!/usr/bin/env node

const { importWorkflows } = require('../lib/workflows/import')
const {
  runValidateCommand,
  textOutput
} = require('../lib/workflows/validate-command')

const BOOLEAN_OPTIONS = new Set(['--all', '--live', '--help', '--json'])
const VALUE_OPTIONS = new Set([
  '--app',
  '--from',
  '--workflow',
  '--key',
  '--schema',
  '--base-url',
  '--api-base-url',
  '--timeout-ms'
])

function writeOut(message = '') {
  process.stdout.write(`${message}\n`)
}

function writeErr(message = '') {
  process.stderr.write(`${message}\n`)
}

function help() {
  return [
    'Usage: cap-n8n <command> [options]',
    '',
    'Commands:',
    '  import    Import n8n workflow artifacts into a CAP app',
    '  validate  Validate CAP n8n workflow annotations against generated artifacts',
    '',
    'Import options:',
    '  --app <path>          CAP app root that receives app-local n8n artifacts',
    '  --from <path>         Local n8n workflow export JSON file',
    '  --workflow <value>    Source workflow ID, name, webhook path, or local key to import',
    '  --key <value>         Override the local artifact key for one selected workflow',
    '  --schema <path>       Sidecar workflow input schema JSON file',
    '  --all                Import every workflow explicitly',
    '  --live               Import from the configured live n8n API',
    '  --base-url <url>     Override configured n8n routing base URL',
    '  --api-base-url <url> Override configured n8n public API base URL',
    '  --timeout-ms <ms>    Override live import request timeout',
    '',
    'Validate options:',
    '  --app <path>          CAP app root that contains app-local n8n artifacts',
    '  --json               Emit machine-readable sanitized diagnostics',
    '  --help               Show help'
  ].join('\n')
}

function parseArgs(args) {
  const options = {}
  const positionals = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (!arg.startsWith('--')) {
      positionals.push(arg)
      continue
    }

    if (BOOLEAN_OPTIONS.has(arg)) {
      options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = true
      continue
    }

    if (!VALUE_OPTIONS.has(arg)) {
      throw new Error(`Unknown option: ${arg}`)
    }

    const value = args[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`${arg} requires a value.`)
    }
    index += 1
    options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value
  }

  return {
    command: positionals[0],
    options
  }
}

function safeErrorMessage(error) {
  return error?.message || 'cap-n8n command failed.'
}

function printImportResult(result) {
  writeOut(`Imported ${result.workflows.length} ${result.sourceType} n8n workflow(s) into ${result.artifactRoot}`)
  for (const workflow of result.workflows) {
    const workflowPath = workflow.paths.workflow
    writeOut(`- ${workflow.workflowKey} (${result.sourceType}) -> ${workflowPath}`)
  }

  for (const diagnostic of result.diagnostics || []) {
    writeErr(`${diagnostic.severity || 'warning'}: ${diagnostic.workflowKey || 'workflow'}: ${diagnostic.message}`)
  }
}

function printValidateResult(payload) {
  if (payload.options?.json) {
    writeOut(JSON.stringify({
      appRoot: payload.appRoot,
      errors: payload.result.errors,
      warnings: payload.result.warnings,
      diagnostics: payload.result.diagnostics
    }, null, 2))
    return
  }

  for (const line of textOutput(payload)) {
    const hasError = line.includes('severity=error')
    if (hasError) {
      writeErr(line)
    } else {
      writeOut(line)
    }
  }
}

async function main(argv = process.argv.slice(2)) {
  const { command, options } = parseArgs(argv)

  if (!command || command === 'help' || options.help) {
    writeOut(help())
    return 0
  }

  if (command !== 'import' && command !== 'validate') {
    writeErr(`Unknown cap-n8n command: ${command}`)
    writeErr(help())
    return 1
  }

  if (command === 'validate') {
    const payload = await runValidateCommand({
      ...options,
      cwd: process.cwd()
    })
    payload.options = options
    printValidateResult(payload)
    return payload.exitCode
  }

  const result = await importWorkflows({
    ...options,
    cwd: process.cwd()
  })
  printImportResult(result)
  return 0
}

if (require.main === module) {
  main().then((exitCode) => {
    process.exitCode = exitCode
  }).catch((error) => {
    writeErr(safeErrorMessage(error))
    process.exitCode = 1
  })
}

module.exports = {
  main,
  parseArgs
}
