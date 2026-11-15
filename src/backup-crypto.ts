const ENCODER = new TextEncoder();

/** Magic prefix that identifies a SIFTQ backup payload. */
const MAGIC = "SIFTBK1";
const HKDF_SALT = "siftq-d1-backup";
const HKDF_INFO = "aes-256-gcm-v1";
const IV_BYTES = 12;
const KEY_BITS = 256;
const KEY_ID_BYTES = 8;

/** Derived AES-GCM key plus a short identifier used to detect a wrong secret. */
export type BackupKey = {
  key: CryptoKey;
  keyId: string;
};

/** Encrypted payload with the metadata needed by the manifest. */
export type EncryptedBackup = {
  payload: Uint8Array<ArrayBuffer>;
  keyId: string;
  iv: string;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesOf(view: ArrayBuffer | ArrayBufferView): Uint8Array<ArrayBuffer> {
  if (view instanceof ArrayBuffer) return new Uint8Array(view);
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return new Uint8Array(copy);
}

/** Derives the backup key from an existing application secret with HKDF. */
export async function deriveBackupKey(secret: string): Promise<BackupKey> {
  if (secret.length === 0) throw new Error("backup secret is empty");
  const material = await crypto.subtle.importKey("raw", ENCODER.encode(secret), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: ENCODER.encode(HKDF_SALT), info: ENCODER.encode(HKDF_INFO) },
    material,
    KEY_BITS,
  );
  const raw = bytesOf(bits);
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  const digest = bytesOf(await crypto.subtle.digest("SHA-256", raw));
  return { key, keyId: toHex(digest.slice(0, KEY_ID_BYTES)) };
}

/** Encrypts a plaintext payload as magic + IV + AES-GCM ciphertext. */
export async function encryptBackup(plaintext: Uint8Array, secret: string): Promise<EncryptedBackup> {
  const { key, keyId } = await deriveBackupKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = bytesOf(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new Uint8Array(plaintext)));
  const magic = ENCODER.encode(MAGIC);
  const payload = new Uint8Array(magic.length + iv.length + ciphertext.length);
  payload.set(magic, 0);
  payload.set(iv, magic.length);
  payload.set(ciphertext, magic.length + iv.length);
  return { payload, keyId, iv: toHex(iv) };
}

/** Decrypts a backup payload and rejects payloads with an unknown format. */
export async function decryptBackup(
  payload: Uint8Array,
  secret: string,
): Promise<{ plaintext: Uint8Array<ArrayBuffer>; keyId: string; iv: string }> {
  const magic = ENCODER.encode(MAGIC);
  if (payload.length < magic.length) throw new Error("backup payload is too short");
  const header = payload.slice(0, magic.length);
  if (toHex(header) !== toHex(magic)) throw new Error("backup payload has an unknown format");
  if (payload.length <= magic.length + IV_BYTES) throw new Error("backup payload is too short");
  const iv = payload.slice(magic.length, magic.length + IV_BYTES);
  const ciphertext = payload.slice(magic.length + IV_BYTES);
  const { key, keyId } = await deriveBackupKey(secret);
  const plaintext = bytesOf(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext));
  return { plaintext, keyId, iv: toHex(iv) };
}
