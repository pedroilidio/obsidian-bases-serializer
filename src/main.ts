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
} from "obsidian";

import { Format, SerializedRow, renderGroups, renderRows } from "./render";
import { solidifyAnchorToText, stripBlock, upsertBlock, upsertBlockAfterAnchor } from "./sentinels";
const VIEW_TYPE = "bases-serializer";
const DEFAULT_KEY = "default";

function countLabel(count: number): string {
  return `${count} row${count === 1 ? "" : "s"}`;
}

class SerializerView extends BasesView {
  type = VIEW_TYPE;
  private buttonEl: HTMLButtonElement;
  private previewEl: HTMLElement;
  private statusEl: HTMLElement;
  private containerEl: HTMLElement;
  private timer: number | null = null;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.containerEl = containerEl;
    containerEl.empty();
    containerEl.addClass("bases-serializer");

    const toolbar = containerEl.createDiv({ cls: "bases-serializer-toolbar" });
    this.buttonEl = toolbar.createEl("button", { text: "Serialize now" });
    this.buttonEl.addEventListener("click", () => {
      void this.serialize(true);
    });
    const menuButton = toolbar.createEl("button", { text: "▾", cls: "bases-serializer-menu" });
    menuButton.setAttribute("aria-label", "More serialize actions");
    menuButton.addEventListener("click", (event) => this.openMenu(event));
    this.statusEl = toolbar.createDiv({ cls: "bases-serializer-status" });

    this.previewEl = containerEl.createDiv({ cls: "bases-serializer-preview" });
  }

  onDataUpdated(): void {
    const body = this.body();
    this.previewEl.empty();
    if (body) {
      const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
      void MarkdownRenderer.render(this.app, body, this.previewEl, sourcePath, this);
    } else {
      this.previewEl.setText("(no rows)");
    }

    const { embedded } = this.embedInfo();
    this.buttonEl.setText(embedded ? "Serialize here" : "Serialize now");
    this.statusEl.setText(
      embedded
        ? `${countLabel(this.data.data.length)} · embedded`
        : `${countLabel(this.data.data.length)} · set a target note`
    );

    if (this.config.get("auto") && embedded) {
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
    // Prefer the innermost element that carries a `src` attribute.
    const withSrc = this.containerEl.closest("[src]") ?? embed;
    const src = withSrc.getAttribute("src") ?? "";
    return { embedded: true, anchor: src.split("/").pop() ?? src };
  }

  private row(entry: BasesEntry): SerializedRow {
    const order = this.config.getOrder();
    const cells = order.map((property) => this.cell(entry, property));
    const values: Record<string, string> = {};
    order.forEach((property, index) => {
      values[property] = cells[index];
      values[this.config.getDisplayName(property)] = cells[index];
    });
    return {
      link: this.link(entry),
      cells,
      title: entry.file.basename,
      path: entry.file.path,
      values,
    };
  }

  private rows(): SerializedRow[] {
    return this.data.data.map((entry) => this.row(entry));
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

  private headers(): string[] {
    return ["File", ...this.config.getOrder().map((property) => this.config.getDisplayName(property))];
  }

  private body(): string {
    const format = (this.config.get("format") as Format) || "list";
    const order = this.config.getOrder();
    const suffixProperty = this.config.get("suffix");
    const template = String(this.config.get("template") || "") || undefined;

    let suffixIndex: number | undefined;
    if (
      (format === "checklist" || format === "numbered") &&
      typeof suffixProperty === "string" &&
      suffixProperty
    ) {
      const index = order.indexOf(suffixProperty as BasesPropertyId);
      if (index >= 0) suffixIndex = index;
    }

    const headers = this.headers();
    let rendered: string;

    if (Boolean(this.config.get("group")) && this.data.groupedData.some((group) => group.hasKey())) {
      const groups = this.data.groupedData.map((group) => ({
        title: group.hasKey() && group.key ? group.key.toString() : null,
        rows: group.entries.map((entry) => this.row(entry)),
      }));
      rendered = renderGroups(groups, format, suffixIndex, headers, template);
    } else {
      rendered = renderRows(this.rows(), format, suffixIndex, headers, template);
    }

    return rendered.trim() ? rendered : String(this.config.get("empty") || "");
  }

  private targetFile(embedded: boolean): TFile | null {
    // Embedded: write into the note that contains the embed (its `this`).
    if (embedded) {
      const active = this.app.workspace.getActiveFile();
      if (active) return active;
    }
    // Standalone: use the configured target note.
    const target = String(this.config.get("target") || "").trim();
    if (!target) return null;
    const path = target.endsWith(".md") ? target : `${target}.md`;
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  private openMenu(event: MouseEvent): void {
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle("Serialize (keep embed)")
        .setIcon("file-output")
        .onClick(() => void this.serialize(true, false))
    );
    menu.addItem((item) =>
      item
        .setTitle("Serialize & solidify (remove embed + sentinels)")
        .setIcon("file-x")
        .onClick(() => void this.serialize(true, true))
    );
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle("Copy Markdown")
        .setIcon("copy")
        .onClick(() => void navigator.clipboard.writeText(this.body()))
    );
    menu.addItem((item) =>
      item.setTitle("Remove serialized block").setIcon("trash").onClick(() => void this.removeBlock())
    );
    menu.showAtMouseEvent(event);
  }

  private key(): string {
    return String(this.config.get("key") || this.config.name || DEFAULT_KEY);
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
    const meta = { format: String(this.config.get("format") || "list") };
    const solidify = embedded && (solidifyOverride ?? Boolean(this.config.get("solidify")));

    await this.app.vault.process(file, (data) => {
      if (!embedded) return upsertBlock(data, key, body, meta);
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
          type: "file",
          key: "target",
          displayName: "Target note (standalone views)",
          placeholder: "folder/note.md",
        },
        {
          type: "text",
          key: "key",
          displayName: "Block key",
          placeholder: "default: view name",
        },
        {
          type: "dropdown",
          key: "format",
          displayName: "Format",
          default: "list",
          options: { list: "List", checklist: "Checklist", numbered: "Numbered", table: "Table" },
        },
        {
          type: "dropdown",
          key: "linkStyle",
          displayName: "Link style",
          default: "wikilink",
          options: { wikilink: "Wikilink [[Note]]", markdown: "Markdown [title](path)", none: "Plain text" },
        },
        {
          type: "text",
          key: "template",
          displayName: "Line template (overrides format)",
          placeholder: "- {link} — {note.due}",
        },
        {
          type: "text",
          key: "suffix",
          displayName: "Suffix property (checklist / numbered)",
          placeholder: "note.due",
        },
        {
          type: "text",
          key: "empty",
          displayName: "Empty-state text",
          placeholder: "e.g. _nothing here_",
        },
        {
          type: "toggle",
          key: "auto",
          displayName: "Auto-serialize when embedded",
          default: false,
        },
        {
          type: "toggle",
          key: "solidify",
          displayName: "Fully solidify (remove embed and sentinels)",
          default: false,
        },
        {
          type: "toggle",
          key: "group",
          displayName: "Group headings (from the Base groupBy)",
          default: true,
        },
      ],
    });

    if (!registered) {
      new Notice("Bases Serializer: Bases is not enabled in this vault");
    }
  }
}
