import { describe, expect, it } from "bun:test";
import { configOptionsFromAcp } from "../server/config";

describe("configOptionsFromAcp", () => {
  it("flattens grouped select options and keeps the current value", () => {
    const options = configOptionsFromAcp([
      {
        type: "select",
        id: "model",
        name: "Model",
        category: "model",
        currentValue: "a",
        options: [
          {
            group: "group-1",
            name: "Group 1",
            options: [
              { value: "a", name: "A" },
              { value: "b", name: "B" },
            ],
          },
        ],
      },
    ]);

    expect(options).toEqual([
      {
        id: "model",
        name: "Model",
        category: "model",
        values: [
          { value: "a", name: "A" },
          { value: "b", name: "B" },
        ],
        current: "a",
      },
    ]);
  });

  it("ignores boolean options and empty option lists", () => {
    const options = configOptionsFromAcp([
      { type: "boolean", id: "flag", name: "Flag", currentValue: true },
      { type: "select", id: "empty", name: "Empty", options: [] },
    ]);

    expect(options).toEqual([]);
  });

  it("returns an empty list for invalid input", () => {
    expect(configOptionsFromAcp(null)).toEqual([]);
    expect(configOptionsFromAcp([{ type: "select" }])).toEqual([]);
  });
});
