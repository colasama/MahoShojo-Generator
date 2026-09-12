import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminManagementFixture } from './admin-management-fixture';
import { adminActionVersion } from '../src/admin/actions/core';
import { createAdminAiReviewJob, readAdminAiJobResult, runAdminAiJob } from '../src/admin/ai-review';
import { createAdminMetricsActions } from '../src/admin/actions/metrics';
import { cancelAdminJob, type AdminPrivateBucket } from '../src/admin/jobs';

const close: Array<() => void> = [];
afterEach(() => close.splice(0).forEach((cleanup) => cleanup()));
const providers = [{ name: 'fixture', type: 'openai' as const, apiKey: 'fixture-secret', baseUrl: 'https://provider.example.test/v1', model: 'fixture-model' }];
async function setup(extraCapabilities: string[] = []) {
  const fixture = await adminManagementFixture(['ai.review', 'content.write', ...extraCapabilities]);
  close.push(() => fixture.sqlite.close());
  fixture.sqlite.exec(`INSERT INTO users (id,username,email,auth_key) VALUES (1,'fixture','fixture@example.test','fixture-key');
    INSERT INTO data_cards (id,user_id,type,name,description,data,is_public,review_status,created_at,updated_at)
    VALUES ('card',1,'character','测试卡','测试简介','{"name":"测试卡","isNative":true}',1,'pending','2026-01-01','2026-01-01')`);
  const objects = new Map<string, string>();
  const bucket: AdminPrivateBucket = {
    async put(key, body) { objects.set(key, typeof body === 'string' ? body : await new Response(body).text()); },
    async get(key) { const body = objects.get(key); return body === undefined ? null : { text: async () => body, body: new Response(body).body! }; },
    async delete(key) { objects.delete(key); },
  };
  const expectedVersion = await adminActionVersion('data-cards', fixture.sqlite.prepare("SELECT * FROM data_cards WHERE id='card'").get()!);
  const input = { reason: '人工辅助审核', idempotencyKey: 'ai-once', provider: 'fixture', model: 'fixture-model', targets: [{ kind: 'card', id: 'card', expectedVersion }] };
  const enqueued = await createAdminAiReviewJob(fixture.db, input, fixture.context);
  const jobId = enqueued.result!.jobId;
  return { ...fixture, bucket, objects, jobId, input, expectedVersion };
}
const completion = (reviews = [{ id: 'card:card', suggestion: 'approved', reason: '未发现违规内容' }]) => new Response(JSON.stringify({
  id: 'fixture-completion', object: 'chat.completion', created: 1_800_000_000, model: 'fixture-model',
  choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify({ reviews }) }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125 },
}), { headers: { 'Content-Type': 'application/json' } });

