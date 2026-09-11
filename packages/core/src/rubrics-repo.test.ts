import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRubric } from "./rubric.js";

/**
 * Every file dropped into rubrics/ gets checked here automatically — a
 * contributor adding a new rubric never has to touch this test. This is
 * the CI check CONTRIBUTING.md points to.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rubricsDir = path.resolve(__dirname, "../../../rubrics");
const files = readdirSync(rubricsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

describe("rubrics/ contents", () => {
  it("has at least one rubric file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} is a valid rubric whose id matches its filename`, () => {
      const text = readFileSync(path.join(rubricsDir, file), "utf8");
      const rubric = loadRubric(text);
      expect(rubric.criteria.length).toBeGreaterThan(0);
      for (const c of rubric.criteria) {
        expect(c.id).toBeTruthy();
        expect(c.guidance).toBeTruthy();
      }
      const expectedId = file.replace(/\.ya?ml$/, "");
      expect(rubric.id).toBe(expectedId);
    });
  }

  it("has no duplicate rubric ids across files", () => {
    const ids = files.map((f) => loadRubric(readFileSync(path.join(rubricsDir, f), "utf8")).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
