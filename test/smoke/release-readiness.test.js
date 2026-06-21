import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..', '..')
const packageJsonPath = resolve(repoRoot, 'package.json')
const reviewCommandPath = resolve(repoRoot, 'scripts', 'review-local.js')
const readmePath = resolve(repoRoot, 'README.md')
const envExamplePath = resolve(repoRoot, '.env.example')
const btpGuidePath = resolve(repoRoot, 'docs', 'btp-deployment-guide.md')
const releaseReadinessPath = resolve(repoRoot, 'docs', 'release-readiness.md')
const manualShowcasePath = resolve(repoRoot, 'docs', 'manual-visual-showcase.md')
const localCustomNodePath = resolve(repoRoot, 'docs', 'local-n8n-custom-node-e2e.md')
const cloudN8nRunbookPath = resolve(repoRoot, 'docs', 'cloud-n8n-runbook.md')
const workflowFixturePath = resolve(repoRoot, 'test-workflows', 'workflows.json')
const cancellationFixturePath = resolve(repoRoot, 'test-workflows', 'cancellation-workflows.json')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readSource(path) {
  return readFileSync(path, 'utf8')
}

function regex(parts, flags = '') {
  return new RegExp(parts.join(''), flags)
}

function walkFiles(root, predicate = () => true) {
  if (!existsSync(root)) return []

  const current = statSync(root)
  if (!current.isDirectory()) return predicate(root) ? [root] : []

  return readdirSync(root).flatMap(entry => walkFiles(join(root, entry), predicate))
}

function envValue(source, key) {
  const match = source.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match ? match[1].trim() : undefined
}

const warningLabels = [
  'fix before release',
  'accepted tooling warning',
  'manual/UAT evidence required',
]

const evidenceStates = [
  'automated verified',
  'browser/manual verified',
  'manual UAT required',
]

const phase8Requirements = [
  'DOCS-01',
  'DOCS-02',
  'DOCS-03',
  'DOCS-04',
  'DOCS-05',
  'DOCS-06',
  'DOCS-07',
  'VERIFY-05',
  'VERIFY-06',
  'VERIFY-07',
]

const envGroups = [
  'CAP demo/mock',
  'local n8n webhook',
  'real n8n custom-node E2E',
  'cancellation stop API',
  'cloud n8n',
  'BTP advisory',
]

const envKeys = [
  'N8N_BASE_URL',
  'N8N_API_KEY',
  'N8N_CANCEL_SUPPORTED',
  'N8N_CANCEL_API_BASE_URL',
  'N8N_CANCEL_WORKFLOW_ID',
  'SAP_CAP_BASE_URL',
  'SAP_CAP_USERNAME',
  'SAP_CAP_PASSWORD',
  'N8N_REVIEW_USER',
  'N8N_REVIEW_PASSWORD',
  'N8N_CLOUD_BASE_URL',
  'N8N_CLOUD_API_KEY',
  'BTP_CAP_BASE_URL',
  'BTP_N8N_BASE_URL',
  'BTP_DESTINATION_NAME',
]

const deterministicChecks = [
  'npm test',
  'npm run n8n:workflow:validate -- --app demo-app',
  'node node_modules/@sap/cds-dk/bin/cds.js compile demo-app/db demo-app/srv demo-app/app demo-app/n8n --to csn',
]

const forbiddenReviewCommandPatterns = [
  regex(['docker', String.raw`\s+`, 'compose'], 'i'),
  regex(['n8n', ':', 'up'], 'i'),
  regex(['browser'], 'i'),
  regex(['screen', 'shot'], 'i'),
  regex(['login', String.raw`\s+`, 'password'], 'i'),
  regex(['dot', 'env'], 'i'),
  regex(['readFileSync', String.raw`\([^)]*`, String.raw`\.`, 'env'], 'i'),
  regex(['--', 'api-key'], 'i'),
  regex(['--', 'apikey'], 'i'),
]

const secretSourcePatterns = [
  regex(['gh', 'p_']),
  regex(['gh', 'o_']),
  regex(['github', '_pat_']),
  regex(['s', 'k-[A-Za-z0-9]{20,}']),
  regex(['BE', 'GIN ', '.*', 'PRIVATE', ' KEY']),
  regex(['Authorization', ': Basic [A-Za-z0-9+/=]{12,}']),
  regex(['Bearer ', '[A-Za-z0-9._-]{16,}']),
  regex(['N8N', '_API_KEY=[A-Za-z0-9]']),
]

const personalMetadataPatterns = [
  regex(['workflow', ':', 'owner'], 'i'),
  regex(['g', 'mail', String.raw`\.`, 'com'], 'i'),
]

