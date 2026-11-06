// 빈자리 추이: 수집기가 하루 1파일로 요약을 쌓고(90일 보관), 상세 페이지가 최근 4주 그래프를 그린다
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDay, summarizeForest, writeHistory, expired, kstDate } from '../../collector/history.mjs';
import { seriesOf, trendSection, loadHistory } from './trend.mjs';

const forest = (id, s1, s2, booking) => ({ id, booking, goods: [{ kind: '01', s: s1 }, { kind: '01', s: s1 }, { kind: '02', s: s2 }] });
const status = (generatedAt, forests) => ({ generatedAt, forests });

// Value: protects=추이 원본 요약(가능 건수·예약률) 계산; fails_when=A 칸 수나 예약률 합산이 틀어짐; why_new=기존엔 추이를 저장하지 않았음; seam=none; no_claim=실제 숲나들e 수집
test('휴양림 요약: 숙소·야영장 가능 건수와 예약률(표본 10 미만은 null)', () => {
  const f = forest('F1', 'AAFC.', 'A1', { '01': { we: [6, 10], wd: [4, 10] }, '02': { we: [1, 3], wd: [0, 2] } });
  assert.deepEqual(summarizeForest(f), [4, 1, 50, null]);
});

// Value: protects=하루 1파일·마지막 회차 덮어쓰기·90일 보관; fails_when=파일이 회차마다 늘거나 오래된 파일이 안 지워짐; why_new=신규; seam=임시 폴더 파일 입출력; no_claim=git 커밋
test('writeHistory: 같은 날은 1파일로 덮어쓰고 90일 지난 파일은 지운다', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hist-'));
  writeFileSync(join(dir, '20260701.json'), '{}');
  writeFileSync(join(dir, '20260810.json'), '{}');
  const a = await writeHistory(dir, status('2026-11-05T20:00:00Z', [forest('F1', 'A', 'A', null)])); // KST 11-06 05시
  assert.equal(a.date, '20261106');
  await writeHistory(dir, status('2026-11-06T02:00:00Z', [forest('F1', 'AA', 'A', null)])); // 같은 KST 날
  assert.deepEqual(readdirSync(dir).sort(), ['20260810.json', '20261106.json']);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, '20261106.json'), 'utf8')).f.F1, [4, 1, null, null]);
  assert.deepEqual(expired(['20260807.json', '20260808.json', 'x.json'], '20261106'), ['20260807.json', '20260808.json']);
  assert.equal(kstDate('2026-11-05T15:00:00Z'), '20261106');
});

// Value: protects=상세 페이지에 최근 4주 선 그래프 또는 '쌓는 중' 안내; fails_when=데이터 있는데 차트가 안 나오거나 4주보다 오래된 점이 섞임; why_new=신규; seam=none; no_claim=브라우저 렌더링
test('trendSection: 4주 밖 점은 빼고 차트를 그리고, 2일 미만이면 안내만', () => {
  const day = (date, n) => ({ date, f: { F1: [n, 0, null, null] } });
  const hist = [day('20261001', 99), day('20261020', 10), day('20261030', 20), day('20261106', 5)];
  assert.deepEqual(seriesOf(hist, 'F1').map((p) => p.date), ['20261020', '20261030', '20261106']);
  const html = trendSection(hist, 'F1', ['01'], () => '숙소');
  assert.match(html, /<svg/);
  assert.match(html, /10\/20부터 11\/6까지 10, 20, 5건/);
  assert.doesNotMatch(html, /99/);
  assert.match(trendSection([day('20261106', 5)], 'F1', ['01'], () => '숙소'), /쌓는 중/);
  assert.equal(loadHistory(join(tmpdir(), 'nope-dir-x')).length, 0);
  assert.match(buildDay(status('2026-11-06T00:00:00Z', [])).date, /^\d{8}$/);
});
