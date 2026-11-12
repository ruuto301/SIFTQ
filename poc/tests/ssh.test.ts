import { describe, expect, it } from "bun:test";
import { parseSshHosts } from "../server/ssh";

describe("parseSshHosts", () => {
  it("returns concrete Host aliases in sorted order", () => {
    const text = [
      "Host yoriwake.sbx",
      "  HostName 10.0.0.1",
      "Host alpha beta",
      "Host *",
      "Host !ignored",
      "Host name-with-*",
    ].join("\n");

    expect(parseSshHosts(text)).toEqual(["alpha", "beta", "yoriwake.sbx"]);
  });

  it("ignores comments and missing Host lines", () => {
    expect(parseSshHosts("# Host commented\nHostName example.com\n")).toEqual([]);
  });
});
