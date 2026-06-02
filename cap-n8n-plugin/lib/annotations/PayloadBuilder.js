const cds = require('@sap/cds')
const { createAnnotationError } = require('./AnnotationParser')
const { SELECT } = cds.ql

function ownValue(source, key) {
  if (!source || typeof source !== 'object') return undefined
  if (!Object.prototype.hasOwnProperty.call(source, key)) return undefined
  return source[key]
}

function hasOwnValue(source, key) {
  if (!source || typeof source !== 'object') return false
  return Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined
}

function keyNames(entity = {}) {
  return Object.entries(entity.elements || {})
    .filter(([, element]) => element?.key === true)
    .map(([name]) => name)
}

function valueFromParams(params, key) {
  if (!params) return undefined
  const candidates = Array.isArray(params) ? params : [params]

  for (const candidate of candidates) {
    const value = ownValue(candidate, key)
    if (value !== undefined) return value
  }
}

function resolveKeys(entity, data = {}, req = {}) {
  const keys = {}

  for (const key of keyNames(entity)) {
    if (hasOwnValue(data, key)) {
      keys[key] = data[key]
      continue
    }

    const paramValue = valueFromParams(req?.params, key)
    if (paramValue !== undefined) {
      keys[key] = paramValue
      continue
    }

    if (hasOwnValue(req?.data, key)) {
      keys[key] = req.data[key]
    }
  }

  return keys
}

function serviceName(service) {
  if (typeof service === 'string') return service
  return service?.name
}

function eventMetadata({ event, entity, service, keys, timestamp }) {
  const metadata = {
    name: event,
    entity: entity?.name,
    keys,
    timestamp: timestamp || new Date().toISOString()
  }

  const name = serviceName(service)
  if (name) metadata.service = name

  return metadata
}

function subjectObjectValue(subject, path) {
  if (!subject || typeof subject !== 'object') return undefined
  if (subject.SELECT) return undefined
  return ownValue(subject, path)
}

function subjectRunner(req) {
  if (!req || !req.subject?.SELECT) return undefined
  if (typeof req.run === 'function') return req
  const tx = cds.tx?.(req)
  return tx && typeof tx.run === 'function' ? tx : undefined
}

function readSubjectValue(path, req) {
  const directValue = subjectObjectValue(req?.subject, path)
  if (directValue !== undefined) return directValue

  const runner = subjectRunner(req)
  if (!runner) return undefined

  return runner
    .run(SELECT.one.from(req.subject).columns(path))
    .then((row) => row?.[path])
}

function isPromise(value) {
  return value && typeof value.then === 'function'
}

function resolveAnnotationValue({ value, data = {}, keys = {}, req } = {}) {
  const mapping = typeof value === 'string' ? { path: value } : value
  const path = mapping?.path

  if (!path) {
    throw createAnnotationError('n8n workflow annotation value requires a scalar path.', {
      field: 'value'
    })
  }

  if (mapping.key && hasOwnValue(keys, path)) return keys[path]
  if (hasOwnValue(data, path)) return data[path]

  return readSubjectValue(path, req)
}

function appendEvent(payload, metadata) {
  payload.event = metadata
  return payload
}

function buildMappedPayload({ annotation, data, keys, req }) {
  const payload = {}
  const pending = []

  for (const [name, mapping] of Object.entries(annotation.inputs || {})) {
    const resolved = resolveAnnotationValue({
      value: mapping,
      data,
      keys,
      req
    })

    if (isPromise(resolved)) {
      pending.push(resolved.then((value) => {
        payload[name] = value
      }))
    } else {
      payload[name] = resolved
    }
  }

  return pending.length > 0
    ? Promise.all(pending).then(() => payload)
    : payload
}

function buildKeyPayload(keys) {
  return { ...keys }
}

function buildStartPayload({
  annotation,
  event,
  entity,
  service,
  data = {},
  req,
  timestamp
} = {}) {
  if (!annotation || typeof annotation !== 'object') {
    throw createAnnotationError('n8n workflow start payload requires a parsed annotation.', {
      field: 'annotation'
    })
  }

  const keys = resolveKeys(entity, data, req)
  const metadata = eventMetadata({
    event,
    entity,
    service,
    keys,
    timestamp
  })
  const payload = annotation.inputs
    ? buildMappedPayload({ annotation, data, keys, req })
    : buildKeyPayload(keys)

  return isPromise(payload)
    ? payload.then((resolved) => appendEvent(resolved, metadata))
    : appendEvent(payload, metadata)
}

module.exports = {
  buildStartPayload,
  resolveAnnotationValue,
  resolveKeys
}
