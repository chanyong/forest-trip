// 이슈 #20: 소개 페이지, 홈 초기 HTML(JS 없이 읽히는 본문·사업자 푸터), JSON-LD 사업자 정보 통일 검사
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const BIZ = /대표: 홍지혜\(넥스트웨이브\)[\s\S]*사업자등록번호: 311-11-67514/;

test('about.html: 비공식·예약 대행 아님·결제 없음 고지와 canonical', () => {
  const s = read('public/about.html');
  assert.match(s, /<h1>숲가자 소개<\/h1>/);
  assert.match(s, /비공식/);
  assert.match(s, /예약 대행이 아닙니다/);
  assert.match(s, /결제가 없습니다/);
  assert.match(s, /rel="canonical" href="https:\/\/supgaja\.com\/about"/);
  assert.match(s.slice(s.indexOf('<footer')), BIZ);
  assert.doesNotMatch(s, /후기|제휴|광고/);
});

test('index.html: 홈 정적 본문 자리와 JSON-LD 사업자 정보가 푸터와 같다', () => {
  const s = read('index.html');
  assert.ok(s.includes('<!--HOME_STATIC-->'));
  assert.equal((s.match(/<h1/g) || []).length, 1);
  assert.ok(s.includes('"legalName":"넥스트웨이브"') && s.includes('"taxID":"311-11-67514"') && s.includes('"name":"홍지혜"'));
  assert.ok(!s.includes('"name":"chanyong"'));
});

test('build-static.mjs: 홈에 사업자 푸터·지역별 휴양림 링크를 넣고 sitemap에 /about 추가', () => {
  const s = read('scripts/build-static.mjs');
  assert.ok(s.includes("loc: '/about'"));
  assert.ok(s.includes('HOME_STATIC') && s.includes('311-11-67514'));
  assert.ok(s.includes("name: '홍지혜'") && !s.includes("name: 'chanyong'"));
});

test('vercel.json: /about 이 about.html 로 연결', () => {
  const v = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.ok(v.rewrites.some((r) => r.source === '/about' && r.destination === '/about.html'));
});

test('빌드 결과(dist)가 있으면 홈 본문에 휴양림 링크와 사업자 정보가 있다', { skip: !existsSync(new URL('../dist/index.html', import.meta.url)) }, () => {
  const h = read('dist/index.html');
  assert.ok((h.match(/href="\/forest\/[^"]+"/g) || []).length > 100);
  assert.match(h, BIZ);
  assert.ok(!h.includes('<!--HOME_STATIC-->'));
  assert.ok(!read('dist/about.html').includes('{{FOREST_COUNT}}'));
});

test('about.html: 알림 섹션이 있고 검증 안 된 문구는 없다 (이슈 #20)', () => {
  const s = read('public/about.html');
  assert.match(s, /<h2 id="alerts">빈자리 이메일 알림<\/h2>/);
  assert.match(s, /확인 메일/);
  assert.match(s, /예약 대행이 아니며/);
  assert.match(s, /이미 마감됐을 수 있습니다/);
  assert.match(s, /7일 뒤 삭제/);
  assert.ok(s.includes('href="/privacy"'));
  for (const bad of ['즉시 알림', '새로 생긴', '하루']) {
    assert.ok(!s.includes(bad), `about.html에 금지 문구: ${bad}`);
  }
});

test('faq.html: 알림 항목이 about 알림 설명과 모순되지 않는다 (이슈 #20)', () => {
  const s = read('public/faq.html');
  const i = s.indexOf('빈자리가 나면 알려 줄 수 있나요?');
  const item = s.slice(i, s.indexOf('</details>', i));
  assert.match(item, /이미 마감됐을 수 있습니다/);
  assert.match(item, /\/about#alerts/);
  for (const bad of ['즉시 알림', '새로 생긴', '새 빈자리', '하루']) {
    assert.ok(!item.includes(bad), `faq 알림 항목에 금지 문구: ${bad}`);
  }
});
