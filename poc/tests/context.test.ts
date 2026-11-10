import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readContextLocal, renderContextMarkdown, writeContextLocal } from "../server/context";

const directories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "poc-context-"));
  directories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("context", () => {
  it("writes and reads shared context files", () => {
    const directory = temporaryDirectory();
    writeContextLocal(directory, "テスト", {
      memo: "メモ本文",
      browserUrl: "https://example.com",
      browserTitle: "Example",
    });

    expect(readContextLocal(directory)).toEqual({
      memo: "メモ本文",
      browserUrl: "https://example.com",
      browserTitle: "Example",
    });

    const markdown = readFileSync(join(directory, ".poc", "context.md"), "utf8");
    expect(markdown).toContain("メモ本文");
    expect(markdown).toContain("https://example.com");
    expect(readFileSync(join(directory, "POC.md"), "utf8")).toBe(markdown);
  });

  it("renders the shared markdown", () => {
    const markdown = renderContextMarkdown("タスク", { memo: "m", browserUrl: "u", browserTitle: "t" });
    expect(markdown).toContain("# タスク: タスク");
    expect(markdown).toContain("## メモ");
    expect(markdown).toContain("## ブラウザ");
  });
});
