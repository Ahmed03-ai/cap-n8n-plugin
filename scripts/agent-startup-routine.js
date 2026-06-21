#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process')
const { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } = require('node:fs')
const http = require('node:http')
const https = require('node:https')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const defaultN8nUrl = 'http://localhost:5678'
const defaultCapUrl = 'http://localhost:3000'
const localAdminAuthHeaders = {
  Authorization: 'Basic YWxpY2U6'
}
const runtimeDir = path.join(repoRoot, '.n8n-review-data')
const capPidFile = path.join(runtimeDir, 'cap.pid')
const workflowsDir = path.join(repoRoot, 'test-workflows')
const defaultWorkflowImportName = 'stock update discord msg test workflow'
const defaultWorkflowImportSourcePath = path.join(workflowsDir, `${defaultWorkflowImportName}.json`)
const fallbackWorkflowImportSourcePath = path.join(workflowsDir, 'workflows.json')
const workflowImportHostPath = path.join(repoRoot, 'test-workflows', '.agent-startup-routine-workflows.json')
const workflowImportContainerPath = '/test-workflows/.agent-startup-routine-workflows.json'
const customComposeFile = 'docker-compose.n8n-node.yml'
const plainComposeFile = 'docker-compose.yml'

function printUsage() {
  console.log(`
Usage:
  npm run agent:startup
  npm run agent:startup -- --check
  npm run agent:startup -- --plain-n8n
  npm run agent:startup -- --workflow "stock update discord msg test workflow"
  npm run agent:startup -- --workflow-file test-workflows/workflows.json
  npm run agent:startup -- --skip-n8n
  npm run agent:startup -- --stop

Options:
  --check          Run prerequisite checks without starting services
  --plain-n8n      Start the plain n8n compose profile instead of the custom-node review profile
  --workflow <name>
                  Import the selected workflow by workflow name, ID, webhook path, or fixture file name
                  Default: ${defaultWorkflowImportName}
  --workflow-file <path>
                  Import workflow JSON from a specific file under test-workflows
  --skip-prepare   Do not rebuild and install the local n8n community node package
  --skip-workflow-import
                  Do not import the selected workflow into n8n
  --skip-n8n       Do not start n8n
  --skip-cap       Do not start the CAP demo app
  --install        Run npm install before startup, even if node_modules exists
  --no-install     Do not auto-install dependencies when node_modules is missing
  --strict         Exit if n8n cannot start instead of continuing with CAP only
  --open           Open the CAP and n8n URLs after startup
  --stop           Stop CAP started by this helper, stop the selected n8n compose profile, and exit
  --down-on-exit   Stop n8n when this process exits
  --help           Show this help
`.trim())
}

function parseArgs(argv) {
  const options = {
    check: false,
    plainN8n: false,
    skipPrepare: false,
    skipWorkflowImport: false,
    skipN8n: false,
    skipCap: false,
    workflowName: defaultWorkflowImportName,
    workflowFile: null,
    install: false,
    noInstall: false,
    strict: false,
    open: false,
    stop: false,
    downOnExit: false,
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--check') options.check = true
    else if (arg === '--plain-n8n') options.plainN8n = true
    else if (arg === '--workflow') {
      options.workflowName = readRequiredOptionValue(argv, index, arg)
      index += 1
    } else if (arg.startsWith('--workflow=')) {
      options.workflowName = readInlineOptionValue(arg, '--workflow=')
    } else if (arg === '--workflow-file') {
      options.workflowFile = resolveWorkflowFile(readRequiredOptionValue(argv, index, arg))
      index += 1
    } else if (arg.startsWith('--workflow-file=')) {
      options.workflowFile = resolveWorkflowFile(readInlineOptionValue(arg, '--workflow-file='))
    } else if (arg === '--skip-prepare') options.skipPrepare = true
    else if (arg === '--skip-workflow-import') options.skipWorkflowImport = true
    else if (arg === '--skip-n8n') options.skipN8n = true
    else if (arg === '--skip-cap') options.skipCap = true
    else if (arg === '--install') options.install = true
    else if (arg === '--no-install') options.noInstall = true
    else if (arg === '--strict') options.strict = true
    else if (arg === '--open') options.open = true
    else if (arg === '--stop') options.stop = true
    else if (arg === '--down-on-exit') options.downOnExit = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`Unknown option: ${arg}`)
  }

  if (options.plainN8n) {
    options.skipPrepare = true
  }

  return options
}

