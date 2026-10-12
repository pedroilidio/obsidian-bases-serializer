import {
  BasesAllOptions,
  BasesEntry,
  BasesPropertyId,
  BasesView,
  Notice,
  Plugin,
  QueryController,
  TFile,
} from "obsidian";

import { Format, SerializedRow, renderRows } from "./render";
import { upsertBlock } from "./sentinels";

const VIEW_TYPE = "bases-serializer";
const DEFAULT_KEY = "default";

class SerializerView extends BasesView {
  type = VIEW_TYPE;
  private previewEl: HTMLElement;
  private statusEl: HTMLElement;
  private timer: number | null = null;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    containerEl.empty();
    containerEl.addClass("bases-serializer");

    const toolbar = containerEl.createDiv({ cls: "bases-serializer-toolbar" });
    const button = toolbar.createEl("button", { text: "Serialize now" });
    button.addEventListener("click", () => {
      void this.serialize(true);
    });
    this.statusEl = toolbar.createDiv({ cls: "bases-serializer-status" });

    this.previewEl = containerEl.createEl("pre", { cls: "bases-serializer-preview" });
  }

  onDataUpdated(): void {
    const body = this.body();
    this.previewEl.setText(body || "(no rows)");
    this.statusEl.setText(`${this.data.data.length} row(s)`);

    if (this.config.get("auto")) {
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        void this.serialize(false);
      }, 800);
    }
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

  async serialize(notify: boolean): Promise<void> {
    const target = String(this.config.get("target") || "").trim();
    if (!target) {
      if (notify) new Notice("Bases Serializer: set a target note in the view options");
      return;
    }

    const path = target.endsWith(".md") ? target : `${target}.md`;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      if (notify) new Notice(`Bases Serializer: target not found: ${path}`);
      return;
    }

    const key = String(this.config.get("key") || this.config.name || DEFAULT_KEY);
    const body = this.body();

    await this.app.vault.process(file, (data) =>
      upsertBlock(data, key, body, { format: String(this.config.get("format") || "list") })
    );

    if (notify) {
      new Notice(`Bases Serializer: ${this.data.data.length} row(s) → ${path}`);
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
          displayName: "Target note",
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
          displayName: "Auto-serialize on change",
          default: false,
        },
      ],
    });

    if (!registered) {
      new Notice("Bases Serializer: Bases is not enabled in this vault");
    }
  }
}
