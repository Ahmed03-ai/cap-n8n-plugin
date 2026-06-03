#!/usr/bin/env node

const { spawn } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')

function resolveNpmCommand() {
  const npmExecPath = process.env.npm_execpath
  const adjacentNpmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')

  if (npmExecPath && existsSync(npmExecPath)) {
    return {
      command: process.execPath,
      prefixArgs: [npmExecPath]
    }
  }

  if (existsSync(adjacentNpmCli)) {
    return {
      command: process.execPath,
      prefixArgs: [adjacentNpmCli]
    }
  }

  return {
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    prefixArgs: []
  }
}

const npmCommand = resolveNpmCommand()

const labels = {
  fix: 'fix before release',
  accepted: 'accepted tooling warning',
  manual: 'manual/UAT evidence required'
}

const checks = [
  {
    name: 'Workspace tests',
    display: 'npm test',
    command: npmCommand.command,
    args: [...npmCommand.prefixArgs, 'test'],
    streamStdout: true
  },
  {
    name: 'Workflow annotation validation',
    display: 'npm run n8n:workflow:validate -- --app demo-app',
    command: npmCommand.command,
    args: [...npmCommand.prefixArgs, 'run', 'n8n:workflow:validate', '--', '--app', 'demo-app'],
    streamStdout: true
  },
  {
    name: 'CAP model compile including generated workflows',
    display: 'node node_modules/@sap/cds-dk/bin/cds.js compile demo-app/db demo-app/srv demo-app/app demo-app/n8n --to csn',
    command: process.execPath,
    args: [
      'node_modules/@sap/cds-dk/bin/cds.js',
      'compile',
      'demo-app/db',
      'demo-app/srv',
      'demo-app/app',
      'demo-app/n8n',
      '--to',
      'csn'
    ],
    streamStdout: false
  }
]

const warningLike = /\b(?:warn|warning|deprecated|deprecation|DEP\d{4})\b/i
const acceptedToolingWarning = /DEP0190|Passing args to a child process with shell option true|trace-deprecation/i

function printCheckList() {
  console.log('review:local deterministic checks:')
  for (const check of checks) {
    console.log(`- ${check.display}`)
  }
  console.log('')
  console.log(`${labels.manual}: live n8n UI evidence is outside this automated command.`)
}

function summarizeHiddenStdout(result) {
  if (result.streamStdout) return

  console.log(`[${result.name}] stdout summarized: ${result.stdoutBytes} bytes across ${result.stdoutLines} lines.`)
}

function warningLines(output) {
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && warningLike.test(line))
}

function classifyWarnings(result) {
  const lines = warningLines(result.stderr)
  const accepted = []
  const unclassified = []

  for (const line of lines) {
    if (acceptedToolingWarning.test(line)) {
      accepted.push(line)
    } else {
      unclassified.push(line)
    }
  }

  return { accepted, unclassified }
}

function printWarningSummary(result) {
  const classified = classifyWarnings(result)

  if (!classified.accepted.length && !classified.unclassified.length) {
    console.log(`${labels.accepted}: none observed for ${result.name}`)
    return true
  }

  for (const line of classified.accepted) {
    console.log(`${labels.accepted}: ${result.name}: ${line}`)
  }

  for (const line of classified.unclassified) {
    console.error(`${labels.fix}: ${result.name}: unclassified warning-like output: ${line}`)
  }

  return classified.unclassified.length === 0
}

function runCheck(check) {
  return new Promise(resolve => {
    console.log('')
    console.log(`=== ${check.name} ===`)
    console.log(`$ ${check.display}`)

    const child = spawn(check.command, check.args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const result = {
      name: check.name,
      streamStdout: check.streamStdout,
      stdoutBytes: 0,
      stdoutLines: 0,
      stderr: '',
      exitCode: 0
    }

    child.stdout.on('data', chunk => {
      const text = chunk.toString()
      result.stdoutBytes += Buffer.byteLength(text)
      result.stdoutLines += text.split(/\r?\n/).length - 1

      if (check.streamStdout) {
        process.stdout.write(text)
      }
    })

    child.stderr.on('data', chunk => {
      const text = chunk.toString()
      result.stderr += text
      process.stderr.write(text)
    })

    child.on('error', error => {
      result.exitCode = 1
      result.stderr += `${error.message}\n`
      console.error(error.message)
    })

    child.on('close', code => {
      result.exitCode = typeof code === 'number' ? code : result.exitCode
      summarizeHiddenStdout(result)
      console.log(`[${check.name}] exit code: ${result.exitCode}`)
      resolve(result)
    })
  })
}

async function main() {
  if (process.argv.includes('--list')) {
    printCheckList()
    return 0
  }

  const results = []
  let failed = false

  for (const check of checks) {
    const result = await runCheck(check)
    const warningsOk = printWarningSummary(result)
    results.push(result)

    if (result.exitCode !== 0) {
      failed = true
      console.error(`${labels.fix}: ${result.name} failed with exit code ${result.exitCode}`)
    }

    if (!warningsOk) {
      failed = true
    }
  }

  console.log('')
  console.log('=== review:local summary ===')
  for (const result of results) {
    const status = result.exitCode === 0 ? 'passed' : 'failed'
    console.log(`- ${result.name}: ${status} (exit ${result.exitCode})`)
  }
  console.log(`${labels.manual}: real n8n editor/runtime evidence remains a separate UAT artifact.`)

  if (failed) {
    console.error(`${labels.fix}: review:local did not pass.`)
    return 1
  }

  console.log('review:local passed.')
  return 0
}

main()
  .then(code => {
    process.exitCode = code
  })
  .catch(error => {
    console.error(`${labels.fix}: ${error.message}`)
    process.exitCode = 1
  })