function readRequiredOptionValue(argv, index, flag) {
  const value = argv[index + 1]

  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`)
  }

  return value
}

function readInlineOptionValue(arg, prefix) {
  const value = arg.slice(prefix.length)

  if (!value) {
    throw new Error(`${prefix.slice(0, -1)} requires a value`)
  }

  return value
}

function isInsideDirectory(filePath, directoryPath) {
  const relativePath = path.relative(directoryPath, filePath)
  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

function resolveWorkflowFile(value) {
  const resolvedPath = path.resolve(repoRoot, value)

  if (!isInsideDirectory(resolvedPath, workflowsDir)) {
    throw new Error('--workflow-file must point to a file under test-workflows')
  }

  return resolvedPath
}

function log(message = '') {
  console.log(message)
}

function step(message) {
  console.log(`\n== ${message} ==`)
}

function ok(message) {
  console.log(`[ok] ${message}`)
}

function info(message) {
  console.log(`[info] ${message}`)
}

function warn(message) {
  console.warn(`[warn] ${message}`)
}

function failMessage(message) {
  console.error(`[fail] ${message}`)
}

function resolveNpmCommand() {
  const npmExecPath = process.env.npm_execpath
  const adjacentNpmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')

  if (npmExecPath && existsSync(npmExecPath)) {
    return {
      command: process.execPath,
      prefixArgs: [npmExecPath],
      display: 'npm'
    }
  }

  if (existsSync(adjacentNpmCli)) {
    return {
      command: process.execPath,
      prefixArgs: [adjacentNpmCli],
      display: 'npm'
    }
  }

  return {
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    prefixArgs: [],
    display: 'npm'
  }
}

function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false'
    },
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    shell: options.shell || false
  })

  return {
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error
  }
}

function printCommand(display, cwd = repoRoot) {
  const relativeCwd = path.relative(repoRoot, cwd)
  const cwdLabel = relativeCwd ? relativeCwd.replace(/\\/g, '/') : '.'
  console.log(`[run] (${cwdLabel}) ${display}`)
}

function requireCommand(display, command, args, options = {}) {
  printCommand(display, options.cwd || repoRoot)
  const result = runSync(command, args, { ...options, inherit: true })

  if (result.status !== 0) {
    throw new Error(`${display} failed with exit code ${result.status}`)
  }
}

function captureCommand(command, args, options = {}) {
  return runSync(command, args, options)
}

function resolveComposeCommand() {
  const dockerCompose = captureCommand('docker', ['compose', 'version'])

  if (dockerCompose.status === 0) {
    return {
      command: 'docker',
      prefixArgs: ['compose'],
      display: 'docker compose'
    }
  }

  const legacyComposeName = process.platform === 'win32' ? 'docker-compose.exe' : 'docker-compose'
  const legacyCompose = captureCommand(legacyComposeName, ['version'])

  if (legacyCompose.status === 0) {
    return {
      command: legacyComposeName,
      prefixArgs: [],
      display: legacyComposeName
    }
  }

  return {
    command: null,
    prefixArgs: [],
    display: null,
    error: [dockerCompose.error?.message, dockerCompose.stderr, legacyCompose.error?.message, legacyCompose.stderr]
      .filter(Boolean)
      .join('\n')
      .trim()
  }
}

function composeArgs(compose, composeFile, actionArgs) {
  return [...compose.prefixArgs, '-f', composeFile, ...actionArgs]
}

function displayCompose(compose, composeFile, actionArgs) {
  return `${compose.display} -f ${composeFile} ${actionArgs.join(' ')}`
}

function checkNodeVersion() {
  const [major, minor] = process.versions.node.split('.').map(Number)

  if (major < 20 || major >= 25) {
    throw new Error(`Node ${process.versions.node} is not supported here. Use Node 20, 22, or 24.`)
  }

  if (major === 20 || (major === 22 && minor < 16)) {
    warn(`Node ${process.versions.node} can run CAP, but the n8n node package declares >=22.16 <25. Use Node 22.16+ or 24 for the custom-node path.`)
  } else {
    ok(`Node ${process.versions.node}`)
  }
}

function checkGitState() {
  const branchResult = captureCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  const hashResult = captureCommand('git', ['rev-parse', '--short', 'HEAD'])

  if (branchResult.status === 0 && hashResult.status === 0) {
    const branch = branchResult.stdout.trim()
    const hash = hashResult.stdout.trim()
    const label = branch === 'HEAD' ? `detached at ${hash}` : `${branch} at ${hash}`
    info(`Git state: ${label}`)
  } else {
    warn('Git state could not be read. Startup can continue.')
  }
}

function checkNpm(npmCommand) {
  const result = captureCommand(npmCommand.command, [...npmCommand.prefixArgs, '--version'])

  if (result.status !== 0) {
    throw new Error('npm is not available')
  }

  ok(`npm ${result.stdout.trim()}`)
}

function checkDockerAccess(compose) {
  if (!compose.command) {
    throw new Error(`Docker Compose is not available${compose.error ? `\n${compose.error}` : ''}`)
  }

  ok(`Compose command: ${compose.display}`)

  const infoResult = captureCommand('docker', ['info'])

  if (infoResult.status !== 0) {
    const detail = [infoResult.error?.message, infoResult.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`Docker is installed, but the daemon is not reachable by this user.${detail ? `\n${detail}` : ''}`)
  }

  ok('Docker daemon reachable')
}

function ensureDependencies(npmCommand, options) {
  const nodeModulesPath = path.join(repoRoot, 'node_modules')

  if (options.noInstall) {
    if (!existsSync(nodeModulesPath)) {
      warn('node_modules is missing and --no-install was set')
    } else {
      ok('node_modules exists')
    }
    return
  }

  if (!options.install && existsSync(nodeModulesPath)) {
    ok('node_modules exists')
    return
  }

  step('Install workspace dependencies')
  requireCommand(`${npmCommand.display} install`, npmCommand.command, [...npmCommand.prefixArgs, 'install'])
}

function prepareCustomNode(options) {
  if (options.skipPrepare) {
    info('Skipping custom n8n node preparation')
    return
  }

  step('Prepare custom n8n node')
  requireCommand('node scripts/prepare-n8n-custom-node.js', process.execPath, ['scripts/prepare-n8n-custom-node.js'])
}

function workflowIdFromWorkflow(workflow, index) {
  if (workflow.id) return workflow.id

  const webhookPath = workflow.nodes
    ?.map(node => node?.parameters?.path)
    .find(Boolean)

  const fallback = webhookPath || workflow.name || `workflow-${index + 1}`
  const id = String(fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return id || `workflow-${index + 1}`
}

function workflowWebhookPath(workflow) {
  return workflow.nodes
    ?.map(node => node?.parameters?.path)
    .find(Boolean)
}

function normalizedSearchValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function workflowMatches(workflow, target, sourcePath) {
  const sourceName = path.basename(sourcePath, path.extname(sourcePath))
  const normalizedTarget = normalizedSearchValue(target)
  const values = [
    workflow.name,
    workflow.id,
    workflowWebhookPath(workflow),
    sourceName
  ].map(normalizedSearchValue)

  return values.includes(normalizedTarget)
}

function workflowNames(workflows, sourcePath) {
  const sourceName = path.basename(sourcePath, path.extname(sourcePath))

  return workflows
    .map(workflow => workflow.name || workflow.id || workflowWebhookPath(workflow) || sourceName)
    .filter(Boolean)
}

function resolveWorkflowImportSourcePath(options) {
  if (options.workflowFile) return options.workflowFile

  const namedWorkflowFile = options.workflowName === defaultWorkflowImportName
    ? defaultWorkflowImportSourcePath
    : path.resolve(workflowsDir, `${options.workflowName}.json`)

  if (isInsideDirectory(namedWorkflowFile, workflowsDir) && existsSync(namedWorkflowFile)) {
    return namedWorkflowFile
  }

  return fallbackWorkflowImportSourcePath
}

function readWorkflowFixture(sourcePath) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing workflow fixture: ${path.relative(repoRoot, sourcePath)}`)
  }

  const parsed = JSON.parse(readFileSync(sourcePath, 'utf8'))

  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') return [parsed]

  throw new Error('Workflow fixture must be a JSON object or JSON array')
}

