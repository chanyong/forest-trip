// 네이버 검색광고 심사: 랜딩을 포함한 모든 페이지 하단에 사업자 정보가 있어야 한다(11-07 대표 요청).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'src/App.tsx',
  'scripts/build-static.mjs',
  'public/faq.html',
  'public/privacy.html',
  'public/terms.html',
];

for (const f of files) {
  test(`${f} 하단에 사업자 정보`, () => {
    const s = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    const footer = s.slice(s.indexOf('<footer'), s.lastIndexOf('</footer>'));
    assert.match(footer, /대표: 홍지혜\(넥스트웨이브\)/);
    assert.match(footer, /사업자등록번호: 311-11-67514/);
  });
}
