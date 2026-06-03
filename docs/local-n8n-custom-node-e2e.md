# Local n8n Custom-Node E2E Runbook

This runbook is the manual browser checklist for `VERIFY-07`: proving that a real local n8n editor/runtime loads the local `SAP CAP` community node and executes the Phase 7 node surface against the CAP demo app.

The setup is scripted; the proof is manual browser UAT. Docker Compose config does not prove custom-node loading, and the default `docker-compose.yml` starts plain local n8n without installing this repository's `cap-n8n-node` package. Use the isolated review profile in `docker-compose.n8n-node.yml` for this check.

Evidence state: `manual UAT required` until a reviewer completes the checklist.

## Scope

This checklist proves:

- The installed `SAP CAP` node is visible in the n8n node picker and credentials screen.
- `SAP CAP API` credentials save and Test Connection succeeds against `$metadata`.
- Metadata-backed entity and Action/Function options load.
- Query, Read, Create, Update, Delete, and Action/Function execute against the CAP demo app.
- Cleanup returns the local review profile to a stopped state.

It does not commit n8n owner/login values, CAP credentials, credential exports, API keys, OAuth client secrets, encoded Basic Auth headers, or screenshots.

## Prerequisites

- Node.js compatible with this workspace. The n8n node package declares `>=22.16 <25`.
- Docker Engine and Docker Compose.
- A free local port `3000` for CAP and `5678` for n8n.

Install dependencies from the repository root:

```bash
npm install
```

## Terminal 1: Start CAP

```bash
npm run cap:serve
```

Expected result:

- CAP starts on `http://localhost:3000`.
- Admin OData metadata is available at `http://localhost:3000/odata/v4/admin/$metadata`.
- Catalog OData metadata is available at `http://localhost:3000/odata/v4/catalog/$metadata`.

If the browser prompts for CAP demo credentials, use the local demo user:

```text
Username: alice
Password: leave empty
```

## Terminal 2: Stage The Local n8n Node And Start Review n8n

Build and install the local workspace package into the ignored review profile:

```bash
node scripts/prepare-n8n-custom-node.js
```

This creates `.n8n-review-data/custom/node_modules/n8n-nodes-sap-cap` from a local `npm pack` tarball. It does not run Docker, read `.env`, install the community node from the npm registry, or write credentials.

Start the isolated n8n review profile:

```bash
docker compose -f docker-compose.n8n-node.yml up -d n8n
```

Watch startup logs:

```bash
docker compose -f docker-compose.n8n-node.yml logs n8n
```

Expected log and filesystem evidence:

- n8n starts on `http://localhost:5678`.
- The compose service uses `N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom`.
- The local package exists at `.n8n-review-data/custom/node_modules/n8n-nodes-sap-cap`.

## Browser: Open n8n

Open:

```text
http://localhost:5678
```

If n8n asks for owner setup or login, enter transient local review values in the browser only. Do not write those values to `.env`, docs, fixtures, test files, or exported credentials.

## Step 1: Confirm Installed Node Visibility

Create a new workflow and open the node picker.

Expected result:

- Search for `SAP CAP`.
- The `SAP CAP` node appears in the node picker.
- Open the node and confirm the credentials selector references `SAP CAP API`.

Do not proceed to operation checks until this browser confirmation passes. Docker Compose config does not prove custom-node loading.

## Step 2: Create SAP CAP API Credentials

Create credentials named with any local-only label, for example:

```text
SAP CAP API - Local Review
```

Use these fields:

- Base URL: `http://host.docker.internal:3000`
- Authentication: `Basic Auth`
- Username: `alice`
- Password: leave empty for the local demo user
- Metadata Path: `/odata/v4/admin/$metadata`

On Linux, if `host.docker.internal` does not resolve from the n8n container, use a Docker host gateway address configured for your environment and record the URL in the evidence table.

Click Test Connection.

Expected result:

- The credential saves.
- Test Connection reports success against CAP `$metadata`.
- No real secret values are exported or committed.

## Step 3: Confirm Metadata-Backed Admin Options

Add or edit a `SAP CAP` node with the saved credential.

Use:

- Service Path: `/odata/v4/admin`
- Entity Set Source: `From Metadata`

Expected result:

- The metadata-backed Entity Set dropdown loads.
- `Books` is visible and selectable.

## Step 4: Query Books

Configure:

- Operation: `Query`
- Entity Set: `Books`
- Filter: `stock gt 0`
- Order By: `title asc`
- Select Fields: `ID,title,stock`
- Top: `5`
- Skip: `0`

Run the node.

Expected result:

- n8n returns one item per CAP Book row.
- Returned item JSON does not include raw `@odata.*` metadata fields.

## Step 5: Read One Book

Configure:

- Operation: `Read`
- Entity Set: `Books`
- Key Input: `Manual Key Predicate`
- Key Predicate: `ID=201,IsActiveEntity=true`

Run the node.

Expected result:

- n8n returns the selected Book.
- The request succeeds without exposing auth headers or credential values.

## Step 6: Create One Book

