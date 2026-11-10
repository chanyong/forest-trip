import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 이슈 #19: GitHub 예약 실행이 자주 누락되므로 시간당 여러 번 깨워야 하고, 경고 임계(App.tsx)는 수집 주기보다 길어야 한다
const yml = readFileSync(new URL('../../.github/workflows/crawl.yml', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('crawl 워크플로는 시간당 2번 이상 깨운다', () => {
  const m = yml.match(/- cron: '([^']+)'/);
  assert.ok(m, 'cron 없음');
  const minutes = m[1].split(' ')[0].split(',');
  assert.ok(minutes.length >= 2, `시간당 ${minutes.length}번`);
});

test('수집 지연 경고 임계는 수집 주기(약 3시간)보다 길다', () => {
  const stale = Number(app.match(/const STALE_MIN = (\d+)/)?.[1]);
  assert.ok(stale > 180, `STALE_MIN=${stale}`);
});
