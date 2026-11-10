// GA4 전환 이벤트 검사 (이슈 #11). 실행: npm test
// public/track.js(링크 클릭·알림 신청·의견 버튼)는 가짜 DOM 위에서 실제로 돌려 보고,
// src/lib/track.mjs(검색)는 함수로 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { cleanSearchTerm, searchStep, track, trackSearch } from '../src/lib/track.mjs';

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

function load({ gtag = true, href = 'https://supgaja.com/forest/0101' } = {}) {
  const sent = [];
  const onClick = []; // 등록된 click 리스너 전부(두 번 불러왔을 때 중복 등록을 잡으려고 모두 부른다)
  const onAux = []; // auxclick(가운데 버튼) 리스너
  const onPop = []; // window popstate 리스너
  // 앱이 쓰는 history: 주소를 바꾸고, 불린 this·인수와 그때까지 보낸 hit 수를 남기고, 값을 돌려준다
  const history = { calls: [] };
  for (const m of ['pushState', 'replaceState']) {
    history[m] = function (state, title, url) {
      history.calls.push({ m, self: this, args: [...arguments], sentBefore: sent.length });
      if (url != null) ctx.location.href = new URL(url, ctx.location.href).href;
      return `ret:${m}`;
    };
  }
  const ctx = {
    URL,
    history,
    location: { hostname: 'supgaja.com', href },
    document: { addEventListener: (type, fn) => { if (type === 'click') onClick.push(fn); if (type === 'auxclick') onAux.push(fn); } },
    addEventListener: (type, fn) => { if (type === 'popstate') onPop.push(fn); },
  };
  ctx.window = ctx;
  if (gtag) ctx.gtag = function () { sent.push([...arguments]); };
  vm.createContext(ctx);
  const run = () => vm.runInContext(read('public/track.js'), ctx);
  run();
  const click = (target, path = []) => onClick.forEach((fn) => fn({ target, composedPath: () => path }));
  const auxclick = (target, button = 1) => onAux.forEach((fn) => fn({ target, button, composedPath: () => [] }));
  // vm 안에서 만든 객체는 프로토타입이 달라 JSON 으로 옮겨 비교한다
  const events = () => JSON.parse(JSON.stringify(sent.filter((a) => a[0] === 'event').map((a) => [a[1], a[2]])));
  const sets = () => JSON.parse(JSON.stringify(sent.filter((a) => a[0] === 'set').map((a) => a[1].page_location)));
  const popstate = (url) => { ctx.location.href = url; onPop.forEach((fn) => fn({})); };
  return { ctx, click, auxclick, events, sets, popstate, run, sent };
}

// Value: protects=가운데 버튼으로 새 탭에 연 예약·외부 링크도 affiliate_click·outbound_click 으로 셈; fails_when=auxclick 리스너가 빠지거나 오른쪽 버튼까지 셈;
//   why_new=기존 검사는 click 만 봄; seam=none; no_claim=실제 브라우저의 auxclick 발생 조건(가짜 이벤트로 대신)
test('가운데 버튼(auxclick)으로 연 링크도 세고, 오른쪽 버튼은 세지 않는다', () => {
  const { auxclick, events } = load();
  auxclick(el('a', { href: 'https://www.foresttrip.go.kr/rep/or/sssn/monthRsrvtStatus.do', 'data-ga-item': '유명산자연휴양림' }));
  auxclick(el('a', { href: 'https://map.naver.com/' }));
  auxclick(el('a', { href: 'https://map.naver.com/' }), 2);
  assert.deepEqual(events(), [
    ['affiliate_click', { partner: 'foresttrip', item: '유명산자연휴양림', link_domain: 'www.foresttrip.go.kr' }],
    ['outbound_click', { link_domain: 'map.naver.com', link_url: 'https://map.naver.com/' }],
  ]);
});

