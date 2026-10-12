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

### View options
- **Target note (standalone views)** — where to write when the view isn't embedded.
- **Block key** — sentinel key (defaults to the view name).
- **Format** — `List`, `Checklist`, or `Table`.
- **Checklist suffix property** — optional property id appended to checklist items (e.g. `note.due`).
- **Auto-serialize when embedded** — re-write when the data updates (debounced).
- **Fully solidify (remove embed and sentinels)** — replace the live `![[base#view]]` with plain Markdown (no embed, no sentinel comments), so the note is fully static (default off).
- **Group headings (from the Base groupBy)** — when the Base groups rows, emit `### <group>` headings using Bases' grouped results (default on).

### Button menu
Next to **Serialize** there's a **▾** menu with one-off actions that override the view options:
- **Serialize (keep embed)** — keeps the embed + sentinels (even if the "fully solidify" option is on)
- **Serialize & solidify (remove embed + sentinels)** — fully solidifies this time
- **Copy Markdown**
- **Remove serialized block**

The main **Serialize** button follows the persisted options; the menu items are explicit one-off overrides.

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
