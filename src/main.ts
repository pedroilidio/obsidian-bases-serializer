import {
  BasesAllOptions,
  BasesEntry,
  BasesPropertyId,
  BasesView,
  MarkdownRenderer,
  Menu,
  Notice,
  Plugin,
  QueryController,
  TFile,
  setIcon,
} from "obsidian";

import { Format, PropertiesMode, RenderOptions, SerializedRow, renderGroups, renderRows } from "./render";
import {
  solidifyAnchorToText,
  stripBlock,
  upsertBlock,
  upsertBlockAfterAnchor,
  upsertBlockUnderHeading,
} from "./sentinels";

const VIEW_TYPE = "bases-serializer";
const DEFAULT_KEY = "default";
/** Extra gap (px) between a control and its menu; `Menu` adds 2px on top. */
const MENU_GAP = 2;
const FORMATS: Array<[Format, string]> = [
  ["list", "List"],
  ["checklist", "Checklist"],
  ["numbered", "Numbered"],
  ["table", "Table"],
];
const FORMAT_LABELS: Record<string, string> = Object.fromEntries(FORMATS);
const FORMAT_ICONS: Record<Format, string> = {
  list: "list",
  checklist: "list-checks",
  numbered: "list-ordered",
  table: "table",
};

function countLabel(count: number): string {
  return `${count} row${count === 1 ? "" : "s"}`;
}

class SerializerView extends BasesView {
  type = VIEW_TYPE;
  private buttonEl: HTMLButtonElement;
  private iconEl: HTMLElement;
  private labelEl: HTMLSpanElement;
  private previewWrapEl: HTMLElement;
  private previewEl: HTMLElement;
  private statusEl: HTMLElement;
  private hintEl: HTMLElement;
  private formatBtn: HTMLButtonElement;
  private formatIconEl: HTMLElement;
  private formatLabelEl: HTMLSpanElement;
  private menuBtnEl: HTMLButtonElement;
  private containerEl: HTMLElement;
  private timer: number | null = null;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
    containerEl.empty();
    containerEl.addClass("bases-serializer");

    const toolbar = containerEl.createDiv({ cls: "bases-serializer-toolbar" });

    const split = toolbar.createDiv({ cls: "bases-serializer-split" });
    this.buttonEl = split.createEl("button", { cls: "mod-cta bases-serializer-serialize" });
    this.iconEl = this.buttonEl.createSpan({ cls: "bases-serializer-icon" });
    setIcon(this.iconEl, "snowflake");
    this.labelEl = this.buttonEl.createSpan({ cls: "bases-serializer-label", text: "Serialize now" });
    this.buttonEl.addEventListener("click", () => {
      void this.serialize(true);
    });
    this.menuBtnEl = split.createEl("button", { cls: "mod-cta bases-serializer-menu" });
    this.menuBtnEl.setAttribute("aria-label", "More serialize actions");
    setIcon(this.menuBtnEl.createSpan({ cls: "bases-serializer-icon" }), "chevron-down");
    this.menuBtnEl.addEventListener("click", () => this.openMenu());

    this.formatBtn = toolbar.createEl("button", { cls: "bases-serializer-format" });
    this.formatBtn.setAttribute("aria-label", "Format");
    this.formatBtn.setAttribute("title", "Format");
    this.formatIconEl = this.formatBtn.createSpan({ cls: "bases-serializer-format-icon" });
    this.formatLabelEl = this.formatBtn.createSpan({ cls: "bases-serializer-format-label" });
    setIcon(this.formatBtn.createSpan({ cls: "bases-serializer-format-caret" }), "chevron-down");
    this.formatBtn.addEventListener("click", () => this.openFormatMenu());

