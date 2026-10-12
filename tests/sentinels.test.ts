import { describe, expect, it } from "vitest";

import {
  findBlock,
  sentinelLine,
  stripBlock,
  upsertBlock,
  upsertBlockAfterAnchor,
} from "../src/sentinels";

describe("sentinelLine", () => {
  it("includes the key and meta", () => {
    expect(sentinelLine("k", { format: "list" })).toBe(
      '%% bases-serializer key="k" format="list" %%'
    );
  });
  it("ignores empty meta values", () => {
    expect(sentinelLine("k", { a: "", b: undefined })).toBe('%% bases-serializer key="k" %%');
  });
});

describe("upsertBlock", () => {
  it("appends a block at the end", () => {
    const out = upsertBlock("", "k", "- [[A]]", { format: "list" });
    expect(out).toContain('%% bases-serializer key="k" format="list" %%');
    expect(out).toContain("- [[A]]");
    expect(out).toContain("%% /bases-serializer %%");
  });

  it("replaces the existing block and keeps everything else", () => {
    const first = upsertBlock("# Note\n\nsome text\n", "k", "- [[A]]");
    const second = upsertBlock(first, "k", "- [[B]]");
    expect(second).toContain("- [[B]]");
    expect(second).not.toContain("- [[A]]");
    expect(second).toContain("# Note");
    expect(second).toContain("some text");
  });

  it("keeps blocks with different keys independent", () => {
    let text = upsertBlock("# N\n", "a", "- a");
    text = upsertBlock(text, "b", "- b");
    const stripped = stripBlock(text, "a");
    expect(stripped).not.toContain("- a");
    expect(stripped).toContain("- b");
  });
});

describe("findBlock / stripBlock", () => {
  it("finds nothing when the key is absent", () => {
    expect(findBlock("hi\n".split("\n"), "x")).toBeNull();
    expect(stripBlock("hi\n", "x")).toBe("hi\n");
  });
});

describe("upsertBlockAfterAnchor", () => {
  it("inserts the block right after the embed line", () => {
    const text = "# Note\n\n![[tasks.base#Today]]\n\nsome tail\n";
    const out = upsertBlockAfterAnchor(text, "tasks.base#Today", "Today", "- [[A]]");
    const lines = out.split("\n");
    const at = lines.findIndex((line) => line.includes("tasks.base#Today"));
    expect(lines[at + 2]).toContain('%% bases-serializer key="Today" %%');
    expect(out).toContain("some tail");
  });

  it("replaces an existing block rather than duplicating", () => {
    let out = upsertBlockAfterAnchor("![[tasks.base#Today]]\n", "tasks.base#Today", "Today", "- [[A]]");
    out = upsertBlockAfterAnchor(out, "tasks.base#Today", "Today", "- [[B]]");
    expect(out).toContain("- [[B]]");
    expect(out).not.toContain("- [[A]]");
  });

  it("appends when the anchor is missing", () => {
    const out = upsertBlockAfterAnchor("# Note\n", "missing.base#X", "K", "- [[A]]");
    expect(out).toContain("- [[A]]");
  });
});
