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

1. Open a `.base` file.
2. Add a **Serializer** view (view selector → Serializer).
3. In the view's options (toolbar), set:
   - **Target note** — where the Markdown is written.
   - **Block key** — the sentinel key (defaults to the view name).
   - **Format** — `List`, `Checklist`, or `Table`.
   - **Checklist suffix property** — optional property id appended to checklist items (e.g. `note.due`).
   - **Auto-serialize on change** — re-write when the data updates (debounced).
4. Click **Serialize now**. A preview is shown above the button.

Because filtering/sorting/limits live in the **Base** (Obsidian's query engine),
the serializer just renders the view's current rows.

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