function selectWorkflowsForImport(workflows, options, sourcePath) {
  const selected = workflows.filter(workflow => workflowMatches(workflow, options.workflowName, sourcePath))

  if (selected.length > 0) return selected
  if (options.workflowFile && workflows.length === 1) return workflows

  const available = workflowNames(workflows, sourcePath)
  const availableText = available.length > 0 ? available.join(', ') : 'none'
  throw new Error(`Workflow "${options.workflowName}" was not found in ${path.relative(repoRoot, sourcePath)}. Available: ${availableText}`)
}

function writeWorkflowImportFile(options) {
  const sourcePath = resolveWorkflowImportSourcePath(options)
  const workflows = readWorkflowFixture(sourcePath)
  const selectedWorkflows = selectWorkflowsForImport(workflows, options, sourcePath)
  const normalizedWorkflows = selectedWorkflows.map((workflow, index) => ({
    ...workflow,
    id: workflowIdFromWorkflow(workflow, index),
    active: Boolean(workflow.active)
  }))

  writeFileSync(workflowImportHostPath, `${JSON.stringify(normalizedWorkflows, null, 2)}\n`)

  return {
    sourcePath,
    workflows: normalizedWorkflows
  }
}

function cleanupWorkflowImportFile() {
  if (existsSync(workflowImportHostPath)) {
    unlinkSync(workflowImportHostPath)
  }
}

