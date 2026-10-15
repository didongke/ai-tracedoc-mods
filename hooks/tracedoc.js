// ai-tracedoc — hooks-module build.
//
// Records a project's Claude Code conversation into the same TraceDoc ledger
// the 0.3.x line writes. Only the delivery changed: this runs as a hooks
// module inside the Claude Code process, so there is no binary to sign and
// nothing for Smart App Control to refuse.
//
// What that costs, stated plainly rather than discovered later:
//
//   * There is no transcript offset, so there is nothing to catch up from.
//     The 0.3.x build survived a hook that could not run — a Smart App Control
//     refusal, say — by reading the session .jsonl from its saved byte offset
//     at the next opportunity and backfilling. This build is handed each turn
//     as it happens and cannot re-read the past: a turn that goes unrecorded
//     is gone. A gap is written into the ledger instead of being filled, which
//     is the honest substitute for a backfill, not an equivalent of one.
//   * $.fs writes a whole file: no append, no lock, no rename. The ledger is
//     therefore read-modify-written, serialised by the promise chain below.
//     That serialises the hooks of one session. Two Claude Code sessions in
//     the same project would still overwrite each other, where the 0.3.x build
//     took a real lock and appended.
//   * The question is the engine's own stamp now: session.append with door
//     'prompt'. The 0.3.x build had to infer it from the transcript.
//   * There is no ai-title record here, so a session heading is titled from
//     its first question — the same fallback the 0.3.x build used when no
//     title record was present.
//
// Loader constraint, from the hooks-module contract: the loader reads this
// source before running it, and a module that spells `on`, `$` or `$.env`
// other than literally does not load. So: no aliasing `on`, no destructuring
// `$`, no event name built by concatenation. Every hook below registers a
// literal event name and takes `($, e, next)` literally.

const VERSION = '0.4.0-mods.1'

// The ledger's filename suffix: the same one the 0.3.x line writes, so this is
// a drop-in and a project's ledger keeps its name across the change.
//
// That sameness is why the 0.3.x plugin must be disabled rather than left on
// beside this one. This build read-modify-writes the whole ledger because $.fs
// has no append, while 0.3.x appended under a lock: two of them on one file
// means whichever appended inside the other's read-to-write window is erased.
// One recorder per project, or a suffix of its own -- not both.
const SUFFIX = 'tracedoc.md'

// Which session.append rows are a question.
//
// The deciding field is `origin.kind` = 'human', which is the same predicate
// the 0.3.x build applies to the transcript. A session transcript on this
// machine, read row by row, separates the rows exactly here:
//
//   type=user origin=human     content=string   the person's prompt, and a
//                                               slash command's record
//   type=user origin=undefined content=string   a command's output
//                                               (<local-command-stdout>), and
//                                               the <local-command-caveat>
//   type=user origin=peer      ...              another session's message
//   type=user origin=undefined <summary>        a compaction continuation
//
// So 'human' takes the person and their commands and leaves the machinery,
// which is what the 0.3.x ledger holds. `door` is kept as a second way in for
// the rows origin does not cover: 'prompt' is the person's prompt row by
// definition, and a 'command' row is the command's record rather than its
// output when it carries the <command-message> wrapper the record is built
// from (the output row carries <local-command-stdout> instead). The three
// tests are alternatives, and a row is one event, so accepting it by more than
// one of them still records it once.
//
// 'queue' is refused by its door, ahead of every other test, and this one is
// not an alternative. A queued prompt's record carries origin 'human' like the
// prompt itself, so the origin rule would have taken it; but the docs say a
// queue record is "a row the conversation never keeps", and the same words
// arrive again under 'prompt' when the turn starts. Refusing the door means the
// question is the prompt row whichever order the two arrive in.
const QUESTION_ORIGIN = 'human'
const COMMAND_RECORD = '<command-message>'
const NOT_A_QUESTION_DOORS = ['queue']

