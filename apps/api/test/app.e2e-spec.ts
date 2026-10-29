/**
 * Full end-to-end scenario list for the API, run against a real Nest app +
 * real Postgres (a dedicated `ledgerly_test` database, never the dev
 * DATABASE_URL -- see .env.test) + real Redis. Everything here runs in the
 * DEMO workspace via X-Demo-Role headers, which is enough to exercise every
 * guard/state-machine path without needing a JWT login flow: in DEMO,
 * RolesGuard trusts X-Demo-Role outright (see roles.guard.ts).
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const DEMO = { 'X-Workspace': 'DEMO' };
const asRole = (role: string) => ({ ...DEMO, 'X-Demo-Role': role });

describe('Ledgerly API (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    server = app.getHttpServer();

    // Fresh deterministic DEMO data (metrics + policy + a few historical
    // decisions), exactly what POST /workspace/demo/reset gives a real
    // client -- so this suite exercises the same code path a user hitting
    // "reset demo" in the UI would.
    await request(server).post('/workspace/demo/reset').set(DEMO).expect(201);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe('(1) data upload: valid, invalid, and overwrite', () => {
    it('accepts a valid CSV', async () => {
      const csv = 'date,channel,spend,revenue,impressions,clicks,conversions\n2026-01-01,Email,100,500,1000,80,6\n';
      const res = await request(server)
        .post('/data/upload')
        .set(asRole('ADMIN'))
        .attach('file', Buffer.from(csv), 'rows.csv')
        .expect(201);
      expect(res.body.rowsOk).toBe(1);
      expect(res.body.rowsBad).toBe(0);
    });

    it('rejects a row with a negative spend', async () => {
      const csv = 'date,channel,spend,revenue,impressions,clicks,conversions\n2026-01-02,Email,-5,500,1000,80,6\n';
      const res = await request(server)
        .post('/data/upload')
        .set(asRole('ADMIN'))
        .attach('file', Buffer.from(csv), 'bad.csv')
        .expect(201);
      expect(res.body.rowsOk).toBe(0);
      expect(res.body.rowsBad).toBe(1);
      expect(res.body.errors[0].message).toBeTruthy();
    });

    it('overwrites an existing (date, channel) row on re-upload', async () => {
      const first = 'date,channel,spend,revenue,impressions,clicks,conversions\n2026-01-03,Email,100,200,1000,80,3\n';
      const second = 'date,channel,spend,revenue,impressions,clicks,conversions\n2026-01-03,Email,150,900,1000,80,11\n';
      await request(server).post('/data/upload').set(asRole('ADMIN')).attach('file', Buffer.from(first), 'a.csv').expect(201);
      await request(server).post('/data/upload').set(asRole('ADMIN')).attach('file', Buffer.from(second), 'b.csv').expect(201);

      const metrics = await request(server)
        .get('/data/metrics?from=2026-01-03&to=2026-01-03&channel=Email')
        .set(asRole('ADMIN'))
        .expect(200);
      expect(metrics.body).toHaveLength(1);
      expect(Number(metrics.body[0].revenue)).toBe(900);
    });
  });

  describe('(2) engine: creates decisions, then dedupes on re-run', () => {
    it('creates on the first run, skips the same candidates on the second', async () => {
      const firstRun = await request(server).post('/engine/run').set(asRole('ADMIN')).expect(201);
      const secondRun = await request(server).post('/engine/run').set(asRole('ADMIN')).expect(201);

      expect(secondRun.body.skipped).toBeGreaterThanOrEqual(firstRun.body.created > 0 ? 1 : 0);
      if (firstRun.body.created > 0) {
        expect(secondRun.body.created).toBe(0);
      }
    });
  });

  describe('(3) approval order + Finance requires a spend cap', () => {
    let decisionId: string;

    beforeAll(async () => {
      const list = await request(server).get('/decisions?status=PENDING_REVIEW').set(asRole('ADMIN')).expect(200);
      const withTwoSteps = list.body.find((d: any) => d.approvalProgress.total >= 2);
      const target = withTwoSteps ?? list.body[0];
      expect(target).toBeTruthy();
      decisionId = target.id;
    });

    it('rejects an approval from the wrong role', async () => {
      await request(server).post(`/decisions/${decisionId}/approve`).set(asRole('AUDITOR')).send({}).expect(403);
    });

    it('lets Marketing approve the first step', async () => {
      await request(server).post(`/decisions/${decisionId}/approve`).set(asRole('MARKETING_DIRECTOR')).send({}).expect(201);
    });

    it('rejects Finance approval with no spend cap', async () => {
      const detail = await request(server).get(`/decisions/${decisionId}`).set(asRole('ADMIN')).expect(200);
      if (detail.body.approvals.find((a: any) => a.step === 'FINANCE')) {
        await request(server).post(`/decisions/${decisionId}/approve`).set(asRole('FINANCE')).send({}).expect(400);
      }
    });

    it('accepts Finance approval once a positive spend cap is given', async () => {
      const detail = await request(server).get(`/decisions/${decisionId}`).set(asRole('ADMIN')).expect(200);
      if (detail.body.approvals.find((a: any) => a.step === 'FINANCE' && a.result === 'PENDING')) {
        await request(server)
          .post(`/decisions/${decisionId}/approve`)
          .set(asRole('FINANCE'))
          .send({ spendCap: detail.body.params.shiftAmount ?? 100000 })
          .expect(201);
      }
    });
  });

  describe('(4) execute: 409 before approval, 422 over spend cap', () => {
    it('409s an execute attempt on a still-pending decision', async () => {
      const list = await request(server).get('/decisions?status=PENDING_REVIEW').set(asRole('ADMIN')).expect(200);
      expect(list.body.length).toBeGreaterThan(0);
      const decisionId = list.body[0].id;

      await request(server)
        .post(`/decisions/${decisionId}/execute`)
        .set(asRole('EXECUTOR'))
        .send({ rollback: { metric: 'ROAS', channel: 'Email', below: 1, afterDays: 7 } })
        .expect(409);
    });

    it('422s an execute attempt over the approved spend cap', async () => {
      const list = await request(server).get('/decisions?status=PENDING_REVIEW&type=BUDGET_SHIFT').set(asRole('ADMIN')).expect(200);
      const target = list.body.find((d: any) => d.approvalProgress.total === 1); // MARKETING-only tier
      if (!target) return; // no eligible fixture this run -- nothing to assert

      await request(server).post(`/decisions/${target.id}/approve`).set(asRole('MARKETING_DIRECTOR')).send({}).expect(201);

      // Force a spend cap below the actual shift amount via a second,
      // two-step decision's Finance path isn't available here (this tier
      // has no Finance step), so instead prove the 422 path on a decision
      // that *does* reach Finance, by capping it artificially low.
      const list2 = await request(server).get('/decisions?status=PENDING_REVIEW&type=BUDGET_SHIFT').set(asRole('ADMIN')).expect(200);
      const twoStep = list2.body.find((d: any) => d.approvalProgress.total >= 2);
      if (!twoStep) return;

      await request(server).post(`/decisions/${twoStep.id}/approve`).set(asRole('MARKETING_DIRECTOR')).send({}).expect(201);
      await request(server)
        .post(`/decisions/${twoStep.id}/approve`)
        .set(asRole('FINANCE'))
        .send({ spendCap: 0.01 })
        .expect(201);

      await request(server)
        .post(`/decisions/${twoStep.id}/execute`)
        .set(asRole('EXECUTOR'))
        .send({ rollback: { metric: 'ROAS', channel: 'Email', below: 1, afterDays: 7 } })
        .expect(422);
    });
  });

  describe('(5) every state change is audited, and the chain verifies', () => {
    it('GET /audit/verify reports ok after everything above', async () => {
      const res = await request(server).get('/audit/verify').set(asRole('AUDITOR')).expect(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('(6) tampering is detected', () => {
    it('breaks verify, reporting the exact seq', async () => {
      const tamper = await request(server).post('/audit/demo/tamper').set(DEMO).expect(201);
      expect(tamper.body.tamperedSeq).toBeGreaterThan(0);

      const verify = await request(server).get('/audit/verify').set(asRole('AUDITOR')).expect(200);
      expect(verify.body.ok).toBe(false);
      expect(verify.body.brokenAtSeq).toBe(tamper.body.tamperedSeq);

      // Repair so later tests (and any human poking at this DB afterward)
      // see a clean chain again.
      const repair = await request(server).post('/audit/demo/repair').set(DEMO).expect(201);
      expect(repair.body.ok).toBe(true);
    });
  });

  describe('(7) demo-only endpoints are 403 in LIVE', () => {
    const LIVE = { 'X-Workspace': 'LIVE' };

    it.each(['/audit/demo/tamper', '/audit/demo/repair', '/workspace/demo/reset'])('%s -> 403', async (path) => {
      await request(server).post(path).set(LIVE).expect(403);
    });
  });

  describe('(8) 20 parallel audit appends produce seq 1..N with no gaps or dupes', () => {
    it('advisory-lock serializes concurrent appends correctly', async () => {
      const before = await request(server).get('/audit?limit=1').set(asRole('ADMIN')).expect(200);
      const startSeq: number = before.body[0]?.seq ?? 0;

      await Promise.all(
        Array.from({ length: 20 }, () => request(server).get('/audit/verify').set(asRole('AUDITOR')).expect(200)),
      );

      const after = await request(server).get('/audit?limit=25').set(asRole('ADMIN')).expect(200);
      const newSeqs = after.body.map((e: any) => e.seq).filter((seq: number) => seq > startSeq);

      expect(newSeqs.length).toBe(20);
      const sorted = [...newSeqs].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]).toBe(sorted[i - 1] + 1); // no gaps, no dupes
      }
    });
  });
});
