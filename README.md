# cap-n8n-plugin

A CAP plugin that integrates n8n workflow automation into SAP CAP applications.

## Packages

- `cap-n8n-plugin/` — CAP plugin (CAP → n8n)
- `cap-n8n-node/` — n8n community node (n8n → CAP)
- `demo-app/` — Demo CAP application

## Getting Started

### Prerequisites

- Node.js v18+
- @sap/cds-dk
- Docker (for local n8n)

### Installation

npm install cap-n8n-plugin

### Local Development

1. **Start the local n8n instance**
   We use Docker Compose to spin up a local n8n instance for testing. This instance will store its database in the `.n8n-data/` folder (which is ignored by Git).

   ```bash
   docker-compose up -d
   ```

   _n8n will be available at [http://localhost:5678](http://localhost:5678)_.

2. **Run the CAP Application**
   ```bash
   npm install
   cd demo-app
   cds watch
   ```

   The demo app is configured to bind the n8n service explicitly through `demo-app/package.json`, so the CAP app can talk to the local n8n container without any extra manual service wiring.

### Testing the Workflow Trigger
We have set up a programmatic integration where creating a new Book in CAP notifies an n8n webhook.

1. Ensure n8n is running.
2. In the n8n UI, open the "cap-test-trigger" workflow and click "Test step" on the Webhook node, or ensure the workflow is active.
3. Use the `demo-app/test.http` file to send a `POST` request to CAP. The book ID is now generated automatically, so you do not need to include `ID` in the request body. **Tip:** The easiest way to trigger this request is by installing the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension in VS Code, which adds a "Send Request" button directly above the request in the file.
   Alternatively, use curl:
   ```bash
   curl -X POST http://localhost:3000/odata/v4/admin/Books \
   -H "Content-Type: application/json" \
   -H "Authorization: Basic YWxpY2U6" \
   -d '{"IsActiveEntity": true, "title": "My Curl Trigger Book", "author_ID": 101, "genre_ID": "10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "price": 25.50, "stock": 100}'
   ```
4. Check the n8n UI. You should see the webhook node light up with the event payload!

If you want to import the shared workflow into the local n8n instance, use `npm run n8n:import`. n8n may deactivate the workflow during import, so open it in the UI and activate it or start it in test mode before sending the CAP request.

### Sharing n8n Workflows with the Team

To prevent duplicated work, we store shared test workflows in the `test-workflows/` directory, which is committed to Git.

**To get the latest workflows (after pulling from Git):**
Run the following command to import the shared workflows into your local n8n instance:

```bash
npm run n8n:import
```

**To share a workflow you created or updated:**
Run the following command to export all your local workflows to the `test-workflows/` directory:

```bash
npm run n8n:export
```

_Don't forget to commit and push the updated `.json` files in `test-workflows/` to Git!_
