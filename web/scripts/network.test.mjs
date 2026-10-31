// 하단 '운영자의 다른 서비스' 링크 검사 (이슈 #2). 실행: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkLinks } from '../src/lib/network.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const network = JSON.parse(fs.readFileSync(path.join(WEB, 'src/lib/network.json'), 'utf8'));
const links = networkLinks(network);

test('숲가자를 뺀 10곳을 공통 사양 순서(여행 → 금융·생활 → 그 밖)로 낸다', () => {
  assert.deepEqual(links.map((l) => l.name), [
    '에어모아', '내여행 찾아줌', '이때다', 'ETFX', '카드매치', '내 압구정', '자동차보험 환급 비교', '입시on', 'FPL Live', '딸깍랭크',
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

test('정적 페이지(faq·privacy·terms)의 손으로 맞춘 목록이 network.json 과 같다', () => {
  const want = links.map((l) => l.href.replace(/&/g, '&amp;'));
  for (const f of ['faq.html', 'privacy.html', 'terms.html']) {
    const html = fs.readFileSync(path.join(WEB, 'public', f), 'utf8');
    const band = html.match(/<nav class="netband"[\s\S]*?<\/nav>/);
    assert.ok(band, `${f}: 띠가 없다`);
    const got = [...band[0].matchAll(/<a href="([^"]+)" target="_blank" rel="noopener">/g)].map((m) => m[1]);
    assert.deepEqual(got, want, f);
  }
});