function importDemoWorkflows(compose, composeFile, options) {
  if (options.skipWorkflowImport) {
    info('Skipping workflow import')
    return
  }

  step('Import n8n workflow')
  const importFile = writeWorkflowImportFile(options)
  const workflowNamesForLog = importFile.workflows.map(workflow => workflow.name || workflow.id).join(', ')
  info(`Import source: ${path.relative(repoRoot, importFile.sourcePath)}`)
  info(`Selected workflow: ${workflowNamesForLog}`)

  if (JSON.stringify(importFile.workflows).includes('$env.DISCORD_WEBHOOK_URL') && !process.env.DISCORD_WEBHOOK_URL) {
    warn('DISCORD_WEBHOOK_URL is not set. The workflow will import, but the Discord HTTP step needs that environment variable to execute.')
  }

  try {
    const actionArgs = ['exec', '-T', 'n8n', 'n8n', 'import:workflow', `--input=${workflowImportContainerPath}`]
    requireCommand(displayCompose(compose, composeFile, actionArgs), compose.command, composeArgs(compose, composeFile, actionArgs))
  } finally {
    cleanupWorkflowImportFile()
  }
}

function selectedComposeFile(options) {
  return options.plainN8n ? plainComposeFile : customComposeFile
}

function startN8n(compose, composeFile) {
  step('Start n8n')
  const args = composeArgs(compose, composeFile, ['up', '-d', 'n8n'])
  requireCommand(displayCompose(compose, composeFile, ['up', '-d', 'n8n']), compose.command, args)
}

function stopN8n(compose, composeFile) {
  step('Stop n8n')
  const args = composeArgs(compose, composeFile, ['down'])
  requireCommand(displayCompose(compose, composeFile, ['down']), compose.command, args)
}

function requestUrl(url, options = {}) {
  return new Promise(resolve => {
    const parsed = new URL(url)
    const client = parsed.protocol === 'https:' ? https : http
    const request = client.request(parsed, {
      method: 'GET',
      timeout: 2500,
      headers: options.headers || {}
    }, response => {
      response.resume()
      response.on('end', () => {
        resolve({ ok: true, status: response.statusCode || 0 })
      })
    })

    request.on('timeout', () => {
      request.destroy(new Error('timeout'))
    })

    request.on('error', error => {
      resolve({ ok: false, status: 0, error: error.message })
    })

    request.end()
  })
}

