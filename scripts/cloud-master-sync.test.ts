// ============================================================================
// cloud-master-sync.test.ts — unit tests for the masterSync core (16 checks)
//
// Covers:
//   - mergeList            (LWW union: cloud-newer wins, local-newer kept,
//                           local-only kept, cloud-only added)
//   - applyMasterChange    (insert / update / stale-event / delete)
//   - pushMasterCategory   (push / dedupe / edit / delete / users password
//                           strip) against a fake in-memory Supabase client
//   - pollIntervalMs       (REST-poll backoff policy, incl. stop-on-static)
//
// Run:  npx tsx scripts/cloud-master-sync.test.ts   (must pass 16/16)
// ============================================================================

// Node has no localStorage — masterSync's push-snapshot bookkeeping uses it
// for dedupe, so provide an in-memory shim BEFORE the tests run. (The module
// itself only touches it inside functions, so this is safe after import.)
const memStorage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
  setItem: (k: string, v: string) => { memStorage.set(k, String(v)); },
  removeItem: (k: string) => { memStorage.delete(k); },
  clear: () => { memStorage.clear(); },
};

import {
  mergeList,
  applyMasterChange,
  pushMasterCategory,
  pollIntervalMs,
  _setSupabaseClientForTesting,
  type MasterCategory,
} from '../src/services/masterSync';

