---
description: Show which version of TraceDoc is running
disable-model-invocation: true
allowed-tools: Bash(basename "${CLAUDE_PLUGIN_ROOT}")
---

<!-- The version is the install directory's name, not a field read out of
     plugin.json. Claude Code refuses an injected command that names a path
     under ~/.claude/, and an installed plugin's root is always under one. That
     check outranks allow rules, and it is keyed on the path rather than on what
     the command does: `sed -n ...p` on plugin.json is reported as an edit of a
     sensitive file, because sed counts as write-capable. Splitting the read
     into grep|cut is no better -- a compound command is checked part by part,
     and an injected command never gets to prompt, so a part that would ask
     aborts the whole invocation. Both forms failed on a real installed copy on
     2026-10-03. A marketplace install always lands in a directory named after
     its version, and a directory name opens nothing -- which is what makes the
     running directory's name the version of the running copy. Loaded out of a
     working tree it prints that directory's name instead. Do not put the read
     back: the module below covers that case without one.

     THE MODULE ANSWERS THIS COMMAND. hooks/tracedoc.js hooks
     `ai-tracedoc-mods:version` and returns the version it already carries, so
     the engine prints a string and the body below never runs -- which is what
     makes this a version check rather than a retelling. That is also what
     fixes the working-tree case above: nothing here has to be a version for
     the version to be right.

     The body below is the fallback, for a session where the module did not
     load, and it is the only path left that goes through the model. Keep it
     working, and put no version number anywhere in this file: the body --
     comments included -- is injected into the model's context as a note row
     (seen in session.append as door `note`, isMeta true, origin `engine`), so
     a number written here is a number the model can answer with when the
     substitution comes back empty. One did: on 2026-10-15 a session answered
     with this plugin's previous release number -- the only version-shaped
     token anywhere in this file -- on an install that could only ever print
     `ai-tracedoc-mods`. The rationale stays and the date stays; the number
     does not come back. -->

!`basename "${CLAUDE_PLUGIN_ROOT}"`

Reply with that version and nothing else.

One line. No JSON, no prose, no tool calls, no edits to any file. This is a
lookup, so the only correct response is the number that came back — a version
check that writes to the repository is not a version check.
