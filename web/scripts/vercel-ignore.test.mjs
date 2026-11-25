import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide, bucketOf, isDataOnly } from './vercel-ignore.mjs';

// 이슈 #46: 데이터 전용 커밋은 12시간 구간당 첫 배포만. KST 06:00·18:00 경계
const kst = (d, h) => Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00+09:00`) / 1000;
const data = ['web/public/data/status.json', 'web/public/data/meta.json', 'data/history/20261125.json'];

test('구간 경계는 KST 06시·18시', () => {
  assert.equal(bucketOf(kst('2026-11-25', 5)), bucketOf(kst('2026-11-24', 20)));
  assert.notEqual(bucketOf(kst('2026-11-25', 5)), bucketOf(kst('2026-11-25', 6)));
  assert.notEqual(bucketOf(kst('2026-11-25', 17)), bucketOf(kst('2026-11-25', 18)));
});

test('데이터 전용: 같은 구간이면 건너뜀, 새 구간이면 빌드', () => {
  assert.equal(decide({ ref: 'main', files: data, prevTs: kst('2026-11-25', 7), headTs: kst('2026-11-25', 12) }).skip, true);
  assert.equal(decide({ ref: 'main', files: data, prevTs: kst('2026-11-25', 12), headTs: kst('2026-11-25', 18) }).skip, false);
});

test('코드가 한 파일이라도 섞이면 항상 빌드', () => {
  const t = kst('2026-11-25', 8);
  assert.equal(decide({ ref: 'main', files: [...data, 'web/src/App.tsx'], prevTs: t, headTs: t }).skip, false);
  assert.equal(decide({ ref: 'main', files: ['vercel.json'], prevTs: t, headTs: t }).skip, false);
  assert.equal(isDataOnly([]), false);
});

test('main 아닌 브랜치·시각 불명은 빌드', () => {
  const t = kst('2026-11-25', 8);
  assert.equal(decide({ ref: 'feat/x', files: data, prevTs: t, headTs: t }).skip, false);
  assert.equal(decide({ ref: 'main', files: data, prevTs: NaN, headTs: t }).skip, false);
});

test('vercel.json이 이 스크립트를 ignoreCommand로 연결', () => {
  const v = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.match(v.ignoreCommand, /web\/scripts\/vercel-ignore\.mjs/);
});