describe('Persistent Admin AI review jobs', () => {
  it('selects the exact provider/model pair regardless of order and preserves its identity before dispatch', async () => {
    const test = await setup();
    const other = { ...providers[0], name: 'other', baseUrl: 'https://other.example.test/v1', apiKey: 'other-fixture-secret' };
    for (const ordered of [[other, ...providers], [...providers, other]]) {
      const enqueued = await createAdminAiReviewJob(test.db, { ...test.input, idempotencyKey: crypto.randomUUID() }, test.context);
      const id = enqueued.result!.jobId;
      const fetcher = vi.fn<typeof fetch>(async (request, init) => {
        expect(String(request)).toBe('https://provider.example.test/v1/chat/completions');
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture-secret');
        const job = test.sqlite.prepare('SELECT scope_json,cursor_json FROM admin_jobs WHERE id=?').get(id)!;
        expect(JSON.parse(String(job.scope_json))).toMatchObject({ provider: 'fixture', model: 'fixture-model' });
        expect(JSON.parse(String(job.cursor_json))).toEqual({ provider: 'fixture', model: 'fixture-model' });
        return completion();
      });
      await runAdminAiJob(test.db, test.bucket, id, { providers: ordered, fetch: fetcher });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(await readAdminAiJobResult(test.db, test.bucket, 'operator', id)).toMatchObject({ provider: 'fixture', model: 'fixture-model' });
      expect(JSON.stringify(test.sqlite.prepare('SELECT * FROM admin_jobs').all())).not.toContain('fixture-secret');
    }
    await expect(createAdminAiReviewJob(test.db, { ...test.input, provider: 'other' }, test.context)).rejects.toMatchObject({ code: 'ADMIN_IDEMPOTENCY_CONFLICT' });
  });

  it.each(['missing', 'unknown', 'mismatched', 'duplicate'] as const)('never dispatches a %s provider identity', async (scenario) => {
    const test = await setup();
    const configured = scenario === 'mismatched'
      ? [{ ...providers[0], model: 'other-model' }, { ...providers[0], name: 'other' }]
      : scenario === 'duplicate' ? [...providers, { ...providers[0], baseUrl: 'https://other.example.test/v1' }] : providers;
    if (scenario === 'missing' || scenario === 'unknown') {
      const scope: Record<string, unknown> = { targets: test.input.targets, model: test.input.model };
      if (scenario === 'unknown') scope.provider = 'not-configured';
      test.sqlite.prepare('UPDATE admin_jobs SET scope_json=? WHERE id=?').run(JSON.stringify(scope), test.jobId);
    }
    const fetcher = vi.fn<typeof fetch>(async () => completion());
    await runAdminAiJob(test.db, test.bucket, test.jobId, { providers: configured, fetch: fetcher });
    expect(test.sqlite.prepare('SELECT status,error_code_safe FROM admin_jobs WHERE id=?').get(test.jobId))
      .toMatchObject({ status: 'failed', error_code_safe: 'ADMIN_AI_PREPARATION_FAILED' });
    await runAdminAiJob(test.db, test.bucket, test.jobId, { providers: configured, fetch: fetcher });
    expect(fetcher).not.toHaveBeenCalled();
    expect(test.objects.size).toBe(0);
  });

  it('requires provider on new requests and reads historical completed results without guessing their provider', async () => {
    const test = await setup();
    await expect(createAdminAiReviewJob(test.db, { ...test.input, idempotencyKey: 'legacy', provider: undefined }, test.context)).rejects.toThrow();
    expect(test.sqlite.prepare('SELECT count(*) n FROM admin_jobs').get()?.n).toBe(1);
    const fetcher = vi.fn<typeof fetch>(async () => completion());
    await runAdminAiJob(test.db, test.bucket, test.jobId, { providers, fetch: fetcher });
    const ref = `admin/ai-results/${test.jobId}.json`;
    const historical = JSON.parse(test.objects.get(ref)!);
    delete historical.provider;
    test.objects.set(ref, JSON.stringify(historical));
    expect(await readAdminAiJobResult(test.db, test.bucket, 'operator', test.jobId)).toMatchObject({ provider: null, model: 'fixture-model' });
    await runAdminAiJob(test.db, test.bucket, test.jobId, { providers, fetch: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('enqueues once, claims uncertainty before dispatch, stores usage, and never changes review state', async () => {
    const test = await setup();
    const replay = await createAdminAiReviewJob(test.db, test.input, test.context);
    expect(replay).toMatchObject({ replayed: true, result: { jobId: test.jobId } });
    const fetcher = vi.fn<typeof fetch>(async (_request, init) => {
      expect(test.sqlite.prepare('SELECT status FROM admin_jobs WHERE id=?').get(test.jobId)?.status).toBe('uncertain');
      expect(String(init?.body)).toContain('fixture-model');
      return completion();
    });
    expect(await runAdminAiJob(test.db, test.bucket, test.jobId, { providers, fetch: fetcher })).toBe(true);
    expect(test.sqlite.prepare('SELECT status FROM admin_jobs WHERE id=?').get(test.jobId)?.status).toBe('succeeded');
    const result = await readAdminAiJobResult(test.db, test.bucket, 'operator', test.jobId);
    expect(result).toMatchObject({ provider: 'fixture', model: 'fixture-model', reviews: [{ id: 'card:card', suggestion: 'approved' }], usage: { promptTokens: 100, completionTokens: 25, totalTokens: 125 } });
    expect(test.sqlite.prepare('SELECT review_status FROM data_cards').get()?.review_status).toBe('pending');
    await runAdminAiJob(test.db, test.bucket, test.jobId, { providers, fetch: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(test.sqlite.prepare('SELECT * FROM admin_audit_events').all())).not.toContain('测试简介');
  });

  it('keeps a network-unknown result non-replayable across repeated queue deliveries', async () => {
    const test = await setup();
    const fetcher = vi.fn<typeof fetch>(async () => { throw new Error('upstream socket disconnected'); });
    await runAdminAiJob(test.db, test.bucket, test.jobId, { providers, fetch: fetcher });
    expect(test.sqlite.prepare('SELECT status,error_code_safe FROM admin_jobs WHERE id=?').get(test.jobId)).toMatchObject({ status: 'uncertain', error_code_safe: 'ADMIN_AI_RESULT_UNCERTAIN' });
    expect(JSON.parse(String(test.sqlite.prepare('SELECT cursor_json FROM admin_jobs WHERE id=?').get(test.jobId)?.cursor_json))).toMatchObject({ provider: 'fixture', model: 'fixture-model', dispatched: true });
    await runAdminAiJob(test.db, test.bucket, test.jobId, { providers, fetch: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch stale targets or unconfigured models', async () => {
    const test = await setup();
    test.sqlite.exec("UPDATE data_cards SET name='已修改' WHERE id='card'");
    const fetcher = vi.fn<typeof fetch>(async () => completion());
    await runAdminAiJob(test.db, test.bucket, test.jobId, { providers, fetch: fetcher });
    expect(test.sqlite.prepare('SELECT status FROM admin_jobs WHERE id=?').get(test.jobId)?.status).toBe('failed');
    expect(fetcher).not.toHaveBeenCalled();
    const second = await createAdminAiReviewJob(test.db, { ...test.input, idempotencyKey: 'unknown-model', model: 'not-configured' }, test.context);
    await runAdminAiJob(test.db, test.bucket, second.result!.jobId, { providers, fetch: fetcher });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects model-invented targets and does not repeat after result storage failure', async () => {
    const test = await setup();
    const fetcher = vi.fn<typeof fetch>(async () => completion([{ id: 'other-card', suggestion: 'approved', reason: '未知目标' }]));
    await runAdminAiJob(test.db, test.bucket, test.jobId, { providers, fetch: fetcher });
    expect(test.sqlite.prepare('SELECT status FROM admin_jobs WHERE id=?').get(test.jobId)?.status).toBe('uncertain');
    const next = await createAdminAiReviewJob(test.db, { ...test.input, idempotencyKey: 'storage-failure' }, test.context);
    fetcher.mockImplementation(async () => completion());
    const brokenBucket = { ...test.bucket, put: async () => { throw new Error('storage down'); } };
    await runAdminAiJob(test.db, brokenBucket, next.result!.jobId, { providers, fetch: fetcher });
    await runAdminAiJob(test.db, brokenBucket, next.result!.jobId, { providers, fetch: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('cancels revoked work and refuses result download after revocation', async () => {
    const test = await setup();
    const fetcher = vi.fn<typeof fetch>(async () => completion());
    await runAdminAiJob(test.db, test.bucket, test.jobId, { providers, fetch: fetcher });
    const next = await createAdminAiReviewJob(test.db, { ...test.input, idempotencyKey: 'revoked-job' }, test.context);
    test.sqlite.exec("UPDATE admin_principals SET status='disabled'");
    await runAdminAiJob(test.db, test.bucket, next.result!.jobId, { providers, fetch: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(test.sqlite.prepare('SELECT status FROM admin_jobs WHERE id=?').get(next.result!.jobId)?.status).toBe('cancelled');
    await expect(readAdminAiJobResult(test.db, test.bucket, 'operator', test.jobId)).rejects.toMatchObject({ status: 403 });
  });
  it('audit ignored during dispatch intent rolls back the intent and never calls the provider', async()=>{
    const test=await setup();
    test.sqlite.exec("CREATE TRIGGER ignore_ai_dispatch_audit BEFORE INSERT ON admin_audit_events WHEN NEW.action='ai.review.dispatch-intent' BEGIN SELECT RAISE(IGNORE); END");
    const fetcher=vi.fn<typeof fetch>(async()=>completion());
    await runAdminAiJob(test.db,test.bucket,test.jobId,{providers,fetch:fetcher});
    expect(fetcher).not.toHaveBeenCalled();
    expect(test.sqlite.prepare('SELECT status FROM admin_jobs WHERE id=?').get(test.jobId)?.status).toBe('failed');
    expect(test.sqlite.prepare("SELECT count(*) n FROM admin_audit_events WHERE action='ai.review.dispatch-intent'").get()?.n).toBe(0);
  });
  it('records billed usage after operator cancellation without restoring success or replaying AI',async()=>{
    const test=await setup(['data.maintenance']);
    const fetcher=vi.fn<typeof fetch>(async()=>{
      const updated=String(test.sqlite.prepare('SELECT updated_at FROM admin_jobs WHERE id=?').get(test.jobId)?.updated_at);
      await cancelAdminJob(test.db,{id:test.jobId,expectedUpdatedAt:updated,reason:'供应商核实后取消',idempotencyKey:'cancel-in-flight'},test.context);
      return completion();
    });
    await runAdminAiJob(test.db,test.bucket,test.jobId,{providers,fetch:fetcher});
    const job=test.sqlite.prepare('SELECT status,cursor_json,result_ref,processed_count FROM admin_jobs WHERE id=?').get(test.jobId)!;
    expect(job).toMatchObject({status:'cancelled',result_ref:null,processed_count:0});
    expect(JSON.parse(String(job.cursor_json))).toMatchObject({dispatched:true,provider:'fixture',model:'fixture-model',usage:{promptTokens:100,completionTokens:25,totalTokens:125}});
    expect(test.sqlite.prepare("SELECT count(*) n FROM admin_audit_events WHERE action='ai.review.late-usage'").get()?.n).toBe(1);
    expect(test.objects.size).toBe(0);await expect(readAdminAiJobResult(test.db,test.bucket,'operator',test.jobId)).rejects.toMatchObject({status:403});
    await runAdminAiJob(test.db,test.bucket,test.jobId,{providers,fetch:fetcher});expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('late usage and its audit are atomic even when cancellation races the result R2 write',async()=>{
    const test=await setup(['data.maintenance']);
    const put=test.bucket.put;test.bucket.put=async(key,body)=>{
      await put(key,body);
      const updated=String(test.sqlite.prepare('SELECT updated_at FROM admin_jobs WHERE id=?').get(test.jobId)?.updated_at);
      await cancelAdminJob(test.db,{id:test.jobId,expectedUpdatedAt:updated,reason:'结果存储期间取消',idempotencyKey:'cancel-at-storage'},test.context);
      test.sqlite.exec("CREATE TRIGGER ignore_late_usage_audit BEFORE INSERT ON admin_audit_events WHEN NEW.action='ai.review.late-usage' BEGIN SELECT RAISE(IGNORE); END");
    };
    const fetcher=vi.fn<typeof fetch>(async()=>completion());
    await expect(runAdminAiJob(test.db,test.bucket,test.jobId,{providers,fetch:fetcher})).rejects.toThrow();
    const job=test.sqlite.prepare('SELECT status,cursor_json,result_ref FROM admin_jobs WHERE id=?').get(test.jobId)!;
    expect(job).toMatchObject({status:'cancelled',result_ref:null});
    expect(JSON.parse(String(job.cursor_json))).toEqual({provider:'fixture',model:'fixture-model'});
    expect(test.sqlite.prepare("SELECT count(*) n FROM admin_audit_events WHERE action='ai.review.late-usage'").get()?.n).toBe(0);
    await expect(readAdminAiJobResult(test.db,test.bucket,'operator',test.jobId)).rejects.toMatchObject({status:403});
    await runAdminAiJob(test.db,test.bucket,test.jobId,{providers,fetch:fetcher});expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('Admin metric recomputation', () => {
  it('uses the shared calculator and signature verifier, never the caller isNative flag', async () => {
    const test = await setup();
    const verifySignature = vi.fn(async () => false);
    const action = createAdminMetricsActions({ verifySignature })[0];
    const result = await action.execute(test.db, { id: 'card', expectedVersion: test.expectedVersion, reason: '更新指标', idempotencyKey: 'metrics-once' }, test.context);
    expect(result).toMatchObject({ status: 'succeeded', result: { isNative: false } });
    expect(verifySignature).toHaveBeenCalledWith({ name: '测试卡', isNative: true });
    expect(test.sqlite.prepare('SELECT is_native,data_card_updated_at FROM data_card_metrics').get()).toMatchObject({ is_native: 0, data_card_updated_at: '2026-01-01' });
    const old = test.sqlite.prepare('SELECT * FROM data_card_metrics').get();
    expect(await action.execute(test.db, { id: 'card', expectedVersion: 'stale', reason: '旧版重算', idempotencyKey: 'stale' }, test.context)).toMatchObject({ status: 'conflict' });
    expect(test.sqlite.prepare('SELECT * FROM data_card_metrics').get()).toEqual(old);
  });
});
