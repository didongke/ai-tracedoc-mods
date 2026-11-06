# Security Policy

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** button on this repository's Security tab — [open a private advisory](https://github.com/didongke/ai-tracedoc-mods/security/advisories/new). Please do not open a public issue for a security problem.

You should hear back within a few days. This is a one-person project, so a fix can take longer; a report stays private until a fix ships.

## What this plugin does with your data

`hooks/tracedoc.js` is the whole implementation. It:

- makes **no network calls** of any kind — no telemetry, no crash reporting, no update check;
- writes only into the project it is recording (`<YYYYMMDD>-<project>-tracedoc.md`, its `.jsonl` twin, and `.tracedoc-on`) and into its own plugin directory (`.tracedoc-mods-status.json`);
- keeps its state in Claude Code's own store, under this plugin's identity.

**It records what you asked and what the model answered, verbatim.** A secret typed into a prompt ends up in the ledger — that is what a record is. Keep credentials out of prompts, and treat the ledger like any other log you would commit.

## Supported versions

Only the latest release is supported.
