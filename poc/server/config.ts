import type { ConfigOption, ConfigOptionValue } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function flattenValues(value: unknown): ConfigOptionValue[] {
  if (!Array.isArray(value)) return [];
  const result: ConfigOptionValue[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (Array.isArray(item["options"])) {
      result.push(...flattenValues(item["options"]));
      continue;
    }
    const optionValue = item["value"];
    const optionName = item["name"];
    if (typeof optionValue === "string" && typeof optionName === "string") {
      result.push({ value: optionValue, name: optionName });
    }
  }
  return result;
}

export function configOptionsFromAcp(value: unknown): ConfigOption[] {
  if (!Array.isArray(value)) return [];
  const result: ConfigOption[] = [];
  for (const item of value) {
    if (!isRecord(item) || item["type"] !== "select") continue;
    const id = item["id"];
    const name = item["name"];
    if (typeof id !== "string" || id === "") continue;
    const values = flattenValues(item["options"]);
    if (values.length === 0) continue;
    const current = typeof item["currentValue"] === "string" ? item["currentValue"] : values[0]?.value ?? "";
    const category = item["category"];
    const option: ConfigOption = {
      id,
      name: typeof name === "string" && name !== "" ? name : id,
      values,
      current,
    };
    if (typeof category === "string" && category !== "") option.category = category;
    result.push(option);
  }
  return result;
}
