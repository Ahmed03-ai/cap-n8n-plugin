import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import path from 'node:path'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')
const { ExecutionStore } = require('../../cap-n8n-plugin/lib/ExecutionStore.js')
const { createExecutionResult } = require('../../cap-n8n-plugin/lib/result.js')

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pluginModel = path.join(repoRoot, 'cap-n8n-plugin', 'index.cds')
const lifecycleStatuses = [
  'queued',
  'dispatching',
  'running',
  'succeeded',
  'failed',
  'cancel_requested',
  'cancelled',
  'unknown'
]
const firstClassFields = [
  'executionId',
  'correlationId',
  'workflowId',
  'status',
  'businessKey',
  'tag',
  'attempts',
  'createdAt',
  'startedAt',
  'finishedAt',
  'updatedAt'
]
const forbiddenPublicFields = [
  'inputs',
  'headers',
  'apiKey',
  'authorization',
  'payload',
  'request',
  'requestBody',
  'stack'
]

let db
let store

async function deployExecutionModel() {
  const csn = await cds.load(pluginModel)
  db = await cds.deploy(csn).to('sqlite::memory:')
  store = new ExecutionStore({
    db,
    sensitiveValues: ['configured-secret-value']
  })
}

async function selectOne(entity, where) {
  return db.run(SELECT.one.from(entity).where(where))
}

async function runNode(script) {
  return execFileAsync(process.execPath, ['-e', script], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  })
}

function expectUuid(value) {
  expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
}

function expectNoForbiddenFields(value) {
  if (!value || typeof value !== 'object') return

  for (const field of forbiddenPublicFields) {
    expect(value).not.toHaveProperty(field)
  }

  if (Array.isArray(value)) {
    for (const item of value) expectNoForbiddenFields(item)
    return
  }

  for (const child of Object.values(value)) {
    expectNoForbiddenFields(child)
  }
}

afterEach(async () => {
  if (db) {
    await cds.disconnect(db)
    db = undefined
    store = undefined
  }
})

