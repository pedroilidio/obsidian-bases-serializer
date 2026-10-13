# Architecture

A guided tour of the code, aimed at someone comfortable programming but new to
TypeScript or the Obsidian plugin API. If you only read one section, read
[The one constraint](#the-one-constraint) and [Traps](#traps).

## The one constraint

Obsidian's Bases API hands a plugin a view through a `QueryController` — and that
controller is **opaque**. There is no public way to ask "what rows does the active
Table view have?". The only supported way to see results is to **be a view type**:

```ts
this.registerBasesView(VIEW_TYPE, { factory: (controller, containerEl) => new SerializerView(controller, containerEl), … });
```

That single fact explains the whole design: we register our own view type
(`bases-serializer`), Obsidian instantiates it and pushes query results into it, and
everything else — preview, toolbar, writing to a note — happens inside that view.
It's why the plugin can't serialize a built-in Table/Cards view.

## File map

| File | Size | What it is | Touch it when… |
| --- | --- | --- | --- |
| `src/main.ts` | ~570 lines | The Obsidian-facing layer: the `SerializerView` class and the plugin registration. | Changing the UI, options, menus, where/how a block gets written. |
| `src/render.ts` | ~180 lines | **Pure**: rows/groups → Markdown string. No Obsidian imports. | Changing formats, templates, escaping, detail/property rendering. |
| `src/sentinels.ts` | ~155 lines | **Pure**: the `%% bases-serializer … %%` block — find, insert, replace, strip, freeze. | Changing the output envelope or the placement rules. |
| `styles.css` | ~180 lines | All visual styling, using Obsidian CSS variables. | Anything visual. |
| `tests/*.test.ts` | — | Vitest unit tests for the two pure modules. | Whenever you change `render.ts` or `sentinels.ts`. |
| `.github/workflows/release.yml` | — | Builds + attaches assets on tag push. | Release plumbing. |
| `main.js` | built | Committed bundle — this is what Obsidian loads. | Never edit by hand; run `npm run build`. |

The split is deliberate: the two pure modules hold all the logic worth testing, and
`main.ts` is glue that needs the running app.

## Data flow

```
Bases query
    │  (Obsidian pushes results)
    ▼
onDataUpdated() ──► render() ──► body() ──► options() + renderRows()/renderGroups()
                                  │                    (src/render.ts: pure)
                                  ▼
                     MarkdownRenderer.render()  ──►  live preview in the view

❄ button / command
    │
    ▼
serialize()  ──►  body()  ──►  vault.process(file, …)  ──►  src/sentinels.ts
                  (same string as the preview)              (find + replace one block)
```

Two things worth internalising:

1. **The preview and the write share `body()`.** Whatever you see in the preview is,
   byte for byte, what gets written. Keep it that way.
2. **`vault.process()` is read-modify-write, atomically.** `upsertBlock` and friends
   take the whole file text and return new text; `process` does the I/O. Never
   `vault.modify` (it races) and prefer this over the adapter API.

## `src/render.ts` — the pure renderer

Types you'll meet: `Format` (`list | checklist | numbered | table`),
`PropertiesMode` (`none | inline | subitems`), `SerializedRow`, `SerializedGroup`,
`RenderOptions`.

Entry points:

- `renderRows(rows, options)` — **precedence: `options.template` first**, then
  `format === "table"` → `renderTable`, else one `renderRow` per row.
- `renderGroups(groups, options)` — emits each group's header (default
  `### {group}`) followed by its rows, skipping empty groups.

Helpers: `renderTemplate` (fills `{…}` placeholders from `RowContext`, id or display
name, case-insensitive), `renderGroupHeader` (`{group}`, `{count}`), `escapeCell`
(escapes `|` and flattens newlines so tables can't break), `suffixFor` (the `— value`
tail for list/checklist/numbered lines).

`renderRow` builds the bullet (`- `, `- [ ] `, `1. `) then appends properties via
`propertyParts`, which honours `detailKeys` (if set) or all non-empty cells, and
joins with `options.propertySeparator` (` · ` by default).

This file knows **nothing** about previews, files, or sentinels. If you can express
it as `(rows, options) → string`, it belongs here — and it's unit-testable without
Obsidian.

## `src/sentinels.ts` — the output envelope and placement

The block looks like:

```markdown
%% bases-serializer key="Tasks" format="checklist" %%
### Docs (2)

- [ ] [[Update changelog]] · 2026-11-10 · Todo
%% /bases-serializer %%
```

