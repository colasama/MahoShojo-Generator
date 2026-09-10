import type {
  HostedDrClientTelemetryEvent,
  HostedDrProbeDurationBucket,
} from '@/lib/hosted-dr/client-preflight-telemetry';
import type { HostedDrProbeOutcome, HostedDrDecisionReason, HostedDrPlacement } from '@/lib/hosted-dr/client-preflight';
import {
  HOSTED_DR_CONTRACT_VERSION,
  isHostedDrContractVersionCompatible,
} from '@mahoshojo/hosted-api/hosted-dr';
import honoApiRoutes from '../../../../../../config/hono-api-routes.json';

const MAX_BODY_BYTES = 8 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_EVENTS = 120;
const GLOBAL_RATE_LIMIT_MAX_EVENTS = 2_048;
const MAX_RATE_LIMIT_KEYS = 1_024;
const MAX_CONTRACT_VERSION_LENGTH = 32;
const GLOBAL_RATE_LIMIT_KEY = '__all__';

const routeFamilies = new Set([
  'undeclared',
  ...honoApiRoutes.sharedRouteIds.map((routeId) => `/api/${routeId}`),
]);

const placements: ReadonlySet<HostedDrPlacement> = new Set([
  'hono-primary',
  'next-dr',
  'unavailable',
]);

const decisionReasons: ReadonlySet<HostedDrDecisionReason> = new Set([
  'PRIMARY_ONLY',
  'PRIMARY_READY',
  'DR_READY',
  'OPERATION_NOT_DECLARED',
  'DR_NOT_ELIGIBLE',
  'NO_READY_PLACEMENT',
]);

const probeOutcomes: ReadonlySet<HostedDrProbeOutcome | 'not-run'> = new Set([
  'ready',
  'timeout',
  'not-ready',
  'protocol-error',
  'network-error',
  'not-run',
]);

const probeDurationBuckets: ReadonlySet<HostedDrProbeDurationBucket> = new Set([
  'not-run',
  '0-49ms',
  '50-199ms',
  '200-999ms',
  '1000-2999ms',
  '3000ms+',
]);

const terminalClasses: ReadonlySet<Extract<
  HostedDrClientTelemetryEvent,
  { phase: 'dispatch-terminal' }
>['terminalClass']> = new Set([
  'response-ok',
  'response-error',
  'ambiguous',
  'not-dispatched',
]);

type RateLimitBucket = {
  startedAt: number;
  count: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const hasExactKeys = (record: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actualKeys = Object.keys(record).sort();
  const expectedKeys = [...keys].sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index]);
};

const isStringIn = <T extends string>(value: unknown, values: ReadonlySet<T>): value is T => (
  typeof value === 'string' && values.has(value as T)
);

const isCompatibleContractVersion = (value: unknown): value is string => (
  typeof value === 'string'
  && value.length <= MAX_CONTRACT_VERSION_LENGTH
  && isHostedDrContractVersionCompatible(value, HOSTED_DR_CONTRACT_VERSION)
);

const isProbePairValid = (
  outcome: unknown,
  durationBucket: unknown,
): boolean => (
  isStringIn(outcome, probeOutcomes)
  && isStringIn(durationBucket, probeDurationBuckets)
  && ((outcome === 'not-run') === (durationBucket === 'not-run'))
);

const parseTelemetryEvent = (value: unknown): HostedDrClientTelemetryEvent | null => {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !isCompatibleContractVersion(value.contractVersion)
    || !isStringIn(value.routeFamily, routeFamilies)
    || !isStringIn(value.selectedPlacement, placements)
    || typeof value.phase !== 'string') {
    return null;
  }

  if (value.phase === 'selection') {
    const validKeys = [
      'schemaVersion',
      'phase',
      'contractVersion',
      'routeFamily',
      'selectedPlacement',
      'selectionReason',
      'primaryProbeOutcome',
      'primaryProbeDurationBucket',
      'drProbeOutcome',
      'drProbeDurationBucket',
    ] as const;
    if (!hasExactKeys(value, validKeys)
      || !isStringIn(value.selectionReason, decisionReasons)
      || !isProbePairValid(value.primaryProbeOutcome, value.primaryProbeDurationBucket)
      || !isProbePairValid(value.drProbeOutcome, value.drProbeDurationBucket)) {
      return null;
    }
    return value as unknown as HostedDrClientTelemetryEvent;
  }

  if (value.phase === 'dispatch-terminal') {
    const validKeys = [
      'schemaVersion',
      'phase',
      'contractVersion',
      'routeFamily',
      'selectedPlacement',
      'terminalClass',
    ] as const;
    if (!hasExactKeys(value, validKeys) || !isStringIn(value.terminalClass, terminalClasses)) {
      return null;
    }
    return value as unknown as HostedDrClientTelemetryEvent;
  }

  return null;
};