const MARKER = '.tracedoc-on'
const STATE_KEY = 'tracedoc.state.v1.'
const PENDING_KEY = 'tracedoc.pending.v1.'
const STATUS_FILE = '.tracedoc-mods-status.json'
const GAP_PREFIX = '> ⚠ TraceDoc: '
const VOLUME_THRESHOLD = 200 * 1024
const READ_LIMIT = 4 * 1024 * 1024
const MAX_TRACKED_SESSIONS = 200

// ---------------------------------------------------------------------------
// Module state
//
// In memory and reset by a hot reload. Nothing here is the record: the ledger
// is the record. What is worth surviving a reload — the question waiting for
// its answer — is mirrored into $.store below.

let sessionCwd = ''
let sessionId = ''
let pending = null
let failures = []

const counters = {
  turns: 0,
  recorded: 0,
  gapsReported: 0,
  hookFailures: 0,
  aborted: 0,
  skippedDisabled: 0,
  orphanAnswers: 0,
  subagentTurnsSkipped: 0,
  subagentAppendsSkipped: 0,
  appendsByDoor: {},
  appendShapes: {},
  doorSamples: {},
  rowsNotRecorded: 0,
  turnReasons: {},
  endedAs: null,
}

// The ledger is read-modify-written, which is not atomic. Every write goes
// through this one chain, so no hook starts its read until the hook before it
// has finished writing. A hot reload replaces the module and with it this
// chain, so a reload landing exactly inside a write is the one window this
// does not cover.
let chain = Promise.resolve()

function serialize(fn) {
  const run = chain.then(function () {
    return fn()
  })
  chain = run.then(
    function () {},
    function () {},
  )
  return run
}

// ---------------------------------------------------------------------------
// Small helpers

function pad2(value) {
  return (value < 10 ? '0' : '') + value
}

function localStamp(when) {
  return (
    when.getFullYear() +
    '-' +
    pad2(when.getMonth() + 1) +
    '-' +
    pad2(when.getDate()) +
    ' ' +
    pad2(when.getHours()) +
    ':' +
    pad2(when.getMinutes())
  )
}

function localDay(when) {
  return when.getFullYear() + '-' + pad2(when.getMonth() + 1) + '-' + pad2(when.getDate())
}

function compactDay(when) {
  return String(when.getFullYear()) + pad2(when.getMonth() + 1) + pad2(when.getDate())
}

function basename(path) {
  const trimmed = String(path).replace(/[\\/]+$/, '')
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return cut < 0 ? trimmed : trimmed.slice(cut + 1)
}

function join(dir, name) {
  const base = String(dir)
  if (base.endsWith('/') || base.endsWith('\\')) return base + name
  return base + (base.indexOf('\\') >= 0 ? '\\' : '/') + name
}

function stem() {
  return SUFFIX.replace(/\.md$/, '')
}

// Mirrors the 0.3.x VolumeFilename: volume 1 carries no number.
function volumeFilename(project, today, number) {
  if (number === 1) return today + '-' + project + '-' + SUFFIX
  return today + '-' + project + '-' + stem() + '-' + pad2(number) + '.md'
}

// Mirrors the 0.3.x VolumeNumber: a name with no -NN tail is volume 1.
function volumeNumber(name) {
  const base = String(name).replace(/\.md$/, '')
  const dash = base.lastIndexOf('-')
  if (dash < 0) return 1
  const digits = base.slice(dash + 1)
  if (!/^[0-9]+$/.test(digits)) return 1
  return parseInt(digits, 10)
}

// Mirrors the 0.3.x LedgerPattern `*-<project>-tracedoc*.md`, matched without a
// glob library. Folding case on every platform: the 0.3.x build folds on
// Windows and not elsewhere, and this build cannot tell which platform it is
// on. Over-matching on Linux would need two project directories whose names
// differ only in case, which is a fair trade for not missing the ledger on
// Windows.
function ledgerMatch(name, project) {
  const lower = String(name).toLowerCase()
  if (lower.charAt(0) === '.') return false
  if (!lower.endsWith('.md')) return false
  return lower.indexOf('-' + String(project).toLowerCase() + '-' + stem().toLowerCase()) >= 0
}

