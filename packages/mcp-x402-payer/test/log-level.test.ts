// Confirms the MCP payer's log() honors the shared VELLAR_LOG_LEVEL
// convention (vellar-sdk/log-level), per issue #678: a user should be able to
// set one env var and have log volume change consistently across
// vellar-sdk, vellar-cli, and this package.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { log } from "../src/output.js";

const ORIGINAL_ENV = process.env.VELLAR_LOG_LEVEL;

function captureStderr(fn: () => void): string {
  let captured = "";
  const real = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: unknown) => {
    captured += typeof chunk === "string" ? chunk : String(chunk);
    return true;
  }) as typeof process.stderr.write;
  try {
    fn();
  } finally {
    process.stderr.write = real;
  }
  return captured;
}

beforeEach(() => {
  delete process.env.VELLAR_LOG_LEVEL;
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.VELLAR_LOG_LEVEL;
  } else {
    process.env.VELLAR_LOG_LEVEL = ORIGINAL_ENV;
  }
});

describe("log() respects VELLAR_LOG_LEVEL", () => {
  it("at the default level (info), info and warn and error all emit", () => {
    const output = captureStderr(() => {
      log("info", "info line");
      log("warn", "warn line");
      log("error", "error line");
    });
    expect(output).toContain("info line");
    expect(output).toContain("warn line");
    expect(output).toContain("error line");
  });

  it("at VELLAR_LOG_LEVEL=error, info and warn are suppressed but error still emits", () => {
    process.env.VELLAR_LOG_LEVEL = "error";
    const output = captureStderr(() => {
      log("info", "info line");
      log("warn", "warn line");
      log("error", "error line");
    });
    expect(output).not.toContain("info line");
    expect(output).not.toContain("warn line");
    expect(output).toContain("error line");
  });

  it("at VELLAR_LOG_LEVEL=warn, info is suppressed but warn and error emit", () => {
    process.env.VELLAR_LOG_LEVEL = "warn";
    const output = captureStderr(() => {
      log("info", "info line");
      log("warn", "warn line");
      log("error", "error line");
    });
    expect(output).not.toContain("info line");
    expect(output).toContain("warn line");
    expect(output).toContain("error line");
  });

  it("at VELLAR_LOG_LEVEL=silent, nothing emits, not even error", () => {
    process.env.VELLAR_LOG_LEVEL = "silent";
    const output = captureStderr(() => {
      log("info", "info line");
      log("warn", "warn line");
      log("error", "error line");
    });
    expect(output).toBe("");
  });

  it("an unrecognized VELLAR_LOG_LEVEL value falls back to the default rather than throwing", () => {
    process.env.VELLAR_LOG_LEVEL = "nonsense";
    const output = captureStderr(() => {
      log("info", "info line");
    });
    expect(output).toContain("info line");
  });

  it("a suppressed line is never even serialized (no stray JSON fragment), only omitted", () => {
    process.env.VELLAR_LOG_LEVEL = "error";
    const output = captureStderr(() => {
      log("info", "should not appear", { secretish: "field-value" });
    });
    expect(output).toBe("");
    expect(output).not.toContain("field-value");
  });
});