function acceptableStatus(status) {
  return status >= 200 && status < 500
}

async function waitForUrl(label, url, options = {}) {
  const deadline = Date.now() + (options.timeoutMs || 60000)
  let lastResult = null

  while (Date.now() < deadline) {
    const result = await requestUrl(url, options)
    lastResult = result

    const statusOk = options.expectedStatus
      ? result.status === options.expectedStatus
      : acceptableStatus(result.status)

    if (result.ok && statusOk) {
      ok(`${label}: ${url} returned ${result.status}`)
      return result
    }

    await new Promise(resolve => setTimeout(resolve, options.intervalMs || 1500))
  }

  const detail = lastResult?.error || `last status ${lastResult?.status || 'none'}`
  throw new Error(`${label} did not become reachable at ${url}: ${detail}`)
}

function spawnCap(npmCommand) {
  step('Start CAP demo app')
  printCommand(`${npmCommand.display} run cap:serve`)

  const child = spawn(npmCommand.command, [...npmCommand.prefixArgs, 'run', 'cap:serve'], {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  child.stdout.on('data', chunk => {
    process.stdout.write(`[cap] ${chunk}`)
  })

  child.stderr.on('data', chunk => {
    process.stderr.write(`[cap] ${chunk}`)
  })

  child.on('error', error => {
    failMessage(`CAP failed to start: ${error.message}`)
  })

  child.on('exit', code => {
    const pidFilePresent = existsSync(capPidFile)
    clearCapPid(child.pid)

    if (code !== null && code !== 0 && pidFilePresent) {
      failMessage(`CAP exited with code ${code}`)
    }
  })

  writeCapPid(child)
  return child
}

function stopChild(child) {
  if (!child || child.killed) return

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
}

function writeCapPid(child) {
  mkdirSync(runtimeDir, { recursive: true })
  writeFileSync(capPidFile, `${child.pid}\n`)
}

function clearCapPid(pid) {
  if (!existsSync(capPidFile)) return

  const savedPid = readFileSync(capPidFile, 'utf8').trim()

  if (!pid || savedPid === String(pid)) {
    unlinkSync(capPidFile)
  }
}

function stopCapFromPidFile() {
  if (!existsSync(capPidFile)) {
    info('No CAP PID file found')
    return
  }

  const pid = Number(readFileSync(capPidFile, 'utf8').trim())

  if (!Number.isInteger(pid) || pid <= 0) {
    warn(`Ignoring invalid CAP PID file: ${capPidFile}`)
    unlinkSync(capPidFile)
    return
  }

  info(`Stopping CAP process from PID file: ${pid}`)

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' })
  } else {
    try {
      process.kill(pid, 'SIGTERM')
    } catch (error) {
      warn(`Could not stop CAP PID ${pid}: ${error.message}`)
    }
  }

  clearCapPid(pid)
}

async function openUrl(url) {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
  } else if (process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
  }
}

