# Roadmap

Not a promise list. Things I intend to get to, in roughly this order, with the reason attached. Anything here can be reordered by a convincing issue.

## Now

- **`/ai-tracedoc-mods:feedback`** — one command that opens a prefilled issue carrying the version, the OS and the newest ledger's file name. Most of the friction between "this is broken" and a usable report is the retyping.

## Next

- **An index for multi-volume projects.** Past 200 KiB a project gets `-02.md`, `-03.md`… A single file listing the volumes would make resuming a long project cheaper.

## Considering

- **Cross-process lock.** Two sessions in one project currently overwrite each other's entries; detection warns, prevention does not exist. The honest fix is a lock; the honest risk is that a lock fails harder when it goes wrong. Needs a design, not a patch.
- **Redaction rules.** A list of patterns to mask before writing, so a team can keep the ledger in the repository without wondering what is in it.
- **TypeScript module.** Would unblock distribution through `davila7/claude-code-templates`, whose mods directory typechecks `hooks/**`. Only worth doing if that channel proves it brings installs.

## Won't do

- Record tool calls, thinking or system notices. It would turn a readable ledger into an event stream and break the one thing the plugin is for.
- Any telemetry, analytics or network call.
- A hosted service. The ledger is two files in your repo; that's the whole architecture.