// ---------------------------------------------------------------------------
// The ledger format. Byte-for-byte what internal/tracedoc/ledger.go writes.

function volumeHeader(project) {
  return (
    '# ' +
    project +
    ' · TraceDoc\n\n' +
    'This file is auto-generated by the ai-tracedoc plugin ' +
    'from Claude Code session transcripts. ' +
    'It has not been manually curated.\n\n'
  )
}

function volumeHeaderContinued(project, number, prevFn) {
  return (
    '# ' +
    project +
    ' · TraceDoc (Volume ' +
    number +
    ')\n\n' +
    'Continued from: [' +
    prevFn +
    '](./' +
    prevFn +
    ')\n\n'
  )
}

function sessionHeader(date, title, id) {
  return '\n## ' + date + ' · ' + title + '\n\n<!-- session: ' + id + ' -->\n\n'
}

function footerLink(nextFn) {
  return '\n\n---\n\nContinued in: [' + nextFn + '](./' + nextFn + ')\n'
}

// The parts-then-join shape is load-bearing, exactly as in the Go original:
// joining inserts a separator after the empty terminator part as well, which
// is what gives every entry the blank line the format calls for. Appending as
// you go produces one newline fewer at each boundary, which silently forks the
// ledger from the 0.3.x one.
function formatEntries(entries) {
  const parts = []
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (entry.t) parts.push('**Question:** ' + entry.t + ' · ' + entry.q + '\n')
    else parts.push('**Question:** ' + entry.q + '\n')
    if (entry.a) parts.push('\n**Answer:** ' + entry.a + '\n')
    parts.push('')
  }
  return parts.join('\n')
}

// The 0.3.x fallbackTitle: the first question flattened to one line and cut to
// 40 characters.
function fallbackTitle(question) {
  const flat = String(question == null ? '' : question)
    .trim()
    .replace(/\n/g, ' ')
  const runes = Array.from(flat)
  return runes.length > 40 ? runes.slice(0, 40).join('') + '…' : flat
}

// ---------------------------------------------------------------------------
// Files, through $.fs

async function statOf($, path) {
  try {
    const stat = await $.fs.stat(path)
    return stat && stat.kind !== 'dir' ? stat : null
  } catch (err) {
    return null
  }
}

// Appends by rewriting the whole file, because $.fs has no append.
//
// A read that fails aborts the write. An unreadable ledger must never be
// replaced by just the new text — that is the one way this build could destroy
// a record, and it is worth an exception to rule it out. Volumes roll at
// 200 KiB, so a ledger is never near the 4 MiB read bound; the realistic
// failure is the file having been moved mid-session.
async function appendText($, path, text) {
  let body = ''
  const stat = await statOf($, path)
  if (stat) {
    if (stat.size > READ_LIMIT) throw new Error('ledger is over the 4 MiB read bound: ' + path)
    body = await $.fs.read(path)
  }
  await $.fs.write(path, body + text)
}

// ---------------------------------------------------------------------------
// State, in $.store
//
// $.store is one store per plugin, not per project, and it outlives sessions
// and hot reloads. Every key is therefore namespaced by the project it belongs
// to.

function stateKey(cwd) {
  return STATE_KEY + String(cwd).toLowerCase()
}

async function loadState($, cwd) {
  let raw
  try {
    raw = await $.store.get(stateKey(cwd))
  } catch (err) {
    raw = undefined
  }
  const state = raw && typeof raw === 'object' ? raw : {}
  if (!state.sessions || typeof state.sessions !== 'object') state.sessions = {}
  if (typeof state.volume !== 'string') state.volume = ''
  if (!Array.isArray(state.order)) state.order = []
  return state
}