describe('release readiness smoke gates', () => {
  it('exposes review:local through the root package script', () => {
    const packageJson = readJson(packageJsonPath)

    expect(packageJson.scripts['review:local']).toBe('node scripts/review-local.js')
    expect(existsSync(reviewCommandPath)).toBe(true)
  })

  it('keeps review:local deterministic and inside the automated evidence boundary', () => {
    const source = readSource(reviewCommandPath)

    for (const command of deterministicChecks) {
      expect(source, `review command must name ${command}`).toContain(command)
    }

    for (const pattern of forbiddenReviewCommandPatterns) {
      expect(source, `review command must not match ${pattern}`).not.toMatch(pattern)
    }
  })

  it('keeps D-24 warning labels explicit', () => {
    const source = readSource(reviewCommandPath)

    for (const label of warningLabels) {
      expect(source).toContain(label)
    }

    expect(source).toContain('unclassified warning-like output')
    expect(source).toContain('return classified.unclassified.length === 0')
    expect(source).toContain('result.exitCode !== 0')
  })

  it('keeps release readiness sources free of literal credential material', () => {
    const sources = [
      packageJsonPath,
      reviewCommandPath,
      resolve(repoRoot, 'test', 'smoke', 'release-readiness.test.js'),
    ]

    for (const sourcePath of sources) {
      const source = readSource(sourcePath)

      for (const pattern of secretSourcePatterns) {
        expect(source, `${sourcePath} must not match ${pattern}`).not.toMatch(pattern)
      }
    }
  })

  it('keeps README as the Phase 8 entry point with focused docs and review command links', () => {
    const readme = readSource(readmePath)

    expect(readme).toContain('npm run review:local')
    expect(readme).toContain('.env.example')

    for (const doc of [
      'docs/manual-visual-showcase.md',
      'docs/local-n8n-custom-node-e2e.md',
      'docs/cloud-n8n-runbook.md',
      'docs/btp-deployment-guide.md',
      'docs/release-readiness.md',
    ]) {
      expect(readme, `README must link ${doc}`).toContain(doc)
    }

    expect(readme).toContain('manual UAT required')
    expect(readme).toContain('real n8n custom-node E2E')
    expect(readme).toContain('cancellation')
  })

  it('documents placeholder-only environment groups for every supported run path', () => {
    expect(existsSync(envExamplePath)).toBe(true)
    const envExample = readSource(envExamplePath)

    for (const group of envGroups) {
      expect(envExample, `.env.example must include ${group}`).toContain(group)
    }

    for (const key of envKeys) {
      expect(envExample, `.env.example must include ${key}`).toContain(`${key}=`)
    }

    for (const key of ['N8N_API_KEY', 'SAP_CAP_PASSWORD', 'N8N_REVIEW_USER', 'N8N_REVIEW_PASSWORD', 'N8N_CLOUD_API_KEY', 'BTP_DESTINATION_NAME']) {
      const value = envValue(envExample, key)
      expect(value, `${key} must use an empty or angle-bracket placeholder`).toMatch(/^$|^<[^>\r\n]+>$/)
    }

    expect(envValue(envExample, 'N8N_BASE_URL')).toBe('http://localhost:5678')
    expect(envValue(envExample, 'N8N_CANCEL_SUPPORTED')).toBe('false')
    expect(envValue(envExample, 'N8N_CANCEL_API_BASE_URL')).toBe('http://localhost:5678')
    expect(envValue(envExample, 'N8N_CANCEL_WORKFLOW_ID')).toBe('cap-cancel-stoppable')
    expect(envValue(envExample, 'SAP_CAP_BASE_URL')).toBe('http://host.docker.internal:3000')
    expect(envValue(envExample, 'SAP_CAP_USERNAME')).toBe('alice')
    expect(envValue(envExample, 'N8N_CLOUD_BASE_URL')).toBe('https://<your-n8n-host>')
    expect(envExample).toContain('credentials.baseUrl')
    expect(envExample).toContain('credentials.apiKey')
    expect(envValue(envExample, 'BTP_CAP_BASE_URL')).toBe('https://<cap-app-route>')
    expect(envValue(envExample, 'BTP_N8N_BASE_URL')).toBe('https://<n8n-route>')
  })

  it('maps Phase 8 requirements, evidence states, and DOCS-06 n8n story artifacts', () => {
    const releaseReadiness = readSource(releaseReadinessPath)

    for (const requirement of phase8Requirements) {
      expect(releaseReadiness, `release readiness must include ${requirement}`).toContain(requirement)
    }

    for (const state of evidenceStates) {
      expect(releaseReadiness).toContain(state)
    }

    expect(releaseReadiness).toContain('DOCS-06')
    expect(releaseReadiness).toContain('mockups/n8n-node-mockup.html')
    expect(releaseReadiness).toContain('test-workflows/workflows.json')
    expect(releaseReadiness).toContain('test-workflows/cancellation-workflows.json')
    expect(releaseReadiness).toContain('docs/local-n8n-custom-node-e2e.md')
    expect(releaseReadiness).toContain('docs/cloud-n8n-runbook.md')
    expect(releaseReadiness).toContain('docs/manual-visual-showcase.md')
    expect(releaseReadiness).toMatch(/Issue #(?:19|20|21|22|23|24|25|26|27)/)
    expect(releaseReadiness).toContain('GitHub project/user-story statuses move only after evidence is documented')
  })

  it('keeps BTP deployment guidance advisory and non-scaffolded', () => {
    const guide = readSource(btpGuidePath)

    for (const phrase of [
      'Cloud Foundry',
      'Kyma',
      'advisory',
      'no runtime validation',
      'credentials.baseUrl',
      'credentials.apiKey',
      'cancel.supported',
      'cancel.apiBaseUrl',
      'service binding',
      'destination',
      'webhook reachability',
    ]) {
      expect(guide).toContain(phrase)
    }

    expect(guide).not.toMatch(/Phase 8 (?:provides|adds|ships).*(?:mta\.yaml|Helm chart|Kyma descriptor|production Dockerfile)/i)
  })

  it('documents a concrete local CAP to cloud n8n run path', () => {
    const runbook = readSource(cloudN8nRunbookPath)

    expect(runbook).toContain('manual UAT')
    expect(runbook).toContain('CDS_CONFIG')
    expect(runbook).toContain('N8N_CLOUD_BASE_URL')
    expect(runbook).toContain('N8N_CLOUD_API_KEY')
    expect(runbook).toContain('credentials.baseUrl')
    expect(runbook).toContain('credentials.apiKey')
    expect(runbook).toContain('resolveN8nConfig')
    expect(runbook).toContain('npm run cap:serve')
    expect(runbook).toContain('webhook-test/cap-test-trigger')
    expect(runbook).toContain('http://localhost:3000/odata/v4/admin/Books')
    expect(runbook).toContain('Cloud n8n Trigger Book')
    expect(runbook).toContain('Remove-Item Env:CDS_CONFIG')
    expect(runbook).toContain('unset CDS_CONFIG')
  })

  it('keeps docs, env examples, cancellation fixtures, and review scripts free of real-looking secrets', () => {
    const sources = [
      readmePath,
      envExamplePath,
      ...walkFiles(resolve(repoRoot, 'docs'), file => file.endsWith('.md')),
      workflowFixturePath,
      cancellationFixturePath,
      resolve(repoRoot, 'scripts', 'review-local.js'),
      resolve(repoRoot, 'scripts', 'prepare-n8n-custom-node.js'),
      resolve(repoRoot, 'scripts', 'cancellation-showcase.js'),
    ]

    for (const sourcePath of sources) {
      const source = readSource(sourcePath)

      for (const pattern of secretSourcePatterns) {
        expect(source, `${sourcePath} must not match ${pattern}`).not.toMatch(pattern)
      }

      for (const pattern of personalMetadataPatterns) {
        expect(source, `${sourcePath} must not match ${pattern}`).not.toMatch(pattern)
      }

      expect(source, `${sourcePath} must not ingest .env files`).not.toMatch(/dotenv|readFile(?:Sync)?\([^)]*\.env|\.env\.local/i)
    }
  })

  it('keeps workflow fixtures free of n8n owner/project/shared metadata', () => {
    const fixtures = [
      readJson(workflowFixturePath),
      readJson(cancellationFixturePath),
    ]

    for (const fixture of fixtures) {
      const serialized = JSON.stringify(fixture).toLowerCase()

      for (const forbidden of ['workflow:owner', '"owner"', '"project"', '"shared"', '"pinData"', '"staticData"']) {
        expect(serialized).not.toContain(forbidden.toLowerCase())
      }
    }
  })

  it('keeps manual showcase linked to the focused Phase 8 docs', () => {
    const manual = readSource(manualShowcasePath)

    expect(manual).toContain('docs/local-n8n-custom-node-e2e.md')
    expect(manual).toContain('docs/cloud-n8n-runbook.md')
    expect(manual).toContain('docs/btp-deployment-guide.md')
    expect(manual).toContain('docs/release-readiness.md')
    expect(readSource(localCustomNodePath)).toContain('manual UAT required')
  })
})
