import { describe, expect, it } from "vitest";

import { renderGroups, renderRows, renderTable, SerializedRow } from "../src/render";

const rows: SerializedRow[] = [
  { link: "[[A]]", cells: ["2026-10-13", "open"] },
  { link: "[[B]]", cells: ["", "done"] },
];

describe("renderRows", () => {
  it("renders a list", () => {
    expect(renderRows(rows, { format: "list" })).toBe("- [[A]]\n- [[B]]");
  });

  it("renders a checklist with a suffix column", () => {
    expect(renderRows(rows, { format: "checklist", suffixIndex: 0 })).toBe(
      "- [ ] [[A]] — 2026-10-13\n- [ ] [[B]]"
    );
  });

  it("renders a numbered list", () => {
    expect(renderRows(rows, { format: "numbered" })).toBe("1. [[A]]\n2. [[B]]");
  });

  it("returns an empty string for no rows", () => {
    expect(renderRows([], { format: "list" })).toBe("");
  });
});

describe("properties", () => {
  it("inline", () => {
    expect(renderRows(rows, { format: "list", properties: "inline" })).toBe(
      "- [[A]] · 2026-10-13 · open\n- [[B]] · done"
    );
  });

  it("inline with labels and a custom separator", () => {
    const out = renderRows(rows, {
      format: "list",
      properties: "inline",
      propertyLabels: true,
      headers: ["File", "Due", "Status"],
      propertySeparator: " | ",
    });
    expect(out.split("\n")[0]).toBe("- [[A]] | Due: 2026-10-13 | Status: open");
  });

  it("sub-items", () => {
    expect(renderRows(rows, { format: "checklist", properties: "subitems" })).toBe(
      "- [ ] [[A]]\n\t- 2026-10-13\n\t- open\n- [ ] [[B]]\n\t- done"
    );
  });
});

describe("renderTemplate", () => {
  const row: SerializedRow = {
    link: "[[A]]",
    cells: ["2026-10-13"],
    title: "A",
    path: "Notes/A.md",
    values: { "note.due": "2026-10-13", Due: "2026-10-13" },
  };

  it("substitutes tokens (case-insensitive)", () => {
    expect(renderRows([row], { template: "{index}. {link} — {due}" })).toBe("1. [[A]] — 2026-10-13");
  });

  it("supports the group token via renderGroups", () => {
    const out = renderGroups([{ title: "Today", rows: [row] }], { template: "{group}: {link}" });
    expect(out).toContain("### Today\n\nToday: [[A]]");
  });
});

describe("renderTable", () => {
  it("uses provided headers", () => {
    const table = renderTable(rows, ["File", "Due", "Status"]);
    const lines = table.split("\n");
    expect(lines[0]).toBe("| File | Due | Status |");
    expect(lines[1]).toBe("| --- | --- | --- |");
    expect(lines[2]).toBe("| [[A]] | 2026-10-13 | open |");
  });

  it("escapes pipes in cells", () => {
    const table = renderTable([{ link: "[[A]]", cells: ["a|b"] }], ["File", "X"]);
    expect(table).toContain("a\\|b");
  });
});

describe("renderGroups", () => {
  it("adds headings, passes through untitled, skips empty groups", () => {
    const out = renderGroups(
      [
        { title: "Today", rows: [{ link: "[[A]]", cells: [] }] },
        { title: null, rows: [{ link: "[[B]]", cells: [] }] },
        { title: "Empty", rows: [] },
      ],
      { format: "list" }
    );
    expect(out).toContain("### Today\n\n- [[A]]");
    expect(out).toContain("- [[B]]");
    expect(out).not.toContain("Empty");
  });

  it("uses a group template with {group} and {count}", () => {
    const out = renderGroups(
      [{ title: "Today", rows: [{ link: "[[A]]", cells: [] }] }],
      { format: "list", groupTemplate: "## {group} ({count})" }
    );
    expect(out).toContain("## Today (1)");
  });
});

describe("detailKeys", () => {
  const row: SerializedRow = {
    link: "[[A]]",
    cells: ["x", "y"],
    values: { "note.due": "x", Status: "y" },
  };

  it("limits details to the selected keys (case-insensitive)", () => {
    const out = renderRows([row], {
      format: "list",
      properties: "inline",
      detailKeys: ["status"],
      propertyLabels: true,
    });
    expect(out).toBe("- [[A]] · status: y");
  });
});
