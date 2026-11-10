// 이슈 #21: FAQ 20~30문항, 문항마다 근거·확인일, 알림 문구 제한, JSON-LD 일치
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ITEM = /<details class="item"><summary>([\s\S]*?)<\/summary><div class="a">([\s\S]*?)<\/div><\/details>/g;
const items = () => [...read('public/faq.html').matchAll(ITEM)].map(([, q, a]) => ({ q, a }));

test('faq: 20~30문항, 질문 중복 없음', () => {
  const it = items();
  assert.ok(it.length >= 20 && it.length <= 30, `문항 수 ${it.length}`);
  assert.equal(new Set(it.map((x) => x.q)).size, it.length);
});

test('faq: <!doctype html> 로 시작하고 모든 문항이 <main> 안에 있다', () => {
  const s = read('public/faq.html');
  assert.ok(s.startsWith('<!doctype html>'));
  const m0 = s.indexOf('<main'), m1 = s.indexOf('</main>');
  assert.ok(m0 > 0 && m1 > m0);
  const all = (s.match(/<details class="item">/g) || []).length;
  const inMain = (s.slice(m0, m1).match(/<details class="item">/g) || []).length;
  assert.equal(inMain, all);
  assert.equal(all, items().length);
});

test('faq: 문항마다 근거와 확인일(YYYY-MM-DD)', () => {
  for (const { q, a } of items()) {
    assert.match(a, /<p class="src">근거: [^<]+ · 확인일 \d{4}-\d{2}-\d{2}<\/p>/, `근거·확인일 없음: ${q}`);
  }
});

test('faq: 알림 관련 문항은 about#alerts 와 맞고 금지 문구가 없다', () => {
  const alerts = items().filter(({ q, a }) => /알림/.test(q + a));
  assert.ok(alerts.length >= 2);
  for (const { q, a } of alerts) {
    for (const bad of ['즉시 알림', '새로 생긴', '새 빈자리', '하루']) {
      assert.ok(!(q + a).includes(bad), `알림 문항 금지 문구 '${bad}': ${q}`);
    }
  }
  assert.ok(items().some(({ a }) => a.includes('/about#alerts') && a.includes('이미 마감됐을 수 있습니다')));
});

test('faq: 후기·실적·제휴 주장 문구가 없다 (비제휴 고지 제외)', () => {
  const body = items().map((x) => x.q + x.a).join('\n').replace(/제휴하지 않았습니다/g, '');
  for (const bad of ['제휴', '광고', '수상', '만족도', '누적 이용']) {
    assert.ok(!body.includes(bad), `금지 문구: ${bad}`);
  }
});

test('faq: 사업자 정보 푸터와 문의 이메일 정책 유지', () => {
  const s = read('public/faq.html');
  assert.match(s.slice(s.indexOf('<footer')), /사업자등록번호: 311-11-67514/);
  assert.ok(!/@[a-z0-9.-]+\.[a-z]+/i.test(s.replace(/data-[^>]*/g, '')) || s.includes('supgaja@gmail.com'));
});

test('build-static: FAQPage JSON-LD 는 근거 줄을 빼고 질문 수만큼 만든다', () => {
  const b = read('scripts/build-static.mjs');
  assert.ok(b.includes('<p class="src">'));
  if (!existsSync(new URL('../dist/faq.html', import.meta.url))) return;
  const d = read('dist/faq.html');
  const ld = JSON.parse(d.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'FAQPage');
  assert.equal(ld.mainEntity.length, items().length);
  for (const e of ld.mainEntity) assert.ok(!e.acceptedAnswer.text.includes('확인일'));
});
