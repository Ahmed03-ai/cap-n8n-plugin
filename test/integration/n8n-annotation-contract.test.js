import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')
const {
  readWorkflowAnnotations,
  createAnnotationError
} = require('../../cap-n8n-plugin/lib/annotations/AnnotationParser.js')
const {
  compileCondition,
  evaluateCondition
} = require('../../cap-n8n-plugin/lib/annotations/ConditionEvaluator.js')

function payloadBuilder() {
  return require('../../cap-n8n-plugin/lib/annotations/PayloadBuilder.js')
}

function compileEntity(source, name = 'test.Books') {
  const csn = cds.compile.to.csn(source)
  return {
    name,
    ...csn.definitions[name]
  }
}

function annotationError() {
  return expect.objectContaining({
    code: 'ERR_N8N_ANNOTATION',
    source: 'n8n',
    statusCode: 500
  })
}

function bookEntity(extra = '') {
  return compileEntity(`
    namespace test;

    entity Authors {
      key ID : Integer;
      name : String;
    }

    entity Genres {
      key ID : Integer;
      children : Composition of many Genres on children.parent = $self;
      parent : Association to Genres;
    }

    entity Books {
      key ID : Integer;
      title : String;
      stock : Integer;
      archived : Boolean;
      author : Association to Authors;
      genre : Association to Genres;
    }

    ${extra}
  `)
}

describe('annotation parser contract', () => {
  it('D-01 D-03 reconstructs flattened start annotation keys into a structured config', () => {
    const entity = bookEntity(`
      annotate Books with @n8n.workflow.start: {
        workflowId: 'book-start',
        on: ['CREATE', 'UPDATE'],
        inputs: {
          bookId: 'ID',
          title: 'title'
        },
        businessKey: 'ID',
        tag: 'admin-books'
      };
    `)

    const annotations = readWorkflowAnnotations(entity, { entity })

    expect(annotations.start).toMatchObject({
      workflowId: 'book-start',
      on: ['CREATE', 'UPDATE'],
      inputs: {
        bookId: {
          path: 'ID',
          key: true
        },
        title: {
          path: 'title',
          key: false
        }
      },
      businessKey: {
        path: 'ID',
        key: true
      },
      tag: 'admin-books'
    })
  })

  it('D-05 D-19 reconstructs flattened cancel annotations and defaults missing cancel events to DELETE', () => {
    const entity = bookEntity(`
      annotate Books with @n8n.workflow.cancel: {
        workflowId: 'book-start',
        businessKey: 'ID',
        tag: 'admin-books'
      };
    `)

    const annotations = readWorkflowAnnotations(entity, { entity })

    expect(annotations.cancel).toMatchObject({
      workflowId: 'book-start',
      on: ['DELETE'],
      businessKey: {
        path: 'ID',
        key: true
      },
      tag: 'admin-books'
    })
  })

  it('D-04 accepts CREATE UPDATE DELETE event values and normalizes them to canonical uppercase', () => {
    const entity = bookEntity(`
      annotate Books with @n8n.workflow.start: {
        workflowId: 'book-start',
        on: ['create', 'UPDATE', 'delete']
      };
    `)

    expect(readWorkflowAnnotations(entity, { entity }).start.on).toEqual([
      'CREATE',
      'UPDATE',
      'DELETE'
    ])
  })

  it('D-04 rejects unsupported event values', () => {
    for (const event of ['PATCH', 'UPSERT']) {
      const entity = bookEntity(`
        annotate Books with @n8n.workflow.start: {
          workflowId: 'book-start',
          on: '${event}'
        };
      `)

      expect(() => readWorkflowAnnotations(entity, { entity })).toThrow(annotationError())
    }
  })

  it('D-02 rejects array or multi-start annotation shapes', () => {
    const arrayStart = {
      name: 'test.Books',
      elements: bookEntity().elements,
      '@n8n.workflow.start': [
        { workflowId: 'first', on: 'CREATE' },
        { workflowId: 'second', on: 'UPDATE' }
      ]
    }
    const indexedStart = {
      name: 'test.Books',
      elements: bookEntity().elements,
      '@n8n.workflow.start.0.workflowId': 'first',
      '@n8n.workflow.start.1.workflowId': 'second'
    }

    expect(() => readWorkflowAnnotations(arrayStart, { entity: arrayStart })).toThrow(annotationError())
    expect(() => readWorkflowAnnotations(indexedStart, { entity: indexedStart })).toThrow(annotationError())
  })

  it('D-11 D-12 D-13 rejects missing, association, composition, and multi-segment scalar mappings', () => {
    const entity = bookEntity()

    for (const inputs of [
      { missing: 'missingField' },
      { author: 'author' },
      { children: 'genre.children' },
      { nested: 'title.localized' }
    ]) {
      expect(() => readWorkflowAnnotations({
        ...entity,
        '@n8n.workflow.start.workflowId': 'book-start',
        '@n8n.workflow.start.on': 'CREATE',
        ...Object.fromEntries(
          Object.entries(inputs).map(([key, value]) => [`@n8n.workflow.start.inputs.${key}`, value])
        )
      }, { entity })).toThrow(annotationError())
    }
  })

  it('D-14 D-15 compiles and evaluates safe scalar condition strings', () => {
    const entity = bookEntity()
    const compiled = compileCondition('stock > 0 and title != null and not archived', entity)

    expect(evaluateCondition(compiled, {
      stock: 3,
      title: 'CAP',
      archived: false
    })).toBe(true)
    expect(evaluateCondition(compiled, {
      stock: 0,
      title: 'CAP',
      archived: false
    })).toBe(false)
  })

  it('D-14 D-15 rejects malformed condition strings and unsupported condition nodes', () => {
    const entity = bookEntity()

    for (const expression of [
      'stock >',
      'substring(title, 1, 2) = \'CA\'',
      'author.name = \'Ada\'',
      'exists author',
      'title like \'CAP%\''
    ]) {
      expect(() => compileCondition(expression, entity)).toThrow(annotationError())
    }
  })

  it('exports the typed annotation error helper', () => {
    expect(createAnnotationError('Invalid annotation', { field: 'workflowId' })).toMatchObject({
      code: 'ERR_N8N_ANNOTATION',
      source: 'n8n',
      statusCode: 500,
      details: {
        field: 'workflowId'
      }
    })
  })
})

