const { ACTIVE_STATUSES } = require('../ExecutionStore')

const DEFAULT_PAGE_LIMIT = 100

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function createCancellationError(message, details = {}) {
  const error = new Error(message)
  error.code = 'ERR_N8N_ANNOTATION'
  error.source = 'n8n'
  error.statusCode = 500
  error.retryable = false
  error.details = details
  return error
}

function normalizeWorkflowId(workflowId) {
  if (typeof workflowId !== 'string' || !workflowId.trim()) {
    throw createCancellationError('n8n workflow cancellation requires a non-empty workflowId.', {
      field: 'workflowId'
    })
  }

  return workflowId.trim()
}

function normalizePageLimit(pageLimit) {
  const limit = Number(pageLimit || DEFAULT_PAGE_LIMIT)
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_PAGE_LIMIT
  return Math.trunc(limit)
}

function matchingFilters({ workflowId, businessKey, tag, status }) {
  const filters = {
    workflowId,
    status
  }

  if (hasValue(businessKey)) filters.businessKey = String(businessKey)
  if (hasValue(tag)) filters.tag = String(tag)

  return filters
}

function requireMatchMetadata({ businessKey, tag }) {
  if (hasValue(businessKey) || hasValue(tag)) return

  throw createCancellationError('n8n workflow cancellation requires businessKey or tag match metadata.', {
    fields: ['businessKey', 'tag']
  })
}

function addMatches(matches, items = []) {
  for (const item of items) {
    if (!item?.executionId) continue
    matches.set(item.executionId, {
      executionId: item.executionId,
      workflowId: item.workflowId,
      status: item.status,
      businessKey: item.businessKey,
      tag: item.tag
    })
  }
}

async function queryStatusMatches(n8n, baseFilters, status, pageLimit, matches) {
  let offset = 0

  while (true) {
    const result = await n8n.queryExecutions(matchingFilters({
      ...baseFilters,
      status
    }), {
      limit: pageLimit,
      offset
    })

    addMatches(matches, result?.items)

    if (!result?.pageInfo?.hasMore) return

    const nextOffset = Number(result.pageInfo.nextOffset)
    if (!Number.isFinite(nextOffset) || nextOffset <= offset) return
    offset = nextOffset
  }
}

async function cancelMatches(n8n, matches) {
  const results = []

  for (const executionId of matches.keys()) {
    results.push(await n8n.cancel(executionId))
  }

  return results
}

async function cancelMatchingExecutions(n8n, options = {}) {
  if (!n8n || typeof n8n.queryExecutions !== 'function' || typeof n8n.cancel !== 'function') {
    throw createCancellationError('n8n workflow cancellation requires queryExecutions and cancel APIs.', {
      field: 'n8n'
    })
  }

  const workflowId = normalizeWorkflowId(options.workflowId)
  const businessKey = hasValue(options.businessKey) ? String(options.businessKey) : undefined
  const tag = hasValue(options.tag) ? String(options.tag) : undefined
  requireMatchMetadata({ businessKey, tag })

  const pageLimit = normalizePageLimit(options.pageLimit)
  const matches = new Map()
  const baseFilters = {
    workflowId,
    businessKey,
    tag
  }

  for (const status of ACTIVE_STATUSES) {
    await queryStatusMatches(n8n, baseFilters, status, pageLimit, matches)
  }

  if (matches.size === 0) {
    return {
      workflowId,
      businessKey,
      tag,
      matchedCount: 0,
      cancelledCount: 0,
      noMatch: true,
      executionIds: []
    }
  }

  const results = await cancelMatches(n8n, matches)

  return {
    workflowId,
    businessKey,
    tag,
    matchedCount: matches.size,
    cancelledCount: results.length,
    noMatch: false,
    executionIds: [...matches.keys()],
    results
  }
}

module.exports = {
  cancelMatchingExecutions
}
