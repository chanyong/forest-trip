// '운영자의 다른 서비스' 링크 검사 (이슈 #2, #25: 띠는 /network 로 분리). 실행: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkLinks } from '../src/lib/network.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const network = JSON.parse(fs.readFileSync(path.join(WEB, 'src/lib/network.json'), 'utf8'));
const links = networkLinks(network);

test('숲가자를 뺀 10곳을 SITE_RULES 표준 순서로 낸다 (이슈 #9)', () => {
  assert.deepEqual(links.map((l) => l.name), [
    '딸깍랭크', '에어모아', '내여행 찾아줌', '이때다', 'ETFX', '카드매치', '내 압구정', '입시on', '자동차보험 환급 비교', 'FPL Live',
  ]);
});

test('모든 링크에 utm_source=supgaja, utm_medium=footer_network 두 개만 붙는다', () => {
  for (const l of links) {
    const u = new URL(l.href);
    assert.equal(u.origin, new URL(l.url).origin);
    assert.deepEqual([...u.searchParams.keys()], ['utm_source', 'utm_medium']);
    assert.equal(u.searchParams.get('utm_source'), 'supgaja');
    assert.equal(u.searchParams.get('utm_medium'), 'footer_network');
  }
});

test('주소에 경로·쿼리가 있으면 &로 이어 붙이고, self 는 끝 / 유무와 관계없이 뺀다', () => {
  const out = networkLinks({
    utm: { source: 'supgaja', medium: 'footer_network' },
    self: 'https://supgaja.com/',
    sites: [
      { url: 'https://supgaja.com', name: '숲가자', desc: '', icon: '' },
      { url: 'https://x.example/p?a=1', name: 'X', desc: '', icon: '' },
    ],
  });
  assert.deepEqual(out.map((l) => l.href), ['https://x.example/p?a=1&utm_source=supgaja&utm_medium=footer_network']);
});

test('정적 페이지(faq·privacy·terms·about)에는 다른 서비스 띠가 없고 /network 한 줄 링크만 있다 (이슈 #25)', () => {
  for (const f of ['faq.html', 'privacy.html', 'terms.html', 'about.html']) {
    const html = fs.readFileSync(path.join(WEB, 'public', f), 'utf8');
    assert.ok(!html.includes('netband'), `${f}: 띠가 남아 있다`);
    assert.ok(!html.includes('utm_medium=footer_network'), `${f}: 외부 서비스 링크가 남아 있다`);
    assert.ok(html.includes('<a href="/network">운영자의 다른 서비스</a>'), `${f}: /network 링크가 없다`);
  }
});

test('빌드 스크립트: 모든 정적 페이지 푸터에 /network 링크, 띠는 /network 페이지에서만 (이슈 #25)', () => {
  const s = fs.readFileSync(path.join(WEB, 'scripts/build-static.mjs'), 'utf8');
  assert.ok(!s.includes('${networkBand}\n<footer>'), '공통 푸터 앞에 띠가 붙어 있다');
  assert.ok(s.includes("urlPath: '/network'") && s.includes('noindex'));
  assert.ok(s.split('<a href="/network">운영자의 다른 서비스</a>').length - 1 >= 2, '푸터 링크 부족');
  const app = fs.readFileSync(path.join(WEB, 'src/App.tsx'), 'utf8');
  assert.ok(!app.includes('netband') && app.includes('href="/network"'));
});

test('빌드 결과(dist)가 있으면 홈·휴양림 페이지에 외부 서비스 링크가 없고 /network 에 10곳이 있다', { skip: !fs.existsSync(path.join(WEB, 'dist/network/index.html')) }, () => {
  for (const f of ['index.html', 'forest/index.html']) {
    if (!fs.existsSync(path.join(WEB, 'dist', f))) continue;
    const h = fs.readFileSync(path.join(WEB, 'dist', f), 'utf8');
    assert.ok(!h.includes('utm_medium=footer_network'), f);
  }
  const n = fs.readFileSync(path.join(WEB, 'dist/network/index.html'), 'utf8');
  const got = [...n.matchAll(/<a href="([^"]+utm_medium=footer_network)" target="_blank" rel="noopener">/g)].map((m) => m[1]);
  assert.deepEqual(got, links.map((l) => l.href.replace(/&/g, '&amp;')));
});