function trackSession(state, id, volume) {
  state.sessions[id] = volume
  const order = state.order.filter(function (seen) {
    return seen !== id
  })
  order.push(id)
  while (order.length > MAX_TRACKED_SESSIONS) {
    const drop = order.shift()
    if (drop !== id) delete state.sessions[drop]
  }
  state.order = order
}

function pendingKey(id) {
  return PENDING_KEY + String(id)
}

// The question is mirrored into the store so that a hot reload between a
// question and its answer does not orphan the turn: the store still knows what
// was asked. This is state a hot reload would otherwise take with it, which is
// the one place this build can beat the in-memory design it replaces.
async function savePending($, question) {
  try {
    await $.store.set(pendingKey(sessionId), question)
  } catch (err) {
    noteFailure('store.set(pending)', err)
  }
}

async function takePending($) {
  let question = pending
  pending = null
  const key = pendingKey(sessionId)
  if (!question) {
    try {
      const raw = await $.store.get(key)
      if (raw && typeof raw.q === 'string') question = raw
    } catch (err) {
      // The store is unreadable; an answer with no question is counted as an
      // orphan rather than guessed at.
    }
  }
  try {
    await $.store.delete(key)
  } catch (err) {
    // Nothing to clear.
  }
  return question
}

// ---------------------------------------------------------------------------
// Locating the volume, mirroring LocateLatestVolume

async function locateLatestVolume($, cwd, project, state) {
  if (state.volume && (await statOf($, join(cwd, state.volume)))) return { name: state.volume }

  let names = []
  try {
    const entries = await $.fs.list(cwd)
    for (const entry of entries || []) {
      if (!entry || entry.kind === 'dir') continue
      if (ledgerMatch(entry.name, project)) names.push(entry.name)
    }
  } catch (err) {
    return { error: 'cannot list ' + cwd + ': ' + String(err) }
  }
  if (!names.length) return { name: '' }

  let best = names[0]
  for (const name of names) {
    if (volumeNumber(name) > volumeNumber(best)) best = name
  }
  const highest = volumeNumber(best)
  let claimants = 0
  for (const name of names) {
    if (volumeNumber(name) === highest) claimants++
  }
  // Two files claiming one volume number: the 0.3.x build refuses to guess
  // which one a session belongs to, and so does this one.
  if (claimants > 1) {
    return { error: 'ambiguous ledger volumes: ' + names.slice().sort().join(', ') }
  }
  return { name: best }
}

// ---------------------------------------------------------------------------
// Recording

function noteFailure(where, err) {
  counters.hookFailures++
  const message = err && err.message ? String(err.message) : String(err)
  failures.push({ where: where, at: localStamp(new Date()), msg: message })
  if (failures.length > 50) failures.shift()
}

// Turns unreported hook failures into ledger lines. Consumed once, at the next
// entry that does get written, so the gap sits in the ledger next to the turn
// it swallowed rather than only in a status file nobody reads.
function takeGaps() {
  if (!failures.length) return ''
  let text = ''
  for (const failure of failures) {
    counters.gapsReported++
    text += GAP_PREFIX + 'a turn went unrecorded — ' + failure.where + ' failed at ' + failure.at + ': ' + failure.msg + '\n\n'
  }
  failures = []
  return text
}

// RecordingEnabled: the marker's presence is the opt-in, its contents are not
// read, and a directory in the marker's place is not a marker — the same three
// rules the 0.3.x build states, and the last one is the shape a wayward script
// can produce that would otherwise silently opt a project in.
//
// Checked here, per turn, rather than at session start, because /ai-tracedoc:on
// and /off are meant to take effect inside a running session.
async function recordingEnabled($, cwd) {
  return (await statOf($, join(cwd, MARKER))) !== null
}

