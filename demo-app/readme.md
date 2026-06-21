# Demo App for cap-n8n-plugin

This is the SAP CAP `bookshop` sample application, customized to serve as a demo for the `cap-n8n-plugin`. 

It contains a standard domain model with relationships (Books, Authors, Genres) and pre-configured mock data, providing immediate triggers to demonstrate how the plugin starts n8n workflows, tracks execution metadata, and maps scalar CAP data into n8n payloads.

## Testing the Annotation-Driven Webhook Trigger
The current demo trigger is declared in `srv/admin-service.cds` with `@n8n.workflow.start` and registered by the plugin at runtime. The old hard-coded service-handler trigger has been removed from `srv/admin-service.js`.

Use the provided `test.http` file to quickly insert a Book and trigger the webhook test workflow in your local n8n instance. The Book ID is generated automatically now, so you do not need to provide one manually.

The demo app binds the n8n service explicitly in `package.json` using `../cap-n8n-plugin/lib/N8nWorkflowService.js`, which is required for the CAP service to resolve the workflow trigger correctly.

Consult the main project `README.md` at the root for more detailed setup instructions, including how to spin up n8n and sync workflows.

## Quick Test: Create a Book (PowerShell)

If you want a quick, copy-pasteable command to create a `Books` entry (and trigger the annotated n8n workflow), here are two PowerShell-friendly variants that work against the demo CAP server running on `http://localhost:3000`.

- Using `Invoke-RestMethod` (recommended):

```powershell
$BID = Get-Random
$body = @{
	ID = $BID
	IsActiveEntity = $true
	title = 'Demo Book'
	author_ID = 101
	genre_ID = '10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
	stock = 50
} | ConvertTo-Json -Depth 5
# CAP demo uses a local mocked user 'alice' with no password by default
$headers = @{ Authorization = 'Basic YWxpY2U6'; Accept = 'application/json' }
Invoke-RestMethod -Uri 'http://localhost:3000/odata/v4/admin/Books' -Method Post -Body $body -ContentType 'application/json' -Headers $headers
```

- Using `curl.exe` (PowerShell, ensure JSON string quoting is correct):

```powershell
$BID = Get-Random
$body = "{\"ID\":$BID,\"IsActiveEntity\":true,\"title\":\"Demo Book\",\"author_ID\":101,\"genre_ID\":\"10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\",\"stock\":50}"
curl.exe -X POST "http://localhost:3000/odata/v4/admin/Books" -u "alice:" -H "Content-Type: application/json" -H "Accept: application/json" -d $body
```

Notes:
- The `Accept: application/json` header ensures the server returns a JSON entity body.
- The demo CAP app accepts the local `alice` user with an empty password for convenience in the demo environment; the examples above show a Basic auth header or `-u "alice:"` usage.
- The `genre_ID` value must be a valid genre GUID present in the demo dataset (the demo includes sample genre IDs).

