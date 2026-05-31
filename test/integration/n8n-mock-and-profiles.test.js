import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function loadConfig() {
  return require('../../cap-n8n-plugin/lib/config.js')
}

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
