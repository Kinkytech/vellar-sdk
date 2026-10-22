/**
 * Shared log-level configuration, honored consistently by vellar-sdk,
 * the MCP x402 payer, and (per package.json's `exports`) any other package
 * in this workspace that wants its console/stderr output gated the same way.
 *
 * One environment variable, `VELLAR_LOG_LEVEL`, set once, controls all of
 * them. Each package still owns WHERE it writes (stdout vs stderr, JSON vs
 * plain text) and any constraints specific to its own transport — this
 * module only owns WHETHER a given line at a given level should be emitted.
 */

/** Ordered from least to most verbose. Index is used for comparison. */
export const LOG_LEVELS = ["silent", "error", "warn", "info", "debug"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const DEFAULT_LOG_LEVEL: LogLevel = "info";

const LEVEL_RANK: Record<LogLevel, number> = Object.fromEntries(
  LOG_LEVELS.map((level, index) => [level, index]),
) as Record<LogLevel, number>;

function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

/**
 * Parse a log level from an arbitrary string (typically an env var value).
 * Returns `undefined` for anything unrecognized, including empty/whitespace,
 * rather than throwing, so a caller can fall back to a default or warn once
 * instead of crashing a CLI over a typo'd env var.
 */
export function parseLogLevel(value: string | undefined): LogLevel | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  return isLogLevel(normalized) ? normalized : undefined;
}

/**
 * Resolve the effective log level for this process.
 *
 * Precedence: explicit `override` (e.g. a `--log-level` CLI flag) > the
 * shared `VELLAR_LOG_LEVEL` env var > `fallback` (a package-specific default)
 * > the global default (`"info"`). An unrecognized env var value is ignored
 * (falls through) rather than treated as an error, matching this repo's
 * existing convention of defaulting past malformed optional env input rather
 * than failing startup over it.
 */
export function resolveLogLevel(options: {
  override?: string;
  env?: Record<string, string | undefined>;
  fallback?: LogLevel;
} = {}): LogLevel {
  const { override, env = process.env, fallback = DEFAULT_LOG_LEVEL } = options;

  const fromOverride = parseLogLevel(override);
  if (fromOverride) return fromOverride;

  const fromEnv = parseLogLevel(env.VELLAR_LOG_LEVEL);
  if (fromEnv) return fromEnv;

  return fallback;
}

/**
 * Whether a line logged at `level` should be emitted given the effective
 * `threshold` (as returned by `resolveLogLevel`). `"silent"` as the
 * threshold suppresses everything, including errors — a caller that wants
 * fatal startup failures to always print should write those directly rather
 * than gating them through this check.
 */
export function shouldLog(level: Exclude<LogLevel, "silent">, threshold: LogLevel): boolean {
  return LEVEL_RANK[level] <= LEVEL_RANK[threshold];
}
