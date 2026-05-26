const cds = require('@sap/cds');

cds.once('bootstrap', () => {
  cds.log('n8n').info('cap-n8n-plugin loaded. Registering n8n service implementation.');
  
  if (!cds.env.requires) cds.env.requires = {};
  
  // Provide default configuration for n8n requires
  if (cds.env.requires.n8n) {
    if (!cds.env.requires.n8n.impl) {
      cds.env.requires.n8n.impl = require.resolve('./lib/N8nWorkflowService.js');
    }
  } else {
    // Even if not explicitly declared, we can register the default kind mapping
    cds.env.requires.n8n = {
      impl: require.resolve('./lib/N8nWorkflowService.js')
    };
  }
});
