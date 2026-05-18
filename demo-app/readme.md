# Demo App for cap-n8n-plugin

This is the SAP CAP `bookshop` sample application, customized to serve as a demo for the `cap-n8n-plugin`. 

It contains a standard domain model with relationships (Books, Authors, Genres) and pre-configured mock data, providing immediate triggers to demonstrate how the plugin exposes actions, triggers events, and maps data to n8n.

## Testing the Programmatic Webhook Trigger
An implementation of programmatic workflow triggering can be found in `srv/admin-service.js`.

Use the provided `test.http` file to quickly insert a valid Book and trigger the webhook test workflow in your local n8n instance. 

Consult the main project `README.md` at the root for more detailed setup instructions, including how to spin up n8n and sync workflows.