async function runCheck(options, npmCommand, compose, composeFile) {
  step('Prerequisite checks')
  checkGitState()
  checkNodeVersion()
  checkNpm(npmCommand)
  ensureDependencies(npmCommand, { ...options, noInstall: true })

  if (!options.skipPrepare && !options.plainN8n) {
    const shapeResult = captureCommand(process.execPath, ['scripts/prepare-n8n-custom-node.js', '--check'])

    if (shapeResult.status !== 0) {
      throw new Error(`Custom node source shape check failed\n${shapeResult.stderr || shapeResult.stdout}`)
    }

    ok('Custom node source shape')
  }

  if (!options.skipN8n) {
    checkDockerAccess(compose)
  }

  ok('Preflight checks completed')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return 0
  }

  const npmCommand = resolveNpmCommand()
  const composeFile = selectedComposeFile(options)
  const compose = resolveComposeCommand()
  let capProcess = null
  let n8nStarted = false

  log('CAP n8n agent startup routine')
  info(`Repo: ${repoRoot}`)
  info(`n8n profile: ${composeFile}`)

  if (options.stop) {
    if (!compose.command) {
      throw new Error('Cannot stop n8n because Docker Compose is not available')
    }
    stopCapFromPidFile()
    stopN8n(compose, composeFile)
    return 0
  }

  if (options.check) {
    await runCheck(options, npmCommand, compose, composeFile)
    return 0
  }

  step('Prerequisite checks')
  checkGitState()
  checkNodeVersion()
  checkNpm(npmCommand)
  ensureDependencies(npmCommand, options)

  prepareCustomNode(options)

  if (!options.skipN8n) {
    let n8nReady = false

    try {
      checkDockerAccess(compose)
      startN8n(compose, composeFile)
      n8nStarted = true
      await waitForUrl('n8n health', `${defaultN8nUrl}/healthz`, {
        timeoutMs: 90000,
        expectedStatus: 200
      })
      await waitForUrl('n8n UI', defaultN8nUrl, {
        timeoutMs: 30000,
        expectedStatus: 200
      })
      n8nReady = true
    } catch (error) {
      if (options.strict) throw error
      warn(error.message)
      warn('Continuing with CAP startup. Start n8n manually after fixing Docker access.')
    }

    if (n8nReady) {
      importDemoWorkflows(compose, composeFile, options)
    }
  } else {
    info('Skipping n8n startup')
  }

  if (!options.skipCap) {
    const adminMetadata = `${defaultCapUrl}/odata/v4/admin/$metadata`
    const catalogMetadata = `${defaultCapUrl}/odata/v4/catalog/$metadata`
    const existingAdmin = await requestUrl(adminMetadata, { headers: localAdminAuthHeaders })
    const existingCatalog = await requestUrl(catalogMetadata)

    if (existingAdmin.ok && existingCatalog.ok && existingAdmin.status === 200 && existingCatalog.status === 200) {
      ok(`CAP already reachable at ${defaultCapUrl}`)
    } else {
      capProcess = spawnCap(npmCommand)
      await waitForUrl('CAP admin metadata', adminMetadata, {
        timeoutMs: 90000,
        expectedStatus: 200,
        headers: localAdminAuthHeaders
      })
      await waitForUrl('CAP catalog metadata', catalogMetadata, {
        timeoutMs: 30000,
        expectedStatus: 200
      })
    }
  } else {
    info('Skipping CAP startup')
  }

  step('Ready')
  log(`CAP: ${defaultCapUrl}`)
  log(`n8n: ${defaultN8nUrl}`)

  if (n8nStarted && !options.plainN8n) {
    log('Custom n8n node package: n8n-nodes-sap-cap')
  }

  if (options.open) {
    await openUrl(defaultCapUrl)
    await openUrl(defaultN8nUrl)
  }

  if (!capProcess) {
    info('No CAP child process is attached. Startup command is complete.')
    return 0
  }

  log('')
  info('CAP is running in this terminal. Press Ctrl+C to stop CAP.')
  if (n8nStarted) {
    info(`Stop this local review app later with: npm run agent:startup -- --stop${options.plainN8n ? ' --plain-n8n' : ''}`)
  }

  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true
    log('')
    info('Stopping CAP process')
    stopChild(capProcess)
    clearCapPid(capProcess.pid)

    if (options.downOnExit && n8nStarted && compose.command) {
      try {
        stopN8n(compose, composeFile)
      } catch (error) {
        warn(error.message)
      }
    }
  }

  process.on('SIGINT', () => {
    shutdown().then(() => {
      process.exit(0)
    })
  })

  process.on('SIGTERM', () => {
    shutdown().then(() => {
      process.exit(0)
    })
  })

  await new Promise(resolve => {
    capProcess.on('exit', resolve)
  })

  return 0
}

main()
  .then(code => {
    process.exitCode = code
  })
  .catch(error => {
    failMessage(error.message)
    process.exitCode = 1
  })