describe('annotation payload contract', () => {
  it('D-06 D-08 D-10 D-11 builds mapped CREATE payloads with event metadata', () => {
    const { buildStartPayload } = payloadBuilder()
    const entity = bookEntity()
    const annotation = readWorkflowAnnotations({
      ...entity,
      '@n8n.workflow.start.workflowId': 'book-start',
      '@n8n.workflow.start.on': 'CREATE',
      '@n8n.workflow.start.inputs.bookId': 'ID',
      '@n8n.workflow.start.inputs.title': 'title'
    }, { entity }).start

    const payload = buildStartPayload({
      annotation,
      event: 'CREATE',
      entity,
      service: { name: 'AdminService' },
      data: { ID: 101, title: 'CAP with n8n', stock: 5 },
      timestamp: '2026-06-02T10:00:00.000Z'
    })

    expect(payload).toEqual({
      bookId: 101,
      title: 'CAP with n8n',
      event: {
        name: 'CREATE',
        entity: 'test.Books',
        service: 'AdminService',
        keys: { ID: 101 },
        timestamp: '2026-06-02T10:00:00.000Z'
      }
    })
  })

  it('D-06 D-08 builds UPDATE payloads from patch data and req.subject fallback without full rows', async () => {
    const { buildStartPayload } = payloadBuilder()
    const entity = bookEntity()
    const annotation = readWorkflowAnnotations({
      ...entity,
      '@n8n.workflow.start.workflowId': 'book-start',
      '@n8n.workflow.start.on': 'UPDATE',
      '@n8n.workflow.start.inputs.bookId': 'ID',
      '@n8n.workflow.start.inputs.title': 'title'
    }, { entity }).start
    const req = {
      subject: {
        ID: 102,
        title: 'Read from subject',
        stock: 7
      }
    }

    const payload = await buildStartPayload({
      annotation,
      event: 'UPDATE',
      entity,
      service: { name: 'AdminService' },
      data: { ID: 102, stock: 8 },
      req,
      timestamp: '2026-06-02T10:00:01.000Z'
    })

    expect(payload).toEqual({
      bookId: 102,
      title: 'Read from subject',
      event: {
        name: 'UPDATE',
        entity: 'test.Books',
        service: 'AdminService',
        keys: { ID: 102 },
        timestamp: '2026-06-02T10:00:01.000Z'
      }
    })
    expect(payload).not.toHaveProperty('stock')
  })

  it('D-06 D-08 omits full rows when inputs are absent and sends keys plus metadata', () => {
    const { buildStartPayload } = payloadBuilder()
    const entity = bookEntity()
    const annotation = readWorkflowAnnotations({
      ...entity,
      '@n8n.workflow.start.workflowId': 'book-start',
      '@n8n.workflow.start.on': 'CREATE'
    }, { entity }).start

    const payload = buildStartPayload({
      annotation,
      event: 'CREATE',
      entity,
      service: { name: 'AdminService' },
      data: { ID: 103, title: 'Not included', stock: 9 },
      timestamp: '2026-06-02T10:00:02.000Z'
    })

    expect(payload).toEqual({
      ID: 103,
      event: {
        name: 'CREATE',
        entity: 'test.Books',
        service: 'AdminService',
        keys: { ID: 103 },
        timestamp: '2026-06-02T10:00:02.000Z'
      }
    })
  })

  it('D-07 rejects DELETE non-key mappings and builds key-only DELETE payloads', () => {
    const { buildStartPayload } = payloadBuilder()
    const entity = bookEntity()

    expect(() => readWorkflowAnnotations({
      ...entity,
      '@n8n.workflow.start.workflowId': 'book-delete',
      '@n8n.workflow.start.on': 'DELETE',
      '@n8n.workflow.start.inputs.title': 'title'
    }, { entity })).toThrow(annotationError())

    const annotation = readWorkflowAnnotations({
      ...entity,
      '@n8n.workflow.start.workflowId': 'book-delete',
      '@n8n.workflow.start.on': 'DELETE',
      '@n8n.workflow.start.inputs.bookId': 'ID'
    }, { entity }).start
    const payload = buildStartPayload({
      annotation,
      event: 'DELETE',
      entity,
      service: 'AdminService',
      data: { ID: 104, title: 'Deleted title' },
      timestamp: '2026-06-02T10:00:03.000Z'
    })

    expect(payload).toEqual({
      bookId: 104,
      event: {
        name: 'DELETE',
        entity: 'test.Books',
        service: 'AdminService',
        keys: { ID: 104 },
        timestamp: '2026-06-02T10:00:03.000Z'
      }
    })
  })

  it('D-08 resolves keys and scalar annotation values for event metadata', () => {
    const { resolveAnnotationValue, resolveKeys } = payloadBuilder()
    const entity = bookEntity()
    const keys = resolveKeys(entity, { ID: 105 })

    expect(keys).toEqual({ ID: 105 })
    expect(resolveAnnotationValue({
      value: { path: 'ID', key: true },
      data: { ID: 105 },
      keys
    })).toBe(105)
  })
})
