// GA4 전환 이벤트 검사 (이슈 #11). 실행: npm test
// public/track.js(링크 클릭·알림 신청·의견 버튼)는 가짜 DOM 위에서 실제로 돌려 보고,
// src/lib/track.mjs(검색)는 함수로 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { cleanSearchTerm, trackSearch } from '../src/lib/track.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(WEB, rel), 'utf8');

// closest() 는 'a[href]' 와 '[data-ga-item]' 만 쓰므로 그 두 가지만 흉내 낸다
function el(tag, attrs = {}, parent = null, classes = []) {
  const n = {
    tag, attrs, parent,
    classList: { contains: (c) => classes.includes(c) },
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    closest(sel) {
      for (let x = n; x; x = x.parent) {
        if (sel === 'a[href]' && x.tag === 'a' && 'href' in x.attrs) return x;
        if (sel === '[data-ga-item]' && 'data-ga-item' in x.attrs) return x;
      }
      return null;
    },
    getRootNode: () => ({}),
  };
  return n;
}

function load({ gtag = true } = {}) {
  const sent = [];
  let onClick = null;
  const ctx = {
    URL,
    location: { hostname: 'supgaja.com', href: 'https://supgaja.com/forest/0101' },
    document: { addEventListener: (type, fn) => { if (type === 'click') onClick = fn; } },
  };
  ctx.window = ctx;
  if (gtag) ctx.gtag = function () { sent.push([...arguments]); };
  vm.createContext(ctx);
  vm.runInContext(read('public/track.js'), ctx);
  const click = (target, path = []) => onClick({ target, composedPath: () => path });
  // vm 안에서 만든 객체는 프로토타입이 달라 JSON 으로 옮겨 비교한다
  const events = () => JSON.parse(JSON.stringify(sent.filter((a) => a[0] === 'event').map((a) => [a[1], a[2]])));
  return { ctx, click, events };
}

test('숲나들e 예약 링크는 affiliate_click(partner·item)으로 보낸다', () => {
  const { click, events } = load();
  const box = el('div', { 'data-ga-item': '유명산자연휴양림' });
  const a = el('a', { href: 'https://www.foresttrip.go.kr/rep/or/sssn/monthRsrvtStatus.do?hmpgId=FRIP' }, box);
  click(el('small', {}, a)); // 링크 안쪽 글자를 눌러도 링크로 잡는다
  click(el('a', { href: 'https://www.foresttrip.go.kr' }));
  assert.deepEqual(events(), [
    ['affiliate_click', { partner: 'foresttrip', item: '유명산자연휴양림', link_domain: 'www.foresttrip.go.kr' }],
    ['affiliate_click', { partner: 'foresttrip', item: 'site', link_domain: 'www.foresttrip.go.kr' }],
  ]);
});

test('그 밖의 외부 링크는 outbound_click, 사이트 안 링크·전화·메일은 보내지 않는다', () => {
  const { click, events } = load();
  click(el('a', { href: 'https://map.naver.com/p/search/%EC%9C%A0%EB%AA%85%EC%82%B0?c=15' }));
  click(el('a', { href: '/forest/0102' }));
  click(el('a', { href: 'https://supgaja.com/faq.html' }));
  click(el('a', { href: 'tel:031-000-0000' }));
  click(el('a', { href: 'mailto:1bangkr.info@gmail.com' }));
  click(el('button'));
  assert.deepEqual(events(), [
    ['outbound_click', { link_domain: 'map.naver.com', link_url: 'https://map.naver.com/p/search/%EC%9C%A0%EB%AA%85%EC%82%B0' }],
  ]);
});

test("공통 '의견·질문 남기기' 버튼을 누르면 feedback_open", () => {
  const { click, events } = load();
  const host = el('div', { id: 'site-feedback' });
  host.id = 'site-feedback';
  const btn = el('button', {}, null, ['open-btn']);
  btn.getRootNode = () => ({ host });
  click(host, [btn, host]);
  const other = el('button', {}, null, ['send']); // 열린 뒤 패널 안 다른 버튼은 세지 않는다
  other.getRootNode = () => ({ host });
  click(host, [other, host]);
  assert.deepEqual(events(), [['feedback_open', {}]]);
});

test('알림 모듈의 신청 완료(alert_subscribe)를 alert_signup 으로도 보낸다', () => {
  const { ctx, events } = load();
  ctx.window.gtag('event', 'alert_subscribe', { site: 'supgaja.com' });
  ctx.window.gtag('event', 'page_view', {});
  assert.deepEqual(events(), [
    ['alert_subscribe', { site: 'supgaja.com' }],
    ['alert_signup', { method: 'email', site: 'supgaja.com' }],
    ['page_view', {}],
  ]);
});

test('gtag 가 없는 곳(미리보기·로컬)에서는 오류 없이 아무것도 하지 않는다', () => {
  const { click, ctx } = load({ gtag: false });
  assert.doesNotThrow(() => click(el('a', { href: 'https://www.foresttrip.go.kr' })));
  assert.equal(ctx.gtag, undefined);
});

test('검색어에서 이메일·전화번호를 지우고 40자로 자른다', () => {
  assert.equal(cleanSearchTerm('  유명산   가평 '), '유명산 가평');
  assert.equal(cleanSearchTerm('a.b@example.com 유명산'), '유명산');
  assert.equal(cleanSearchTerm('010-1234-5678 산음'), '산음');
  assert.equal(cleanSearchTerm('01012345678'), '');
  assert.equal(cleanSearchTerm('가'.repeat(60)).length, 40);
});

test('search 는 같은 검색어를 연달아 보내지 않고, 개인정보만 있으면 보내지 않는다', () => {
  const sent = [];
  globalThis.window = { gtag: (...a) => sent.push(a) };
  try {
    assert.equal(trackSearch('유명산', 3), '유명산');
    assert.equal(trackSearch('유명산 ', 3), ''); // 정리하면 같은 검색어
    assert.equal(trackSearch('me@example.com', 0), '');
    assert.equal(trackSearch('가평', 0), '가평');
  } finally {
    delete globalThis.window;
  }
  assert.deepEqual(sent, [
    ['event', 'search', { search_term: '유명산', results: 3 }],
    ['event', 'search', { search_term: '가평', results: 0 }],
  ]);
});

test('GA 를 쓰는 모든 페이지가 track.js 를 GA 설정 뒤에 불러오고, 예약 링크에 휴양림 이름을 단다', () => {
  for (const f of ['index.html', 'public/faq.html', 'public/privacy.html', 'public/terms.html', 'scripts/build-static.mjs']) {
    const s = read(f);
    const ga = s.indexOf("gtag('config'");
    const tr = s.indexOf('<script src="/track.js" defer></script>');
    assert.ok(ga >= 0 && tr > ga, `${f}: GA 설정 뒤에 track.js`);
  }
  assert.match(read('src/components/ForestDrawer.tsx'), /href=\{RESERVE_URL\}[^>]*data-ga-item=\{f\.name\}/);
  assert.match(read('scripts/build-static.mjs'), /foresttrip\.go\.kr\/rep[^>]*data-ga-item="\$\{esc\(f\.name\)\}"/);
});