    this.statusEl = toolbar.createDiv({ cls: "bases-serializer-status" });
    this.hintEl = containerEl.createDiv({ cls: "bases-serializer-hint" });
    this.previewWrapEl = containerEl.createDiv({ cls: "bases-serializer-preview-wrap" });
    this.previewEl = this.previewWrapEl.createDiv({ cls: "bases-serializer-preview markdown-rendered" });
    this.previewEl.addEventListener("scroll", () => {
      this.previewEl.toggleClass("is-scrolled", this.previewEl.scrollTop > 2);
    });
  }

  onDataUpdated(): void {
    this.render();
  }

  private render(): void {
    const format = this.format();
    setIcon(this.formatIconEl, FORMAT_ICONS[format] ?? "list");
    this.formatLabelEl.setText(FORMAT_LABELS[format] ?? format);

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
      const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
      void MarkdownRenderer.render(this.app, body, this.previewEl, sourcePath, this).then(finish);
    } else {
      this.previewEl.setText("(no rows)");
      finish();
    }

    const { embedded } = this.embedInfo();
    this.labelEl.setText(embedded ? "Serialize here" : "Serialize now");
    const file = this.targetFile(embedded);
    const where = file ? file.path : embedded ? "no active note" : "no target";
    this.statusEl.setText(`${countLabel(this.data.data.length)} · ${where}`);

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
  private embedInfo(): { embedded: boolean; anchor: string } {
    const embed = this.containerEl.closest(".internal-embed, .markdown-embed");
    if (!embed) return { embedded: false, anchor: "" };
    const withSrc = this.containerEl.closest("[src]") ?? embed;
    const src = withSrc.getAttribute("src") ?? "";
    return { embedded: true, anchor: src.split("/").pop() ?? src };
  }

  /** The format configured in the view options (the native "Format" dropdown). */
  private baseFormat(): Format {
    return ((this.config.get("format") as Format) || "list");
  }

  /** The in-view picker override; empty means "follow the view options". */
  private formatOverride(): string {
    return String(this.config.get("formatOverride") || "");
  }

  /** The effective format: the in-view override, else the view's configured one. */
  private format(): Format {
    return ((this.formatOverride() as Format) || this.baseFormat());
  }

  private link(entry: BasesEntry): string {
    const style = String(this.config.get("linkStyle") || "wikilink");
    if (style === "none") return entry.file.basename;
    if (style === "markdown") {
      return `[${entry.file.basename}](${entry.file.path.replace(/ /g, "%20")})`;
    }
    try {
      return this.app.fileManager.generateMarkdownLink(entry.file, "");
    } catch {
      return `[[${entry.file.path.replace(/\.md$/, "")}]]`;
    }
  }

  private cell(entry: BasesEntry, property: BasesPropertyId): string {
    const value = entry.getValue(property);
    return value ? value.toString() : "";
  }

  private row(entry: BasesEntry): SerializedRow {
    const order = this.config.getOrder();
    const cells = order.map((property) => this.cell(entry, property));
    const values: Record<string, string> = {};
    order.forEach((property, index) => {
      values[property] = cells[index];
      values[this.config.getDisplayName(property)] = cells[index];
    });
    return { link: this.link(entry), cells, title: entry.file.basename, path: entry.file.path, values };
  }

  private rows(): SerializedRow[] {
    return this.data.data.map((entry) => this.row(entry));
  }

  private headers(): string[] {
    return ["File", ...this.config.getOrder().map((property) => this.config.getDisplayName(property))];
  }

  private options(): RenderOptions {
    const format = this.format();
    const order = this.config.getOrder();
    const suffixProperty = String(this.config.get("suffix") || "");
    const detailKeys = String(this.config.get("detailKeys") || "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);

    let suffixIndex: number | undefined;
    if ((format === "checklist" || format === "numbered") && suffixProperty) {
      const index = order.indexOf(suffixProperty as BasesPropertyId);
      if (index >= 0) suffixIndex = index;
    }

    return {
      format,
      suffixIndex,
      headers: this.headers(),
      template: String(this.config.get("template") || "") || undefined,
      groupTemplate: String(this.config.get("groupTemplate") || "") || undefined,
      properties: String(this.config.get("props") || "none") as PropertiesMode,
      propertySeparator: String(this.config.get("propSep") || " · "),
      propertyLabels: Boolean(this.config.get("propLabels")),
      detailKeys: detailKeys.length > 0 ? detailKeys : undefined,
    };
  }

  private body(): string {
    const options = this.options();
    let rendered: string;

    if (Boolean(this.config.get("group")) && this.data.groupedData.some((group) => group.hasKey())) {
      const groups = this.data.groupedData.map((group) => ({
        title: group.hasKey() && group.key ? group.key.toString() : null,
        rows: group.entries.map((entry) => this.row(entry)),
      }));
      rendered = renderGroups(groups, options);
    } else {
      rendered = renderRows(this.rows(), options);
    }

    const content = rendered.trim() ? rendered : String(this.config.get("empty") || "");
    const preamble = String(this.config.get("preamble") || "").trim();
    return preamble ? `${preamble}\n\n${content}` : content;
  }

  private targetFile(embedded: boolean): TFile | null {
    if (embedded) {
      const active = this.app.workspace.getActiveFile();
      if (active) return active;
    }
    const target = String(this.config.get("target") || "").trim();
    if (!target) return null;
    const path = target.endsWith(".md") ? target : `${target}.md`;
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  /** Anchor a menu below its control, using Obsidian's own pattern (`width` +
   *  `overlap`) so it aligns to the control's edge and auto-flips when it would
   *  overflow. `Menu` adds a 2px top offset itself, giving a native-looking gap. */
  private showBelow(menu: Menu, el: HTMLElement | null): void {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    menu.showAtPosition({
      x: rect.x,
      y: rect.bottom + MENU_GAP,
      width: rect.width,
      overlap: true,
    });
  }

  private openFormatMenu(): void {
    const override = this.formatOverride();
    const base = this.baseFormat();
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle(`Default (${FORMAT_LABELS[base] ?? base})`)
        .setIcon("settings-2")
        .setChecked(!override)
        .onClick(() => this.setFormatOverride(""))
    );
    menu.addSeparator();
    for (const [value, label] of FORMATS) {
      menu.addItem((item) => {
        item.setTitle(label);
        item.setIcon(FORMAT_ICONS[value]);
        item.setChecked(override === value);
        item.onClick(() => this.setFormatOverride(value));
      });
    }
    this.showBelow(menu, this.formatBtn);
  }

  /** Set (or clear, with "") the in-view format override and re-render. */
  private setFormatOverride(value: string): void {
    this.config.set("formatOverride", value);
    this.render();
  }

  private openMenu(): void {
    const menu = new Menu();
    menu.addItem((item) =>
      item.setTitle("Keep live view").setIcon("file-output").onClick(() => void this.serialize(true, false))
    );
    menu.addItem((item) =>
      item
        .setTitle("Freeze · replace embed with text")
        .setIcon("file-x")
        .onClick(() => void this.serialize(true, true))
    );
    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle("Copy Markdown").setIcon("copy").onClick(() => void this.copyMarkdown())
    );
    menu.addItem((item) =>
      item.setTitle("Open target note").setIcon("file-symlink").onClick(() => {
        const file = this.targetFile(this.embedInfo().embedded);
        if (file) void this.app.workspace.getLeaf(false).openFile(file);
      })
    );
    menu.addItem((item) =>
      item.setTitle("Remove serialized block").setIcon("trash").onClick(() => void this.removeBlock())
    );
    this.showBelow(menu, this.menuBtnEl);
  }

  private key(): string {
    return String(this.config.get("key") || this.config.name || DEFAULT_KEY);
  }

  private async copyMarkdown(): Promise<void> {
    const body = this.body();
    if (!body.trim()) {
      new Notice("Bases Serializer: nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(body);
      new Notice(`Bases Serializer: copied ${countLabel(this.data.data.length)} to clipboard`);
    } catch {
      new Notice("Bases Serializer: could not copy to clipboard");
    }
  }

  private async removeBlock(): Promise<void> {
    const { embedded } = this.embedInfo();
    const file = this.targetFile(embedded);
    if (!file) return;
    const key = this.key();
    await this.app.vault.process(file, (data) => stripBlock(data, key));
    new Notice(`Bases Serializer: removed block "${key}" from ${file.path}`);
  }

  async serialize(notify: boolean, solidifyOverride?: boolean): Promise<void> {
    const { embedded, anchor } = this.embedInfo();
    const file = this.targetFile(embedded);
    if (!file) {
      if (notify) {
        new Notice(
          embedded
            ? "Bases Serializer: no active note to write into"
            : "Bases Serializer: set a target note (or embed this view in a note)"
        );
      }
      return;
    }

    const key = this.key();
    const body = this.body();
    const meta = { format: this.format() };
    const solidify = embedded && (solidifyOverride ?? Boolean(this.config.get("solidify")));

    await this.app.vault.process(file, (data) => {
      if (!embedded) {
        const section = String(this.config.get("section") || "").trim();
        return section
          ? upsertBlockUnderHeading(data, section, key, body, meta)
          : upsertBlock(data, key, body, meta);
      }
      return solidify
        ? solidifyAnchorToText(data, anchor, key, body)
        : upsertBlockAfterAnchor(data, anchor, key, body, meta);
    });

    if (notify) {
      new Notice(`Bases Serializer: ${countLabel(this.data.data.length)} → ${file.path}`);
    }
  }
}

