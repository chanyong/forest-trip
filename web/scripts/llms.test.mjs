// /llms.txt 가 빌드 때 만들어지고 필요한 내용을 담는지 검사 (이슈 #1, SITE_RULES 1-7). 실행: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLlmsTxt } from './llms.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://supgaja.com';

const sample = {
  site: SITE,
  updatedKST: '2026-11-03 06:05 KST',
  range: { from: '2026-11-03', to: '2027-01-31', days: 90 },
  forests: 185,
  goods: 7464,
  available: 109757,
  weekends: { this: { from: '2026-11-06', to: '2026-11-07' }, next: { from: '2026-11-13', to: '2026-11-14' } },
  regions: [
    { name: '경기·서울·인천', code: '1', slug: 'gyeonggi', forests: 30, open: 25, thisWeekend: 3, nextWeekend: 5 },
    { name: '강원', code: '2', slug: 'gangwon', forests: 28, open: 20, thisWeekend: 4, nextWeekend: 6 },
  ],
  nation: { thisWeekend: 7, nextWeekend: 11 },
};

test('llms.txt 는 제목·요약 인용문으로 시작하고 무엇을·어디서·얼마나 자주를 적는다', () => {
  const t = buildLlmsTxt(sample);
  assert.match(t, /^# 숲가자/);
  assert.match(t, /\n> 숲나들e\(foresttrip\.go\.kr\)/, '출처(어디서)');
  assert.match(t, /약 3시간마다/, '갱신 주기(얼마나 자주)');
  assert.match(t, /마지막 갱신: 2026-11-03 06:05 KST/);
  assert.match(t, /185곳/);
  assert.match(t, /7,464개/);
  assert.match(t, /109,757건/);
  assert.match(t, /## 무엇을 어디서 얼마나 자주 모으나/);
  assert.match(t, /비공식 참고용/);
});

test('llms.txt 에 주요 페이지와 데이터 링크가 있다', () => {
  const t = buildLlmsTxt(sample);
  for (const p of ['/', '/forest/', '/vacancy/all/this-weekend/', '/vacancy/all/next-weekend/', '/faq.html', '/privacy', '/terms', '/sitemap.xml', '/data/status.json', '/data/meta.json', '/alerts-feed.json']) {
    assert.ok(t.includes(SITE + p), `${p} 링크`);
  }
  assert.match(t, /\/vacancy\/gangwon\//, '지역 랜딩 링크');
  assert.match(t, /`A` 예약가능/, '상태 코드 설명');
});

test('llms.txt 지역별 요약 표에 지역별 수와 전국 합계가 있다', () => {
  const t = buildLlmsTxt(sample);
  assert.ok(t.includes('| 강원 | 2 | gangwon | 28 | 20 | 4 | 6 |'));
  assert.ok(t.includes('| 전국 | (생략) | all | 185 | 45 | 7 | 11 |'), '전국 빈자리 있는 곳 = 지역 합');
  assert.doesNotMatch(t, /undefined|NaN/);
});

test('빌드 스크립트가 dist/llms.txt 를 쓴다', () => {
  const src = fs.readFileSync(path.join(WEB, 'scripts/build-static.mjs'), 'utf8');
  assert.match(src, /import \{ buildLlmsTxt \} from '\.\/llms\.mjs'/);
  assert.match(src, /writeFileSync\(path\.join\(DIST, 'llms\.txt'\)/);
});
