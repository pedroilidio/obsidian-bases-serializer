# Changelog

All notable changes to **Bases Serializer** are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-10-13

### Fixed

- Removed the `builtin-modules` build dependency; the esbuild config now uses
  Node's built-in `node:module`, as the community review recommends.
- Cleared the two remaining TypeScript lint warnings from the community review
  (unsafe `any` assignment/call) by dropping `Object.fromEntries` from the
  format table.

### Changed

- The format table is now one typed list of `{ value, label, icon }` entries,
  replacing the tuple list plus two lookup maps.

## [0.1.0] - 2026-10-13

Initial release.

Freeze a Bases view into real Markdown — links, tasks and text that exist
outside the `.base`, so they show up in the Graph, in Search, in Publish and in
exports. Bases views are dynamic by nature, which means their results aren't text
anywhere. Bases Serializer writes the current result as ordinary Markdown,
wrapped in sentinel comments, so you can re-run it any time and update the block
in place.

### Added

- A new Bases view type, **Serializer**, with a live preview of exactly what will
  be written, plus a row count and target.
- Four formats — `List`, `Checklist`, `Numbered`, `Table` — switchable from the
  toolbar without opening the view options.
- Refresh in place: output is wrapped in `%% bases-serializer key="…" %%`
  sentinels, so re-serializing replaces only that block. Multiple independently
  keyed blocks per note are supported.
- Group headings that respect Bases' `Group by`, with a `{group}` / `{count}`
  header template.
- **Embedded** (write below the embed) and **standalone** (Target note / Section
  heading) modes.
- **Freeze**: optionally replace the live embed with plain Markdown, leaving no
  embed and no sentinels behind.
- Row templates (`{link}`, `{note.due}`, `{title}`, `{index}`, `{group}`, …).
- Item details as inline text or sub-items, with optional property labels,
  configurable separator, and a trailing property.
- Link styles: wikilink, Markdown, or plain text.
- Heading / preamble, no-results text, preview max height, and debounced
  auto-serialize for embedded views.
- Toolbar actions: Copy Markdown, Open target note, Remove serialized block.
- Command: *Serialize the base in the active note* — hotkey and automation
  friendly.

### Notes

- Requires Obsidian **1.10.0+** (the public Bases API) with Bases enabled.
- The plugin is a **view type**: it serializes its own Serializer views, not the
  built-in Table/Cards views.
- Read-only with respect to the notes it queries — it only ever writes the target
  note.

[Unreleased]: https://github.com/pedroilidio/obsidian-bases-serializer/compare/0.1.1...HEAD
[0.1.1]: https://github.com/pedroilidio/obsidian-bases-serializer/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/pedroilidio/obsidian-bases-serializer/releases/tag/0.1.0
