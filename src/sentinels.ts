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
