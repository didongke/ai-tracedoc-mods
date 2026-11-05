# ai-tracedoc

English | [中文](README.zh-CN.md)

Records every Claude Code Q&A in a project into a TraceDoc ledger.

It runs as a Claude Code **hooks module**.<br>
Each Q&A is written twice: a Markdown ledger for people, JSONL for machines.<br>
One source for Windows, Linux and macOS, run and tested on all three.

> Hit `400 … maximum context length` → quit → reopen a session → "read this project's `*-tracedoc*.jsonl` and carry on"<br>
> → the new session says what was done and what is next, by itself.

## Value

1. **Picking up where it stopped.** Work is not finished when it stops — the context ceiling, another machine, handing it to someone else — and carrying on needs no re-explaining.

   - **The context ceiling:** the API answers `400 … maximum context length`. Open a new session, tell it to read the project's `*-tracedoc*.jsonl`, and it picks the work up itself.
   - **Another machine:** half done on the office desktop, commit, `git pull` at home, and the record arrives with the code — carry on.
   - **A handover:** whoever opens the project reads the record, or hands it to an AI, and can continue — no handover document, no meeting.

2. **Turning the process into a data asset.** One JSONL line per Q&A, all timestamped: a complete record of how the AI and you built this, with plenty to get out of it — for example, where it kept stalling, which problems are the same root cause, which questions were the least efficient.

## What is recorded

Only the questions a person writes, and the model's final answer.

The model's working is not recorded — no tool output, no thinking, and none of the engine's notices, system-reminder blocks, tool results or other sessions' messages.

## Install

Requires Claude Code ≥ 2.1.287.
Lower versions do not load hooks modules — installed, it records nothing.
Check: `claude --version`

```
/plugin marketplace add https://github.com/didongke/ai-tracedoc-mods
/plugin install ai-tracedoc-mods@ai-tracedoc-mods
```

Prefer the full HTTPS URL; the `didongke/ai-tracedoc-mods` shorthand clones over SSH, which needs GitHub's host key already trusted.<br>
After installing, the grey line under the tabs in `/plugin` should read `1 mod active · ai-tracedoc-mods`.

### Update

```
/plugin marketplace update ai-tracedoc-mods
/reload-plugins
```

## Use

| Command | What it does |
| --- | --- |
| `/ai-tracedoc-mods:on` | Start recording (creates `.tracedoc-on`) |
| `/ai-tracedoc-mods:off` | Stop recording (deletes `.tracedoc-on`) |
| `/ai-tracedoc-mods:version` | Show the version |

In a project that is not recording, **every start of Claude Code** shows `/ai-tracedoc-mods:on` in the top-right corner (`claude -c` included); it clears itself after 3 seconds. `/reload-plugins` shows it once more — the hook cannot tell a start from a reload, and would rather say it twice.

A Q&A is written to **two** files in the project root:

```
<YYYYMMDD>-<project>-tracedoc.md     the ledger, for people
<YYYYMMDD>-<project>-tracedoc.jsonl  one line per Q&A, for machines
```

Past 200 KiB, a new session opens a new volume `-02.md`; the JSONL follows under the same name, and the old volume ends with a `Continued in:` link.

> **Note: do not run two Claude Code sessions in the same project at once.** The ledger is read-modify-written as a whole, with no cross-process lock — two sessions writing at the same time overwrite each other, and entries are lost.

### One entry in the ledger

The label has its own line; the text starts on the next.

```
**Question:** 2026-10-15 09:26:07
what the question was

**Answer:**
the answer and its conclusion
```

### One line of JSONL

```json
{"time":"2026-10-15T09:26:07+08:00","question":"…","answer":"…"}
```

- `time` is the moment the question was asked.
- Written as-is, not escaped to `\uXXXX`; newlines and quotes follow JSON's rules, so a long entry is still one line.
- No header row; history starts at the first entry recorded after installing.

## Uninstall

Uninstalling leaves `.tracedoc-on`, `*-tracedoc*.md` and `*-tracedoc*.jsonl` in the project directory — delete them if you do not want them. `.tracedoc-mods-status.json` lives in the plugin directory and goes with the plugin.