`%% … %%` is Obsidian's comment syntax: hidden in Reading view and in the preview,
which is why the preview shows the *rendered* result with no visible markers.

Four strategies, chosen in `SerializerView.serialize()`:

| Function | Used when | Behaviour |
| --- | --- | --- |
| `upsertBlock` | standalone, no section | append at end of file, or replace the block with the same `key` |
| `upsertBlockUnderHeading` | standalone + **Section heading** | insert under the first matching heading (falls back to append) |
| `upsertBlockAfterAnchor` | embedded | insert right after the first line containing the embed's `src` (e.g. `tasks.base#Today`) |
| `solidifyAnchorToText` | embedded + **Freeze** | delete any block for the key, then replace the embed line itself with the body — no sentinels, no embed |

`findBlock()` identifies a block by the line starting with `%% bases-serializer` that
contains `key="<key>"`. Matching is exact on the quoted key, which is what lets
several independent blocks coexist in one note.

**Why text surgery instead of a Markdown/YAML round-trip?** Obsidian's own docs
warn about this, and in practice round-tripping rewrites frontmatter (`2026_10_12`
becomes an int, `T` becomes a space, `null` becomes `null`). Line-based editing
leaves everything outside the block untouched. Everything here takes and returns a
plain string, so it is trivially testable.

## `src/main.ts` — the Obsidian layer

### `SerializerView extends BasesView`

