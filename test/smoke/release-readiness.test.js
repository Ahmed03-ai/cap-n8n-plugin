import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..', '..')
const packageJsonPath = resolve(repoRoot, 'package.json')
const reviewCommandPath = resolve(repoRoot, 'scripts', 'review-local.js')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readSource(path) {
  return readFileSync(path, 'utf8')
}

function regex(parts, flags = '') {
  return new RegExp(parts.join(''), flags)
}

const warningLabels = [
  'fix before release',
  'accepted tooling warning',
  'manual/UAT evidence required',
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
  regex(['s', 'k-[A-Za-z0-9]']),
  regex(['BE', 'GIN ', '.*', 'PRIVATE', ' KEY']),
  regex(['Authorization', ': Basic [A-Za-z0-9+/=]+']),
  regex(['Bearer ', '[A-Za-z0-9]']),
  regex(['N8N', '_API_KEY=.*[A-Za-z0-9]']),
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
})
