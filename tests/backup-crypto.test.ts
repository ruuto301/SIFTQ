import { describe, expect, it } from "vite-plus/test";
import { decryptBackup, deriveBackupKey, encryptBackup } from "../src/backup-crypto";

const SAMPLE = new TextEncoder().encode("SIFTQ backup payload");

describe("backup-crypto", () => {
  it("derives a stable, secret-dependent key id", async () => {
    const first = await deriveBackupKey("secret");
    const second = await deriveBackupKey("secret");
    const other = await deriveBackupKey("another-secret");

    expect(first.keyId).toHaveLength(16);
    expect(first.keyId).toBe(second.keyId);
    expect(first.keyId).not.toBe(other.keyId);
  });

  it("round-trips a payload with the same secret", async () => {
    const { payload, keyId, iv } = await encryptBackup(SAMPLE, "secret");

    expect(iv).toHaveLength(24);
    expect(payload.slice(0, 7)).toEqual(new TextEncoder().encode("SIFTBK1"));
    expect(payload.length).toBeGreaterThan(SAMPLE.length);

    const decrypted = await decryptBackup(payload, "secret");
    expect(decrypted.keyId).toBe(keyId);
    expect(new TextDecoder().decode(decrypted.plaintext)).toBe("SIFTQ backup payload");
  });

  it("uses a different IV for every payload", async () => {
    const first = await encryptBackup(SAMPLE, "secret");
    const second = await encryptBackup(SAMPLE, "secret");

    expect(first.iv).not.toBe(second.iv);
    expect(first.payload).not.toEqual(second.payload);
  });

  it("rejects a wrong secret", async () => {
    const { payload } = await encryptBackup(SAMPLE, "secret");

    await expect(decryptBackup(payload, "wrong-secret")).rejects.toThrow();
  });

  it("rejects a short payload", async () => {
    await expect(decryptBackup(new Uint8Array([1, 2, 3]), "secret")).rejects.toThrow("too short");
  });

  it("rejects an unknown payload format", async () => {
    await expect(decryptBackup(new Uint8Array(32).fill(9), "secret")).rejects.toThrow("unknown format");
  });
});
