const cds = require('@sap/cds')
const { readWorkflowAnnotations } = require('./AnnotationParser')
const { evaluateCondition } = require('./ConditionEvaluator')
const {
  buildStartPayload,
  resolveAnnotationValue,
  resolveKeys
} = require('./PayloadBuilder')
const { cancelMatchingExecutions } = require('./CancellationResolver')

const REGISTERED = Symbol.for('cap-n8n-plugin.annotations.registered')

function asArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value[Symbol.iterator] === 'function') return [...value]
  return Object.values(value)
}

function runtimeData(data) {
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
}

function serviceName(srv) {
  return srv?.name
}

function metadataFor({ annotation, event, entity, srv, businessKey, err }) {
  const metadata = {
    workflowId: annotation.workflowId,
    event,
    entity: entity?.name,
    service: serviceName(srv),
    businessKey,
    tag: annotation.tag
  }

  if (err) {
    metadata.reason = err.message
    if (err.code) metadata.code = err.code
    if (err.statusCode) metadata.statusCode = err.statusCode
  }

  return metadata
}

async function resolveBusinessKey({ annotation, data, keys, req }) {
  if (!annotation.businessKey) return undefined

  const value = await resolveAnnotationValue({
    value: annotation.businessKey,
    data,
    keys,
    req
  })

  if (value === undefined || value === null) return undefined
  return String(value)
}

async function shouldStart(annotation, data) {
  if (!annotation.condition) return true
  return evaluateCondition(annotation.condition, data)
}

async function runStartHandler({ srv, entity, annotation, event, data, req }) {
  const currentData = runtimeData(data)
  const keys = resolveKeys(entity, currentData, req)
  const businessKey = await resolveBusinessKey({
    annotation,
    data: currentData,
    keys,
    req
  })

  if (!await shouldStart(annotation, currentData)) {
    cds.log('n8n').info('Skipped annotated n8n workflow start because condition evaluated false', metadataFor({
      annotation,
      event,
      entity,
      srv,
      businessKey
    }))
    return
  }

  const payload = await buildStartPayload({
    annotation,
    event,
    entity,
    service: srv,
    data: currentData,
    req
  })
  const n8n = await cds.connect.to('n8n')

  await n8n.start(annotation.workflowId, payload, {
    businessKey,
    tag: annotation.tag,
    bestEffort: true,
    _req: req
  })
}

async function runCancelHandler({ srv, entity, annotation, event, data, req }) {
  const currentData = runtimeData(data)
  const keys = resolveKeys(entity, currentData, req)
  const businessKey = await resolveBusinessKey({
    annotation,
    data: currentData,
    keys,
    req
  })
  const n8n = await cds.connect.to('n8n')
  const result = await cancelMatchingExecutions(n8n, {
    workflowId: annotation.workflowId,
    businessKey,
    tag: annotation.tag
  })

  if (result.noMatch) {
    cds.log('n8n').warn('No active n8n executions matched annotated cancellation', metadataFor({
      annotation,
      event,
      entity,
      srv,
      businessKey
    }))
  }

  return result
}

function registerStartHandler(srv, entity, annotation, event) {
  srv.after(event, entity, async (data, req) => {
    let businessKey

    try {
      const currentData = runtimeData(data)
      const keys = resolveKeys(entity, currentData, req)
      businessKey = await resolveBusinessKey({
        annotation,
        data: currentData,
        keys,
        req
      })

      await runStartHandler({
        srv,
        entity,
        annotation,
        event,
        data,
        req
      })
    } catch (err) {
      cds.log('n8n').error('Annotated n8n workflow start failed', metadataFor({
        annotation,
        event,
        entity,
        srv,
        businessKey,
        err
      }))
    }
  })
}

function registerCancelHandler(srv, entity, annotation, event) {
  srv.after(event, entity, async (data, req) => {
    let businessKey

    try {
      const currentData = runtimeData(data)
      const keys = resolveKeys(entity, currentData, req)
      businessKey = await resolveBusinessKey({
        annotation,
        data: currentData,
        keys,
        req
      })

      await runCancelHandler({
        srv,
        entity,
        annotation,
        event,
        data,
        req
      })
    } catch (err) {
      cds.log('n8n').error('Annotated n8n workflow cancellation failed', metadataFor({
        annotation,
        event,
        entity,
        srv,
        businessKey,
        err
      }))
    }
  })
}

function registerEntityAnnotations(srv, entity) {
  const annotations = readWorkflowAnnotations(entity, { entity })
  let count = 0

  if (annotations.start) {
    for (const event of annotations.start.on) {
      registerStartHandler(srv, entity, annotations.start, event)
      count += 1
    }
  }

  if (annotations.cancel) {
    for (const event of annotations.cancel.on) {
      registerCancelHandler(srv, entity, annotations.cancel, event)
      count += 1
    }
  }

  return count
}

function registerN8nAnnotations(srv) {
  if (!srv || srv[REGISTERED]) return srv

  let count = 0
  for (const entity of asArray(srv.entities)) {
    count += registerEntityAnnotations(srv, entity)
  }

  Object.defineProperty(srv, REGISTERED, {
    value: true,
    enumerable: false
  })

  if (count > 0) {
    cds.log('n8n').info('Registered annotated n8n workflow handlers', {
      service: serviceName(srv),
      handlers: count
    })
  }

  return srv
}

module.exports = {
  registerN8nAnnotations
}
