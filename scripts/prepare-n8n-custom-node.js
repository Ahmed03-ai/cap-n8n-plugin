#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const packageDir = path.join(repoRoot, 'cap-n8n-node')
const packageJsonPath = path.join(packageDir, 'package.json')
const reviewRoot = path.join(repoRoot, '.n8n-review-data')
const customDir = path.join(reviewRoot, 'custom')
const packageName = 'n8n-nodes-sap-cap'
const installedPackageDir = path.join(customDir, 'node_modules', packageName)
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function relative(file) {
  return path.relative(repoRoot, file).replace(/\\/g, '/')
}

function fail(message) {
  console.error(`[prepare-n8n-custom-node] ${message}`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const spawnCommand = process.platform === 'win32' && command === npmCommand ? 'cmd.exe' : command
  const spawnArgs = process.platform === 'win32' && command === npmCommand
    ? ['/d', '/s', '/c', command, ...args]
    : args
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: options.cwd || repoRoot,
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
    },
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })

  if (result.status !== 0) {
    const output = [result.error?.message, result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`${command} ${args.join(' ')} failed${output ? `\n${output}` : ''}`)
  }

  return result.stdout || ''
}

function ensureSourceShape() {
  if (!fs.existsSync(packageJsonPath)) {
    fail(`Missing ${relative(packageJsonPath)}`)
  }

  const packageJson = readJson(packageJsonPath)

  if (packageJson.name !== packageName) {
    fail(`Expected ${relative(packageJsonPath)} name to be ${packageName}`)
  }

  const nodeManifestPaths = packageJson.n8n?.nodes || []
  const credentialManifestPaths = packageJson.n8n?.credentials || []

  if (!nodeManifestPaths.includes('dist/nodes/SapCap/SapCap.node.js')) {
    fail('cap-n8n-node package manifest must include dist/nodes/SapCap/SapCap.node.js')
  }

  if (!credentialManifestPaths.includes('dist/credentials/SapCapApi.credentials.js')) {
    fail('cap-n8n-node package manifest must include dist/credentials/SapCapApi.credentials.js')
  }

  for (const sourceFile of [
    'nodes/SapCap/SapCap.node.ts',
    'credentials/SapCapApi.credentials.ts',
  ]) {
    const absoluteSource = path.join(packageDir, sourceFile)
    if (!fs.existsSync(absoluteSource)) {
      fail(`Missing ${relative(absoluteSource)}`)
    }
  }

  console.log(`[prepare-n8n-custom-node] Source package shape OK: ${packageName}`)
}

function ensureCustomPackageJson() {
  fs.mkdirSync(customDir, { recursive: true })

  const customPackageJsonPath = path.join(customDir, 'package.json')
  const customPackageJson = {
    name: 'cap-n8n-review-custom',
    private: true,
    description: 'Local n8n custom-node review profile for CAP n8n Integration',
  }

  fs.writeFileSync(customPackageJsonPath, `${JSON.stringify(customPackageJson, null, 2)}\n`)
  return customPackageJsonPath
}

function clearOldPacks() {
  if (!fs.existsSync(customDir)) return

  for (const entry of fs.readdirSync(customDir)) {
    if (entry.startsWith(`${packageName}-`) && entry.endsWith('.tgz')) {
      fs.unlinkSync(path.join(customDir, entry))
    }
  }
}

function packWorkspace() {
  clearOldPacks()

  const output = run(npmCommand, [
    'pack',
    '--workspace',
    packageName,
    '--pack-destination',
    customDir,
  ], { capture: true })
  const tarballName = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.endsWith('.tgz'))
    .pop()

  if (!tarballName) {
    fail('npm pack did not report a local tarball name')
  }

  const tarballPath = path.join(customDir, tarballName)

  if (!fs.existsSync(tarballPath)) {
    fail(`npm pack did not create ${relative(tarballPath)}`)
  }

  return tarballPath
}

function installPack(tarballPath) {
  console.log(`[prepare-n8n-custom-node] Running npm install for local tarball ${path.basename(tarballPath)}`)
  run(npmCommand, [
    'install',
    `./${path.basename(tarballPath)}`,
    '--save-exact',
    '--legacy-peer-deps',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
  ], { cwd: customDir })
}

function ensureInstallShape() {
  const packageJson = readJson(packageJsonPath)
  const installedPackageJsonPath = path.join(installedPackageDir, 'package.json')

  if (!fs.existsSync(installedPackageJsonPath)) {
    fail(`Missing installed package at ${relative(installedPackageDir)}`)
  }

  const installedPackageJson = readJson(installedPackageJsonPath)

  if (installedPackageJson.name !== packageName) {
    fail(`Installed package name mismatch in ${relative(installedPackageJsonPath)}`)
  }

  for (const manifestPath of [
    ...(packageJson.n8n?.nodes || []),
    ...(packageJson.n8n?.credentials || []),
  ]) {
    const installedManifestFile = path.join(installedPackageDir, manifestPath)

    if (!fs.existsSync(installedManifestFile)) {
      fail(`Missing installed manifest file ${relative(installedManifestFile)}`)
    }
  }

  console.log(`[prepare-n8n-custom-node] Installed package shape OK: ${relative(installedPackageDir)}`)
}

function prepare() {
  ensureSourceShape()
  ensureCustomPackageJson()
  run(npmCommand, ['run', 'build', '--workspace', packageName])
  const tarballPath = packWorkspace()
  installPack(tarballPath)
  ensureInstallShape()

  console.log('[prepare-n8n-custom-node] Start n8n with:')
  console.log('docker compose -f docker-compose.n8n-node.yml up -d n8n')
}

const args = process.argv.slice(2)

if (args.includes('--check')) {
  ensureSourceShape()
} else if (args.includes('--check-install-shape')) {
  ensureInstallShape()
} else {
  prepare()
}
