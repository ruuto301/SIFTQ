import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function parseSshHosts(text: string): string[] {
  const hosts = new Set<string>();
  for (const line of text.split("\n")) {
    const withoutComment = line.split("#")[0] ?? "";
    const match = /^\s*Host\s+(.+?)\s*$/i.exec(withoutComment);
    if (match === null) continue;
    const value = match[1];
    if (value === undefined) continue;
    for (const alias of value.split(/\s+/)) {
      if (alias === "" || alias === "*" || alias.includes("*") || alias.startsWith("!")) continue;
      hosts.add(alias);
    }
  }
  return Array.from(hosts).sort((left, right) => left.localeCompare(right));
}

export function readSshHosts(): string[] {
  const path = join(homedir(), ".ssh", "config");
  if (!existsSync(path)) return [];
  try {
    return parseSshHosts(readFileSync(path, "utf8"));
  } catch {
    return [];
  }
}
