// 이슈 #22: 휴양림 상세 '시설 안내' 구역(상위 30곳)과 문단 유사도 기준 검사
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { uniqueParagraph, usageTips, detailSection } from './forest-detail.mjs';
import { similarity, pairwise } from './similarity.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const status = JSON.parse(read('public/data/status.json'));
const top = JSON.parse(read('src/lib/top-forests.json'));
const byId = new Map(status.forests.map((f) => [f.id, f]));
const SIM_MAX = 0.5; // 표본 20곳의 최대 유사도 0.31(평균 0.17)보다 넉넉히 잡은 기준값

test('상위 30곳: 30개, 중복 없음, 모두 수집 데이터에 있고 표본은 20곳', () => {
  assert.equal(top.forests.length, 30);
  assert.equal(new Set(top.forests.map((x) => x.id)).size, 30);
  for (const x of top.forests) assert.ok(byId.has(x.id), x.id);
  assert.equal(top.forests.filter((x) => x.sample).length, 20);
  assert.ok(top.criteria.includes('리뷰'));
});

test('고유 문단: 휴양림 이름·객실 이름·수량이 들어 있고 지어낸 문구가 없다', () => {
  for (const x of top.forests) {
    const f = byId.get(x.id);
    const t = uniqueParagraph(f);
    assert.ok(t.includes(f.name), `${f.name}: 이름`);
    assert.ok(f.goods.some((g) => t.includes(g.name.trim())), `${f.name}: 객실 이름`);
    assert.ok(t.includes(`${f.goods.filter((g) => g.kind === f.goods[0].kind).length}`), `${f.name}: 수량`);
    assert.doesNotMatch(t + usageTips(f).join(' '), /추천|인기|제휴|광고|후기|최고|최저가|숲나들e에서 가장/);
  }
});

test('문단 유사도: 표본 20곳과 상위 30곳 모두 기준값 미만', () => {
  const items = top.forests.map((x) => ({ id: x.id, sample: x.sample, text: uniqueParagraph(byId.get(x.id)) }));
  assert.ok(pairwise(items.filter((i) => i.sample)).max < SIM_MAX);
  assert.ok(pairwise(items).max < SIM_MAX);
  // 같은 문단은 1, 전혀 다른 문단은 낮다(점검 함수 자체 확인)
  assert.equal(similarity('가 나 다 라', '가 나 다 라'), 1);
  assert.ok(similarity('가 나 다 라', '마 바 사 아') < 0.1);
});

test('detailSection: 출처·확인일·표를 담고 외부 소개문·광고 문구가 없다', () => {
  const f = byId.get(top.forests[0].id);
  const h = detailSection(f, status.generatedAt);
  assert.match(h, /시설 안내/);
  assert.match(h, /출처: 숲나들e/);
  assert.match(h, /확인일 \d{4}-\d{2}-\d{2}/);
  assert.match(h, /<table>/);
  assert.doesNotMatch(h, /제휴|광고|<img/);
});

test('build-static.mjs: 상위 30곳에만 시설 안내를 붙인다', () => {
  const s = read('scripts/build-static.mjs');
  assert.ok(s.includes("import { detailSection } from './forest-detail.mjs'"));
  assert.ok(s.includes('TOP.has(f.id) ? detailSection(f, generatedAt)'));
  assert.ok(existsSync(new URL('../src/lib/top-forests.json', import.meta.url)));
});
