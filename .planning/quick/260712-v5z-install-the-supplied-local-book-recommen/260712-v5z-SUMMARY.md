---
status: complete
---

# Quick Task 260712-v5z: Install the supplied local book recommendation workflow

## Result

Replaced the default startup fixture with the supplied book recommendation workflow at `test-workflows/stock update discord msg test workflow.json`.

The fixture is local and startup-ready:

- workflow name remains `stock update discord msg test workflow`
- it imports as active
- Discord requests read `DISCORD_WEBHOOK_URL` from the environment
- exported credential bindings, instance metadata, root workflow ID, and version metadata are removed

## Validation

- Parsed the fixture as JSON.
- Confirmed no direct Discord webhook URL, credential bindings, or instance metadata remain.
- Ran `npm.cmd run agent:startup -- --check` successfully.

## Commit

- `cf894ae` `chore(260712-v5z): install local book recommendation workflow`