async function record($, question, answer) {
  const cwd = sessionCwd || (await $.session.root())
  const id = sessionId || (await $.session.id())
  const project = basename(cwd)
  const now = new Date()
  const today = compactDay(now)
  const entry = { q: question.q, a: answer, t: question.t }

  if (!(await recordingEnabled($, cwd))) {
    counters.skippedDisabled++
    return
  }

  const state = await loadState($, cwd)
  const placed = typeof state.sessions[id] === 'string' ? state.sessions[id] : ''

  // A session already placed in a volume keeps appending there for its whole
  // life, so its entries stay contiguous and it never spans volumes.
  if (placed && (await statOf($, join(cwd, placed)))) {
    await appendText($, join(cwd, placed), takeGaps() + formatEntries([entry]))
    counters.recorded++
    await $.store.set(stateKey(cwd), state)
    return
  }

  const located = await locateLatestVolume($, cwd, project, state)
  if (located.error) throw new Error(located.error)
  let current = located.name

  if (current) {
    const stat = await statOf($, join(cwd, current))
    // Only a session arriving at a volume may split it, and only once it has
    // grown past the threshold. A session already placed in one returned
    // above, so a continuation never reaches here — which is what keeps a
    // session's entries contiguous.
    if (stat && stat.size > VOLUME_THRESHOLD) {
      const number = volumeNumber(current) + 1
      const name = volumeFilename(project, today, number)
      await $.fs.write(join(cwd, name), volumeHeaderContinued(project, number, current))
      await appendText($, join(cwd, current), footerLink(name))
      current = name
    }
  } else {
    current = volumeFilename(project, today, 1)
    await $.fs.write(join(cwd, current), volumeHeader(project))
  }

  const date = entry.t ? entry.t.slice(0, 10) : localDay(now)
  const heading = sessionHeader(date, fallbackTitle(entry.q), id)
  await appendText($, join(cwd, current), takeGaps() + heading + formatEntries([entry]))

  trackSession(state, id, current)
  state.volume = current
  counters.recorded++
  await $.store.set(stateKey(cwd), state)
}

// The text of a session.append row. The prompt arrives as content blocks, not
// as a bare string, so the blocks are joined the way the 0.3.x build joined
// an assistant message's: non-empty text blocks only, blank line between.
function messageText(message) {
  if (!message) return ''
  const content = message.content
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  const texts = []
  for (const block of content) {
    if (!block || block.type !== 'text') continue
    const text = String(block.text == null ? '' : block.text).trim()
    if (text) texts.push(text)
  }
  return texts.join('\n\n')
}

// ---------------------------------------------------------------------------
// The status file
//
// Diagnostics for the trial, not part of the record: which doors actually
// arrived, what the engine said each turn ended as, how many turns went
// unrecorded. It lives in the plugin's own directory so a trial leaves the
// project it is recording untouched.

async function writeStatus($) {
  const status = {
    plugin: 'ai-tracedoc (hooks-module build)',
    version: VERSION,
    updatedAt: localStamp(new Date()),
    session: sessionId || null,
    cwd: sessionCwd || null,
    ledgerSuffix: SUFFIX,
    questionRule: { origin: QUESTION_ORIGIN, door: 'prompt', commandRecord: COMMAND_RECORD },
    counters: counters,
    pending: pending ? pending.q.slice(0, 120) : null,
    unreportedFailures: failures,
  }
  await $.fs.write(join($.plugin.root, STATUS_FILE), JSON.stringify(status, null, 2) + '\n')
}

async function safeStatus($) {
  try {
    await writeStatus($)
  } catch (err) {
    counters.hookFailures++
  }
}

// ---------------------------------------------------------------------------

