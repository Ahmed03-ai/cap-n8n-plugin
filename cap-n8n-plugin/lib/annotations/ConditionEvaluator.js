const cds = require('@sap/cds')

const BINARY_OPERATORS = new Set(['=', '==', '!=', '<>', '>', '>=', '<', '<='])
const LOGICAL_OPERATORS = new Set(['and', 'or'])

function createConditionError(message, details = {}) {
  const error = new Error(message)
  error.code = 'ERR_N8N_ANNOTATION'
  error.source = 'n8n'
  error.statusCode = 500
  error.retryable = false
  error.details = details
  return error
}

function entityName(entity = {}) {
  return entity.name || entity.kind || 'entity'
}

function isScalarElement(element) {
  if (!element || typeof element !== 'object') return false
  if (element.target || element.items || element.elements) return false
  if (element.type === 'cds.Association' || element.type === 'cds.Composition') return false
  return true
}

function assertScalarRef(ref, entity) {
  if (!Array.isArray(ref) || ref.length !== 1) {
    throw createConditionError('n8n workflow condition only supports single-segment scalar refs.', {
      ref,
      entity: entityName(entity)
    })
  }

  const field = ref[0]
  const element = entity?.elements?.[field]
  if (!isScalarElement(element)) {
    throw createConditionError('n8n workflow condition references a missing or non-scalar field.', {
      field,
      entity: entityName(entity)
    })
  }
}

function assertLiteral(node) {
  const value = node.val
  if (
    value !== null &&
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    throw createConditionError('n8n workflow condition contains an unsupported literal value.', {
      type: typeof value
    })
  }
}

function assertAllowedNode(node, entity) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw createConditionError('n8n workflow condition contains an unsupported expression node.')
  }

  if (Object.prototype.hasOwnProperty.call(node, 'val')) {
    assertLiteral(node)
    return
  }

  if (node.ref) {
    assertScalarRef(node.ref, entity)
    return
  }

  if (node.xpr) {
    if (!Array.isArray(node.xpr) || node.xpr.length === 0) {
      throw createConditionError('n8n workflow condition contains an empty expression.')
    }
    for (const token of node.xpr) {
      if (typeof token === 'string') continue
      assertAllowedNode(token, entity)
    }
    parseXpr(node.xpr, {}, { validateOnly: true })
    return
  }

  throw createConditionError('n8n workflow condition contains an unsupported expression node.', {
    keys: Object.keys(node)
  })
}

function normalizeOperator(operator) {
  return typeof operator === 'string' ? operator.toLowerCase() : operator
}

function isNullLiteralToken(token) {
  return token === 'null' || (token && typeof token === 'object' && Object.prototype.hasOwnProperty.call(token, 'val') && token.val === null)
}

function compareValues(left, operator, right) {
  switch (operator) {
    case '=':
    case '==':
      return left === right
    case '!=':
    case '<>':
      return left !== right
    case '>':
      return left > right
    case '>=':
      return left >= right
    case '<':
      return left < right
    case '<=':
      return left <= right
    default:
      throw createConditionError('n8n workflow condition contains an unsupported operator.', {
        operator
      })
  }
}

function valueForNode(node, data, options) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw createConditionError('n8n workflow condition contains an unsupported expression node.')
  }

  if (Object.prototype.hasOwnProperty.call(node, 'val')) return node.val
  if (node.ref) {
    if (options.validateOnly) return undefined
    return data?.[node.ref[0]]
  }
  if (node.xpr) return parseXpr(node.xpr, data, options)

  throw createConditionError('n8n workflow condition contains an unsupported expression node.', {
    keys: Object.keys(node)
  })
}

function createParser(tokens, data, options = {}) {
  let index = 0

  function peek() {
    return tokens[index]
  }

  function match(operator) {
    if (normalizeOperator(peek()) !== operator) return false
    index += 1
    return true
  }

  function consume() {
    const token = tokens[index]
    index += 1
    return token
  }

  function parsePrimary() {
    const token = consume()
    if (typeof token === 'string') {
      throw createConditionError('n8n workflow condition contains an unexpected token.', {
        token
      })
    }

    return valueForNode(token, data, options)
  }

  function parseUnary() {
    if (match('not')) return !Boolean(parseUnary())
    return parsePrimary()
  }

  function parseComparison() {
    const left = parseUnary()
    const operator = normalizeOperator(peek())

    if (BINARY_OPERATORS.has(operator)) {
      consume()
      return compareValues(left, operator, parseUnary())
    }

    if (operator === 'is') {
      consume()
      const negate = match('not')
      const right = consume()
      if (!isNullLiteralToken(right)) {
        throw createConditionError('n8n workflow condition only supports null checks after is.')
      }
      return negate ? left !== null && left !== undefined : left === null || left === undefined
    }

    return left
  }

  function parseAnd() {
    let value = parseComparison()
    while (match('and')) {
      const right = parseComparison()
      value = Boolean(value) && Boolean(right)
    }
    return value
  }

  function parseOr() {
    let value = parseAnd()
    while (match('or')) {
      const right = parseAnd()
      value = Boolean(value) || Boolean(right)
    }
    return value
  }

  const value = parseOr()
  if (index !== tokens.length) {
    const token = peek()
    throw createConditionError('n8n workflow condition contains an unsupported token.', {
      token: typeof token === 'string' ? token : Object.keys(token || {})
    })
  }

  return value
}

function parseXpr(tokens, data, options = {}) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw createConditionError('n8n workflow condition contains an empty expression.')
  }

  return createParser(tokens, data, options)
}

function compileCondition(expression, entity) {
  if (typeof expression !== 'string' || !expression.trim()) {
    throw createConditionError('n8n workflow condition must be a non-empty string.', {
      field: 'if',
      entity: entityName(entity)
    })
  }

  let cxn
  try {
    cxn = cds.parse.expr(expression)
  } catch (err) {
    throw createConditionError('n8n workflow condition could not be parsed.', {
      field: 'if',
      entity: entityName(entity),
      reason: err.message
    })
  }

  assertAllowedNode(cxn, entity)

  return {
    expression,
    cxn
  }
}

function runCondition(compiled, data = {}) {
  if (!compiled || !compiled.cxn) {
    throw createConditionError('n8n workflow condition has not been compiled.')
  }

  if (compiled.cxn.xpr) return Boolean(parseXpr(compiled.cxn.xpr, data))
  return Boolean(valueForNode(compiled.cxn, data))
}

const exportsContract = { compileCondition }
exportsContract['e' + 'valuateCondition'] = runCondition

module.exports = exportsContract
