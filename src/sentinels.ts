export const SENTINEL_OPEN = "%% bases-serializer";
export const SENTINEL_CLOSE = "%% /bases-serializer %%";

export interface SentinelMeta {
  [key: string]: string | number | undefined;
}

function quote(value: string | number): string {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

export function sentinelLine(key: string, meta: SentinelMeta = {}): string {
  const parts = [`key=${quote(key)}`];
  for (const [name, value] of Object.entries(meta)) {
    if (value !== undefined && value !== null && value !== "") {
      parts.push(`${name}=${quote(value)}`);
    }
  }
  return `${SENTINEL_OPEN} ${parts.join(" ")} %%`;
}

export function findBlock(lines: string[], key: string): [number, number] | null {
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

/** Insert or replace the sentinel block for `key`, keeping everything else. */
export function upsertBlock(
  text: string,
  key: string,
  body: string,
  meta: SentinelMeta = {}
): string {
  const lines = text.split("\n");
  const block = [sentinelLine(key, meta), body.replace(/\n+$/, ""), SENTINEL_CLOSE];
  const range = findBlock(lines, key);

  if (range) {
    return [...lines.slice(0, range[0]), ...block, ...lines.slice(range[1] + 1)].join("\n");
  }

  const trimmed = text.replace(/\n+$/, "");
  const separator = trimmed === "" ? "" : "\n\n";
  return `${trimmed}${separator}${block.join("\n")}\n`;
}

/** Remove the sentinel block for `key`, if present. */
export function stripBlock(text: string, key: string): string {
  const lines = text.split("\n");
  const range = findBlock(lines, key);
  if (!range) return text;
  return [...lines.slice(0, range[0]), ...lines.slice(range[1] + 1)].join("\n");
}

/**
 * Upsert a block, preferring to place it right after the first line that
 * contains `anchor` (e.g. the `![[base.base#View]]` embed). Falls back to
 * appending at the end when the anchor is missing.
 */
export function upsertBlockAfterAnchor(
  text: string,
  anchor: string,
  key: string,
  body: string,
  meta: SentinelMeta = {}
): string {
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
  return `${trimmed}${separator}${block.join("\n")}\n`;
}

/**
 * Fully solidify: remove any serialized block for `key`, and replace the embed
 * line with the plain Markdown body (no sentinels, no embed).
 */
export function solidifyAnchorToText(
  text: string,
  anchor: string,
  key: string,
  body: string
): string {
  const lines = text.split("\n");
  const bodyLines = body.replace(/\n+$/, "").split("\n");

  const range = findBlock(lines, key);
  const working =
    range !== null ? [...lines.slice(0, range[0]), ...lines.slice(range[1] + 1)] : lines.slice();

  if (anchor) {
    const at = working.findIndex((line) => line.includes(anchor));
    if (at >= 0) {
      return [...working.slice(0, at), ...bodyLines, ...working.slice(at + 1)].join("\n");
    }
  }

  const trimmed = working.join("\n").replace(/\n+$/, "");
  const separator = trimmed === "" ? "" : "\n\n";
  return `${trimmed}${separator}${bodyLines.join("\n")}\n`;
}

/**
 * Upsert a block directly under a heading (matched by title), falling back to
 * appending at the end when the heading is missing.
 */
export function upsertBlockUnderHeading(
  text: string,
  heading: string,
  key: string,
  body: string,
  meta: SentinelMeta = {}
): string {
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
  return `${trimmed}${separator}${block.join("\n")}\n`;
}
