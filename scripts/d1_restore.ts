import { readFileSync, writeFileSync } from "node:fs";
import { decryptBackup } from "../src/backup-crypto";
import { gunzip, sha256Hex } from "../src/backup";

const MAGIC_ERROR = "backup payload has an unknown format";

type RestoreOptions = {
  file: string;
  out: string;
  keyFrom: "session" | "github";
  secret: string | undefined;
  expectSha256: string | undefined;
  expectKeyId: string | undefined;
};

const OPTION_FLAGS = new Set(["--file", "--out", "--key-from", "--secret", "--expect-sha256", "--expect-key-id"]);

function requiredValue(flag: string, value: string | undefined): string {
  if (value === undefined) throw new Error(`${flag} requires a value`);
  return value;
}

function assignOption(options: RestoreOptions, flag: string, value: string | undefined): void {
  switch (flag) {
    case "--file":
      options.file = requiredValue(flag, value);
      break;
    case "--out":
      options.out = requiredValue(flag, value);
      break;
    case "--key-from": {
      const source = requiredValue(flag, value);
      if (source !== "session" && source !== "github") throw new Error("--key-from must be session or github");
      options.keyFrom = source;
      break;
    }
    case "--secret":
      options.secret = requiredValue(flag, value);
      break;
    case "--expect-sha256":
      options.expectSha256 = requiredValue(flag, value);
      break;
    case "--expect-key-id":
      options.expectKeyId = requiredValue(flag, value);
      break;
    default:
      throw new Error(`unknown option: ${flag}`);
  }
}

function resolveSecret(options: RestoreOptions): string {
  if (options.secret !== undefined) return options.secret;
  const name = options.keyFrom === "github" ? "GITHUB_CLIENT_SECRET" : "SESSION_SECRET";
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required (or pass --secret)`);
  return value;
}

function parseArgs(argv: readonly string[]): RestoreOptions {
  const options: RestoreOptions = { file: "", out: "", keyFrom: "session", secret: undefined, expectSha256: undefined, expectKeyId: undefined };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (flag === undefined) break;
    if (!OPTION_FLAGS.has(flag)) throw new Error(`unknown option: ${flag}`);
    assignOption(options, flag, argv[index + 1]);
  }
  if (options.file === "") throw new Error("--file is required");
  if (options.out === "") options.out = options.file.replace(/\.enc$/, "");
  return options;
}

export async function restoreBackup(options: RestoreOptions): Promise<{ keyId: string; sha256: string; sizeBytes: number }> {
  const payload = new Uint8Array(readFileSync(options.file));
  let plaintext: Uint8Array<ArrayBuffer>;
  let keyId: string;
  try {
    ({ plaintext, keyId } = await decryptBackup(payload, resolveSecret(options)));
  } catch (error) {
    if (error instanceof Error && error.message.includes("unknown format")) throw new Error(MAGIC_ERROR);
    throw error;
  }
  if (options.expectKeyId !== undefined && options.expectKeyId !== keyId) {
    throw new Error(`keyId mismatch: payload=${keyId} expected=${options.expectKeyId}`);
  }
  const sql = await gunzip(plaintext);
  const sha256 = await sha256Hex(sql);
  if (options.expectSha256 !== undefined && options.expectSha256 !== sha256) {
    throw new Error(`sha256 mismatch: payload=${sha256} expected=${options.expectSha256}`);
  }
  writeFileSync(options.out, sql);
  return { keyId, sha256, sizeBytes: sql.length };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  restoreBackup(options)
    .then((result) => {
      console.log(`restored ${options.out} (${result.sizeBytes} bytes, keyId=${result.keyId}, sha256=${result.sha256})`);
      console.log("next: wrangler d1 execute siftq --local --persist-to .wrangler/state --file " + options.out);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}

if (import.meta.main) main();
