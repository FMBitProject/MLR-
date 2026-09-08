import "./helpers.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { TERMS, PRIVACY, FAQ } from "../src/lib/legal.ts";

const LOCALES = ["id", "en"] as const;

test("legal: Terms and Privacy exist in both locales with a title and sections", () => {
  for (const doc of [TERMS, PRIVACY])
    for (const l of LOCALES) {
      assert.ok(doc[l], `missing locale ${l}`);
      assert.ok(doc[l].title.trim().length > 0);
      assert.ok(doc[l].sections.length > 0, "a legal document with no sections");
    }
});

test("legal: the two locales describe the same document structure", () => {
  for (const doc of [TERMS, PRIVACY]) {
    assert.equal(
      doc.id.sections.length,
      doc.en.sections.length,
      "a section was translated in one locale but not the other",
    );
  }
});

test("legal: no section has an empty heading or an empty body", () => {
  for (const doc of [TERMS, PRIVACY])
    for (const l of LOCALES)
      doc[l].sections.forEach((s, i) => {
        assert.ok(s.heading.trim().length > 0, `${l} section ${i} has no heading`);
        assert.ok(s.body.length > 0 || (s.list?.length ?? 0) > 0, `${l} "${s.heading}" is empty`);
        for (const p of s.body) assert.ok(p.trim().length > 0, `${l} "${s.heading}" has a blank paragraph`);
        for (const li of s.list ?? []) assert.ok(li.trim().length > 0, `${l} "${s.heading}" has a blank list item`);
      });
});

test("legal: no unfilled placeholder text ships in a published document", () => {
  // COMPANY placeholders are injected at render time; the static copy itself
  // must never carry TODO/lorem markers.
  for (const doc of [TERMS, PRIVACY])
    for (const l of LOCALES) {
      const text = JSON.stringify(doc[l]);
      for (const marker of ["TODO", "TBD", "lorem ipsum", "XXX", "FIXME"])
        assert.ok(!text.toLowerCase().includes(marker.toLowerCase()), `${l} contains "${marker}"`);
    }
});

test("legal: the FAQ has groups and questions in both locales", () => {
  for (const l of LOCALES) {
    assert.ok(FAQ[l].groups.length > 0);
    for (const g of FAQ[l].groups) {
      assert.ok(g.name.trim().length > 0);
      assert.ok(g.items.length > 0, `empty FAQ group "${g.name}"`);
      for (const it of g.items) {
        assert.ok(it.q.trim().length > 0, `blank question in "${g.name}"`);
        assert.ok(it.a.trim().length > 0, `question "${it.q}" has no answer`);
      }
    }
  }
});

test("legal: the FAQ covers the same questions in both locales", () => {
  assert.equal(FAQ.id.groups.length, FAQ.en.groups.length);
  FAQ.id.groups.forEach((g, i) => {
    assert.equal(g.items.length, FAQ.en.groups[i].items.length, `group ${i} differs in size`);
  });
});

test("legal: headings are unique within a document (stable anchors)", () => {
  for (const doc of [TERMS, PRIVACY])
    for (const l of LOCALES) {
      const headings = doc[l].sections.map((s) => s.heading);
      assert.equal(new Set(headings).size, headings.length, `${l} has duplicate headings`);
    }
});
