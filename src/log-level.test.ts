import { afterEach, describe, expect, it } from "vitest";
import { LOG_LEVELS, parseLogLevel, resolveLogLevel, shouldLog } from "./log-level";

const ORIGINAL_ENV = process.env.VELLAR_LOG_LEVEL;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.VELLAR_LOG_LEVEL;
  } else {
    process.env.VELLAR_LOG_LEVEL = ORIGINAL_ENV;
  }
});

describe("parseLogLevel", () => {
  it("accepts every recognized level", () => {
    for (const level of LOG_LEVELS) {
      expect(parseLogLevel(level)).toBe(level);
    }
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(parseLogLevel("DEBUG")).toBe("debug");
    expect(parseLogLevel("  warn  ")).toBe("warn");
    expect(parseLogLevel("Error")).toBe("error");
  });

  it("returns undefined for undefined, empty, or unrecognized input", () => {
    expect(parseLogLevel(undefined)).toBeUndefined();
    expect(parseLogLevel("")).toBeUndefined();
    expect(parseLogLevel("   ")).toBeUndefined();
    expect(parseLogLevel("verbose")).toBeUndefined();
    expect(parseLogLevel("trace")).toBeUndefined();
    expect(parseLogLevel("not-a-level")).toBeUndefined();
  });
});

describe("resolveLogLevel", () => {
  it("defaults to info with no override, no env var, and no fallback", () => {
    expect(resolveLogLevel({ env: {} })).toBe("info");
  });

  it("honors a package-specific fallback when nothing else is set", () => {
    expect(resolveLogLevel({ env: {}, fallback: "warn" })).toBe("warn");
  });

  it("prefers the shared VELLAR_LOG_LEVEL env var over the fallback", () => {
    expect(resolveLogLevel({ env: { VELLAR_LOG_LEVEL: "debug" }, fallback: "warn" })).toBe("debug");
  });

  it("prefers an explicit override over the env var", () => {
    expect(
      resolveLogLevel({ override: "error", env: { VELLAR_LOG_LEVEL: "debug" }, fallback: "warn" }),
    ).toBe("error");
  });

  it("falls through an unrecognized env var value to the fallback, rather than throwing", () => {
    expect(resolveLogLevel({ env: { VELLAR_LOG_LEVEL: "verbose" }, fallback: "warn" })).toBe("warn");
  });

  it("falls through an unrecognized override to the env var", () => {
    expect(
      resolveLogLevel({ override: "nope", env: { VELLAR_LOG_LEVEL: "debug" }, fallback: "warn" }),
    ).toBe("debug");
  });

  it("reads from process.env by default", () => {
    process.env.VELLAR_LOG_LEVEL = "error";
    expect(resolveLogLevel()).toBe("error");
  });
});

describe("shouldLog", () => {
  it("logs at or below the threshold's verbosity", () => {
    expect(shouldLog("error", "error")).toBe(true);
    expect(shouldLog("error", "warn")).toBe(true);
    expect(shouldLog("error", "debug")).toBe(true);
    expect(shouldLog("warn", "warn")).toBe(true);
    expect(shouldLog("warn", "debug")).toBe(true);
    expect(shouldLog("info", "info")).toBe(true);
    expect(shouldLog("debug", "debug")).toBe(true);
  });

  it("suppresses anything more verbose than the threshold", () => {
    expect(shouldLog("warn", "error")).toBe(false);
    expect(shouldLog("info", "warn")).toBe(false);
    expect(shouldLog("info", "error")).toBe(false);
    expect(shouldLog("debug", "info")).toBe(false);
  });

  it("suppresses everything, including error, when the threshold is silent", () => {
    expect(shouldLog("error", "silent")).toBe(false);
    expect(shouldLog("warn", "silent")).toBe(false);
    expect(shouldLog("info", "silent")).toBe(false);
    expect(shouldLog("debug", "silent")).toBe(false);
  });

  it("at debug (the most verbose threshold), every level logs", () => {
    expect(shouldLog("error", "debug")).toBe(true);
    expect(shouldLog("warn", "debug")).toBe(true);
    expect(shouldLog("info", "debug")).toBe(true);
    expect(shouldLog("debug", "debug")).toBe(true);
  });
});
