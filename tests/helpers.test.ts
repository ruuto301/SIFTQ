import { describe, expect, it } from "vite-plus/test";
import {
  findById,
  findVersioned,
  isToolResult,
  readId,
  readVersionedInput,
  removeContent,
  updateContent,
  type RepoResult,
} from "../src/mcp/helpers";
import type { ToolResult } from "../src/mcp/types";

const okResult = <T>(value: T): RepoResult<T> => ({ ok: true, value });
const failResult = (code: string): RepoResult<never> => ({ ok: false, error: { code } });

function empty<T>(): Promise<RepoResult<T | undefined>> {
  return Promise.resolve(okResult<T | undefined>(undefined));
}

function failed<T>(code: string): Promise<RepoResult<T | undefined>> {
  return Promise.resolve(failResult(code));
}

function payload(result: ToolResult): unknown {
  const first = result.content[0];
  return JSON.parse(first === undefined ? "null" : first.text);
}

function errorPayload(value: unknown): unknown {
  if (!isToolResult(value)) throw new Error("expected a tool error");
  return payload(value);
}

describe("isToolResult", () => {
  it("recognizes tool results only", () => {
    expect(isToolResult({ content: [], isError: true })).toBe(true);
    expect(isToolResult({ id: "a" })).toBe(false);
    expect(isToolResult("a")).toBe(false);
  });
});

describe("readId", () => {
  it("reads a non-empty id", () => {
    expect(readId({ id: "idea-1" })).toBe("idea-1");
  });

  it("rejects a missing or empty id", () => {
    expect(errorPayload(readId({}))).toEqual({ code: "INVALID_INPUT", message: "id is required" });
    expect(errorPayload(readId({ id: "" }))).toEqual({ code: "INVALID_INPUT", message: "id is required" });
  });
});

describe("readVersionedInput", () => {
  it("reads a positive version", () => {
    expect(readVersionedInput({ id: "task-1", version: 2 })).toEqual({ id: "task-1", version: 2 });
  });

  it("rejects a missing or non-positive version", () => {
    expect(errorPayload(readVersionedInput({ id: "task-1" }))).toEqual({
      code: "INVALID_INPUT",
      message: "id and version are required",
    });
    expect(errorPayload(readVersionedInput({ id: "task-1", version: 0 }))).toEqual({
      code: "INVALID_INPUT",
      message: "id and version are required",
    });
  });
});

describe("findById", () => {
  it("returns the loaded entity", async () => {
    const found = await findById({ id: "a" }, "failed to load", () => Promise.resolve(okResult({ id: "a" })));

    expect(found).toEqual({ id: "a" });
  });

  it("maps a missing entity to NOT_FOUND", async () => {
    const found = await findById({ id: "a" }, "failed to load", empty);

    expect(errorPayload(found)).toEqual({ code: "NOT_FOUND", message: "the target was not found" });
  });

  it("maps a repository failure to the caller message", async () => {
    const found = await findById({ id: "a" }, "failed to load the task", () => failed("CONFLICT"));

    expect(errorPayload(found)).toEqual({ code: "CONFLICT", message: "failed to load the task" });
  });
});

describe("findVersioned", () => {
  it("keeps the validated input next to the loaded entity", async () => {
    const found = await findVersioned({ id: "t", version: 3 }, "failed to load", (input) =>
      Promise.resolve(okResult({ version: input.version })),
    );

    expect(found).toEqual({ input: { id: "t", version: 3 }, value: { version: 3 } });
  });

  it("propagates the argument validation error", async () => {
    const found = await findVersioned({ id: "t" }, "failed to load", () => Promise.resolve(okResult({ version: 1 })));

    expect(errorPayload(found)).toEqual({ code: "INVALID_INPUT", message: "id and version are required" });
  });
});

describe("updateContent", () => {
  it("renders the updated value", async () => {
    const result = await updateContent(Promise.resolve(okResult({ id: "a" })));

    expect(payload(result)).toEqual({ id: "a" });
  });

  it("maps a failed update to its error code", async () => {
    const result = await updateContent(Promise.resolve(failResult("CONFLICT")));

    expect(payload(result)).toEqual({ code: "CONFLICT", message: "the task changed on the server; fetch it again" });
  });
});

describe("removeContent", () => {
  it("renders the deleted id", async () => {
    const result = await removeContent("a", Promise.resolve(okResult(null)));

    expect(payload(result)).toEqual({ deleted: "a" });
  });

  it("maps a failed delete to its error code", async () => {
    const result = await removeContent("a", Promise.resolve(failResult("NOT_FOUND")));

    expect(payload(result)).toEqual({ code: "NOT_FOUND", message: "the target was not found" });
  });
});
