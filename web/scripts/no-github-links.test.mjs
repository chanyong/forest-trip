// 화면에 운영자 GitHub 링크가 나가지 않는지 검사 (이슈 #4). 실행: npm test
// 문의는 공통 '의견·질문' 버튼(딸깍랭크 feedback.js)으로 받는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(WEB, rel), 'utf8');

// 빌드 결과로 나가는 원본: index.html, src/, public/(data 제외), 정적 페이지 생성 스크립트
function shippedFiles() {
  const out = ['index.html', 'scripts/build-static.mjs'];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(WEB, rel), { withFileTypes: true })) {
      const r = path.posix.join(rel, e.name);
      if (e.isDirectory()) {
        if (r !== 'public/data') walk(r);
      } else if (/\.(tsx?|mjs|js|html|json|css)$/.test(e.name)) {
        out.push(r);
      }
    }
  };
  walk('src');
  walk('public');
  return out;
}

test('화면에 나가는 파일에 github.com/chanyong 링크가 없다', () => {
  const hits = shippedFiles().filter((f) => read(f).includes('github.com/chanyong'));
  assert.deepEqual(hits, []);
});

test('문의 안내는 의견·질문 버튼을 가리키고, 그 버튼 스크립트가 같은 페이지에 있다', () => {
  for (const [page, text] of [['index.html', read('src/App.tsx')], ['public/faq.html', read('public/faq.html')]]) {
    assert.match(text, /화면 아래 '의견·질문' 버튼으로/, `${page} 문의 안내 문구`);
    assert.match(read(page), /ddalkkakrank\.kr\/feedback\.js/, `${page} 의견·질문 버튼 스크립트`);
  }
});
