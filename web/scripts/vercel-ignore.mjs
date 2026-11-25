// Vercel ignoreCommand: 데이터 갱신만 담은 커밋은 12시간 구간(KST 06시·18시 시작)마다 첫 배포만 만든다.
// 종료 코드 0 = 이 배포를 건너뜀, 1 = 빌드. 판단이 불확실하면 항상 빌드한다(fail-open). (이슈 #46)
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const BUCKET_SEC = 12 * 3600;
const SHIFT_SEC = 3 * 3600; // UTC epoch 12시간 구간 + 3시간 = 경계가 UTC 21:00·09:00(KST 06:00·18:00)
const DATA_PATHS = [/^web\/public\/data\//, /^data\/history\//];

export const bucketOf = (ts) => Math.floor((ts + SHIFT_SEC) / BUCKET_SEC);
export const isDataOnly = (files) => files.length > 0 && files.every((f) => DATA_PATHS.some((re) => re.test(f)));

/** @returns {{skip:boolean, reason:string}} */
export function decide({ ref, files, prevTs, headTs }) {
  if (ref && ref !== 'main') return { skip: false, reason: `main 아닌 브랜치(${ref})` };
  if (!isDataOnly(files)) return { skip: false, reason: '코드·설정 변경 포함 또는 변경 파일 불명' };
  if (!Number.isFinite(prevTs) || !Number.isFinite(headTs)) return { skip: false, reason: '커밋 시각 불명' };
  if (bucketOf(prevTs) === bucketOf(headTs)) return { skip: true, reason: '데이터만 변경, 같은 12시간 구간에 이미 배포됨' };
  return { skip: false, reason: '데이터만 변경, 새 12시간 구간의 첫 배포' };
}

const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function main() {
  let result;
  try {
    const head = sh('git rev-parse HEAD');
    const prev = process.env.VERCEL_GIT_PREVIOUS_SHA || sh('git rev-parse HEAD~1');
    const files = sh(`git diff --name-only ${prev} ${head}`).split('\n').filter(Boolean);
    result = decide({
      ref: process.env.VERCEL_GIT_COMMIT_REF,
      files,
      prevTs: Number(sh(`git show -s --format=%ct ${prev}`)),
      headTs: Number(sh(`git show -s --format=%ct ${head}`)),
    });
  } catch (e) {
    result = { skip: false, reason: `확인 실패(${e.message.split('\n')[0]}) → 빌드` };
  }
  console.log(`[ignore] ${result.skip ? '건너뜀' : '빌드'}: ${result.reason}`);
  process.exit(result.skip ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
