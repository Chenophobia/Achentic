import { randomUUID } from "node:crypto";

export type ErrorReporter = (error: unknown, method: string, path: string) => void;

type Frame = { filename: string; function: string; lineno: number };

type ErrorDetails = { type: string; value: string; frames: Frame[] };

type Endpoint = { storeUrl: string; authHeader: string };

const FRAME_PATTERN = /^\s+at (?:(.+) \((.+):(\d+):\d+\)|(.+):(\d+):\d+)$/;

const REPORT_TIMEOUT_MS = 3000;

function parseDsn(dsn: string): Endpoint | null {
  try {
    return toEndpoint(new URL(dsn));
  } catch {
    return null;
  }
}

function toEndpoint(parsed: URL): Endpoint | null {
  const key = parsed.username;
  const projectId = parsed.pathname.replaceAll("/", "");
  if (key === "" || projectId === "") return null;
  return {
    storeUrl: `${parsed.protocol}//${parsed.host}/api/${projectId}/store/`,
    authHeader: `Sentry sentry_version=7, sentry_key=${key}, sentry_client=tiny-notes/1.0`,
  };
}

function parseFrames(stack: string): Frame[] {
  const frames: Frame[] = [];
  for (const line of stack.split("\n")) {
    const match = FRAME_PATTERN.exec(line);
    if (match === null) continue;
    const filename = match[2] ?? match[4];
    if (filename === undefined) continue;
    frames.push({
      filename,
      function: match[1] ?? "?",
      lineno: Number(match[3] ?? match[5]),
    });
  }
  return frames.reverse();
}

function describeError(error: unknown): ErrorDetails {
  if (error instanceof Error)
    return { type: error.name, value: error.message, frames: parseFrames(error.stack ?? "") };
  return { type: "Error", value: String(error), frames: [] };
}

export function createErrorReporter(dsn: string | undefined): ErrorReporter {
  const endpoint = dsn === undefined ? null : parseDsn(dsn);
  if (endpoint === null) return () => undefined;
  return (error, method, path) => {
    const details = describeError(error);
    const body = JSON.stringify({
      event_id: randomUUID().replaceAll("-", ""),
      timestamp: new Date().toISOString(),
      platform: "node",
      level: "error",
      request: { method, url: path },
      exception: {
        values: [
          { type: details.type, value: details.value, stacktrace: { frames: details.frames } },
        ],
      },
    });
    fetch(endpoint.storeUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Sentry-Auth": endpoint.authHeader },
      body,
      signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
    }).catch(() => undefined);
  };
}
