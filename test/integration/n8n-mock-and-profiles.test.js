import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')
const originalN8nConfig = cds.env.requires?.n8n

function loadConfig() {
  return require('../../cap-n8n-plugin/lib/config.js')
}

function configureMockN8n(options = {}) {
  cds.env.requires ??= {}
  cds.env.requires.n8n = {
    kind: 'mock',
    impl: require.resolve('../../cap-n8n-plugin/lib/MockN8nWorkflowService.js'),
    ...options
  }
}

async function resetN8nService() {
  try {
    await cds.disconnect('n8n')
  } catch (err) {
    // Service may not have been connected yet.
  }
  delete cds.services.n8n

  if (originalN8nConfig) {
    cds.env.requires.n8n = originalN8nConfig
  } else if (cds.env.requires) {
    delete cds.env.requires.n8n
  }
}

afterEach(async () => {
  await resetN8nService()
})

describe('n8n mock runtime and profile configuration', () => {
  it("resolves explicit kind: 'mock' without requiring webhook credentials", () => {
    const { resolveN8nConfig } = loadConfig()

    expect(resolveN8nConfig({ kind: 'mock' }, { NODE_ENV: 'production' })).toMatchObject({
      kind: 'mock'
    })
  })

  it("falls back to kind: 'mock' for development profiles without a baseUrl", () => {
    const { resolveN8nConfig } = loadConfig()

    expect(resolveN8nConfig({}, { CDS_ENV: 'development', NODE_ENV: 'production' })).toMatchObject({
      kind: 'mock'
    })
    expect(resolveN8nConfig({}, { NODE_ENV: 'test' })).toMatchObject({
      kind: 'mock'
    })
  })

  it("resolves kind: 'webhook' when a webhook baseUrl is configured", () => {
    const { resolveN8nConfig } = loadConfig()

    expect(resolveN8nConfig({
      kind: 'webhook',
      credentials: {
        baseUrl: 'http://localhost:5678'
      }
    }, { NODE_ENV: 'production' })).toMatchObject({
      kind: 'webhook',
      baseUrl: 'http://localhost:5678'
    })
  })

  it('does not require an apiKey when webhook baseUrl is present', () => {
    const { resolveN8nConfig } = loadConfig()

    const config = resolveN8nConfig({
      credentials: {
        baseUrl: 'http://localhost:5678'
      }
    }, { NODE_ENV: 'production' })

    expect(config).toMatchObject({
      kind: 'webhook',
      baseUrl: 'http://localhost:5678'
    })
    expect(config.apiKey).toBeUndefined()
  })

  it('throws a sanitized baseUrl error for production webhook mode without credentials', () => {
    const { resolveN8nConfig } = loadConfig()
    const secretApiKey = 'secret-api-key-value'

    expect(() => resolveN8nConfig({
      kind: 'webhook',
      credentials: {
        apiKey: secretApiKey
      }
    }, { NODE_ENV: 'production' })).toThrow(/baseUrl/)

    try {
      resolveN8nConfig({
        kind: 'webhook',
        credentials: {
          apiKey: secretApiKey
        }
      }, { NODE_ENV: 'production' })
    } catch (err) {
      expect(err.message).toContain('baseUrl')
      expect(err.message).not.toContain(secretApiKey)
      expect(err).toMatchObject({
        code: 'ERR_N8N_CONFIG',
        source: 'n8n'
      })
    }
  })
})

describe('MockN8nWorkflowService', () => {
  it('returns deterministic mock execution results and records start metadata', async () => {
    configureMockN8n()

    const n8n = await cds.connect.to('n8n')
    const result = await n8n.start(
      'cap-test-trigger',
      { event: 'BookCreated' },
      { correlationId: 'corr-1', businessKey: 'book-1' }
    )
    const sendResult = await n8n.send('start', {
      workflowId: 'webhook-test/debug-trigger',
      inputs: { event: 'Debug' },
      options: { businessKey: 'book-2' }
    })

    expect(result).toMatchObject({
      accepted: true,
      workflowId: 'cap-test-trigger',
      executionId: 'mock-exec-1',
      correlationId: 'corr-1',
      businessKey: 'book-1',
      mock: true
    })
    expect(sendResult).toMatchObject({
      accepted: true,
      workflowId: 'webhook-test/debug-trigger',
      executionId: 'mock-exec-2',
      businessKey: 'book-2',
      mock: true
    })
    expect(n8n.executions).toHaveLength(2)
    expect(n8n.executions[0]).toMatchObject({
      executionId: 'mock-exec-1',
      workflowId: 'cap-test-trigger',
      inputs: { event: 'BookCreated' },
      status: 'success',
      correlationId: 'corr-1',
      businessKey: 'book-1'
    })
    expect(n8n.executions[0].startedAt).toEqual(expect.any(String))
    expect(n8n.executions[0].finishedAt).toEqual(expect.any(String))
  })

  it('supports explicit opt-in mock failures without adding query or cancel APIs', async () => {
    configureMockN8n({
      mock: {
        failWorkflows: ['fail-me']
      }
    })

    const n8n = await cds.connect.to('n8n')

    await expect(n8n.start('ok-workflow', { event: 'BookCreated' })).resolves.toMatchObject({
      executionId: 'mock-exec-1',
      mock: true
    })
    await expect(n8n.start('fail-me', { secret: 'do-not-leak' })).rejects.toMatchObject({
      code: 'ERR_N8N_MOCK_FAILURE',
      source: 'n8n',
      mock: true
    })

    try {
      await n8n.start('fail-me', { secret: 'do-not-leak' })
    } catch (err) {
      expect(err.message).toContain('fail-me')
      expect(err.message).not.toContain('do-not-leak')
    }

    const MockN8nWorkflowService = require('../../cap-n8n-plugin/lib/MockN8nWorkflowService.js')
    expect(MockN8nWorkflowService.prototype).not.toHaveProperty('query')
    expect(MockN8nWorkflowService.prototype).not.toHaveProperty('cancel')
  })
})
