# Cloud n8n Runbook

This runbook shows how to run the local CAP demo app against a reachable cloud n8n webhook. It is manual UAT until a reviewer completes it against a real cloud n8n instance and records evidence.

Use this path when you want to keep CAP local on `http://localhost:3000` but send the CAP annotation webhook to a cloud n8n workflow.

## What This Proves

- The CAP plugin can use cloud n8n as the webhook runtime.
- `N8N_CLOUD_BASE_URL` maps to the supported `cds.requires.n8n.credentials.baseUrl` setting.
- `N8N_CLOUD_API_KEY` maps to the supported `cds.requires.n8n.credentials.apiKey` setting.
- Secrets remain in environment variables, not committed files.

## Prerequisites

- `npm install` has completed.
- The cloud n8n instance is reachable from your machine.
- You can create or edit a workflow in the cloud n8n UI.
- If your cloud n8n webhook requires an API key, create a local review key in n8n and keep it only in your shell.

## Cloud n8n Workflow Setup

In cloud n8n:

1. Create or import a workflow named `CAP n8n Test`.
2. Add a Webhook node.
3. Set the Webhook method to `POST`.
4. Set the Webhook path to `cap-test-trigger`.
5. For the existing demo annotation `workflowId: 'webhook-test/cap-test-trigger'`, put the Webhook node in test/listening mode before triggering CAP.
6. Keep the n8n browser tab open so you can see the request payload arrive.

Expected cloud webhook URL shape:

```text
https://<your-n8n-host>/webhook-test/cap-test-trigger
```

For an active production webhook, the URL shape is usually:

```text
https://<your-n8n-host>/webhook/cap-test-trigger
```

The checked-in demo annotation uses the test/listening path. Do not edit source files for this runbook.

## Configure Local CAP For Cloud n8n

The plugin reads standard CAP configuration from `cds.requires.n8n`. For this runbook, use `CDS_CONFIG` to override only the n8n binding at process start. The runtime resolves `{env.NAME}` placeholders in n8n credentials.

PowerShell:

```powershell
$env:N8N_CLOUD_BASE_URL = "https://<your-n8n-host>"
$env:N8N_CLOUD_API_KEY = "<cloud-n8n-api-key>"
$env:CDS_CONFIG = '{"requires":{"n8n":{"kind":"webhook","credentials":{"baseUrl":"{env.N8N_CLOUD_BASE_URL}","apiKey":"{env.N8N_CLOUD_API_KEY}"}}}}'
```

Bash:

```bash
export N8N_CLOUD_BASE_URL="https://<your-n8n-host>"
export N8N_CLOUD_API_KEY="<cloud-n8n-api-key>"
export CDS_CONFIG='{"requires":{"n8n":{"kind":"webhook","credentials":{"baseUrl":"{env.N8N_CLOUD_BASE_URL}","apiKey":"{env.N8N_CLOUD_API_KEY}"}}}}'
```

Verify the CAP runtime config resolves to the cloud values without printing the API key:

```bash
node -e "const cds=require('@sap/cds'); const {resolveN8nConfig}=require('./cap-n8n-plugin/lib/config'); const cfg=resolveN8nConfig(cds.env.requires.n8n, process.env); if(cfg.baseUrl!==process.env.N8N_CLOUD_BASE_URL) process.exit(1); if(!cfg.apiKey) process.exit(1); console.log('cloud n8n config resolved for ' + cfg.baseUrl)"
```

Expected result:

```text
cloud n8n config resolved for https://<your-n8n-host>
```

## Start CAP

In the same shell where `CDS_CONFIG` is set:

```bash
npm run cap:serve
```

Expected result:

- CAP starts on port `3000`.
- The n8n plugin logs webhook mode.
- No cloud API key value is printed.

## Trigger CAP And Verify Cloud n8n

Keep the cloud n8n Webhook node in test/listening mode, then trigger the demo annotation.

PowerShell:

```powershell
curl.exe -X POST "http://localhost:3000/odata/v4/admin/Books" `
  -H "Content-Type: application/json" `
  -H "Authorization: Basic <base64-demo-basic-auth>" `
  -d '{"ID":1022,"IsActiveEntity":true,"title":"Cloud n8n Trigger Book","author_ID":101,"genre_ID":"10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","price":25.50,"stock":100}'
```

Bash:

```bash
curl -X POST "http://localhost:3000/odata/v4/admin/Books" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic <base64-demo-basic-auth>" \
  -d '{"ID":1022,"IsActiveEntity":true,"title":"Cloud n8n Trigger Book","author_ID":101,"genre_ID":"10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","price":25.50,"stock":100}'
```

Expected CAP result:

- The create request succeeds.
- CAP records the book locally.

Expected cloud n8n result:

- The cloud n8n Webhook node receives one request.
- The visible payload contains `bookId: 1022` and `title: "Cloud n8n Trigger Book"`.
- The payload event metadata names `CREATE` and `AdminService.Books`.

Optional update proof:

```bash
curl -X PATCH "http://localhost:3000/odata/v4/admin/Books(ID=1022,IsActiveEntity=true)" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic <base64-demo-basic-auth>" \
  -d '{"stock":101}'
```

Expected cloud n8n result:

- The cloud n8n Webhook node receives a second request.
- The event metadata names `UPDATE`.

## Evidence To Record

Record the following in `docs/release-readiness.md` or project tracking before moving cloud n8n stories beyond `manual UAT required`:

- Cloud n8n base URL host, without API key.
- Workflow name and webhook path.
- CAP command used.
- CAP create/update result.
- Cloud n8n visible request payload.
- Cleanup result.

## Cleanup

PowerShell:

```powershell
Remove-Item Env:CDS_CONFIG -ErrorAction SilentlyContinue
Remove-Item Env:N8N_CLOUD_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:N8N_CLOUD_API_KEY -ErrorAction SilentlyContinue
```

Bash:

```bash
unset CDS_CONFIG
unset N8N_CLOUD_BASE_URL
unset N8N_CLOUD_API_KEY
```

Delete or deactivate the cloud n8n test workflow if it was created only for review.
