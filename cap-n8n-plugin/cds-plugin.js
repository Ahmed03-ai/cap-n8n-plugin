const cds = require('@sap/cds');
const { resolveN8nConfig } = require('./lib/config');

function ensureN8nConfig() {
  if (!cds.env.requires) cds.env.requires = {};
  if (!cds.env.requires.n8n) cds.env.requires.n8n = {};

  return cds.env.requires.n8n;
}

function implementationForKind(kind) {
  if (kind === 'mock') {
    return require.resolve('./lib/MockN8nWorkflowService.js');
  }

  return require.resolve('./lib/N8nWorkflowService.js');
}

function registerModel() {
  const n8nConfig = ensureN8nConfig();

  if (!n8nConfig.model) {
    n8nConfig.model = require.resolve('./index.cds');
  }

  return n8nConfig;
}

registerModel();

cds.once('bootstrap', () => {
  const n8nConfig = registerModel();
  if (n8nConfig.impl) {
    cds.log('n8n').info('cap-n8n-plugin loaded. Preserving explicit n8n service implementation.');
    return;
  }

  const resolvedConfig = resolveN8nConfig(n8nConfig);
  n8nConfig.kind = n8nConfig.kind || resolvedConfig.kind;
  n8nConfig.impl = implementationForKind(resolvedConfig.kind);

  cds.log('n8n').info(`cap-n8n-plugin loaded. Registered ${resolvedConfig.kind} n8n service implementation.`);
});