Configure:

- Operation: `Create`
- Entity Set: `Books`
- Body (JSON):

```json
{
  "IsActiveEntity": true,
  "title": "VERIFY-07 Created Book",
  "author_ID": 101,
  "genre_ID": "10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "price": 19.99,
  "stock": 25
}
```

Run the node.

Expected result:

- Create uses one `Body (JSON)` object.
- n8n returns the created CAP entity as one cleaned item.
- Record the returned `ID` if CAP assigns or changes it.

## Step 7: Update The Created Book

Configure:

- Operation: `Update`
- Entity Set: `Books`
- Key Input: `Manual Key Predicate`
- Key Predicate: use the created book key, for example `ID=<created-id>,IsActiveEntity=true`
- Body (JSON):

```json
{
  "price": 24.99,
  "stock": 30
}
```

Run the node.

Expected result:

- Update uses a key plus one `Body (JSON)` object.
- n8n returns the updated CAP entity as one cleaned item.

## Step 8: Delete The Created Book

Configure:

- Operation: `Delete`
- Entity Set: `Books`
- Key Input: `Manual Key Predicate`
- Key Predicate: use the created book key, for example `ID=<created-id>,IsActiveEntity=true`
- Body: none

Run the node.

Expected result:

- Delete uses the key with no request body.
- There is no extra confirmation checkbox.
- n8n returns a confirmation item with `deleted: true`.

## Step 9: Confirm Metadata-Backed Catalog Action/Function Options

Edit the `SAP CAP API` credential temporarily for Catalog metadata, or create a second local credential:

- Base URL: `http://host.docker.internal:3000`
- Authentication: `Basic Auth`
- Username: `alice`
- Password: leave empty
- Metadata Path: `/odata/v4/catalog/$metadata`

Configure the node:

- Service Path: `/odata/v4/catalog`
- Operation: `Action/Function`
- Operation Source: `From Metadata`

Expected result:

- Metadata-backed Action/Function options load.
- `submitOrder` is visible as an Action option.

## Step 10: Invoke Catalog submitOrder

Configure:

- Operation: `Action/Function`
- Operation Source: `From Metadata`
- Action/Function: `submitOrder`
- Parameters (JSON):

```json
{
  "book": 201,
  "quantity": 1
}
```

Run the node.

Expected result:

- Action/Function uses one `Parameters (JSON)` object.
- n8n returns one cleaned item from the Catalog action response.

## Troubleshooting

### SAP CAP Node Is Not In The Picker

Run:

```bash
node scripts/prepare-n8n-custom-node.js --check-install-shape
docker compose -f docker-compose.n8n-node.yml down
docker compose -f docker-compose.n8n-node.yml up -d n8n
docker compose -f docker-compose.n8n-node.yml logs n8n
```

Confirm `.n8n-review-data/custom/node_modules/n8n-nodes-sap-cap` contains `dist/nodes/SapCap/SapCap.node.js` and `dist/credentials/SapCapApi.credentials.js`.

### Test Connection Cannot Reach CAP

Check:

- `npm run cap:serve` is still running.
- Base URL is reachable from Docker n8n as `http://host.docker.internal:3000`.
- Linux host routing may require a gateway fallback instead of `host.docker.internal`.
- Metadata Path matches the service being tested: `/odata/v4/admin/$metadata` or `/odata/v4/catalog/$metadata`.

### Metadata Options Do Not Load

Check:

- The credential Test Connection passes first.
- Admin operations use `/odata/v4/admin` plus `/odata/v4/admin/$metadata`.
- Catalog Action/Function uses `/odata/v4/catalog` plus `/odata/v4/catalog/$metadata`.

### Operation Fails With Authorization Or Validation

Use placeholder-only local demo values. Do not paste committed Basic Auth headers, API keys, token values, OAuth secrets, or credential exports into this file.

For Admin Book examples, keep sample references valid:

```json
{
  "author_ID": 101,
  "genre_ID": "10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "price": 19.99,
  "stock": 25
}
```

## Cleanup

Stop n8n:

```bash
docker compose -f docker-compose.n8n-node.yml down
```

Leave `.n8n-review-data/` ignored. Delete it manually only when you intentionally want to reset the local review profile.

## Evidence Checklist

Keep evidence local to the reviewer or copy results into release-readiness tracking. Do not commit credential exports or screenshots with secrets.

| Evidence Field | Result |
|----------------|--------|
| Evidence state | `manual UAT required` |
| n8n URL opened |  |
| Visible node name in picker |  |
| Credentials screen shows SAP CAP API |  |
| Credential Test Connection result |  |
| Admin metadata-backed Entity Set options loaded |  |
| Query result |  |
| Read result for `ID=201,IsActiveEntity=true` |  |
| Create result using one Body (JSON) object |  |
| Update result using key plus one Body (JSON) object |  |
| Delete result using key with no body |  |
| Catalog metadata-backed Action/Function options loaded |  |
| Action/Function submitOrder result using one Parameters (JSON) object |  |
| Cleanup confirmation |  |