const clientKeyOf = (request: Request): string => {
  const forwardedAddress = request.headers.get('cf-connecting-ip')?.trim() ?? '';
  return forwardedAddress.length > 0 && forwardedAddress.length <= 128
    ? `source:${forwardedAddress}`
    : 'source:anonymous';
};

const consumeRateLimit = (key: string, now = Date.now()): boolean => {
  const bucketFor = (bucketKey: string): RateLimitBucket => {
    const existing = rateLimitBuckets.get(bucketKey);
    if (existing && now - existing.startedAt < RATE_LIMIT_WINDOW_MS) return existing;

    if (!existing && rateLimitBuckets.size >= MAX_RATE_LIMIT_KEYS) {
      const oldestKey = [...rateLimitBuckets.keys()]
        .find((candidate) => candidate !== GLOBAL_RATE_LIMIT_KEY);
      if (oldestKey) rateLimitBuckets.delete(oldestKey);
    }

    const bucket = { startedAt: now, count: 0 };
    rateLimitBuckets.set(bucketKey, bucket);
    return bucket;
  };

  const sourceBucket = bucketFor(key);
  if (sourceBucket.count >= RATE_LIMIT_MAX_EVENTS) return false;

  const globalBucket = bucketFor(GLOBAL_RATE_LIMIT_KEY);
  if (globalBucket.count >= GLOBAL_RATE_LIMIT_MAX_EVENTS) return false;

  // cf-connecting-ip is expected to be edge-injected; this global bucket still bounds
  // direct callers that rotate/spoof that header or reach multiple source buckets.
  sourceBucket.count += 1;
  globalBucket.count += 1;
  return true;
};

const responseHeaders = (extra: Record<string, string> = {}): Headers => new Headers({
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  ...extra,
});

const errorResponse = (status: number, code: string, extra: Record<string, string> = {}) => new Response(
  JSON.stringify({ ok: false, code }),
  { status, headers: responseHeaders({ 'Content-Type': 'application/json', ...extra }) },
);

type BodyReadResult =
  | { kind: 'ok'; body: ArrayBuffer }
  | { kind: 'too-large' }
  | { kind: 'read-error' };

const readBodyWithinLimit = async (request: Request): Promise<BodyReadResult> => {
  if (!request.body) return { kind: 'ok', body: new ArrayBuffer(0) };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // body 已经超限，清理失败不改变拒绝结果。
        }
        return { kind: 'too-large' };
      }
      chunks.push(value);
    }
  } catch {
    return { kind: 'read-error' };
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { kind: 'ok', body: body.buffer };
};

export const appRouteHandler = async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', { Allow: 'POST' });
  }
  if (!consumeRateLimit(clientKeyOf(request))) {
    return errorResponse(429, 'TELEMETRY_RATE_LIMITED', { 'Retry-After': '60' });
  }

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    return errorResponse(415, 'UNSUPPORTED_MEDIA_TYPE');
  }

  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BODY_BYTES) {
      return errorResponse(413, 'TELEMETRY_BODY_TOO_LARGE');
    }
  }

  const bodyResult = await readBodyWithinLimit(request);
  if (bodyResult.kind === 'too-large') return errorResponse(413, 'TELEMETRY_BODY_TOO_LARGE');
  if (bodyResult.kind === 'read-error') return errorResponse(400, 'INVALID_TELEMETRY_BODY');

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bodyResult.body));
  } catch {
    return errorResponse(400, 'INVALID_TELEMETRY_EVENT');
  }
  const event = parseTelemetryEvent(parsed);
  if (!event) return errorResponse(400, 'INVALID_TELEMETRY_EVENT');

  console.info(JSON.stringify({ event: 'hosted.dr.client.telemetry', ...event }));
  return new Response(null, { status: 204, headers: responseHeaders() });
};

export default appRouteHandler;
