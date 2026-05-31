'use strict'

const packageJson = require('./package.json')

module.exports = {
  packageName: packageJson.name,
  nodes: packageJson.n8n.nodes,
  credentials: packageJson.n8n.credentials,
}