describe('n8n execution store integration contract', () => {
  beforeEach(async () => {
    await deployExecutionModel()
  })

  it('creates queued executions with plugin-owned IDs and separate n8n IDs', async () => {
    const queued = await store.createQueued({
      workflowId: 'cap-test-trigger',
      n8nExecutionId: 'n8n-exec-123'
    })

    expectUuid(queued.executionId)
    expect(queued.executionId).not.toBe('n8n-exec-123')
    expect(queued).toMatchObject({
      n8nExecutionId: 'n8n-exec-123',
      workflowId: 'cap-test-trigger',
      status: 'queued',
      attempts: 0
    })

    const stored = await selectOne('cap.n8n.WorkflowExecutions', { executionId: queued.executionId })
    expect(stored).toMatchObject({
      executionId: queued.executionId,
      n8nExecutionId: 'n8n-exec-123'
    })

    const withoutExternalId = await store.createQueued({
      workflowId: 'no-external-id'
    })
    expect(withoutExternalId).not.toHaveProperty('n8nExecutionId')
  })

  it('returns first-class lifecycle fields and validates status transitions', async () => {
    const queued = await store.createQueued({
      workflowId: 'cap-test-trigger',
      correlationId: 'corr-1',
      businessKey: 'book-1',
      tag: 'admin-create'
    })

    const dispatching = await store.markDispatching(queued.executionId)
    const running = await store.markRunning(queued.executionId, { n8nExecutionId: 'n8n-exec-456' })
    const succeeded = await store.markSucceeded(queued.executionId, {
      result: { ok: true, executionId: 'n8n-exec-456' }
    })

    for (const field of firstClassFields) {
      expect(succeeded).toHaveProperty(field)
    }

    expect(dispatching.status).toBe('dispatching')
    expect(running.status).toBe('running')
    expect(running.startedAt).toEqual(expect.any(String))
    expect(succeeded).toMatchObject({
      executionId: queued.executionId,
      correlationId: 'corr-1',
      workflowId: 'cap-test-trigger',
      status: 'succeeded',
      businessKey: 'book-1',
      tag: 'admin-create',
      attempts: 0
    })
    expect(succeeded.finishedAt).toEqual(expect.any(String))
    expect(succeeded.updatedAt).toEqual(expect.any(String))

    await expect(store.updateStatus(queued.executionId, 'not-a-phase-3-status')).rejects.toMatchObject({
      code: 'ERR_N8N_EXECUTION_STATUS'
    })

    for (const status of lifecycleStatuses) {
      await expect(store.updateStatus(queued.executionId, status)).resolves.toMatchObject({ status })
    }
  })

  it('stores and returns sanitized result and error envelopes', async () => {
    const queued = await store.createQueued({
      workflowId: 'secret-workflow'
    })

    await store.saveResult(queued.executionId, {
      ok: true,
      apiKey: 'result-api-key',
      headers: { authorization: 'Bearer result-token' },
      requestBody: { secret: 'request-body-secret' },
      inputs: { customer: 'raw-input-secret' },
      payload: { nested: 'payload-secret' },
      message: 'configured-secret-value should be removed'
    })
    await store.saveError(queued.executionId, {
      source: 'n8n',
      statusCode: 500,
      retryable: false,
      code: 'ERR_N8N_HTTP_STATUS',
      message: 'n8n failed with configured-secret-value',
      details: {
        stack: 'stack trace should not be public',
        authorization: 'Bearer error-token',
        payload: { secret: 'error-payload-secret' },
        request: { body: 'raw request body' },
        response: {
          message: 'safe diagnostic'
        }
      }
    })

    const dto = await store.getExecution(queued.executionId)
    const serialized = JSON.stringify(dto)

    expect(dto).toHaveProperty('result')
    expect(dto).toHaveProperty('error')
    expectNoForbiddenFields(dto)
    expect(serialized).not.toContain('result-api-key')
    expect(serialized).not.toContain('result-token')
    expect(serialized).not.toContain('request-body-secret')
    expect(serialized).not.toContain('raw-input-secret')
    expect(serialized).not.toContain('payload-secret')
    expect(serialized).not.toContain('configured-secret-value')
    expect(serialized).not.toContain('stack trace should not be public')
    expect(serialized).not.toContain('error-token')
    expect(serialized).not.toContain('error-payload-secret')
    expect(serialized).not.toContain('raw request body')
    expect(dto.error.details.response).toEqual({ message: 'safe diagnostic' })
  })

  it('keeps internal dispatch payload storage out of public DTOs', async () => {
    const queued = await store.createQueued({
      workflowId: 'cap-test-trigger',
      correlationId: 'corr-dispatch-1',
      inputs: {
        event: 'BookCreated',
        secret: 'raw-dispatch-input-secret'
      },
      dispatch: {
        workflowPath: 'webhook/cap-test-trigger',
        payload: {
          event: 'BookCreated',
          secret: 'raw-dispatch-payload-secret'
        }
      }
    })

    const dispatch = await selectOne('cap.n8n.WorkflowDispatches', { executionId: queued.executionId })
    expect(dispatch).toMatchObject({
      executionId: queued.executionId,
      workflowId: 'cap-test-trigger',
      workflowPath: 'webhook/cap-test-trigger',
      status: 'queued'
    })
    expect(dispatch.payload).toContain('raw-dispatch-payload-secret')

    const dto = await store.getExecution(queued.executionId)
    const result = createExecutionResult(dto)
    const serialized = JSON.stringify(result)

    expectNoForbiddenFields(result)
    expect(serialized).not.toContain('raw-dispatch-input-secret')
    expect(serialized).not.toContain('raw-dispatch-payload-secret')
    expect(result).not.toHaveProperty('dispatch')
    expect(result).not.toHaveProperty('workflowPath')
  })
})

describe('n8n execution model integration contract', () => {
  it('loads the plugin-owned WorkflowExecutions model with first-class fields', async () => {
    const csn = await cds.load(pluginModel)
    const execution = csn.definitions['cap.n8n.WorkflowExecutions']
    const dispatch = csn.definitions['cap.n8n.WorkflowDispatches']

    expect(execution).toBeDefined()
    expect(dispatch).toBeDefined()
    expect(Object.keys(execution.elements)).toEqual(expect.arrayContaining([
      ...firstClassFields,
      'n8nExecutionId',
      'result',
      'error'
    ]))
    expect(execution.elements.executionId.key).toBe(true)
    expect(execution.elements.executionId.type).toBe('cds.UUID')
    expect(execution.elements.attempts.type).toBe('cds.Integer')
    expect(execution.elements.result.type).toBe('cds.LargeString')
    expect(execution.elements.error.type).toBe('cds.LargeString')
  })

  it('loads the consumer effective model with WorkflowExecutions after plugin activation', async () => {
    const script = `
      const path = require('path')
      const cds = require('@sap/cds')
      cds.root = path.resolve('demo-app')
      Promise.resolve(cds.plugins)
        .then(() => cds.load('*'))
        .then((csn) => {
          const execution = csn.definitions['cap.n8n.WorkflowExecutions']
          if (!execution) {
            console.error('cap.n8n.WorkflowExecutions missing from consumer model')
            process.exit(1)
          }
          const fields = ${JSON.stringify(firstClassFields)}
          for (const field of fields) {
            if (!execution.elements[field]) {
              console.error('missing field ' + field)
              process.exit(1)
            }
          }
        })
        .catch((err) => {
          console.error(err)
          process.exit(1)
        })
    `

    await expect(runNode(script)).resolves.toMatchObject({
      stderr: ''
    })
  })
})