export function register(on) {
  on('session.start', async ($, e, next) => {
    const out = await next(e)
    try {
      sessionCwd = e && e.cwd ? e.cwd : await $.session.root()
      sessionId = await $.session.id()
      await safeStatus($)
    } catch (err) {
      noteFailure('session.start', err)
    }
    return out
  }).catch(async ($, e, next) => {
    noteFailure('session.start (hook failed)', next && next.error ? next.error.message : 'unknown')
    return next(e)
  })

  on('session.append', async ($, e, next) => {
    const out = await next(e)
    try {
      // A subagent's rows are not the conversation this ledger records; the
      // 0.3.x build drew the same line with its isSidechain predicate.
      if (e && e.agentId != null) {
        counters.subagentAppendsSkipped++
        return out
      }
      const door = e && e.door != null ? String(e.door) : '(absent)'
      counters.appendsByDoor[door] = (counters.appendsByDoor[door] || 0) + 1

      const message = e && e.message ? e.message : {}
      const origin = e && e.origin && e.origin.kind != null ? String(e.origin.kind) : '(absent)'

      // The shape of every row, kept because which doors and origins this
      // engine really sends is not something to take on faith.
      const shape =
        door +
        ' | role=' + String(message.role) +
        ' | isMeta=' + String(message.isMeta) +
        ' | origin=' + origin
      counters.appendShapes[shape] = (counters.appendShapes[shape] || 0) + 1

      const text = messageText(message)
      const isQuestion =
        NOT_A_QUESTION_DOORS.indexOf(door) < 0 &&
        (origin === QUESTION_ORIGIN ||
          door === 'prompt' ||
          (door === 'command' && text.indexOf(COMMAND_RECORD) >= 0))

      if (!isQuestion || !text) {
        // A row that is not recorded is sampled, so one that should have been
        // can be recognised from the status file. Never a prompt's: its text is
        // in the ledger by design, and a second copy of it is exposure with
        // nothing bought.
        if (text && door !== 'prompt' && !counters.doorSamples[door]) {
          counters.doorSamples[door] = text.slice(0, 60)
        }
        counters.rowsNotRecorded++
        return out
      }

      pending = { q: text, t: localStamp(new Date()) }
      await savePending($, pending)
      await safeStatus($)
    } catch (err) {
      noteFailure('session.append', err)
    }
    return out
  }).catch(async ($, e, next) => {
    noteFailure('session.append (hook failed)', next && next.error ? next.error.message : 'unknown')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    try {
      if (e && e.agentId != null) {
        counters.subagentTurnsSkipped++
        return out
      }
      counters.turns++
      const reason = e && e.reason != null ? String(e.reason) : '(absent)'
      counters.turnReasons[reason] = (counters.turnReasons[reason] || 0) + 1
      if (e && e.isAborted) counters.aborted++

      const answer = e && typeof e.answer === 'string' ? e.answer.trim() : ''
      const question = await takePending($)
      if (!question) {
        // A turn with no question in hand: the question was dropped or the
        // module reloaded across it. Counted, never guessed at.
        counters.orphanAnswers++
        await safeStatus($)
        return out
      }
      await serialize(function () {
        return record($, question, answer)
      })
      await safeStatus($)
    } catch (err) {
      noteFailure('turn.complete', err)
    }
    return out
  }).catch(async ($, e, next) => {
    noteFailure('turn.complete (hook failed)', next && next.error ? next.error.message : 'unknown')
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    const out = await next(e)
    try {
      // A question asked and never answered is recorded question-only, which
      // is what the 0.3.x build's SessionEnd path does. Its Stop path defers
      // an incomplete chain instead, but here the engine has told us the turn
      // ended — deferring would only lose it.
      const question = await takePending($)
      if (question) {
        await serialize(function () {
          return record($, question, '')
        })
      }
      counters.endedAs = e && e.reason != null ? String(e.reason) : '(absent)'
      await safeStatus($)
    } catch (err) {
      noteFailure('session.end', err)
      await safeStatus($)
    }
    return out
  }).catch(async ($, e, next) => {
    noteFailure('session.end (hook failed)', next && next.error ? next.error.message : 'unknown')
    return next(e)
  })
}
