export type Format = "list" | "checklist" | "table";

export interface SerializedRow {
  /** Markdown link text for the file, e.g. "[[Notes/Foo]]". */
  link: string;
  /** Rendered values of the view's ordered properties. */
  cells: string[];
}

function escapeCell(value: string): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

export function renderRow(
  row: SerializedRow,
  format: Format,
  suffixIndex?: number
): string {
  if (format === "checklist") {
    const suffix =
      suffixIndex !== undefined && row.cells[suffixIndex] ? ` — ${row.cells[suffixIndex]}` : "";
    return `- [ ] ${row.link}${suffix}`;
  }
  return `- ${row.link}`;
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
  headers: string[] = []
): string {
  if (rows.length === 0) return "";
  if (format === "table") return renderTable(rows, headers);
  return rows.map((row) => renderRow(row, format, suffixIndex)).join("\n");
}
