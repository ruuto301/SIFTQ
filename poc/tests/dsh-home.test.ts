import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDshHome } from "../server/acp";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function workspace(): string {
  const directory = mkdtempSync(join(tmpdir(), "siftq-workspace-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("resolveDshHome", () => {
  it("uses a .dsh directory inside the workspace", () => {
    const root = workspace();
    mkdirSync(join(root, ".dsh"));
    expect(resolveDshHome(root)).toBe(join(root, ".dsh"));
  });

  it("uses a dsh directory inside the workspace", () => {
    const root = workspace();
    mkdirSync(join(root, "dsh"));
    expect(resolveDshHome(root)).toBe(join(root, "dsh"));
  });

  it("uses the workspace root when credentials files live there", () => {
    const root = workspace();
    writeFileSync(join(root, ".env"), "DEEPSEEK_API_KEY=test\n");
    expect(resolveDshHome(root)).toBe(root);
  });

  it("returns null for a workspace without DSH configuration", () => {
    expect(resolveDshHome(workspace())).toBeNull();
    expect(resolveDshHome("")).toBeNull();
  });
});
