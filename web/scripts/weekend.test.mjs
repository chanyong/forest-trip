// 이번 주말 빈자리 JSON(이슈 #44): 모양·숫자·빌드 연결 검사. 실행: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWeekendJson } from './weekend.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const f = (id, n) => ({ id, name: `휴양림${id}`, type: '국립', sidoName: '강원', sigungu: '평창군' });
const mk = (name, from, to, nForests) => ({
  name, from, to,
  regions: [{ slug: 'all', name: '전국', forests: nForests }, { slug: 'gangwon', name: '강원', forests: 1 }],
  list: Array.from({ length: nForests }, (_, i) => ({ f: f(String(i)), n: 3, byDate: [{ iso: from, wd: '금', a: 2, b: 1 }] })),
});

test('weekend.json 은 이번·다음 주말 범위, 지역별 수, 상위 휴양림 날짜별 객실 수를 담는다', () => {
  const j = buildWeekendJson({ site: 'https://supgaja.com', generatedAt: '2026-11-23T12:00:00+09:00',
    weekends: { this: mk('이번 주말', '2026-11-27', '2026-11-28', 2), next: mk('다음 주말', '2026-12-04', '2026-12-05', 0) } });
  assert.equal(j.thisWeekend.checkinFrom, '2026-11-27');
  assert.equal(j.thisWeekend.forestsWithVacancy, 2);
  assert.equal(j.thisWeekend.roomsAvailable, 6);
  assert.equal(j.thisWeekend.page, 'https://supgaja.com/vacancy/all/this-weekend/');
  assert.deepEqual(j.thisWeekend.regions.map((r) => r.slug), ['gangwon'], '전국 행은 지역 목록에서 뺀다');
  assert.deepEqual(j.thisWeekend.top[0].dates[0], { date: '2026-11-27', weekday: '금', lodging: 2, camping: 1 });
  assert.equal(j.thisWeekend.top[0].url, 'https://supgaja.com/forest/0');
  assert.deepEqual(j.nextWeekend.top, [], '빈자리가 없으면 빈 배열');
  assert.doesNotMatch(JSON.stringify(j), /undefined|NaN/);
});

test('top 은 30곳, 휴양림당 날짜는 6개까지', () => {
  const w = mk('이번 주말', '2026-11-27', '2026-11-28', 40);
  w.list[0].byDate = Array.from({ length: 9 }, (_, i) => ({ iso: `2026-11-${10 + i}`, wd: '토', a: 1, b: 0 }));
  const j = buildWeekendJson({ site: 'https://supgaja.com', generatedAt: 'x', weekends: { this: w, next: mk('다음 주말', 'a', 'b', 0) } });
  assert.equal(j.thisWeekend.top.length, 30);
  assert.equal(j.thisWeekend.top[0].dates.length, 6);
});

test('빌드 스크립트가 dist/data/ai/weekend.json 을 쓰고 llms.txt 가 그 주소를 안내한다', () => {
  const src = fs.readFileSync(path.join(WEB, 'scripts/build-static.mjs'), 'utf8');
  assert.match(src, /import \{ buildWeekendJson \} from '\.\/weekend\.mjs'/);
  assert.match(src, /writeFileSync\(path\.join\(DIST, 'data\/ai\/weekend\.json'\)/);
  assert.match(fs.readFileSync(path.join(WEB, 'scripts/llms.mjs'), 'utf8'), /\/data\/ai\/weekend\.json/);
});
