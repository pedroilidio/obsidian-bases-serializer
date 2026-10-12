# Bases Serializer

Serialize an [Obsidian Bases](https://obsidian.md/help/bases) view into **static
Markdown**, wrapped in sentinel comments so it can be refreshed in place.

Bases views are dynamic. This plugin lets you **freeze** the current result into
real Markdown text — so links show up in the Graph, in Publish, in exports, and
are readable by other tools. Re-serialize any time to update the block.

## Install (manual / BRAT)

1. Build (see Development) or download `main.js`, `manifest.json`, `styles.css`.
2. Copy them into `<vault>/.obsidian/plugins/bases-serializer/`.
3. Enable **Bases Serializer** in Settings → Community plugins.

## Usage

### Embedded (recommended)
1. Write a base **inside a note**: `![[tasks.base#Today]]`.
2. Add the **Serializer** view to that base (`views` → add a view of type *Serializer*); the embed shows the Serializer preview.
3. Click **Serialize here**. The frozen Markdown is inserted **directly below the embed** in that note (under a sentinel block keyed by the view).

This keeps the snapshot next to the query it came from — the base's `this`.

### Standalone
If the base is open as its own tab, set a **Target note** in the view options and click **Serialize now** (the block is appended to that note).

### View options (grouped)
**Output**
- **Target note (standalone only)** — where to write when the view isn't embedded.
- **Section heading (standalone)** — write the block under this heading in the target note (creates it if missing).
- **Sentinel key** — key for the block (defaults to the view name).
- **Format** — `List`, `Checklist`, `Numbered`, or `Table`.
- **Link style** — `Wikilink [[Note]]` (default), `Markdown [title](path)`, or `Plain text`.
- **Row template (overrides format)** — one template per row (see placeholders below).
- **Heading / preamble** — a line emitted above the block (e.g. `## Tasks`).

**Item details**
- **Item details** — `Hide` (default), `Inline` (same line), or `Sub-items` (nested bullets).
- **Detail properties (empty = all columns)** — comma-separated ids/display names to show (e.g. `note.due, status`).
- **Details separator** — used by `Inline` (default ` · `; verbatim, include your own spaces).
- **Label details** — `Due: 2026-10-13` instead of bare values (default off).
- **Trailing property** — a property appended to each checklist/numbered item.

**Behaviour**
- **Group headings (from the Base groupBy)** — emit a group header per group using Bases' grouped results (default on).
- **Group template** — header template with `{group}` and `{count}` (default `### {group}`).
- **No-results text** — shown when there are no rows (default: nothing).
- **Auto-serialize when embedded** — re-write when the data updates (debounced).
- **Replace embed with static text (freeze)** — swap the live `![[base#view]]` for plain Markdown (no embed, no sentinels).

#### Row template placeholders
`{link}`, `{title}`, `{path}`, `{index}`, `{group}`, and any property by id (`{note.due}`) or display name (`{Due}`) — case-insensitive. Example:

```
- {link} — {note.due} ({note.status})
```

### Toolbar
- **Format** dropdown — change the format inline (no need to open options).
- **▾ menu** — one-off actions that override the view options: **Keep live view**, **Freeze · replace embed with text**, **Copy Markdown**, **Open target note**, **Remove serialized block**.

## Output format

```markdown
%% bases-serializer key="Today" format="checklist" %%
- [ ] [[Notes/Foo]] — 2026-10-13
- [ ] [[Notes/Bar]]
%% /bases-serializer %%
```

Re-serializing replaces only the block whose sentinel `key=` matches; everything
else in the note is left untouched. Multiple blocks per note are supported.

## Development

```bash
npm install
npm run dev      # esbuild watch -> main.js
npm run build    # typecheck + bundle
npm test         # unit tests (sentinels, rendering)
```

Pure logic lives in `src/sentinels.ts` and `src/render.ts` (no Obsidian imports),
so it is unit-tested without the app. The Bases view lives in `src/main.ts`.

## Notes / limitations

- Requires Obsidian 1.10.0+ (the public Bases API). `QueryController` is opaque,
  so this must be a **view type** — it cannot serialize the active Table view.
- Read-only with respect to the queried notes; it only writes the target note.

## License

MIT
