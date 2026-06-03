const WORKFLOW_FIELDS = new Set(['name', 'nodes', 'connections', 'settings'])
const NODE_FIELDS = new Set(['id', 'name', 'type', 'typeVersion', 'position', 'parameters'])
const SETTINGS_FIELDS = new Set(['executionOrder'])
const UNSAFE_KEYS = new Set([
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'credential',
  'credentialid',
  'credentials',
  'headers',
  'owner',
  'owners',
  'project',
  'projectid',
  'shared',
  'pindata',
  'pinneddata',
  'staticdata',
  'requestbody',
  'responsebody',
  'stack',
  'meta',
  'versionid',
  'activeversionid',
  'versioncounter',
  'triggercount',
  'createdat',
  'updatedat',
  'versionmetadata',
  'tags'
])

const UNSAFE_STRING = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|(Bearer\s+\S+)|(api[_-]?key\s*[:=])/i

function normalizeKey(key) {
  return String(key).replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function pathName(parts) {
  return parts.join('.')
}

function addRemoved(removedPaths, parts) {
  const name = pathName(parts)
  if (name) removedPaths.add(name)
}

function sortedObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value

  const sorted = {}
  for (const key of Object.keys(value).sort()) {
    sorted[key] = value[key]
  }
  return sorted
}

function scrubValue(value, removedPaths, parts = []) {
  if (value === undefined) return undefined
  if (value === null) return null

  if (typeof value === 'string') {
    if (UNSAFE_STRING.test(value)) {
      addRemoved(removedPaths, parts)
      return undefined
    }
    return value
  }

  if (typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value
      .map((item, index) => scrubValue(item, removedPaths, parts.concat(String(index))))
      .filter((item) => item !== undefined)
  }

  const scrubbed = {}
  for (const key of Object.keys(value).sort()) {
    const normalized = normalizeKey(key)
    if (UNSAFE_KEYS.has(normalized)) {
      addRemoved(removedPaths, parts.concat(key))
      continue
    }

    const child = scrubValue(value[key], removedPaths, parts.concat(key))
    if (child !== undefined) scrubbed[key] = child
  }

  return scrubbed
}

function sanitizeNode(node, removedPaths, index) {
  const sanitized = {}

  for (const key of Object.keys(node || {}).sort()) {
    if (!NODE_FIELDS.has(key)) {
      addRemoved(removedPaths, ['nodes', String(index), key])
      continue
    }

    const value = key === 'parameters'
      ? scrubValue(node[key], removedPaths, ['nodes', String(index), key])
      : scrubValue(node[key], removedPaths, ['nodes', String(index), key])

    if (value !== undefined) sanitized[key] = value
  }

  return sanitized
}

function sanitizeSettings(settings, removedPaths) {
  const sanitized = {}

  for (const key of Object.keys(settings || {}).sort()) {
    if (!SETTINGS_FIELDS.has(key)) {
      addRemoved(removedPaths, ['settings', key])
      continue
    }

    const value = scrubValue(settings[key], removedPaths, ['settings', key])
    if (value !== undefined) sanitized[key] = value
  }

  return sanitized
}

function sanitizeWorkflow(workflow = {}) {
  const removedPaths = new Set()
  const sanitized = {}

  for (const key of Object.keys(workflow || {}).sort()) {
    if (!WORKFLOW_FIELDS.has(key)) {
      addRemoved(removedPaths, [key])
      continue
    }

    if (key === 'nodes') {
      sanitized.nodes = Array.isArray(workflow.nodes)
        ? workflow.nodes.map((node, index) => sanitizeNode(node, removedPaths, index))
        : []
      continue
    }

    if (key === 'settings') {
      const settings = sanitizeSettings(workflow.settings, removedPaths)
      if (Object.keys(settings).length) sanitized.settings = settings
      continue
    }

    const value = scrubValue(workflow[key], removedPaths, [key])
    if (value !== undefined) sanitized[key] = key === 'connections' ? sortedObject(value) : value
  }

  return {
    workflow: sortedObject(sanitized),
    removedPaths: Array.from(removedPaths).sort()
  }
}

module.exports = {
  sanitizeWorkflow
}