export default class BasesSerializerPlugin extends Plugin {
  async onload(): Promise<void> {
    const registered = this.registerBasesView(VIEW_TYPE, {
      name: "Serializer",
      icon: "file-output",
      factory: (controller, containerEl) => new SerializerView(controller, containerEl),
      options: (): BasesAllOptions[] => [
        {
          type: "group",
          displayName: "Standalone",
          items: [
            {
              type: "file",
              key: "target",
              displayName: "Target note",
              placeholder: "folder/note.md",
            },
            {
              type: "text",
              key: "section",
              displayName: "Section heading",
              placeholder: "## Tasks",
            },
          ],
        },
        {
          type: "group",
          displayName: "Output",
          items: [
            {
              type: "dropdown",
              key: "format",
              displayName: "Default format",
              default: "list",
              options: { list: "List", checklist: "Checklist", numbered: "Numbered", table: "Table" },
            },
            {
              type: "dropdown",
              key: "linkStyle",
              displayName: "Link style",
              default: "wikilink",
              options: {
                wikilink: "Wikilink [[Note]]",
                markdown: "Markdown [title](path)",
                none: "Plain text",
              },
            },
            {
              type: "text",
              key: "template",
              displayName: "Row template",
              placeholder: "- {link} — {note.due}",
            },
            {
              type: "text",
              key: "preamble",
              displayName: "Heading / preamble",
              placeholder: "## Tasks",
            },
            { type: "text", key: "key", displayName: "Sentinel key", placeholder: "default: view name" },
          ],
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
              options: { none: "Hide", inline: "Inline", subitems: "Sub-items" },
            },
            {
              type: "text",
              key: "detailKeys",
              displayName: "Detail properties",
              placeholder: "note.due, status (empty = all columns)",
            },
            { type: "text", key: "propSep", displayName: "Details separator", placeholder: " · " },
            { type: "toggle", key: "propLabels", displayName: "Show property names", default: false },
            { type: "text", key: "suffix", displayName: "Trailing property", placeholder: "note.due" },
          ],
        },
        {
          type: "group",
          displayName: "Behaviour",
          items: [
            {
              type: "toggle",
              key: "group",
              displayName: "Group headings",
              default: true,
            },
            { type: "text", key: "groupTemplate", displayName: "Group template", placeholder: "### {group} ({count})" },
            { type: "text", key: "empty", displayName: "No-results text", placeholder: "e.g. _nothing here_" },
            {
              type: "text",
              key: "previewHeight",
              displayName: "Preview max height",
              placeholder: "50vh",
            },
            { type: "toggle", key: "auto", displayName: "Auto-serialize (embedded)", default: false },
            {
              type: "toggle",
              key: "solidify",
              displayName: "Freeze (replace embed with text)",
              default: false,
            },
          ],
        },
      ],
    });

    if (!registered) {
      new Notice("Bases Serializer: Bases is not enabled in this vault");
    }
  }
}
