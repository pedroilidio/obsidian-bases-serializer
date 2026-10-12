export type Format = "list" | "checklist" | "numbered" | "table";
export type PropertiesMode = "none" | "inline" | "subitems";

export interface SerializedRow {
  /** Markdown link text for the file, e.g. "[[Notes/Foo]]". */
  link: string;
  /** Rendered values of the view's ordered properties. */
  cells: string[];
  /** File basename (for templates/plain text). */
  title?: string;
  /** File path (for templates/markdown links). */
  path?: string;
  /** Named values (property id and display name) for templates. */
  values?: Record<string, string>;
}

export interface SerializedGroup {
  title: string | null;
  rows: SerializedRow[];
}

export interface RowContext {
  link: string;
  title: string;
  path: string;
  index: number;
  group: string;
  values: Record<string, string>;
}

export interface RenderOptions {
  format?: Format;
  suffixIndex?: number;
  headers?: string[];
  template?: string;
  group?: string;
  properties?: PropertiesMode;
  propertySeparator?: string;
  propertyLabels?: boolean;
}

function escapeCell(value: string): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function suffixFor(row: SerializedRow, suffixIndex?: number): string {
  return suffixIndex !== undefined && row.cells[suffixIndex] ? ` — ${row.cells[suffixIndex]}` : "";
}

export function renderTemplate(template: string, ctx: RowContext): string {
  const table: Record<string, string> = {
    ...ctx.values,
    link: ctx.link,
    title: ctx.title,
    path: ctx.path,
    index: String(ctx.index),
    group: ctx.group,
  };
  return template.replace(/\{([^{}]+)\}/g, (_match, rawKey) => {
    const key = String(rawKey).trim();
    if (key in table) return table[key];
    const found = Object.keys(table).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    return found ? table[found] : "";
  });
}

function rowContext(row: SerializedRow, index: number, group?: string): RowContext {
  return {
    link: row.link,
    title: row.title ?? "",
    path: row.path ?? "",
    index: index + 1,
    group: group ?? "",
    values: row.values ?? {},
  };
}

function propertyParts(row: SerializedRow, options: RenderOptions): string[] {
  const mode = options.properties ?? "none";
  if (mode === "none") return [];
  const headers = options.headers ?? [];
  const parts: string[] = [];
  row.cells.forEach((value, index) => {
    if (!value) return;
    const label = options.propertyLabels ? headers[index + 1] : "";
    parts.push(label ? `${label}: ${value}` : value);
  });
  return parts;
}

export function renderRow(row: SerializedRow, index: number, options: RenderOptions = {}): string {
  const format = options.format ?? "list";
  const suffix = suffixFor(row, options.suffixIndex);

  let line: string;
  if (format === "checklist") line = `- [ ] ${row.link}${suffix}`;
  else if (format === "numbered") line = `${index + 1}. ${row.link}${suffix}`;
  else line = `- ${row.link}${suffix}`;

  const parts = propertyParts(row, options);
  if (parts.length > 0) {
    const mode = options.properties ?? "none";
    if (mode === "inline") {
      const separator = options.propertySeparator ?? " · ";
      return `${line}${separator}${parts.join(separator)}`;
    }
    if (mode === "subitems") {
      return [line, ...parts.map((part) => `\t- ${part}`)].join("\n");
    }
  }
  return line;
}

export function renderTable(rows: SerializedRow[], headers: string[] = []): string {
  const head =
    headers.length > 0
      ? headers
      : ["File", ...(rows[0]?.cells ?? []).map((_, index) => `c${index + 1}`)];
  const header = `| ${head.map(escapeCell).join(" | ")} |`;
  const divider = `| ${head.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    (row) => `| ${[row.link, ...row.cells].map(escapeCell).join(" | ")} |`
  );
  return [header, divider, ...body].join("\n");
}

export function renderRows(rows: SerializedRow[], options: RenderOptions = {}): string {
  if (rows.length === 0) return "";
  const format = options.format ?? "list";

  if (options.template) {
    return rows
      .map((row, index) => renderTemplate(options.template as string, rowContext(row, index, options.group)))
      .join("\n");
  }
  if (format === "table") return renderTable(rows, options.headers ?? []);
  return rows.map((row, index) => renderRow(row, index, options)).join("\n");
}

export function renderGroups(groups: SerializedGroup[], options: RenderOptions = {}): string {
  const parts: string[] = [];
  for (const group of groups) {
    const body = renderRows(group.rows, { ...options, group: group.title ?? undefined });
    if (!body) continue;
    parts.push(group.title ? `### ${group.title}\n\n${body}` : body);
  }
  return parts.join("\n\n");
}
