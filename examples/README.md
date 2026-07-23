# Example Workflows

Ready-to-import n8n workflows you can use as a starting point. Import them through
**Import from File** in the n8n editor.

These are templates, not test fixtures. The shared fixtures used by the local development
loop (`npm run n8n:import` / `npm run n8n:export`) live in `test-workflows/`, which is
mounted into the n8n container.

## cap-stock-alert-discord-ai-cancellable.json

**CAP Stock Alert - Discord + AI (cancellable)**

Triggered by the CAP plugin when a book is created or updated. If stock is low it asks an
AI agent to compose a reorder message and posts it to Discord.

It also serves as a frame for testing cancellation: the webhook responds with the
execution ID and the workflow then waits, so a running execution exists that
`@n8n.workflow.cancel` can stop.

Before running it, add your own credentials to the **Google Gemini Chat Model** node and
set your Discord webhook URL on the **Send Discord Alert** node.
