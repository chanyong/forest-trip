// 화면·구조화 데이터에 보이는 문의 이메일이 공통 주소로 통일됐는지 검사 (이슈 #6). 실행: npm test
// 대표 결정(2026-11-02): 사이트에 보이는 문의 이메일은 모두 1bangkr.info@gmail.com
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(WEB, rel), 'utf8');
const CONTACT = '1bangkr.info@gmail.com';

// 빌드 결과로 나가는 원본: index.html, src/, public/(data 제외), 정적 페이지 생성 스크립트
function shippedFiles() {
  const out = ['index.html', 'scripts/build-static.mjs'];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(WEB, rel), { withFileTypes: true })) {
      const r = path.posix.join(rel, e.name);
      if (e.isDirectory()) {
        if (r !== 'public/data') walk(r);
      } else if (/\.(tsx?|mjs|js|html|json|css|txt|xml|webmanifest)$/.test(e.name)) {
        out.push(r);
      }
    }
  };
  walk('src');
  walk('public');
  return out;
}

test('화면에 나가는 파일에 예전 문의 주소(cyjung@gmail.com)가 없다', () => {
  const hits = shippedFiles().filter((f) => read(f).includes('cyjung@gmail.com'));
  assert.deepEqual(hits, []);
});

test('화면에 나가는 이메일 주소는 모두 공통 문의 주소다', () => {
  const others = [];
  for (const f of shippedFiles()) {
    for (const m of read(f).matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/gi)) {
      if (m[0] !== CONTACT) others.push(`${f}: ${m[0]}`);
    }
  }
  assert.deepEqual(others, []);
});

test('처리방침·약관·JSON-LD에 공통 문의 주소가 있다', () => {
  assert.ok(read('public/privacy.html').includes(`mailto:${CONTACT}`), '개인정보처리방침 mailto');
  assert.ok(read('public/terms.html').includes(`mailto:${CONTACT}`), '이용약관 mailto');
  assert.ok(read('index.html').includes(`"email":"${CONTACT}"`), 'index.html JSON-LD email');
  assert.ok(read('scripts/build-static.mjs').includes(`email: '${CONTACT}'`), '정적 페이지 JSON-LD email');
});
