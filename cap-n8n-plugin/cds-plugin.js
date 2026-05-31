const cds = require('@sap/cds');
const { resolveN8nConfig } = require('./lib/config');

function implementationForKind(kind) {
  if (kind === 'mock') {
    return require.resolve('./lib/MockN8nWorkflowService.js');
  }

  return require.resolve('./lib/N8nWorkflowService.js');
}

cds.once('bootstrap', () => {
  if (!cds.env.requires) cds.env.requires = {};
  if (!cds.env.requires.n8n) cds.env.requires.n8n = {};

  const n8nConfig = cds.env.requires.n8n;
  if (n8nConfig.impl) {
    cds.log('n8n').info('cap-n8n-plugin loaded. Preserving explicit n8n service implementation.');
    return;
  }

  const resolvedConfig = resolveN8nConfig(n8nConfig);
  n8nConfig.kind = n8nConfig.kind || resolvedConfig.kind;
  n8nConfig.impl = implementationForKind(resolvedConfig.kind);

  cds.log('n8n').info(`cap-n8n-plugin loaded. Registered ${resolvedConfig.kind} n8n service implementation.`);
});
