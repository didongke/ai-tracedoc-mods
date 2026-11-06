# Contributing

Thanks for looking. This is a small, single-maintainer project; the most useful thing you can send is a precise report.

## Before you open an issue

Read the [English README](README.md) or [中文](README.zh-CN.md), and the limits below. Several "it did nothing" reports turn out to be one of these:

- **No backfill.** A turn that failed to be written is gone, and the ledger says so with `> ⚠ TraceDoc: a turn went unrecorded …`.
- **One session per project.** The ledger is read-modify-written as a whole, with no cross-process lock; two sessions at once overwrite each other. Recent versions warn you when they see a second one.
- **Only a person's questions.** A turn that is only a slash command records nothing.
- **Subagent rows are skipped.** The ledger follows the conversation you are in.
- **`.tracedoc-on` per project.** Without it, nothing is recorded — that is the switch (`/ai-tracedoc-mods:on` creates it).

## Reporting a bug

Open an issue with the bug template. It asks for the things nobody can guess:

- the plugin version: `/ai-tracedoc-mods:version`
- your Claude Code version: `claude --version`
- your OS
- what you expected, what happened, and the ledger or JSONL lines around it

The plugin's status file, `.tracedoc-mods-status.json`, lives in the plugin directory and is rewritten every turn. It is the first place to look for "why was nothing recorded": `counters` and `unreportedFailures` usually say. **Read it before you attach it** — it summarizes rows and keeps one sample per door.

## Questions and ideas

[Discussions](https://github.com/didongke/ai-tracedoc-mods/discussions) for "how do I…" and "would you…"; issues for defects. Both are read; neither comes with a response-time promise.

## Pull requests

Small, focused PRs are welcome. A test for a bug you found is the most valuable shape. Run the suite before you send:

```
node test/run.mjs hooks/tracedoc.js
```

It needs Node and nothing else. If you change the ledger's layout or the JSONL, say so in the PR — those files are the product.

## Security

Do not open a public issue for a security problem — see [SECURITY.md](SECURITY.md).
