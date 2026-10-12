import { describe, expect, it } from "vitest";

import {
  findBlock,
  sentinelLine,
  solidifyAnchorToText,
  stripBlock,
  upsertBlock,
  upsertBlockAfterAnchor,
  upsertBlockUnderHeading,
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

describe("solidifyAnchorToText", () => {
  it("replaces the embed with plain text (no sentinels)", () => {
    const text = "# Note\n\n![[tasks.base#Today]]\n\ntail\n";
    const out = solidifyAnchorToText(text, "tasks.base#Today", "Today", "- [[A]]\n- [[B]]");
    expect(out).not.toContain("![[tasks.base#Today]]");
    expect(out).not.toContain("bases-serializer");
    expect(out).toContain("- [[A]]\n- [[B]]");
    expect(out).toContain("tail");
  });

  it("replaces an existing block with plain text", () => {
    const withBlock = upsertBlock("![[b.base#V]]\n", "V", "- [[old]]");
    const out = solidifyAnchorToText(withBlock, "b.base#V", "V", "- [[new]]");
    expect(out).not.toContain("bases-serializer");
    expect(out).toContain("- [[new]]");
    expect(out).not.toContain("- [[old]]");
  });
});

describe("upsertBlockUnderHeading", () => {
  it("inserts the block right after the matching heading", () => {
    const text = "# Note\n\n## Tasks\n\ntail\n";
    const out = upsertBlockUnderHeading(text, "## Tasks", "K", "- [[A]]");
    const lines = out.split("\n");
    const at = lines.findIndex((line) => line.trim() === "## Tasks");
    expect(lines.slice(at, at + 4).join("\n")).toContain('%% bases-serializer key="K" %%');
    expect(out).toContain("tail");
  });

  it("appends when the heading is missing", () => {
    expect(upsertBlockUnderHeading("# N\n", "## Missing", "K", "- [[A]]")).toContain("- [[A]]");
  });
});
