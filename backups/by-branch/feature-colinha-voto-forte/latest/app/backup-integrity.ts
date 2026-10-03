import { createHash } from "node:crypto";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalize(source[key]);
        return result;
      }, {});
  }
  return value;
}

export function serializeCanonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value), null, 2);
}

export function sha256Checksum(content: string) {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

export function isRealSha256(value: unknown): value is string {
  return /^sha256:[a-f0-9]{64}$/i.test(String(value ?? ""));
}
