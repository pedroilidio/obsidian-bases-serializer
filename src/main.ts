import {
  BasesAllOptions,
  BasesEntry,
  BasesPropertyId,
  BasesView,
  MarkdownRenderer,
  Notice,
  Plugin,
  QueryController,
  TFile,
} from "obsidian";

import { Format, SerializedRow, renderRows } from "./render";
import { upsertBlock, upsertBlockAfterAnchor, upsertBlockReplacingAnchor } from "./sentinels";

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

  private rows(): SerializedRow[] {
    const order = this.config.getOrder();
    return this.data.data.map((entry) => ({
      link: this.link(entry),
      cells: order.map((property) => this.cell(entry, property)),
    }));
  }

  private link(entry: BasesEntry): string {
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

    let suffixIndex: number | undefined;
    if (format === "checklist" && typeof suffixProperty === "string" && suffixProperty) {
      const index = order.indexOf(suffixProperty as BasesPropertyId);
      if (index >= 0) suffixIndex = index;
    }

    return renderRows(this.rows(), format, suffixIndex, this.headers());
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

  async serialize(notify: boolean): Promise<void> {
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

    const key = String(this.config.get("key") || this.config.name || DEFAULT_KEY);
    const body = this.body();
    const meta = { format: String(this.config.get("format") || "list") };
    const replaceEmbed = Boolean(this.config.get("replaceEmbed"));

    await this.app.vault.process(file, (data) => {
      if (!embedded) return upsertBlock(data, key, body, meta);
      return replaceEmbed
        ? upsertBlockReplacingAnchor(data, anchor, key, body, meta)
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
          options: { list: "List", checklist: "Checklist", table: "Table" },
        },
        {
          type: "text",
          key: "suffix",
          displayName: "Checklist suffix property",
          placeholder: "note.due",
        },
        {
          type: "toggle",
          key: "auto",
          displayName: "Auto-serialize when embedded",
          default: false,
        },
        {
          type: "toggle",
          key: "replaceEmbed",
          displayName: "Remove the embed after serializing",
          default: false,
        },
      ],
    });

    if (!registered) {
      new Notice("Bases Serializer: Bases is not enabled in this vault");
    }
  }
}
