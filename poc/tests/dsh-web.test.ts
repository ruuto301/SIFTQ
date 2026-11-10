import { describe, expect, test } from "bun:test";
import { buildIframeUrl, parseDshWebUrl } from "../server/dsh-web";

describe("dsh web helpers", () => {
  test("parses the launch url", () => {
    expect(parseDshWebUrl("dsh web: http://127.0.0.1:8790/?token=abc")).toBe("http://127.0.0.1:8790/?token=abc");
    expect(parseDshWebUrl("no url")).toBeNull();
  });

  test("builds an iframe url with the session id", () => {
    expect(buildIframeUrl("http://127.0.0.1:8790/?token=abc", "s-1")).toBe(
      "http://127.0.0.1:8790/?token=abc&session=s-1",
    );
  });
});
