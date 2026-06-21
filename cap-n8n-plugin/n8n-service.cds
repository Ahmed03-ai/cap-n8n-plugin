// Service definition for the n8n workflow runtime.
//
// This must live in its own .cds file (with no sibling .js) so that CAP's
// service factory does not auto-bind a co-located implementation via
// `_sibling(def)` and instead falls through to the kind-based `impl`
// configured in `cds.requires.n8n` (webhook vs. mock). The entity model lives
// in ./index.cds; keeping the service separate avoids the index.js sibling.
@protocol: 'none'
service n8n {}
