import { describe, expect, it } from "vitest";

import { renderGroups, renderRows, renderTable, SerializedRow } from "../src/render";

const rows: SerializedRow[] = [
  { link: "[[A]]", cells: ["2026-10-13", "open"] },
  { link: "[[B]]", cells: ["", "done"] },
];

describe("renderRows", () => {
  it("renders a list", () => {
    expect(renderRows(rows, "list")).toBe("- [[A]]\n- [[B]]");
  });

  it("renders a checklist with an optional suffix column", () => {
    expect(renderRows(rows, "checklist", 0)).toBe("- [ ] [[A]] — 2026-10-13\n- [ ] [[B]]");
  });

  it("renders a numbered list", () => {
    expect(renderRows(rows, "numbered")).toBe("1. [[A]]\n2. [[B]]");
  });

  it("returns an empty string for no rows", () => {
    expect(renderRows([], "list")).toBe("");
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

  it("substitutes tokens (case-insensitive), index and group", () => {
    const out = renderRows([row], "list", undefined, [], "{index}. {link} — {due}");
    expect(out).toBe("1. [[A]] — 2026-10-13");
  });

  it("supports the group token via renderGroups", () => {
    const out = renderGroups([{ title: "Today", rows: [row] }], "list", undefined, [], "{group}: {link}");
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
  it("adds a heading for titled groups and passes through untitled ones", () => {
    const out = renderGroups(
      [
        { title: "Today", rows: [{ link: "[[A]]", cells: [] }] },
        { title: null, rows: [{ link: "[[B]]", cells: [] }] },
      ],
      "list"
    );
    expect(out).toContain("### Today\n\n- [[A]]");
    expect(out).toContain("- [[B]]");
  });

  it("skips empty groups", () => {
    expect(renderGroups([{ title: "X", rows: [] }], "list")).toBe("");
  });
});
