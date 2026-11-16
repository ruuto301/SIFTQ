import type { IdeaAttachmentBucket, IdeaAttachmentObject } from "../../src/routes/idea-attachment-api";

/** R2 の代わりに契約テストで使うメモリバケット。 */
export type MemoryAttachmentBucket = IdeaAttachmentBucket & {
  readonly objects: Map<string, Uint8Array>;
  keys: () => string[];
  clear: () => void;
};

export function createMemoryAttachmentBucket(): MemoryAttachmentBucket {
  const objects = new Map<string, Uint8Array>();

  return {
    objects,
    keys: () => [...objects.keys()],
    clear: () => objects.clear(),
    async put(key, value) {
      objects.set(key, new Uint8Array(value.slice(0)));
    },
    async get(key): Promise<IdeaAttachmentObject | null> {
      const stored = objects.get(key);
      if (stored === undefined) return null;
      const copy = new Uint8Array(stored);
      return { arrayBuffer: async () => copy.buffer };
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}
