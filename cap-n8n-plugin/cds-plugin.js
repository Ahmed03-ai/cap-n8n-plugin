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

  // Mark n8n as an external (required-only) service so `cds serve` does NOT
  // instantiate it as a generic provider and cache it in cds.services['n8n'].
  // Without this, the served generic ApplicationService (which has no start())
  // shadows our kind-based impl, causing `n8n.start is not a function` when an
  // annotation handler calls cds.connect.to('n8n'). With external:true, serve
  // skips it and the factory's remote branch resolves o.impl (webhook/mock).
  if (n8nConfig.external === undefined) {
    n8nConfig.external = true;
  }

  if (!n8nConfig.model) {
    // Load BOTH the entity model (index.cds) and the service definition
    // (n8n-service.cds). The service must live in its own .cds file with no
    // sibling .js so CAP's factory falls through to the kind-based impl
    // (webhook vs. mock) instead of auto-binding index.js via _sibling().
    n8nConfig.model = [
      require.resolve('./index.cds'),
      require.resolve('./n8n-service.cds'),
    ];
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

function isPersistenceService(srv) {
  // Annotation handlers belong on the served application services only. The
  // database service exposes the same entities, so registering there makes a
  // single OData write fire each handler twice (once on the app service, once
  // as it propagates to the db layer) — e.g. cancel runs twice and the second
  // pass logs a spurious "no active executions matched" after the first already
  // cancelled. Skip the persistence layer to keep handlers firing exactly once.
  if (srv === cds.db) return true;
  return Boolean(cds.DatabaseService && srv instanceof cds.DatabaseService);
}

cds.on('served', (services) => {
  for (const srv of servedServices(services)) {
    if (isPersistenceService(srv)) continue;
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