// --- tiny test harness -----------------------------------------------------
let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    pass++;
    console.log(`✅ ${name}${detail ? `  [${detail}]` : ''}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`❌ ${name}${detail ? `  [${detail}]` : ''}`);
  }
}

// --- fake in-memory Supabase client (master_records table) -----------------
interface FakeRow { category: string; rec_id: string; data: any; updated_at: string }
interface FakeClient {
  rows: FakeRow[];
  upsertCalls: number;
  deleteCalls: number;
  lastUpsertPayload: FakeRow[] | null;
  lastDelete: { category: string; recIds: string[] } | null;
  from(table: string): any;
}

function makeFakeClient(): FakeClient {
  const rows: FakeRow[] = [];
  const fake: FakeClient = {
    rows,
    upsertCalls: 0,
    deleteCalls: 0,
    lastUpsertPayload: null,
    lastDelete: null,
    from(table: string) {
      if (table !== 'master_records') throw new Error(`unexpected table: ${table}`);
      return {
        upsert: async (payload: FakeRow[]) => {
          fake.upsertCalls += 1;
          fake.lastUpsertPayload = payload;
          for (const r of payload) {
            const i = rows.findIndex(x => x.category === r.category && x.rec_id === r.rec_id);
            if (i >= 0) rows[i] = r; else rows.push(r);
          }
          return { data: null, error: null };
        },
        delete: () => ({
          eq: (col: string, val: any) => ({
            in: async (col2: string, vals: string[]) => {
              fake.deleteCalls += 1;
              fake.lastDelete = { category: String(val), recIds: vals };
              if (col === 'category' && col2 === 'rec_id') {
                for (let i = rows.length - 1; i >= 0; i--) {
                  if (rows[i].category === val && vals.includes(rows[i].rec_id)) rows.splice(i, 1);
                }
              }
              return { data: null, error: null };
            },
          }),
        }),
        select: async () => ({ data: rows.map(r => ({ ...r })), error: null }),
      };
    },
  };
  return fake;
}

// --- tests ------------------------------------------------------------------
(async () => {
  console.log('=== Cloud Master Sync Unit Tests (16 checks) ===\n');

  const T1 = '2026-01-01T00:00:00.000Z';
  const T2 = '2026-01-02T00:00:00.000Z';
  const T3 = '2026-01-03T00:00:00.000Z';

  // --- mergeList (LWW union) ---
  {
    const out = mergeList(
      [{ id: 'a', name: 'local-old', _updatedAt: T1 }],
      [{ id: 'a', name: 'cloud-new', _updatedAt: T2 }],
    );
    check('1) mergeList: cloud record with newer _updatedAt wins (LWW)',
      out.length === 1 && out[0].name === 'cloud-new');
  }
  {
    const out = mergeList(
      [{ id: 'a', name: 'local-newer', _updatedAt: T3 }],
      [{ id: 'a', name: 'cloud-older', _updatedAt: T2 }],
    );
    check('2) mergeList: local record with newer _updatedAt is kept',
      out.length === 1 && out[0].name === 'local-newer');
  }
  {
    const out = mergeList(
      [{ id: 'a', _updatedAt: T1 }, { id: 'b-only-local', name: 'offline create' }],
      [{ id: 'a', name: 'cloud-a', _updatedAt: T2 }],
    );
    const hasB = out.some(r => r.id === 'b-only-local');
    check('3) mergeList: keeps local-only records (unpushed offline creates)',
      out.length === 2 && hasB);
  }
  {
    const out = mergeList(
      [{ id: 'a', name: 'local-a' }],
      [{ id: 'a', name: 'cloud-a', _updatedAt: T2 }, { id: 'c-only-cloud', name: 'made on phone' }],
    );
    check('4) mergeList: adds cloud-only records (fresh device pull)',
      out.length === 2 && out.some(r => r.id === 'c-only-cloud'));
  }

  // --- applyMasterChange (single realtime event) ---
  {
    const out = applyMasterChange([{ id: 'x', name: 'X' }], 'y', { name: 'Y' }, 'INSERT');
    check('5) applyMasterChange INSERT: new record prepended',
      out.length === 2 && out[0].id === 'y' && out[0].name === 'Y' && out[1].id === 'x');
  }
  {
    const out = applyMasterChange(
      [{ id: 'x', name: 'old', _updatedAt: T1 }],
      'x',
      { name: 'new', _updatedAt: T3 },
      'UPDATE',
    );
    check('6) applyMasterChange UPDATE: replaces existing record',
      out.length === 1 && out[0].name === 'new' && out[0]._updatedAt === T3);
  }
  {
    const list = [{ id: 'x', name: 'current', _updatedAt: T3 }];
    const out = applyMasterChange(list, 'x', { name: 'stale', _updatedAt: T1 }, 'UPDATE');
    check('7) applyMasterChange: stale event (older _updatedAt) is ignored',
      out === list && out[0].name === 'current');
  }
  {
    const out = applyMasterChange(
      [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }],
      'x',
      null,
      'DELETE',
    );
    check('8) applyMasterChange DELETE: removes record by id',
      out.length === 1 && out[0].id === 'y');
  }

  // --- pushMasterCategory (fake Supabase client + in-memory localStorage) ---
  const client = makeFakeClient();
  _setSupabaseClientForTesting(client);
  memStorage.clear();
  const cat: MasterCategory = 'couriers';
  const A = { id: 'c-a', name: 'Courier A', code: 'CA' };
  const B = { id: 'c-b', name: 'Courier B', code: 'CB' };

  {
    const ok = await pushMasterCategory(cat, [A, B]);
    const stamped = client.rows.every(r => typeof r.data?._updatedAt === 'string' && r.updated_at === r.data._updatedAt);
    check('9) pushMasterCategory: first push upserts all records with LWW stamp',
      ok && client.rows.length === 2 && client.upsertCalls === 1 && stamped);
  }
  {
    await pushMasterCategory(cat, [A, B]);
    check('10) pushMasterCategory: unchanged second push upserts nothing (dedupe)',
      client.upsertCalls === 1 && client.rows.length === 2);
  }
  {
    const A2 = { ...A, name: 'Courier A EDITED' };
    await pushMasterCategory(cat, [A2, B]);
    const last = client.lastUpsertPayload;
    check('11) pushMasterCategory: edit upserts only the changed record',
      client.upsertCalls === 2 && !!last && last.length === 1 &&
      last[0].rec_id === 'c-a' && last[0].data.name === 'Courier A EDITED');
  }
  {
    const A2 = { ...A, name: 'Courier A EDITED' };
    await pushMasterCategory(cat, [A2]); // B removed
    check('12) pushMasterCategory: removed record is deleted from cloud',
      client.deleteCalls === 1 &&
      client.lastDelete?.category === 'couriers' &&
      client.lastDelete?.recIds?.includes('c-b') &&
      !client.rows.some(r => r.rec_id === 'c-b') &&
      client.rows.some(r => r.rec_id === 'c-a'));
  }
  {
    const userClient = makeFakeClient();
    _setSupabaseClientForTesting(userClient);
    memStorage.clear();
    await pushMasterCategory('users', [
      { id: 'u-1', name: 'User One', email: 'u1@emiza.com', password: 'secret123' } as any,
    ]);
    const row = userClient.rows.find(r => r.category === 'users' && r.rec_id === 'u-1');
    check('13) pushMasterCategory(users): password stripped before upsert',
      !!row && row.data?.password === undefined && row.data?.email === 'u1@emiza.com' && row.data?.name === 'User One');
  }

  // --- pollIntervalMs (REST poll backoff policy) ---
  _setSupabaseClientForTesting(null);
  {
    check('14) pollIntervalMs(0) = 3000ms (healthy fast poll)', pollIntervalMs(0) === 3000);
  }
  {
    check('15) pollIntervalMs: transient 1-2 failures -> 5000ms, degrading 3-5 -> 30000ms',
      pollIntervalMs(1) === 5000 && pollIntervalMs(2) === 5000 &&
      pollIntervalMs(3) === 30000 && pollIntervalMs(5) === 30000);
  }
  {
    check('16) pollIntervalMs(>=6) = null (endpoint absent on static host — stop polling)',
      pollIntervalMs(6) === null && pollIntervalMs(42) === null);
  }

  console.log(`\n=== RESULT: ${pass}/${pass + fail} passed${fail ? ` — FAILED: ${failures.join(', ')}` : ''} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('Test harness error:', e);
  process.exit(2);
});
