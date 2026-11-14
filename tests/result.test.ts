import { describe, expect, it } from "vite-plus/test";
import { err, ok } from "../src/result";

describe("Result helpers", () => {
  it("wraps a value as a success result", () => {
    expect(ok<string, string>("value")).toEqual({ ok: true, value: "value" });
  });

  it("wraps a code as a failure result", () => {
    expect(err<string, string>("CONFLICT")).toEqual({ ok: false, error: "CONFLICT" });
  });
});
