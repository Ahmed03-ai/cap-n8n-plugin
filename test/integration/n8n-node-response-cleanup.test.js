import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')
const n8nPackageDir = resolve(repoRoot, 'cap-n8n-node')

async function importResponseHelpers() {
  const modulePath = resolve(n8nPackageDir, 'dist/nodes/SapCap/ODataResponse.js')

  expect(existsSync(modulePath), 'ODataResponse helper should exist after n8n package build').toBe(true)
  return import(pathToFileURL(modulePath).href)
}

describe('n8n SAP CAP OData response cleanup helpers', () => {
  it('unwraps Query collection responses into cleaned n8n items', async () => {
    const { normalizeODataItems, stripODataMetadata } = await importResponseHelpers()
    const response = {
      '@odata.context': '$metadata#Books',
      value: [
        {
          '@odata.etag': 'W/"1"',
          ID: 201,
          title: 'Dune',
          stock: 7,
          available: true,
          author: {
            '@odata.id': 'Authors(101)',
            ID: 101,
            name: 'Frank Herbert',
          },
          tags: [
            {
              '@odata.type': '#AdminService.Tag',
              code: 'sci-fi',
            },
          ],
          nullable: null,
        },
        {
          ID: 202,
          title: 'Neuromancer',
          stock: 0,
        },
      ],
    }

    expect(stripODataMetadata(response.value[0])).toEqual({
      ID: 201,
      title: 'Dune',
      stock: 7,
      available: true,
      author: {
        ID: 101,
        name: 'Frank Herbert',
      },
      tags: [
        {
          code: 'sci-fi',
        },
      ],
      nullable: null,
    })
    expect(normalizeODataItems('query', response, 3)).toEqual([
      {
        json: {
          ID: 201,
          title: 'Dune',
          stock: 7,
          available: true,
          author: {
            ID: 101,
            name: 'Frank Herbert',
          },
          tags: [
            {
              code: 'sci-fi',
            },
          ],
          nullable: null,
        },
        pairedItem: { item: 3 },
      },
      {
        json: {
          ID: 202,
          title: 'Neuromancer',
          stock: 0,
        },
        pairedItem: { item: 3 },
      },
    ])
  })

  it('returns zero Query items for empty OData collections', async () => {
    const { normalizeODataItems } = await importResponseHelpers()

    expect(normalizeODataItems('query', { value: [] }, 0)).toEqual([])
  })

  it('normalizes Read entity responses into one cleaned n8n item', async () => {
    const { normalizeODataItems } = await importResponseHelpers()

    expect(normalizeODataItems('read', {
      '@odata.context': '$metadata#Books/$entity',
      ID: 201,
      title: 'Dune',
      metadataLikeField: '@odata.should-stay-as-value',
      details: {
        '@odata.mediaEtag': 'hidden',
        IsActiveEntity: true,
      },
    }, 1)).toEqual([
      {
        json: {
          ID: 201,
          title: 'Dune',
          metadataLikeField: '@odata.should-stay-as-value',
          details: {
            IsActiveEntity: true,
          },
        },
        pairedItem: { item: 1 },
      },
    ])
  })

  it('rejects unexpected Query and Read response shapes as responseShape errors', async () => {
    const helpers = await importResponseHelpers()
    const { normalizeODataItems } = helpers

    expect(helpers).not.toHaveProperty('normalizeRawODataResponse')
    expect(() => normalizeODataItems('query', { result: [] }, 0)).toThrowErrorMatchingObject({
      message: 'CAP response did not match the expected OData shape.',
      category: 'responseShape',
    })
    expect(() => normalizeODataItems('query', { value: {} }, 0)).toThrowErrorMatchingObject({
      message: 'CAP response did not match the expected OData shape.',
      category: 'responseShape',
    })
    expect(() => normalizeODataItems('read', [], 0)).toThrowErrorMatchingObject({
      message: 'CAP response did not match the expected OData shape.',
      category: 'responseShape',
    })
    expect(() => normalizeODataItems('read', null, 0)).toThrowErrorMatchingObject({
      message: 'CAP response did not match the expected OData shape.',
      category: 'responseShape',
    })
  })
})
