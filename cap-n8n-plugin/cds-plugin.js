const cds = require('@sap/cds');
const { resolveN8nConfig } = require('./lib/config');
const { registerN8nAnnotations } = require('./lib/annotations/AnnotationRegistrar');

const BUILD_PLUGIN_ID = 'n8n-workflow-validation';
const BUILD_PLUGIN_REGISTERED = Symbol.for('cap-n8n-plugin.build-validation-registered');

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

function registerBuildPlugin() {
  if (!cds.build || typeof cds.build.register !== 'function') return;
  if (cds[BUILD_PLUGIN_REGISTERED]) return;

  const { BuildValidationPlugin } = require('./lib/workflows/BuildValidationPlugin');
  cds.build.register(BUILD_PLUGIN_ID, BuildValidationPlugin);
  cds[BUILD_PLUGIN_REGISTERED] = true;
}

registerBuildPlugin();

function servedServices(services) {
  if (!services) return [];
  if (Array.isArray(services)) return services;
  if (typeof services[Symbol.iterator] === 'function') return [...services];
  return Object.values(services);
}

cds.on('served', (services) => {
  for (const srv of servedServices(services)) {
    registerN8nAnnotations(srv);
  }
});

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