| Member | Role |
| --- | --- |
| `constructor(controller, containerEl)` | Builds the toolbar/preview DOM once. `containerEl` is the element Bases gave us (see [Traps](#traps)). |
| `onDataUpdated()` | Obsidian's "data changed" hook → `render()`. |
| `render()` | Sets the button label, renders the preview, updates the status/hint, arms auto-serialize. |
| `body()` | `options()` → `renderRows`/`renderGroups`, then prepends the preamble. The single source of the output string. |
| `options()` | Reads view config → `RenderOptions`. This is where config keys become behaviour. |
| `embedInfo()` | Are we inside `![[…]]`? Returns `{ embedded, anchor }` from the embed's `src`. |
| `targetFile(embedded)` | Embedded → the active file; standalone → the **Target note** option. |
| `key()` | The sentinel key: `key` option → view name → `"default"`. |
| `serialize(notify, solidifyOverride?)` | Builds the body and writes it via `vault.process`, picking one of the four strategies. |
| `openMenu()` / `openFormatMenu()` | The ▾ actions menu and the format picker. |
| `copyMarkdown()` / `removeBlock()` | Toolbar actions, both with `Notice` feedback. |
| `updateScrollState()` | Toggles the preview's fade classes; driven by render, scroll, and a `ResizeObserver`. |

### `BasesSerializerPlugin.onload()`

Three things happen here:

1. `registerBasesView(...)` — the view type, its name/icon, and the **option schema**
   (grouped: Standalone / Output / Item details / Behaviour).
2. `liveViews` — a module-level `Set<SerializerView>` so the plugin can find the view
   in the active note (there's no workspace-level way to enumerate Bases views).
   Cleanup is registered with `this.register(...)`.
3. The `serialize-active` command — "Serialize the base in the active note".

### Configuration model

Options are declared once, in `onload()`, as `BasesAllOptions[]`. Keys you'll see
referenced in `options()` and `render()`:

`target`, `section`, `format`, `linkStyle`, `template`, `preamble`, `key`, `props`,
`detailKeys`, `propSep`, `propLabels`, `suffix`, `group`, `groupTemplate`, `empty`,
`previewHeight`, `auto`, `solidify`.

Plus one **internal** key, `formatOverride`, not exposed as an option:

- `format` — the **Default format** dropdown in the view options.
- `formatOverride` — set by the in-view picker; empty means "follow `format`".
- `format()` returns `formatOverride || format || "list"`, which is why the button
  can show "Default (Checklist)".

## Common tasks

**Add a format.** Add it to the `Format` union in `render.ts`, add a bullet in
`renderRow`, then add a `["key", "Label"]` entry + icon in `main.ts` (`FORMATS`,
`FORMAT_ICONS`) and a case in the `format` dropdown options in `onload()`.

**Add a view option.** Add an item to the right group in `onload()`, then read it in
`options()` or `render()`. Remember the `config.get` trap below.

**Change what a row looks like.** `renderRow` (bullet + suffix) and `propertyParts`
(details) in `render.ts` — and add a test.

**Change the envelope.** `sentinelLine` / `findBlock` in `sentinels.ts`. If you change
the open marker, note that `findBlock` matches on it, so old blocks stop matching.

**Add a toolbar action.** `openMenu()` in `main.ts` — one `menu.addItem(...)`, with
`.setIcon(...)` and `.onClick(...)`. Anchor it with `showBelow(menu, this.menuBtnEl)`.

## UI and CSS

Everything is a CSS class, styled with Obsidian variables (`--input-height`,
`--radius-s`, `--size-4-2`, `--interactive-accent`, …) so themes keep working.

- Root: Bases gives us `.bases-view`; we add `.bases-serializer` to the same element.
- `.bases-serializer-toolbar` is a **container** (`container-name: bases-serializer`),
  and `@container bases-serializer (width < 578px)` hides the button labels — this
  mirrors the native Bases toolbar, which does the same at 590px (the 12px difference
  is our extra inline padding).
- The split button (`.bases-serializer-split`) and the format button
  (`.bases-serializer-format`) are `flex: 0 0 auto` with `min-width: max-content` when
  collapsed, so they can never shrink below their content. Without that, the caret
  gets pushed outside the button.
- The fade on the preview is a `mask-image` gradient toggled by `updateScrollState()`.

## Tests

```bash
npm test        # vitest run
npm run build   # tsc --noEmit + esbuild bundle
```

`tests/render.test.ts` and `tests/sentinels.test.ts` cover the pure modules only —
they import from `src/render.ts` / `src/sentinels.ts`, never from `obsidian`. That's
the point of keeping those files free of Obsidian imports.

`main.ts` is **not** unit-tested (it needs the app). Verify changes to it in a real
vault — see below.

## Manual verification loop

```bash
npm run build
cp main.js manifest.json styles.css "<vault>/.obsidian/plugins/bases-serializer/"
```

Then reload the app. With the Obsidian CLI:

```bash
Obsidian.exe command id=app:reload     # picks up JS *and* CSS
```

Notes: `plugin:reload` is unreliable (it exits non-zero), so reload the whole app;
and on a large vault that takes 15–30s while it re-indexes, so don't panic at
"Loading plugins…". CSS changes in particular often need the full reload.

## Release

1. Bump `version` in `manifest.json` **and** add the mapping in `versions.json`.
2. Commit, then `git tag -a X.Y.Z -m "X.Y.Z" && git push origin X.Y.Z`.
3. `.github/workflows/release.yml` builds and attaches `main.js`, `manifest.json`,
   `styles.css` to a **draft** release. Publish it by hand.

The tag **must** equal `manifest.json`'s `version` — that's what Obsidian matches when
installing.

## Traps

Things that cost us time; they'll cost you time too.

1. **`config.get()` ignores option defaults.** An option declared with `default: true`
   still returns `undefined` if the base file never set it. `Boolean(undefined)` is
   `false`. This is why `body()` checks `Boolean(this.config.get("group"))` and why
   demo bases set `group: true` explicitly. Always coerce deliberately.
2. **The element Bases hands you is `.bases-view`,** which Obsidian styles with
   `overflow: auto; flex-grow: 1`. Left alone, the *whole* view scrolls — toolbar
   included. `styles.css` overrides it into a fixed flex column so only the preview
   scrolls. Don't remove those overrides.
3. **Flex items shrink below their content by default.** `min-width: 0` (or `auto`)
   on a button whose content can't shrink will push its children out of the box. Hence
   `flex: 0 0 auto` + `min-width: max-content` on our buttons.
4. **`vault.process()` on the active note loses the cursor/selection.** We use it for
   everything for atomicity; the guidelines prefer the Editor API when editing the
   note the user is looking at. Worth revisiting if a user complains about the cursor
   jumping.
5. **Menus are anchored, not positioned by hand.** `Menu.showAtPosition({ x, y, width,
   overlap: true })` is what Obsidian itself uses; it adds a 2px offset and flips when
   it would overflow. Menus also **auto-dismiss within a second or two** if focus
   moves, which makes screenshot automation fiddly.
6. **Sentinel comments are invisible in rendered Markdown.** `%% … %%` disappears in
   Reading view and in our preview. If a block "isn't there", check Source mode.
7. **Grouped output needs two things:** the base's own `groupBy` (so
   `data.groupedData` has keys) *and* our `Group headings` option. Either one missing
   and you get a flat list.
8. **`normalizePath()` user input.** Paths come from a text option; always normalise
   before `getAbstractFileByPath` (cross-platform separators, stray slashes).
