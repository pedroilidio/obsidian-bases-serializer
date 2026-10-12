/*
Bases Serializer — generated bundle. Do not edit directly; see src/.
*/
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => BasesSerializerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/render.ts
function escapeCell(value) {
  return String(value != null ? value : "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}
function lookupValue(values, key) {
  if (key in values) return values[key];
  const found = Object.keys(values).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  return found ? values[found] : "";
}
function suffixFor(row, suffixIndex) {
  return suffixIndex !== void 0 && row.cells[suffixIndex] ? ` \u2014 ${row.cells[suffixIndex]}` : "";
}
function renderTemplate(template, ctx) {
  const table = {
    ...ctx.values,
    link: ctx.link,
    title: ctx.title,
    path: ctx.path,
    index: String(ctx.index),
    group: ctx.group
  };
  return template.replace(/\{([^{}]+)\}/g, (_match, rawKey) => {
    const key = String(rawKey).trim();
    if (key in table) return table[key];
    const found = Object.keys(table).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    return found ? table[found] : "";
  });
}
function renderGroupHeader(template, group, count) {
  return template.replace(
    /\{(\w+)\}/g,
    (_match, key) => key === "group" ? group : key === "count" ? String(count) : ""
  );
}
function rowContext(row, index, group) {
  var _a, _b, _c;
  return {
    link: row.link,
    title: (_a = row.title) != null ? _a : "",
    path: (_b = row.path) != null ? _b : "",
    index: index + 1,
    group: group != null ? group : "",
    values: (_c = row.values) != null ? _c : {}
  };
}
function propertyParts(row, options) {
  var _a, _b;
  const mode = (_a = options.properties) != null ? _a : "none";
  if (mode === "none") return [];
  if (options.detailKeys && options.detailKeys.length > 0) {
    return options.detailKeys.map((key) => {
      var _a2;
      const value = lookupValue((_a2 = row.values) != null ? _a2 : {}, key);
      if (!value) return "";
      return options.propertyLabels ? `${key}: ${value}` : value;
    }).filter(Boolean);
  }
  const headers = (_b = options.headers) != null ? _b : [];
  const parts = [];
  row.cells.forEach((value, index) => {
    if (!value) return;
    const label = options.propertyLabels ? headers[index + 1] : "";
    parts.push(label ? `${label}: ${value}` : value);
  });
  return parts;
}
function renderRow(row, index, options = {}) {
  var _a, _b, _c;
  const format = (_a = options.format) != null ? _a : "list";
  const suffix = suffixFor(row, options.suffixIndex);
  let line;
  if (format === "checklist") line = `- [ ] ${row.link}${suffix}`;
  else if (format === "numbered") line = `${index + 1}. ${row.link}${suffix}`;
  else line = `- ${row.link}${suffix}`;
  const parts = propertyParts(row, options);
  if (parts.length > 0) {
    const mode = (_b = options.properties) != null ? _b : "none";
    if (mode === "inline") {
      const separator = (_c = options.propertySeparator) != null ? _c : " \xB7 ";
      return `${line}${separator}${parts.join(separator)}`;
    }
    if (mode === "subitems") {
      return [line, ...parts.map((part) => `	- ${part}`)].join("\n");
    }
  }
  return line;
}
function renderTable(rows, headers = []) {
  var _a, _b;
  const head = headers.length > 0 ? headers : ["File", ...((_b = (_a = rows[0]) == null ? void 0 : _a.cells) != null ? _b : []).map((_, index) => `c${index + 1}`)];
  const header = `| ${head.map(escapeCell).join(" | ")} |`;
  const divider = `| ${head.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    (row) => `| ${[row.link, ...row.cells].map(escapeCell).join(" | ")} |`
  );
  return [header, divider, ...body].join("\n");
}
function renderRows(rows, options = {}) {
  var _a, _b;
  if (rows.length === 0) return "";
  const format = (_a = options.format) != null ? _a : "list";
  if (options.template) {
    return rows.map(
      (row, index) => renderTemplate(options.template, rowContext(row, index, options.group))
    ).join("\n");
  }
  if (format === "table") return renderTable(rows, (_b = options.headers) != null ? _b : []);
  return rows.map((row, index) => renderRow(row, index, options)).join("\n");
}
function renderGroups(groups, options = {}) {
  var _a, _b;
  const template = (_a = options.groupTemplate) != null ? _a : "### {group}";
  const parts = [];
  for (const group of groups) {
    const body = renderRows(group.rows, { ...options, group: (_b = group.title) != null ? _b : void 0 });
    if (!body) continue;
    if (group.title) {
      parts.push(`${renderGroupHeader(template, group.title, group.rows.length)}

${body}`);
    } else {
      parts.push(body);
    }
  }
  return parts.join("\n\n");
}

// src/sentinels.ts
var SENTINEL_OPEN = "%% bases-serializer";
var SENTINEL_CLOSE = "%% /bases-serializer %%";
function quote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}
function sentinelLine(key, meta = {}) {
  const parts = [`key=${quote(key)}`];
  for (const [name, value] of Object.entries(meta)) {
    if (value !== void 0 && value !== null && value !== "") {
      parts.push(`${name}=${quote(value)}`);
    }
  }
  return `${SENTINEL_OPEN} ${parts.join(" ")} %%`;
}
function findBlock(lines, key) {
  const needle = `key=${quote(key)}`;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(SENTINEL_OPEN) && lines[i].includes(needle)) {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === SENTINEL_CLOSE) return [i, j];
      }
      return [i, lines.length - 1];
    }
  }
  return null;
}
function upsertBlock(text, key, body, meta = {}) {
  const lines = text.split("\n");
  const block = [sentinelLine(key, meta), body.replace(/\n+$/, ""), SENTINEL_CLOSE];
  const range = findBlock(lines, key);
  if (range) {
    return [...lines.slice(0, range[0]), ...block, ...lines.slice(range[1] + 1)].join("\n");
  }
  const trimmed = text.replace(/\n+$/, "");
  const separator = trimmed === "" ? "" : "\n\n";
  return `${trimmed}${separator}${block.join("\n")}
`;
}
function stripBlock(text, key) {
  const lines = text.split("\n");
  const range = findBlock(lines, key);
  if (!range) return text;
  return [...lines.slice(0, range[0]), ...lines.slice(range[1] + 1)].join("\n");
}
function upsertBlockAfterAnchor(text, anchor, key, body, meta = {}) {
  const lines = text.split("\n");
  const block = [sentinelLine(key, meta), body.replace(/\n+$/, ""), SENTINEL_CLOSE];
  const range = findBlock(lines, key);
  if (range) {
    return [...lines.slice(0, range[0]), ...block, ...lines.slice(range[1] + 1)].join("\n");
  }
  if (anchor) {
    const at = lines.findIndex((line) => line.includes(anchor));
    if (at >= 0) {
      return [...lines.slice(0, at + 1), "", ...block, "", ...lines.slice(at + 1)].join("\n");
    }
  }
  const trimmed = text.replace(/\n+$/, "");
  const separator = trimmed === "" ? "" : "\n\n";
  return `${trimmed}${separator}${block.join("\n")}
`;
}
function solidifyAnchorToText(text, anchor, key, body) {
  const lines = text.split("\n");
  const bodyLines = body.replace(/\n+$/, "").split("\n");
  const range = findBlock(lines, key);
  const working = range !== null ? [...lines.slice(0, range[0]), ...lines.slice(range[1] + 1)] : lines.slice();
  if (anchor) {
    const at = working.findIndex((line) => line.includes(anchor));
    if (at >= 0) {
      return [...working.slice(0, at), ...bodyLines, ...working.slice(at + 1)].join("\n");
    }
  }
  const trimmed = working.join("\n").replace(/\n+$/, "");
  const separator = trimmed === "" ? "" : "\n\n";
  return `${trimmed}${separator}${bodyLines.join("\n")}
`;
}
function upsertBlockUnderHeading(text, heading, key, body, meta = {}) {
  const lines = text.split("\n");
  const block = [sentinelLine(key, meta), body.replace(/\n+$/, ""), SENTINEL_CLOSE];
  const range = findBlock(lines, key);
  if (range !== null) {
    return [...lines.slice(0, range[0]), ...block, ...lines.slice(range[1] + 1)].join("\n");
  }
  const want = heading.replace(/^#+\s*/, "").trim().toLowerCase();
  const at = lines.findIndex((line) => {
    const match = line.match(/^#{1,6}\s+(.*?)\s*$/);
    return match !== null && match[1].toLowerCase() === want;
  });
  if (at >= 0) {
    return [...lines.slice(0, at + 1), "", ...block, "", ...lines.slice(at + 1)].join("\n");
  }
  const trimmed = text.replace(/\n+$/, "");
  const separator = trimmed === "" ? "" : "\n\n";
  return `${trimmed}${separator}${block.join("\n")}
`;
}

// src/main.ts
var VIEW_TYPE = "bases-serializer";
var DEFAULT_KEY = "default";
var MENU_GAP = 2;
var FORMATS = [
  ["list", "List"],
  ["checklist", "Checklist"],
  ["numbered", "Numbered"],
  ["table", "Table"]
];
var FORMAT_LABELS = Object.fromEntries(FORMATS);
var FORMAT_ICONS = {
  list: "list",
  checklist: "list-checks",
  numbered: "list-ordered",
  table: "table"
};
function countLabel(count) {
  return `${count} row${count === 1 ? "" : "s"}`;
}
var SerializerView = class extends import_obsidian.BasesView {
  constructor(controller, containerEl) {
    super(controller);
    this.type = VIEW_TYPE;
    this.timer = null;
    this.containerEl = containerEl;
    containerEl.empty();
    containerEl.addClass("bases-serializer");
    const toolbar = containerEl.createDiv({ cls: "bases-serializer-toolbar" });
    const split = toolbar.createDiv({ cls: "bases-serializer-split" });
    this.buttonEl = split.createEl("button", { cls: "mod-cta bases-serializer-serialize" });
    this.iconEl = this.buttonEl.createSpan({ cls: "bases-serializer-icon" });
    (0, import_obsidian.setIcon)(this.iconEl, "snowflake");
    this.labelEl = this.buttonEl.createSpan({ cls: "bases-serializer-label", text: "Serialize now" });
    this.buttonEl.addEventListener("click", () => {
      void this.serialize(true);
    });
    this.menuBtnEl = split.createEl("button", { cls: "mod-cta bases-serializer-menu" });
    this.menuBtnEl.setAttribute("aria-label", "More serialize actions");
    (0, import_obsidian.setIcon)(this.menuBtnEl.createSpan({ cls: "bases-serializer-icon" }), "chevron-down");
    this.menuBtnEl.addEventListener("click", () => this.openMenu());
    this.formatBtn = toolbar.createEl("button", { cls: "bases-serializer-format" });
    this.formatBtn.setAttribute("aria-label", "Format");
    this.formatBtn.setAttribute("title", "Format");
    this.formatLabelEl = this.formatBtn.createSpan({ cls: "bases-serializer-format-label" });
    (0, import_obsidian.setIcon)(this.formatBtn.createSpan({ cls: "bases-serializer-format-caret" }), "chevron-down");
    this.formatBtn.addEventListener("click", () => this.openFormatMenu());
    this.statusEl = toolbar.createDiv({ cls: "bases-serializer-status" });
    this.hintEl = containerEl.createDiv({ cls: "bases-serializer-hint" });
    this.previewWrapEl = containerEl.createDiv({ cls: "bases-serializer-preview-wrap" });
    this.previewEl = this.previewWrapEl.createDiv({ cls: "bases-serializer-preview markdown-rendered" });
    this.previewEl.addEventListener("scroll", () => {
      this.previewEl.toggleClass("is-scrolled", this.previewEl.scrollTop > 2);
    });
  }
  onDataUpdated() {
    this.render();
  }
  render() {
    var _a, _b, _c;
    const format = this.format();
    this.formatLabelEl.setText((_a = FORMAT_LABELS[format]) != null ? _a : format);
    const body = this.body();
    this.previewWrapEl.style.setProperty(
      "--bases-serializer-preview-height",
      String(this.config.get("previewHeight") || "50vh")
    );
    this.previewEl.empty();
    const finish = () => {
      this.previewEl.toggleClass(
        "is-scrollable",
        this.previewEl.scrollHeight > this.previewEl.clientHeight + 1
      );
      this.previewEl.toggleClass("is-scrolled", this.previewEl.scrollTop > 2);
    };
    if (body) {
      const sourcePath = (_c = (_b = this.app.workspace.getActiveFile()) == null ? void 0 : _b.path) != null ? _c : "";
      void import_obsidian.MarkdownRenderer.render(this.app, body, this.previewEl, sourcePath, this).then(finish);
    } else {
      this.previewEl.setText("(no rows)");
      finish();
    }
    const { embedded } = this.embedInfo();
    this.labelEl.setText(embedded ? "Serialize here" : "Serialize now");
    const file = this.targetFile(embedded);
    const where = file ? file.path : embedded ? "no active note" : "no target";
    this.statusEl.setText(`${countLabel(this.data.data.length)} \xB7 ${where}`);
    if (!embedded && !file) {
      this.hintEl.setText(
        "Not embedded. Set a Target note in the Standalone options, or embed this Base in a note, to serialize."
      );
    } else {
      this.hintEl.empty();
    }
    if (Boolean(this.config.get("auto")) && embedded) {
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        void this.serialize(false);
      }, 800);
    }
  }
  /** Whether this view is embedded in a note, and the embed's `src`. */
  embedInfo() {
    var _a, _b, _c;
    const embed = this.containerEl.closest(".internal-embed, .markdown-embed");
    if (!embed) return { embedded: false, anchor: "" };
    const withSrc = (_a = this.containerEl.closest("[src]")) != null ? _a : embed;
    const src = (_b = withSrc.getAttribute("src")) != null ? _b : "";
    return { embedded: true, anchor: (_c = src.split("/").pop()) != null ? _c : src };
  }
  format() {
    return this.config.get("format") || "list";
  }
  link(entry) {
    const style = String(this.config.get("linkStyle") || "wikilink");
    if (style === "none") return entry.file.basename;
    if (style === "markdown") {
      return `[${entry.file.basename}](${entry.file.path.replace(/ /g, "%20")})`;
    }
    try {
      return this.app.fileManager.generateMarkdownLink(entry.file, "");
    } catch (e) {
      return `[[${entry.file.path.replace(/\.md$/, "")}]]`;
    }
  }
  cell(entry, property) {
    const value = entry.getValue(property);
    return value ? value.toString() : "";
  }
  row(entry) {
    const order = this.config.getOrder();
    const cells = order.map((property) => this.cell(entry, property));
    const values = {};
    order.forEach((property, index) => {
      values[property] = cells[index];
      values[this.config.getDisplayName(property)] = cells[index];
    });
    return { link: this.link(entry), cells, title: entry.file.basename, path: entry.file.path, values };
  }
  rows() {
    return this.data.data.map((entry) => this.row(entry));
  }
  headers() {
    return ["File", ...this.config.getOrder().map((property) => this.config.getDisplayName(property))];
  }
  options() {
    const format = this.format();
    const order = this.config.getOrder();
    const suffixProperty = String(this.config.get("suffix") || "");
    const detailKeys = String(this.config.get("detailKeys") || "").split(",").map((key) => key.trim()).filter(Boolean);
    let suffixIndex;
    if ((format === "checklist" || format === "numbered") && suffixProperty) {
      const index = order.indexOf(suffixProperty);
      if (index >= 0) suffixIndex = index;
    }
    return {
      format,
      suffixIndex,
      headers: this.headers(),
      template: String(this.config.get("template") || "") || void 0,
      groupTemplate: String(this.config.get("groupTemplate") || "") || void 0,
      properties: String(this.config.get("props") || "none"),
      propertySeparator: String(this.config.get("propSep") || " \xB7 "),
      propertyLabels: Boolean(this.config.get("propLabels")),
      detailKeys: detailKeys.length > 0 ? detailKeys : void 0
    };
  }
  body() {
    const options = this.options();
    let rendered;
    if (Boolean(this.config.get("group")) && this.data.groupedData.some((group) => group.hasKey())) {
      const groups = this.data.groupedData.map((group) => ({
        title: group.hasKey() && group.key ? group.key.toString() : null,
        rows: group.entries.map((entry) => this.row(entry))
      }));
      rendered = renderGroups(groups, options);
    } else {
      rendered = renderRows(this.rows(), options);
    }
    const content = rendered.trim() ? rendered : String(this.config.get("empty") || "");
    const preamble = String(this.config.get("preamble") || "").trim();
    return preamble ? `${preamble}

${content}` : content;
  }
  targetFile(embedded) {
    if (embedded) {
      const active = this.app.workspace.getActiveFile();
      if (active) return active;
    }
    const target = String(this.config.get("target") || "").trim();
    if (!target) return null;
    const path = target.endsWith(".md") ? target : `${target}.md`;
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof import_obsidian.TFile ? file : null;
  }
  /** Anchor a menu below its control, using Obsidian's own pattern (`width` +
   *  `overlap`) so it aligns to the control's edge and auto-flips when it would
   *  overflow. `Menu` adds a 2px top offset itself, giving a native-looking gap. */
  showBelow(menu, el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    menu.showAtPosition({
      x: rect.x,
      y: rect.bottom + MENU_GAP,
      width: rect.width,
      overlap: true
    });
  }
  openFormatMenu() {
    const current = this.format();
    const menu = new import_obsidian.Menu();
    for (const [value, label] of FORMATS) {
      menu.addItem((item) => {
        item.setTitle(label);
        item.setIcon(FORMAT_ICONS[value]);
        item.setChecked(value === current);
        item.onClick(() => {
          this.config.set("format", value);
          this.render();
        });
      });
    }
    this.showBelow(menu, this.formatBtn);
  }
  openMenu() {
    const menu = new import_obsidian.Menu();
    menu.addItem(
      (item) => item.setTitle("Keep live view").setIcon("file-output").onClick(() => void this.serialize(true, false))
    );
    menu.addItem(
      (item) => item.setTitle("Freeze \xB7 replace embed with text").setIcon("file-x").onClick(() => void this.serialize(true, true))
    );
    menu.addSeparator();
    menu.addItem(
      (item) => item.setTitle("Copy Markdown").setIcon("copy").onClick(() => void this.copyMarkdown())
    );
    menu.addItem(
      (item) => item.setTitle("Open target note").setIcon("file-symlink").onClick(() => {
        const file = this.targetFile(this.embedInfo().embedded);
        if (file) void this.app.workspace.getLeaf(false).openFile(file);
      })
    );
    menu.addItem(
      (item) => item.setTitle("Remove serialized block").setIcon("trash").onClick(() => void this.removeBlock())
    );
    this.showBelow(menu, this.menuBtnEl);
  }
  key() {
    return String(this.config.get("key") || this.config.name || DEFAULT_KEY);
  }
  async copyMarkdown() {
    const body = this.body();
    if (!body.trim()) {
      new import_obsidian.Notice("Bases Serializer: nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(body);
      new import_obsidian.Notice(`Bases Serializer: copied ${countLabel(this.data.data.length)} to clipboard`);
    } catch (e) {
      new import_obsidian.Notice("Bases Serializer: could not copy to clipboard");
    }
  }
  async removeBlock() {
    const { embedded } = this.embedInfo();
    const file = this.targetFile(embedded);
    if (!file) return;
    const key = this.key();
    await this.app.vault.process(file, (data) => stripBlock(data, key));
    new import_obsidian.Notice(`Bases Serializer: removed block "${key}" from ${file.path}`);
  }
  async serialize(notify, solidifyOverride) {
    const { embedded, anchor } = this.embedInfo();
    const file = this.targetFile(embedded);
    if (!file) {
      if (notify) {
        new import_obsidian.Notice(
          embedded ? "Bases Serializer: no active note to write into" : "Bases Serializer: set a target note (or embed this view in a note)"
        );
      }
      return;
    }
    const key = this.key();
    const body = this.body();
    const meta = { format: String(this.config.get("format") || "list") };
    const solidify = embedded && (solidifyOverride != null ? solidifyOverride : Boolean(this.config.get("solidify")));
    await this.app.vault.process(file, (data) => {
      if (!embedded) {
        const section = String(this.config.get("section") || "").trim();
        return section ? upsertBlockUnderHeading(data, section, key, body, meta) : upsertBlock(data, key, body, meta);
      }
      return solidify ? solidifyAnchorToText(data, anchor, key, body) : upsertBlockAfterAnchor(data, anchor, key, body, meta);
    });
    if (notify) {
      new import_obsidian.Notice(`Bases Serializer: ${countLabel(this.data.data.length)} \u2192 ${file.path}`);
    }
  }
};
var BasesSerializerPlugin = class extends import_obsidian.Plugin {
  async onload() {
    const registered = this.registerBasesView(VIEW_TYPE, {
      name: "Serializer",
      icon: "file-output",
      factory: (controller, containerEl) => new SerializerView(controller, containerEl),
      options: () => [
        {
          type: "group",
          displayName: "Standalone",
          items: [
            {
              type: "file",
              key: "target",
              displayName: "Target note",
              placeholder: "folder/note.md"
            },
            {
              type: "text",
              key: "section",
              displayName: "Section heading",
              placeholder: "## Tasks"
            }
          ]
        },
        {
          type: "group",
          displayName: "Output",
          items: [
            {
              type: "dropdown",
              key: "format",
              displayName: "Format",
              default: "list",
              options: { list: "List", checklist: "Checklist", numbered: "Numbered", table: "Table" }
            },
            {
              type: "dropdown",
              key: "linkStyle",
              displayName: "Link style",
              default: "wikilink",
              options: {
                wikilink: "Wikilink [[Note]]",
                markdown: "Markdown [title](path)",
                none: "Plain text"
              }
            },
            {
              type: "text",
              key: "template",
              displayName: "Row template",
              placeholder: "- {link} \u2014 {note.due}"
            },
            {
              type: "text",
              key: "preamble",
              displayName: "Heading / preamble",
              placeholder: "## Tasks"
            },
            { type: "text", key: "key", displayName: "Sentinel key", placeholder: "default: view name" }
          ]
        },
        {
          type: "group",
          displayName: "Item details",
          items: [
            {
              type: "dropdown",
              key: "props",
              displayName: "Item details",
              default: "none",
              options: { none: "Hide", inline: "Inline", subitems: "Sub-items" }
            },
            {
              type: "text",
              key: "detailKeys",
              displayName: "Detail properties",
              placeholder: "note.due, status (empty = all columns)"
            },
            { type: "text", key: "propSep", displayName: "Details separator", placeholder: " \xB7 " },
            { type: "toggle", key: "propLabels", displayName: "Show property names", default: false },
            { type: "text", key: "suffix", displayName: "Trailing property", placeholder: "note.due" }
          ]
        },
        {
          type: "group",
          displayName: "Behaviour",
          items: [
            {
              type: "toggle",
              key: "group",
              displayName: "Group headings",
              default: true
            },
            { type: "text", key: "groupTemplate", displayName: "Group template", placeholder: "### {group} ({count})" },
            { type: "text", key: "empty", displayName: "No-results text", placeholder: "e.g. _nothing here_" },
            {
              type: "text",
              key: "previewHeight",
              displayName: "Preview max height",
              placeholder: "50vh"
            },
            { type: "toggle", key: "auto", displayName: "Auto-serialize (embedded)", default: false },
            {
              type: "toggle",
              key: "solidify",
              displayName: "Freeze (replace embed with text)",
              default: false
            }
          ]
        }
      ]
    });
    if (!registered) {
      new import_obsidian.Notice("Bases Serializer: Bases is not enabled in this vault");
    }
  }
};
