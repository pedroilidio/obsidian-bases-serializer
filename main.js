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
function renderRow(row, format, suffixIndex) {
  if (format === "checklist") {
    const suffix = suffixIndex !== void 0 && row.cells[suffixIndex] ? ` \u2014 ${row.cells[suffixIndex]}` : "";
    return `- [ ] ${row.link}${suffix}`;
  }
  return `- ${row.link}`;
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
function renderRows(rows, format = "list", suffixIndex, headers = []) {
  if (rows.length === 0) return "";
  if (format === "table") return renderTable(rows, headers);
  return rows.map((row) => renderRow(row, format, suffixIndex)).join("\n");
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

// src/main.ts
var VIEW_TYPE = "bases-serializer";
var DEFAULT_KEY = "default";
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
    this.buttonEl = toolbar.createEl("button", { text: "Serialize now" });
    this.buttonEl.addEventListener("click", () => {
      void this.serialize(true);
    });
    this.statusEl = toolbar.createDiv({ cls: "bases-serializer-status" });
    this.previewEl = containerEl.createDiv({ cls: "bases-serializer-preview" });
  }
  onDataUpdated() {
    var _a, _b;
    const body = this.body();
    this.previewEl.empty();
    if (body) {
      const sourcePath = (_b = (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) != null ? _b : "";
      void import_obsidian.MarkdownRenderer.render(this.app, body, this.previewEl, sourcePath, this);
    } else {
      this.previewEl.setText("(no rows)");
    }
    const { embedded } = this.embedInfo();
    this.buttonEl.setText(embedded ? "Serialize here" : "Serialize now");
    this.statusEl.setText(
      embedded ? `${countLabel(this.data.data.length)} \xB7 embedded` : `${countLabel(this.data.data.length)} \xB7 set a target note`
    );
    if (this.config.get("auto") && embedded) {
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
  rows() {
    const order = this.config.getOrder();
    return this.data.data.map((entry) => ({
      link: this.link(entry),
      cells: order.map((property) => this.cell(entry, property))
    }));
  }
  link(entry) {
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
  headers() {
    return ["File", ...this.config.getOrder().map((property) => this.config.getDisplayName(property))];
  }
  body() {
    const format = this.config.get("format") || "list";
    const order = this.config.getOrder();
    const suffixProperty = this.config.get("suffix");
    let suffixIndex;
    if (format === "checklist" && typeof suffixProperty === "string" && suffixProperty) {
      const index = order.indexOf(suffixProperty);
      if (index >= 0) suffixIndex = index;
    }
    return renderRows(this.rows(), format, suffixIndex, this.headers());
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
  async serialize(notify) {
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
    const key = String(this.config.get("key") || this.config.name || DEFAULT_KEY);
    const body = this.body();
    const meta = { format: String(this.config.get("format") || "list") };
    await this.app.vault.process(
      file,
      (data) => embedded ? upsertBlockAfterAnchor(data, anchor, key, body, meta) : upsertBlock(data, key, body, meta)
    );
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
          type: "file",
          key: "target",
          displayName: "Target note (standalone views)",
          placeholder: "folder/note.md"
        },
        {
          type: "text",
          key: "key",
          displayName: "Block key",
          placeholder: "default: view name"
        },
        {
          type: "dropdown",
          key: "format",
          displayName: "Format",
          default: "list",
          options: { list: "List", checklist: "Checklist", table: "Table" }
        },
        {
          type: "text",
          key: "suffix",
          displayName: "Checklist suffix property",
          placeholder: "note.due"
        },
        {
          type: "toggle",
          key: "auto",
          displayName: "Auto-serialize when embedded",
          default: false
        }
      ]
    });
    if (!registered) {
      new import_obsidian.Notice("Bases Serializer: Bases is not enabled in this vault");
    }
  }
};