test('숲나들e 예약 링크는 affiliate_click(partner·item)으로 보낸다', () => {
  const { click, events } = load();
  const box = el('div', { 'data-ga-item': '유명산자연휴양림' });
  const a = el('a', { href: 'https://www.foresttrip.go.kr/rep/or/sssn/monthRsrvtStatus.do?hmpgId=FRIP' }, box);
  click(el('small', {}, a)); // 링크 안쪽 글자를 눌러도 링크로 잡는다
  click(el('a', { href: 'https://www.foresttrip.go.kr', 'data-ga-item': 'site' }));
  // Value: protects=data-ga-item 이 빈 값이어도 affiliate_click.item 은 'site'(빈 휴양림 이름이 GA 에 빈 칸으로 쌓이지 않음); fails_when=|| 'site' 대체값이 빠짐;
  //   why_new=기존 행은 늘 값이 있는 data-ga-item 만 씀; seam=none; no_claim=실제 브라우저 DOM(가짜 el 로 대신)
  click(el('a', { href: 'https://www.foresttrip.go.kr/rep', 'data-ga-item': '' }));
  assert.deepEqual(events(), [
    ['affiliate_click', { partner: 'foresttrip', item: '유명산자연휴양림', link_domain: 'www.foresttrip.go.kr' }],
    ['affiliate_click', { partner: 'foresttrip', item: 'site', link_domain: 'www.foresttrip.go.kr' }],
    ['affiliate_click', { partner: 'foresttrip', item: 'site', link_domain: 'www.foresttrip.go.kr' }],
  ]);
});

test('같은 foresttrip.go.kr 이라도 예약 표시가 없는 휴양림 홈페이지 링크는 outbound_click', () => {
  const { click, events } = load();
  // 정적 휴양림 페이지·서랍과 같은 구조: 예약 링크에만 data-ga-item, 홈페이지 링크는 그 옆
  const actions = el('div');
  el('a', { href: 'https://www.foresttrip.go.kr/rep/or/sssn/monthRsrvtStatus.do', 'data-ga-item': '유명산자연휴양림' }, actions);
  click(el('a', { href: 'http://www.foresttrip.go.kr/0101' }, actions));
  click(el('a', { href: 'http://bhforest.foresttrip.go.kr' }, actions));
  assert.deepEqual(events(), [
    ['outbound_click', { link_domain: 'www.foresttrip.go.kr', link_url: 'http://www.foresttrip.go.kr/0101' }],
    ['outbound_click', { link_domain: 'bhforest.foresttrip.go.kr', link_url: 'http://bhforest.foresttrip.go.kr/' }],
  ]);
});

