// 빈자리 알림 버튼: 전국·긴 기간이면 막지 않고 좁힌 조건을 제안하고, 그 조건은 신청 창으로 넘어갈 수 있어야 한다
import test from 'node:test';
import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const out = join(mkdtempSync(join(tmpdir(), 'alerts-')), 'a.mjs');
const b = await rolldown({ input: fileURLToPath(new URL('../src/lib/alerts.ts', import.meta.url)) });
await b.write({ file: out, format: 'esm' });
const m = await import(pathToFileURL(out).href);

const status = { forests: [], days: 88 };
const base = { view: 'list', from: '2026-11-05', to: '2027-01-31', nights: 1, sidos: [], types: [], kinds: [], people: 0, flags: [], weekend: false, wait: false, q: '', mine: false };

// Value: protects=첫 화면(전국·88일)에서 error.broad 로 안내창이 뜨고 좁힌 제안이 나옴; fails_when=broad 표시나 제안이 빠져 다시 막힘;
//   why_new=기존엔 안내 문구만 있었음; seam=none; no_claim=실제 alerts.js 창이 열리는지
test('전국·88일은 broad 로 표시되고, 제안 조건은 모두 신청 가능한 요청이 된다', () => {
  const r = m.alertFromFilters(status, base, new Set());
  assert.equal(r.broad, true);
  const opts = m.narrowOptions(base, '2026-11-05');
  assert.ok(opts.length >= 3);
  for (const o of opts) {
    const req = m.alertFromFilters(status, { ...base, ...o.patch }, new Set());
    assert.ok(!('error' in req), o.label);
    assert.equal(req.site, 'supgaja.com');
  }
});

test('이번·다음 주말은 금~토 체크인(오늘이 토요일이면 오늘부터)', () => {
  const [a, b2] = m.narrowOptions(base, '2026-11-05'); // 목
  assert.deepEqual([a.patch.from, a.patch.to, b2.patch.from], ['2026-11-06', '2026-11-07', '2026-11-13']);
  const [s] = m.narrowOptions(base, '2026-11-07'); // 토
  assert.deepEqual([s.patch.from, s.patch.to], ['2026-11-07', '2026-11-07']);
  const [u] = m.narrowOptions(base, '2026-11-08'); // 일
  assert.deepEqual([u.patch.from, u.patch.to], ['2026-11-13', '2026-11-14']);
});
