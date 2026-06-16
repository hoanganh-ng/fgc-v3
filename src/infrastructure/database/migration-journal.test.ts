import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const JOURNAL_URL = new URL(
  "../../../drizzle/meta/_journal.json",
  import.meta.url,
);
const DRIZZLE_DIR = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

describe("migration journal static invariants", () => {
  let journal: Journal;

  it("loads _journal.json without a database connection", async () => {
    const raw = await readFile(JOURNAL_URL, "utf8");
    journal = JSON.parse(raw) as Journal;
    expect(journal.entries.length).toBeGreaterThan(0);
  });

  it("has strictly increasing idx values", async () => {
    if (!journal) {
      const raw = await readFile(JOURNAL_URL, "utf8");
      journal = JSON.parse(raw) as Journal;
    }
    for (let i = 1; i < journal.entries.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const prev = journal.entries[i - 1]!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const curr = journal.entries[i]!;
      expect(curr.idx).toBeGreaterThan(prev.idx);
    }
  });

  it("has strictly increasing when values", async () => {
    if (!journal) {
      const raw = await readFile(JOURNAL_URL, "utf8");
      journal = JSON.parse(raw) as Journal;
    }
    for (let i = 1; i < journal.entries.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const prev = journal.entries[i - 1]!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const curr = journal.entries[i]!;
      expect(curr.when).toBeGreaterThan(prev.when);
    }
  });

  it("has a corresponding .sql file for every journal tag", async () => {
    if (!journal) {
      const raw = await readFile(JOURNAL_URL, "utf8");
      journal = JSON.parse(raw) as Journal;
    }
    for (const entry of journal.entries) {
      const sqlPath = resolve(DRIZZLE_DIR, `${entry.tag}.sql`);
      expect(
        existsSync(sqlPath),
        `Missing SQL file for journal tag "${entry.tag}": expected ${sqlPath}`,
      ).toBe(true);
    }
  });
});
