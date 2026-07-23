# Example Workflows

Ready-to-import n8n workflows you can use as a starting point. Import them through
**Import from File** in the n8n editor.

These are templates, not test fixtures. The shared fixtures used by the local development
loop (`npm run n8n:import` / `npm run n8n:export`) live in `test-workflows/`, which is
mounted into the n8n container.

## final_example_workflow.json

**Final Example Workflow**

This is the complete presentation workflow. A CAP Book event triggers AI description
enrichment, a low-stock Discord alert, three book recommendations, Open Library cover
lookup, and SAP CAP write-back operations. Before running it, configure the Google
Gemini credentials, the SAP CAP credential, and the Discord webhook URL in n8n.

## cap-stock-alert-discord-ai-cancellable.json

**CAP Stock Alert - Discord + AI (cancellable)**

Triggered by the CAP plugin when a book is created or updated. If stock is low it asks an
AI agent to compose a reorder message and posts it to Discord.

It also serves as a frame for testing cancellation: the webhook responds with the
execution ID and the workflow then waits, so a running execution exists that
`@n8n.workflow.cancel` can stop.

Before running it, add your own credentials to the **Google Gemini Chat Model** node and
set your Discord webhook URL on the **Send Discord Alert** node.

### Cancellation test setup

To test the cancellation feature end to end, the workflow response and CAP runtime must
be configured so CAP can remember the real n8n execution ID and later stop it when the
same Book is deleted.

1. In n8n, open the **CAP Book Event** Webhook node.
2. Set **Respond** to **Using 'Respond to Webhook' Node**.
3. Open the **Respond to Webhook** node.
4. Set **Respond With** to **JSON**.
5. Set the response body to return the running n8n execution ID:

   ```json
   {
     "executionId": "{{ $execution.id }}",
     "status": "running",
     "keepRunning": true
   }
   ```

   The response must evaluate to a real execution ID, for example:

   ```json
   {
     "executionId": "59",
     "status": "running",
     "keepRunning": true
   }
   ```

   If it returns the literal text `={{ $execution.id }}` or an empty body, CAP can start
   the workflow but cannot stop the real n8n execution.

6. Activate the workflow and use the production webhook path configured in the demo CAP
   annotation, usually:

   ```text
   http://localhost:5678/webhook/cap-test-trigger
   ```

   The n8n **Listen for test event** button arms the one-shot test URL
   `/webhook-test/cap-test-trigger`; the CAP demo annotation uses the production URL
   `/webhook/cap-test-trigger`.

7. Start CAP with cancellation enabled and an n8n API key. The n8n stop API requires the
   key in the `X-N8N-API-KEY` header.

   ```bash
   export N8N_API_KEY=<local-n8n-api-key>
   export CDS_CONFIG='{"requires":{"n8n":{"kind":"webhook","credentials":{"baseUrl":"http://localhost:5678","apiKey":"{env.N8N_API_KEY}"},"cancel":{"supported":true,"apiBaseUrl":"http://localhost:5678"}}}}'
   npm run cap:serve
   ```

8. Create a Book with `stock > 0` so `@n8n.workflow.start` runs:

   ```bash
   curl -X POST "http://localhost:3000/odata/v4/admin/Books" \
     -u "alice:" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -d '{"ID":881244,"IsActiveEntity":true,"title":"Manual Cancellation Book","descr":"Manual cancellation test","author_ID":101,"genre_ID":"10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","price":12.34,"stock":5}'
   ```

9. Delete the same Book ID to fire `@n8n.workflow.cancel`:

   ```bash
   curl -X DELETE "http://localhost:3000/odata/v4/admin/Books(ID=881244,IsActiveEntity=true)" \
     -u "alice:" \
     -H "If-Match: *" \
     -H "Accept: application/json"
   ```

Expected result: n8n first shows a running execution for the Book create event. After the
Book delete request, the same n8n execution changes to stopped/canceled.
