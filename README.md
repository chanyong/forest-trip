# 숲빈자리 — 전국 자연휴양림 빈자리 찾기

숲나들e(foresttrip.go.kr) 월별 예약현황을 3시간마다 모아서 전국 자연휴양림 숙소·야영장의 빈자리를
**목록 · 지도 · 달력 · 월간 그리드**로 한 번에 보여 주는 정적 웹사이트입니다.

## 구조

```
GitHub Actions (3시간마다)
  └─ collector/crawl.mjs  ── 숲나들e 공개 API (비로그인) ──▶ web/public/data/*.json 커밋
                                                              └─ Vercel 자동 배포 (CDN 정적 서빙)
로그인된 Aside 브라우저 (월 1회, 수동)
  └─ collector/refresh-master.sh ──▶ data/master.json (휴양림·객실 ID, 좌표)
로컬 (월 1회, 수동)
  └─ node collector/naver-reviews.mjs ──▶ data/naver.json (네이버 방문자·블로그 리뷰 수)
```

- DB, 서버 없이 운영합니다. 데이터는 하나의 JSON(약 1MB, gzip 약 150KB)이고, 필터링은 브라우저에서 합니다.
- 날짜별 상태 API는 로그인 없이 호출할 수 있습니다. 객실 목록 API만 로그인이 필요해서, 객실 마스터는 따로 갱신합니다.

| 경로 | 역할 |
|---|---|
| `collector/crawl.mjs` | 상태 수집. 의존성 없음, Node 20+ |
| `collector/master.repl.js` / `master.poll.js` | Aside REPL로 시도별 객실 ID 수집 (로그인 세션) |
| `collector/build-master.mjs` | 마스터 병합, 공식 좌표·주소·전화번호 보강 |
| `collector/naver-reviews.mjs` | 네이버 모바일 검색의 플레이스 정보에서 리뷰 수·별점 수집. 기존 값은 건너뛰고 `--force`로 전체 갱신 |
| `data/master.json` | 휴양림 185곳 · 객실 7,464개 (2026-10-26 기준) |
| `web/` | Vite + React + TS, MapLibre(OpenFreeMap), TanStack Virtual |
| `.github/workflows/crawl.yml` | 정기 수집 → 커밋 → Vercel 배포 |

## 상태 코드 (`status.json`의 `s` 문자열, 날짜당 1글자)

`A` 예약가능 · `1`~`9` 대기(다음 대기 순번) · `F` 완료 · `C` 휴무 · `R` 공사/점검 · `P` 추첨·우선예약 기간 · `.` 기간 밖

숲나들e 응답 매핑: `rsrvtAvail=Y`이고 `rsrvtCnt=0`이면 `A`. 예약이 있고 `wtngCnt < goodsMxmmWtngCnt`이면 대기, 그 밖은 `F`.
`PRNSL_DAY`는 `C`, `REPAIR`는 `R`, `DRLTS`/`PRIOR`는 `P`, `BEFORE_DATE`/`OVER_DATE`는 `.`.

## 예약률

`collector/stats.mjs`가 수집할 때마다 휴양림·시설(숙소/야영장)별로 `booking: {"01": {we: [예약된 날, 예약 받는 날], wd: [...]}}`를 계산합니다.
예약 받는 날은 `A`·대기·`F`이고, 그중 대기·`F`를 예약된 날로 셉니다. 주말은 체크인 다음 날이 토·일·공휴일인 숙박입니다.
공휴일 목록은 `web/src/lib/holidays.json` 하나를 웹과 수집기가 같이 씁니다.

## 로컬 실행

```bash
node collector/crawl.mjs            # 전체 수집 (약 20~30분), LIMIT_FORESTS=3 으로 일부만
cd web && npm i && npm run dev
```

## 수집 정책

- 요청 간격 0.35초 이상(무작위), 동시 2건, 실패하면 지수 백오프로 재시도
- 실패율이 30%를 넘으면 기존 데이터를 덮어쓰지 않습니다.
- 숲나들e 서버 부담을 줄이기 위해 3시간 주기로 수집합니다. 운영기관이 요청하면 즉시 중단합니다.

본 서비스는 비공식 참고용이며 국립자연휴양림관리소·지자체와 제휴하지 않았습니다. 예약은 숲나들e에서 진행하세요.
