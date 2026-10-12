export type Format = "list" | "checklist" | "numbered" | "table";

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

export function renderRow(
  row: SerializedRow,
  format: Format,
  suffixIndex?: number,
  index = 0
): string {
  const suffix = suffixFor(row, suffixIndex);
  if (format === "checklist") return `- [ ] ${row.link}${suffix}`;
  if (format === "numbered") return `${index + 1}. ${row.link}${suffix}`;
  return `- ${row.link}${suffix}`;
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

export function renderRows(
  rows: SerializedRow[],
  format: Format = "list",
  suffixIndex?: number,
  headers: string[] = [],
  template?: string,
  group?: string
): string {
  if (rows.length === 0) return "";
  if (template) {
    return rows.map((row, index) => renderTemplate(template, rowContext(row, index, group))).join("\n");
  }
  if (format === "table") return renderTable(rows, headers);
  return rows.map((row, index) => renderRow(row, format, suffixIndex, index)).join("\n");
}

export function renderGroups(
  groups: SerializedGroup[],
  format: Format = "list",
  suffixIndex?: number,
  headers: string[] = [],
  template?: string
): string {
  const parts: string[] = [];
  for (const group of groups) {
    const body = renderRows(group.rows, format, suffixIndex, headers, template, group.title ?? undefined);
    if (!body) continue;
    parts.push(group.title ? `### ${group.title}\n\n${body}` : body);
  }
  return parts.join("\n\n");
}
