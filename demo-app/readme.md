# Demo App for cap-n8n-plugin

This is the SAP CAP `bookshop` sample application, customized to serve as a demo for the `cap-n8n-plugin`. 

It contains a standard domain model with relationships (Books, Authors, Genres) and pre-configured mock data, providing immediate triggers to demonstrate how the plugin starts n8n workflows, tracks execution metadata, and maps scalar CAP data into n8n payloads.

## Testing the Annotation-Driven Webhook Trigger
The current demo trigger is declared in `srv/admin-service.cds` with `@n8n.workflow.start` and registered by the plugin at runtime. The old hard-coded service-handler trigger has been removed from `srv/admin-service.js`.

Use the provided `test.http` file to quickly insert a Book and trigger the webhook test workflow in your local n8n instance. The Book ID is generated automatically now, so you do not need to provide one manually.

The demo app binds the n8n service explicitly in `package.json` using `../cap-n8n-plugin/lib/N8nWorkflowService.js`, which is required for the CAP service to resolve the workflow trigger correctly.

Consult the main project `README.md` at the root for more detailed setup instructions, including how to spin up n8n and sync workflows.
