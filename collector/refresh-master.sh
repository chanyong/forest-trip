#!/usr/bin/env bash
# 객실 마스터 갱신 (로그인 필요 → 로그인된 Aside 브라우저 사용, 월 1회 정도 권장)
# 1) Aside에서 숲나들e 로그인 후 월별현황조회 페이지를 연다
# 2) ./collector/refresh-master.sh
set -euo pipefail
cd "$(dirname "$0")"
aside repl "$(cat master.repl.js)" | tail -1
while :; do
  sleep 30
  out=$(aside repl "$(cat master.poll.js)" | grep '^@@' | cut -c3-)
  done=$(node -e "const m=JSON.parse(process.argv[1]);console.log(m.done?1:0, m.log.join(','))" "$out")
  echo "$done"
  [[ $done == 1* ]] && break
done
node -e "
const fs=require('fs');const m=JSON.parse(process.argv[1]);
if(m.error){console.error(m.error);process.exit(1)}
for(const [s,f] of Object.entries(m.sidos)) fs.writeFileSync('master/'+s+'.json', JSON.stringify(f));
" "$out"
node build-master.mjs
