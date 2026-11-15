import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type ContextData = {
  memo: string;
  browserUrl: string;
  browserTitle: string;
};

const EMPTY_CONTEXT: ContextData = { memo: "", browserUrl: "", browserTitle: "" };

export function renderContextMarkdown(taskTitle: string, data: ContextData): string {
  return [
    `# タスク: ${taskTitle}`,
    "",
    "## メモ",
    data.memo,
    "",
    "## ブラウザ",
    `- URL: ${data.browserUrl}`,
    `- タイトル: ${data.browserTitle}`,
    "",
  ].join("\n");
}

function normalizeContext(value: unknown): ContextData {
  if (typeof value !== "object" || value === null) return { ...EMPTY_CONTEXT };
  const record = value as Record<string, unknown>;
  return {
    memo: typeof record["memo"] === "string" ? record["memo"] : "",
    browserUrl: typeof record["browserUrl"] === "string" ? record["browserUrl"] : "",
    browserTitle: typeof record["browserTitle"] === "string" ? record["browserTitle"] : "",
  };
}

export function readContextLocal(cwd: string): ContextData {
  const path = join(cwd, ".poc", "context.json");
  if (!existsSync(path)) return { ...EMPTY_CONTEXT };
  try {
    return normalizeContext(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return { ...EMPTY_CONTEXT };
  }
}

export function writeContextLocal(cwd: string, taskTitle: string, data: ContextData): void {
  const dir = join(cwd, ".poc");
  mkdirSync(dir, { recursive: true });
  const markdown = renderContextMarkdown(taskTitle, data);
  writeFileSync(join(dir, "context.json"), JSON.stringify(data, null, 2) + "\n", "utf8");
  writeFileSync(join(dir, "context.md"), markdown, "utf8");
  writeFileSync(join(cwd, "POC.md"), markdown, "utf8");
}

function sshBin(): string {
  return process.env["POC_SSH_BIN"] ?? "ssh";
}

const READ_SCRIPT =
  "import os, sys\n" +
  "path = os.path.join(sys.argv[1], '.poc', 'context.json')\n" +
  "if os.path.exists(path):\n" +
  "    with open(path) as f:\n" +
  "        print(f.read())\n";

const WRITE_SCRIPT =
  "import base64, json, os, sys\n" +
  "payload = json.loads(base64.b64decode(sys.argv[1]))\n" +
  "root = payload['cwd']\n" +
  "os.makedirs(os.path.join(root, '.poc'), exist_ok=True)\n" +
  "with open(os.path.join(root, '.poc', 'context.json'), 'w') as f:\n" +
  "    f.write(json.dumps(payload['data'], ensure_ascii=False, indent=2) + '\\n')\n" +
  "for name in ['.poc/context.md', 'POC.md']:\n" +
  "    with open(os.path.join(root, name), 'w') as f:\n" +
  "        f.write(payload['markdown'])\n";

function runRemoteScript(host: string, script: string, arg: string): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    console.log("runRemoteScript start", host, arg);
    const child = spawn(sshBin(), [host, "python3", "-", arg], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, timeout: 15000 });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      console.log("runRemoteScript exit", host, code);
      resolve({ status: code ?? -1, stdout, stderr });
    });
    child.stdin.end(script);
  });
}

export async function readContextRemote(host: string, cwd: string): Promise<ContextData> {
  const result = await runRemoteScript(host, READ_SCRIPT, cwd);
  if (result.status !== 0) return { ...EMPTY_CONTEXT };
  const text = result.stdout.trim();
  if (text === "") return { ...EMPTY_CONTEXT };
  try {
    return normalizeContext(JSON.parse(text));
  } catch {
    return { ...EMPTY_CONTEXT };
  }
}

export async function writeContextRemote(host: string, cwd: string, taskTitle: string, data: ContextData): Promise<void> {
  const arg = Buffer.from(JSON.stringify({ cwd, data, markdown: renderContextMarkdown(taskTitle, data) }), "utf8").toString("base64");
  const result = await runRemoteScript(host, WRITE_SCRIPT, arg);
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "failed to write context");
  }
}

export async function readContext(target: string, cwd: string): Promise<ContextData> {
  return target === "" ? readContextLocal(cwd) : readContextRemote(target, cwd);
}

export async function writeContext(target: string, cwd: string, taskTitle: string, data: ContextData): Promise<void> {
  if (target === "") {
    writeContextLocal(cwd, taskTitle, data);
  } else {
    await writeContextRemote(target, cwd, taskTitle, data);
  }
}