test('그 밖의 외부 링크는 outbound_click, 사이트 안 링크·전화·메일은 보내지 않는다', () => {
  const { click, events } = load();
  click(el('a', { href: 'https://map.naver.com/p/search/%EC%9C%A0%EB%AA%85%EC%82%B0?c=15' }));
  click(el('a', { href: '/forest/0102' }));
  click(el('a', { href: 'https://supgaja.com/faq.html' }));
  click(el('a', { href: 'tel:031-000-0000' }));
  click(el('a', { href: 'mailto:supgaja@gmail.com' }));
  click(el('button'));
  // Value: protects=foresttrip.go.kr 와 비슷한 다른 도메인은 data-ga-item 이 있어도 affiliate_click 이 아님; fails_when=partnerOf 가 endsWith·includes 로 느슨해짐;
  //   why_new=기존 행은 진짜 foresttrip 하위 도메인만 씀; seam=none; no_claim=실제 브라우저 URL 파싱(Node URL 로 대신)
  click(el('a', { href: 'https://notforesttrip.go.kr/', 'data-ga-item': 'x' }));
  click(el('a', { href: 'https://foresttrip.go.kr.example.com/', 'data-ga-item': 'x' }));
  // Value: protects=주소로 읽을 수 없는 href 는 이벤트 없이 넘어가고 클릭 처리가 깨지지 않음; fails_when=new URL() 의 try/catch 가 빠짐(리스너 예외);
  //   why_new=기존 행은 모두 읽을 수 있는 href; seam=none; no_claim=브라우저별 URL 파서 차이(Node URL 로 대신)
  assert.doesNotThrow(() => click(el('a', { href: 'http://[' })));
  assert.doesNotThrow(() => click(el('a', { href: 'https://[::1', 'data-ga-item': 'x' })));
  assert.deepEqual(events(), [
    ['outbound_click', { link_domain: 'map.naver.com', link_url: 'https://map.naver.com/p/search/%EC%9C%A0%EB%AA%85%EC%82%B0' }],
    ['outbound_click', { link_domain: 'notforesttrip.go.kr', link_url: 'https://notforesttrip.go.kr/' }],
    ['outbound_click', { link_domain: 'foresttrip.go.kr.example.com', link_url: 'https://foresttrip.go.kr.example.com/' }],
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
  // Value: protects=alert_subscribe 에 site 가 없어도 alert_signup.site 는 현재 호스트; fails_when=location.hostname 대체값이 빠짐;
  //   why_new=기존 행은 site 를 늘 넘김; seam=none; no_claim=alerts.js 가 실제로 보내는 매개변수(가짜 호출로 대신)
  ctx.window.gtag('event', 'alert_subscribe');
  assert.deepEqual(events(), [
    ['alert_subscribe', { site: 'supgaja.com' }],
    ['alert_signup', { method: 'email', site: 'supgaja.com' }],
    ['page_view', {}],
    ['alert_subscribe', null],
    ['alert_signup', { method: 'email', site: 'supgaja.com' }],
  ]);
});

// Value: protects=track.js 를 두 번 불러와도 클릭·알림 신청 이벤트가 한 번씩만 감; fails_when=__supTrack·__sup 중복 방지가 빠짐(전환 두 배 집계);
//   why_new=기존 검사는 모두 한 번만 불러옴; seam=none; no_claim=실제 브라우저의 스크립트 중복 로드 경로(같은 vm 에서 두 번 실행으로 대신)
test('track.js 를 두 번 불러와도 이벤트는 한 번만 보낸다', () => {
  const { click, events, ctx, run } = load();
  run();
  click(el('a', { href: 'https://map.naver.com/' }));
  ctx.window.gtag('event', 'alert_subscribe', { site: 'supgaja.com' });
  assert.deepEqual(events(), [
    ['outbound_click', { link_domain: 'map.naver.com', link_url: 'https://map.naver.com/' }],
    ['alert_subscribe', { site: 'supgaja.com' }],
    ['alert_signup', { method: 'email', site: 'supgaja.com' }],
  ]);
});

// Value: protects=gtag 가 없을 때 예약·외부 링크·의견 버튼 클릭이 오류 없이 아무것도 보내지 않고 gtag 를 만들지 않음, 늦게 생긴 gtag 로는 보냄;
//   fails_when=send() 의 typeof 검사가 빠지거나 gtag 를 불러올 때 한 번만 잡아 둠; why_new=기존 행은 링크 하나 doesNotThrow 뿐; seam=none;
//   no_claim=실제 gtag.js 지연 로드 순서(가짜 함수로 대신)
test('gtag 가 없는 곳(미리보기·로컬)에서는 오류 없이 아무것도 하지 않는다', () => {
  const { click, ctx, events } = load({ gtag: false });
  assert.doesNotThrow(() => click(el('a', { href: 'https://www.foresttrip.go.kr' })));
  assert.doesNotThrow(() => click(el('a', { href: 'https://www.foresttrip.go.kr/rep', 'data-ga-item': '유명산자연휴양림' })));
  assert.doesNotThrow(() => click(el('a', { href: 'https://map.naver.com/' })));
  const host = el('div', { id: 'site-feedback' });
  host.id = 'site-feedback';
  const btn = el('button', {}, null, ['open-btn']);
  btn.getRootNode = () => ({ host });
  assert.doesNotThrow(() => click(host, [btn, host]));
  assert.equal(ctx.gtag, undefined);
  assert.equal(ctx.window.gtag, undefined);
  assert.deepEqual(events(), []);
  // 리스너는 등록돼 있고, 나중에 gtag 가 생기면 그때부터 보낸다
  const late = [];
  ctx.gtag = function () { late.push([...arguments]); };
  click(el('a', { href: 'https://map.naver.com/' }));
  assert.deepEqual(JSON.parse(JSON.stringify(late)), [['event', 'outbound_click', { link_domain: 'map.naver.com', link_url: 'https://map.naver.com/' }]]);
});

test('검색어에서 이메일·전화번호를 지우고 40자로 자른다', () => {
  assert.equal(cleanSearchTerm('  유명산   가평 '), '유명산 가평');
  assert.equal(cleanSearchTerm('a.b@example.com 유명산'), '유명산');
  assert.equal(cleanSearchTerm('010-1234-5678 산음'), '산음');
  assert.equal(cleanSearchTerm('01012345678'), '');
  assert.equal(cleanSearchTerm('가'.repeat(60)).length, 40);
  // Value: protects=검색어가 null·undefined 여도 'null'·'undefined' 문자열이 아니라 '' 를 돌려줌; fails_when=String(q ?? '') 의 ?? '' 가 빠짐;
  //   why_new=기존 행은 문자열만 넣음; seam=none; no_claim=App.tsx 가 실제로 넘기는 값(filters?.q ?? '')
  assert.equal(cleanSearchTerm(null), '');
  assert.equal(cleanSearchTerm(undefined), '');
});

// Value: protects=window 가 없는 곳(SSR·Node)이나 gtag 가 함수가 아니면 track() 이 오류 없이 넘어가고, gtag 가 있으면 params 기본값 {} 로 보냄;
//   fails_when=typeof window 검사·try/catch 가 빠지거나 params 기본값이 빠짐; why_new=track() 을 직접 부르는 검사가 없음; seam=none;
//   no_claim=브라우저의 실제 gtag 동작(가짜 함수로 대신)
test('track() 은 window·gtag 가 없으면 아무것도 하지 않고, 있으면 기본 params {} 로 보낸다', () => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.doesNotThrow(() => track('search', { search_term: 'x', results: 1 }));
  const sent = [];
  globalThis.window = { gtag: 'not-a-function' };
  try {
    assert.doesNotThrow(() => track('search'));
    globalThis.window = { gtag: (...a) => sent.push(a) };
    track('feedback_open');
  } finally {
    delete globalThis.window;
  }
  assert.deepEqual(sent, [['event', 'feedback_open', {}]]);
});

test('search 는 같은 검색어를 연달아 보내지 않고, 개인정보만 있으면 보내지 않는다', () => {
  const sent = [];
  trackSearch(''); // 모듈의 마지막 검색어 기억(last)을 비우고 시작해 다른 검사 순서에 기대지 않는다
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

test('검색어를 비웠다가 같은 검색어를 다시 치면 다시 보낸다', () => {
  const sent = [];
  trackSearch(''); // last 를 비우고 시작
  globalThis.window = { gtag: (...a) => sent.push(a) };
  try {
    assert.equal(trackSearch('산음', 2), '산음');
    assert.equal(trackSearch('', 9), '');
    assert.equal(trackSearch('산음', 2), '산음');
  } finally {
    delete globalThis.window;
  }
  assert.equal(sent.length, 2);
});

test('주소로 들어온 처음 검색어만 건너뛰고, 바꾼 뒤에는 처음 검색어로 돌아가도 보낸다', () => {
  let s = searchStep(undefined, '유명산'); // 첫 실행: 주소의 q
  assert.equal(s.send, false);
  s = searchStep(s.skip, '유명산'); // 결과 수만 바뀌어 다시 실행돼도 보내지 않는다
  assert.equal(s.send, false);
  s = searchStep(s.skip, '가평');
  assert.equal(s.send, true);
  s = searchStep(s.skip, '유명산'); // 사용자가 다시 친 처음 검색어
  assert.equal(s.send, true);
  assert.deepEqual(searchStep(undefined, ''), { skip: '', send: false });
  assert.equal(searchStep('', '가').send, true);
});

test('GA 를 쓰는 모든 페이지가 track.js 를 GA 설정 뒤에 불러오고, 예약 링크에 휴양림 이름을 단다', () => {
  for (const f of ['index.html', 'public/faq.html', 'public/privacy.html', 'public/terms.html', 'scripts/build-static.mjs']) {
    const s = read(f);
    const ga = s.indexOf("gtag('config'");
    const tr = s.indexOf('<script src="/track.js" defer></script>');
    assert.ok(ga >= 0 && tr > ga, `${f}: GA 설정 뒤에 track.js`);
    // Value: protects=GA 설정이 supgaja.com 호스트 조건 안에 있음(미리보기·로컬에서 gtag 가 없어 track.js 가 아무것도 안 보냄);
    //   fails_when=어느 페이지에서 호스트 조건이 빠짐(이번 PR 전 faq.html 처럼); why_new=기존 행은 순서만 봄; seam=none; no_claim=실제 미리보기 배포에서의 동작
    const host = s.search(/location\.hostname\s*===\s*'supgaja\.com'/);
    assert.ok(host >= 0 && host < ga, `${f}: GA 설정이 supgaja.com 호스트 조건 안에`);
  }
  assert.match(read('src/components/ForestDrawer.tsx'), /href=\{RESERVE_URL\}[^>]*data-ga-item=\{f\.name\}/);
  assert.match(read('scripts/build-static.mjs'), /foresttrip\.go\.kr\/rep[^>]*data-ga-item="\$\{esc\(f\.name\)\}"/);
  // Value: protects=앱 바닥글의 숲나들e 링크 두 곳이 affiliate_click(item=site)로 잡힘; fails_when=App.tsx 링크에서 data-ga-item="site" 가 빠짐;
  //   why_new=기존 행은 서랍·정적 페이지만 봄; seam=none; no_claim=렌더된 DOM(소스 문자열로 대신)
  const appSite = read('src/App.tsx').match(/href="https:\/\/www\.foresttrip\.go\.kr"[^>]*data-ga-item="site"/g) || [];
  assert.equal(appSite.length, 2, 'App.tsx 숲나들e 링크 두 곳에 data-ga-item="site"');
});

// ── 주소의 검색어(q)를 GA page_location 에서 빼기 (이슈 #11 대표 결정 A) ──
// [불러올 때 주소, GA 로 보낼 page_location]
const LOC_CASES = [
  ['https://supgaja.com/?q=010-1234-5678&utm_source=naver&utm_campaign=a%20b&forest=0101', 'https://supgaja.com/?utm_source=naver&utm_campaign=a%20b&forest=0101'],
  ['https://supgaja.com/?view=map&q=me%40example.com#top', 'https://supgaja.com/?view=map#top'],
  ['https://supgaja.com/?q=%EC%9C%A0%EB%AA%85%EC%82%B0', 'https://supgaja.com/'], // q 만 있으면 ? 도 없앤다
  ['https://supgaja.com/?q', 'https://supgaja.com/'],
  ['https://supgaja.com/?q=1&sort=price&q=2', 'https://supgaja.com/?sort=price'],
  ['https://supgaja.com/?%71=x&a=1', 'https://supgaja.com/?a=1'], // 인코딩된 q(%71)도 앱은 q 로 읽는다
  ['https://supgaja.com/?utm_campaign=a+b&qq=1&q2=3&Q=4', 'https://supgaja.com/?utm_campaign=a+b&qq=1&q2=3&Q=4'], // q 가 아니면 글자 그대로
  ['https://supgaja.com/forest/0101', 'https://supgaja.com/forest/0101'],
  ['https://supgaja.com/#q=1', 'https://supgaja.com/#q=1'], // 해시는 매개변수가 아니다
  ['not a url', 'not a url'], // 읽을 수 없는 주소는 그대로
];

// Value: protects=GA 로 가는 page_location 에 주소의 원래 검색어(이메일·전화번호가 섞일 수 있음)가 없고 다른 매개변수(utm_*, forest, view)·해시는 글자 그대로;
//   fails_when=q 를 빼지 않거나 URLSearchParams 로 다시 써서 utm 인코딩이 바뀜; why_new=이전에는 gtag 가 현재 주소를 그대로 붙임; seam=none;
//   no_claim=실제 gtag.js 가 set 값을 page_view 에 쓰는지(배포 뒤 DebugView)
test('불러올 때 q 만 뺀 주소로 page_location 을 set 한다', () => {
  for (const [href, want] of LOC_CASES) assert.deepEqual(load({ href }).sets(), [want], href);
});

// Value: protects=앱이 replaceState·pushState 로 검색어를 주소에 넣어도 이후 hit 의 page_location 에 q 가 없고, 앱의 history 호출은 this·인수·반환값 그대로;
//   fails_when=history 를 감싸지 않거나 감싼 함수가 반환값·this 를 잃거나 새 주소 set 이 원래 함수보다 늦음; why_new=history 를 다루는 검사가 없음; seam=none;
//   no_claim=gtag.js 의 기록 기반 page_view 가 감싸는 순서와 상관없이 set 값을 읽는지
test('replaceState·pushState·popstate 로 주소가 바뀌면 q 뺀 주소로 다시 set 한다', () => {
  const { ctx, sets, sent, popstate } = load({ href: 'https://supgaja.com/' });
  const h = ctx.history;
  const state = { forest: '0101' };
  assert.equal(h.replaceState(null, '', '/?q=010-1234-5678&people=2'), 'ret:replaceState');
  assert.equal(h.pushState(state, '', '/?q=010-1234-5678&people=2&forest=0101'), 'ret:pushState');
  assert.equal(h.calls[0].self, h);
  assert.deepEqual(h.calls[1].args, [state, '', '/?q=010-1234-5678&people=2&forest=0101']);
  assert.equal(h.calls[1].args[0], state);
  // 원래 함수가 불릴 때는 이미 새 주소로 set 돼 있다
  assert.deepEqual(JSON.parse(JSON.stringify(sent[h.calls[1].sentBefore - 1])), ['set', { page_location: 'https://supgaja.com/?people=2&forest=0101' }]);
  h.replaceState(null, '', '/?q=가평&people=2&forest=0101'); // 검색어만 바뀌면 다시 보내지 않는다
  h.replaceState(null, ''); // 주소 인수가 없으면 바뀐 것 없음
  popstate('https://supgaja.com/?view=map');
  assert.deepEqual(sets(), ['https://supgaja.com/', 'https://supgaja.com/?people=2', 'https://supgaja.com/?people=2&forest=0101', 'https://supgaja.com/?view=map']);
  assert.equal(JSON.stringify(sent).includes('010-1234-5678'), false);
});

// Value: protects=다른 모듈(alerts.js·앱 search)이 보내는 event 에도 q 없는 page_location 이 붙고, 직접 넘긴 page_location 은 그대로, q 가 없으면 params 를 건드리지 않음;
//   fails_when=래퍼가 page_location 을 넣지 않거나 덮어씀; why_new=래퍼는 alert_subscribe 만 다룸; seam=none; no_claim=alerts.js 의 실제 호출
test('래퍼가 event 에 q 뺀 page_location 을 넣고, 이미 있으면 덮어쓰지 않는다', () => {
  const { ctx, events } = load({ href: 'https://supgaja.com/?q=me%40example.com&utm_source=x' });
  ctx.window.gtag('event', 'search', { search_term: '유명산' });
  ctx.window.gtag('event', 'alert_subscribe', { site: 'supgaja.com' });
  ctx.window.gtag('event', 'x', { page_location: 'https://supgaja.com/given' });
  ctx.window.gtag('event', 'y');
  ctx.location.href = 'https://supgaja.com/?utm_source=x';
  ctx.window.gtag('event', 'z', { a: 1 });
  const loc = 'https://supgaja.com/?utm_source=x';
  assert.deepEqual(events(), [
    ['search', { search_term: '유명산', page_location: loc }],
    ['alert_subscribe', { site: 'supgaja.com', page_location: loc }],
    ['alert_signup', { method: 'email', site: 'supgaja.com', page_location: loc }],
    ['x', { page_location: 'https://supgaja.com/given' }],
    ['y', { page_location: loc }],
    ['z', { a: 1 }],
  ]);
});

// Value: protects=gtag 가 없는 곳(미리보기·로컬)에서도 앱의 history 호출이 그대로 동작하고 set 을 보내지 않음, 두 번 불러와도 history 를 두 번 감싸지 않음;
//   fails_when=syncLoc 의 typeof 검사나 __supTrack 중복 방지가 빠짐; why_new=history 감싸기는 새 동작; seam=none; no_claim=실제 브라우저 history
test('gtag 가 없어도 history 는 그대로 동작하고, 두 번 불러와도 set 을 한 번만 보낸다', () => {
  const none = load({ gtag: false, href: 'https://supgaja.com/?q=1' });
  assert.equal(none.ctx.history.replaceState(null, '', '/?q=2'), 'ret:replaceState');
  assert.equal(none.ctx.location.href, 'https://supgaja.com/?q=2');
  assert.deepEqual(none.sets(), []);
  const twice = load({ href: 'https://supgaja.com/?q=1' });
  twice.run();
  twice.ctx.history.replaceState(null, '', '/?q=2&people=2');
  assert.deepEqual(twice.sets(), ['https://supgaja.com/', 'https://supgaja.com/?people=2']);
});

// Value: protects=앱 첫 page_view(index.html 의 config)부터 q 가 빠지고, 인라인 처리가 track.js 와 같은 결과이며, page_location 을 config 매개변수로 고정하지 않음;
//   fails_when=config 앞 set 이 빠지거나 두 처리가 어긋나거나 config 에 page_location 을 다시 넣음(이후 hit 에 첫 주소가 고정됨);
//   why_new=기존 검사는 config 위치만 봄; seam=none; no_claim=gtag.js 가 set 값을 첫·이후 page_view 에 쓰는지(배포 뒤 DebugView)
test('index.html 이 config 앞에서 q 뺀 page_location 을 set 하고, config 에는 page_location 을 넣지 않는다', () => {
  const html = read('index.html');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes("gtag('config'"));
  assert.ok(inline, 'GA 설정 인라인 스크립트');
  for (const [href, want] of LOC_CASES) {
    const ctx = { URL, location: { hostname: 'supgaja.com', href }, document: { createElement: () => ({}), head: { appendChild() {} } } };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(inline, ctx);
    const calls = [...ctx.dataLayer].map((a) => JSON.parse(JSON.stringify([...a])));
    const si = calls.findIndex((a) => a[0] === 'set');
    const ci = calls.findIndex((a) => a[0] === 'config');
    assert.ok(si >= 0 && ci > si, `config 앞에 set: ${href}`);
    assert.equal(calls[si][1].page_location, want, href);
    assert.deepEqual(calls[ci], ['config', 'G-7W5GR0VK33'], `config 에 page_location 없음: ${href}`);
    assert.deepEqual(load({ href }).sets(), [calls[si][1].page_location], `track.js 와 같은 결과: ${href}`);
  }
});

// Value: protects=앱에서 검색한 뒤 사이트 안 다른 페이지로 가도 다음 페이지 GA page_referrer(document.referrer)에 원래 검색어가 없음;
//   fails_when=index.html 의 referrer meta 가 빠지거나 전체 주소를 보내는 정책으로 바뀜; why_new=page_location 검사만 있었음; seam=none; no_claim=브라우저가 meta 정책을 적용하는지(배포 뒤 확인)
test('index.html 은 referrer 로 출처만 보낸다(strict-origin)', () => {
  assert.match(read('index.html'), /<meta name="referrer" content="strict-origin" \/>/);
});
