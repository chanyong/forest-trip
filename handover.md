# 숲가자(supgaja.com) 인수인계

최종 갱신: 2026-10-28
다음 Claude Code 세션은 이 파일을 먼저 읽고 사이트 관리를 이어 간다. 세부 기술 설명은 `README.md`에 있다.

---

## 1. 한눈에 보기

| 항목 | 값 |
|---|---|
| 서비스 | 숲가자: 전국 자연휴양림(숲나들e) 숙소·야영장 빈자리를 목록·지도·달력·월간 그리드로 보여 주는 비공식 참고용 정적 사이트 |
| 대표 주소 | https://supgaja.com (www.supgaja.com과 forest-trip-seven.vercel.app은 supgaja.com으로 308 영구 이동) |
| 저장소 | github.com/chanyong/forest-trip (public), 브랜치 `main` |
| 로컬 폴더 | `~/Library/CloudStorage/Dropbox/20_Dev/forest-trip` (Dropbox로 Windows와 동기화) |
| 호스팅 | Vercel 팀 `chanyong2`, 프로젝트 `forest-trip` (prj_ZlE3qoEYbnhWzrmEg4rITede3IYn). `main`에 push하면 자동 배포 |
| 도메인 | supgaja.com. 2026-10-27 호스팅케이알(Megazone)에서 등록. 네임서버는 Vercel DNS(ns1/ns2.vercel-dns.com) |
| 수집 | GitHub Actions `crawl.yml`. 매시 7분에 깨어나 데이터가 150분 이상 묵었을 때만 수집하고, 결과 JSON을 커밋한다 |
| 분석 | GA4 계정 'Chanyong'(a63589372), 속성 「숲가자 (supgaja.com)」 561001282, 측정 ID G-7W5GR0VK33, 웹 스트림 16213862023 |
| 검색 | Google Search Console 도메인 속성 supgaja.com. DNS TXT로 인증했고 sitemap을 제출함 |
| 구글 계정 | cyjung@gmail.com (Aside 브라우저에 로그인돼 있음) |
| 이전 이름 | 숲빈자리. 2026-10-27에 숲가자로 변경. 숲자리는 supjari.com 캠핑장 서비스와 겹쳐 제외했다 |

## 2. 작업 원칙 (사용자 지시)

- 사용자와는 한국어로 대화한다.
- 수정하면 검증한 뒤 바로 커밋하고 push(=배포)한다. 사용자는 "수정한거 다 배포"를 기본으로 원한다.
- 외부 서비스 설정은 사용자 확인 후에만 만들거나 바꾼다. 해당하는 일: 도메인, DNS, Vercel 설정, GA, GSC, 결제.
- 비밀값은 출력하거나 커밋하지 않는다. `.env.local`에 Vercel OIDC 토큰이 있고 `.gitignore`로 제외돼 있다.
- 브라우저 작업(GA, GSC, 숲나들e 로그인 등)은 Aside(`aside exec "..."`)로 한다. `aside guide`로 사용법을 확인할 수 있다.
- 서버와 DB 없이 정적 JSON으로 운영하는 구조를 유지한다. 서버나 DB를 도입하려면 먼저 사용자에게 확인한다.
- 숲나들e 수집 부하는 보수적으로 유지한다(요청 간격 0.35초 이상, 동시 2건). 운영기관이 요청하면 즉시 중단한다.
- 커밋 메시지는 한국어로 쓰고, 끝에 `Co-Authored-By: Claude ... <noreply@anthropic.com>`를 붙인다.

### Claude Code 권한 관련
- auto 모드 분류기가 `vercel domains add`, `vercel dns add`, `git checkout -- .`을 막은 적이 있다.
- 막히면 우회하지 말고, 사용자에게 `! <명령>`으로 직접 실행해 달라고 안내한다.

## 3. 구조

```
GitHub Actions (crawl.yml, 매시 확인 · 실제 약 3시간 주기)
  └─ node collector/crawl.mjs ─ 숲나들e 비로그인 API ─▶ web/public/data/{status,changes,meta}.json 커밋 ─▶ Vercel 배포
Aside 브라우저 (월 1회, 수동, 숲나들e 로그인 필요)
  └─ collector/refresh-master.sh ─▶ data/master.json (휴양림 185곳 · 객실 7,464개, 좌표·주소)
로컬 (월 1회, 수동)
  ├─ node collector/naver-reviews.mjs ─▶ data/naver.json (네이버 방문자·블로그 리뷰, 별점) 179/185곳
  └─ node collector/prices.mjs        ─▶ data/prices.json (객실별 [비수기 평일, 비수기 주말, 성수기 평일, 성수기 주말]) 7,406/7,464실
```

- `crawl.mjs`는 `master`, `naver`, `prices` 파일을 읽어 `status.json`에 합친다. 합치는 값은 forest.naver, forest.booking(예약률), goods.pr(요금)이다.
- `collector/stats.mjs`는 예약률 계산을 맡는다. 예약된 날은 대기·F, 예약 받는 날은 A+대기+F로 센다. 주말은 체크인 다음 날이 토·일·공휴일인 숙박이고, 표본이 10 미만이면 표시하지 않는다.
- `collector/backfill-stats.mjs`는 집계 방식이나 요금을 바꿨을 때 기존 status.json을 다시 계산하는 1회용 스크립트다.
- `web/src/lib/holidays.json`은 공휴일 목록이다. 웹과 수집기가 같이 쓰며 연 1회 갱신한다.
- 상태 코드(날짜당 1글자): `A` 가능 · `1~9` 대기 · `F` 완료 · `C` 휴무 · `R` 공사 · `P` 추첨/우선예약 · `.` 정보 없음

### 웹 (`web/`, Vite + React + TS)

| 파일 | 내용 |
|---|---|
| `App.tsx` | 탭(목록/지도/달력/월간 그리드, 방향키 이동), 상세 팝업(history.pushState로 뒤로가기 지원), 빈 결과 화면, 개인정보 안내 하단 문구 |
| `lib/data.ts` | 필터(URL 쿼리와 동기화), 검색·정렬(date/count/review/popular/price/name/dist), 예약률, 요금(`weekendPriceOf`, `pricesOf`, `byPrice`) |
| `components/FilterBar.tsx`, `Dropdown.tsx` | 필터바. 다중 선택 드롭다운과 기본 select 사용. 모바일에서는 '상세 조건'으로 접힌다 |
| `components/TableView.tsx` | 목록. 열은 휴양림·가장 가까운 날짜·가능 건수·주말 요금·예약률·체크인 날짜. 30곳씩 '더 보기' |
| `components/MapView.tsx` | MapLibre(OpenFreeMap). 마커, 지도 영역 안 목록(빈자리/리뷰/요금 순 정렬), 팝업 |
| `components/CalendarView.tsx`, `GridView.tsx` | 달력 히트맵과 날짜별 카드. 월간 그리드(가상 스크롤, CSV 내보내기) |
| `components/ForestDrawer.tsx` | 휴양림 상세 팝업. 리뷰, 시설별 예약률·요금, 객실별 날짜 그리드, 숲나들e 예약 링크 |
| `components/Summary.tsx` | 상단 요약 카드와 '최근 새로 열린 자리' 카드 |
| `components/Price.tsx`, `Rate.tsx`, `Reviews.tsx` | 요금 표시(숙소 6.9만 · 야영 3만), 예약률 막대, 네이버 리뷰 배지 |
| `index.html` | 메타·OG·JSON-LD, status.json 조기 요청(`window.__statusReq`), 글꼴 비동기 로드, GA4(supgaja.com 호스트에서만 동작) |
| `public/` | 404.html, og-image.png(1200×630, 숲가자 supgaja.com), 아이콘, manifest, robots.txt, sitemap.xml |
| `vercel.json` | 보안 헤더, 캐시, www·vercel.app → supgaja.com 리디렉션 |

### QC (`qa/`)
- `cd qa && npm run qc`로 배포 사이트를 점검한다. 3개 엔진 × 14개 화면 크기에서 접근성(axe), 터치 영역, 키보드, 뒤로가기, SEO, 링크를 본다.
- 결과와 캡처는 `qa/out/`에 저장된다. 대상 URL은 `qa/package.json`에 있고, 지금은 https://supgaja.com 이다.
- 2026-10-27 기준 결과
  - QC: 문제 0건
  - Lighthouse 데스크톱: 성능 99, CLS 0.001
  - Lighthouse 모바일: 성능 83, 접근성·권장사항·SEO 100

## 4. 지금까지 한 일 (시간순)

| 날짜 | 커밋 | 내용 |
|---|---|---|
| 10-26 | 3d1960b | 최초 구축: 수집기, 4개 보기, 필터 |
| 10-26 | 460d414 | maplibre-gl 6.16 업데이트(XSS 취약점) |
| 10-27 | 5f65805 | 추첨·우선예약(P) 상태 분리 |
| 10-27 | 2f00d41 | 필터 드롭다운화, 네이버 리뷰 수, 달력 목록 정리, 모바일 접근성 |
| 10-27 | ae7f3d7 | 주말·평일 예약률 집계, 필터, 정렬 |
| 10-27 | 18dc5e1 · 49e67ee · 6e0d2cf · 53b769b · d6826c9 | 오픈 전 QC(접근성, 모바일, SEO, 보안 헤더, 성능/CLS)와 QC 스크립트 |
| 10-27 | ac38e97 | 예약 실행 누락에 대비한 매시간 확인 + 신선도 가드 |
| 10-27 | 6b6fa3d | 공휴일 보강(노동절·제헌절, 2027 대체공휴일) |
| 10-27 | b9cd3b4 | 보기 탭 아이콘·색 |
| 10-27 | be236b4 | 객실 요금 수집, 주말 평균 요금(그리드·상세) |
| 10-27 | 1905842 · c235edf | 숲가자로 이름 변경, supgaja.com 연결, 301 리디렉션 |
| 10-27 | 5782631 | GA4 태그, 개인정보 안내에 방문 통계 고지 |
| 10-27 | (외부 작업) | GA4 속성 생성, GSC 도메인 인증, sitemap 제출, 홈 색인 요청(Aside로 진행) |
| 10-28 | ba98264 | 목록·지도에 주말 평균 요금, '주말 요금 낮은 순' 정렬 |
| 10-28 | a4738fc | '최근 새로 열린 자리' 카드의 카드별 확인 시각 줄 삭제 |

### 가격순 정렬 규칙 (사용자와 합의)
- 숙소와 야영장 요금을 섞어 비교하지 않는다.
- 숙소가 있는 휴양림을 숙소 요금 순으로 먼저 놓고, 야영장만 있는 곳은 그다음, 요금 정보가 없는 곳은 맨 뒤에 둔다.
- 시설 필터를 고르면 그 시설 요금만으로 정렬한다.
- 요금은 비수기 주말 1박 요금의 평균이다.

## 5. 앞으로 할 일

### 우선
1. **수집 주기 안정화**
   - GitHub의 예약 실행(schedule)이 자주 빠진다. 예: 10-27 19:23Z 실행 후 23:39Z까지 실행이 없었다. 매시간 cron을 걸어 두었는데도 몇 시간씩 건너뛴다.
   - 대안: 외부 크론(cron-job.org 등)이나 Vercel Cron에서 GitHub `workflow_dispatch` API를 호출한다. GitHub 토큰이 필요하므로 사용자에게 확인하고 진행한다.
   - 확인 명령: `gh run list --workflow crawl.yml -L 10`
2. **지도 탭 문제 확인 대기**
   - 사용자가 "'지도' 탭 누르면 올…"까지만 적어 무슨 현상인지 모른다.
   - 헤드리스 Chrome/WebKit의 모바일·데스크톱 화면에서는 오류도, 화면 튐도 없었다. 다만 확인한 것은 페이지 맨 위에서 누른 경우뿐이다.
   - 사용자에게 기기·브라우저와 현상(화면이 위로 올라감인지, 오류인지)을 받아서 재현한다.
3. **GSC 색인 확인**
   - 10-27에 홈 색인을 요청했다. 며칠 뒤 색인됐는지 보고, 안 됐으면 URL 검사로 다시 요청한다.
   - 확인할 곳: 페이지 색인 보고서, sitemap 상태(발견된 페이지 4개)
4. **GA4 수집 확인**
   - 실시간 보고서에 방문자가 잡히는 것은 확인했다.
   - 며칠 뒤 보고서에서 페이지뷰를 확인하고, 탭 전환(URL 쿼리 변경)이 페이지뷰로 잡히는지 본다. 향상된 측정의 '브라우저 기록 기반 페이지 변경'에 해당한다.

### 정기 작업
- **월 1회: 객실 마스터 갱신**
  - Aside에서 숲나들e에 로그인하고 월별현황조회 페이지를 연 뒤 `./collector/refresh-master.sh`를 실행한다.
  - 새 객실이 생겼으면 `node collector/prices.mjs`로 요금도 받는다. 기존 값은 건너뛴다.
  - 그다음 커밋한다. data/*.json은 저장소에 포함된다.
- **월 1회: 네이버 리뷰 갱신**
  - `node collector/naver-reviews.mjs --force`를 실행한다.
  - 매칭되지 않는 곳: 수락산동막골, 피노키오, 좌구산휴양랜드, 영양에코둥지, 학가산우래, 광치
- **연 1회: 공휴일 갱신**
  - `web/src/lib/holidays.json`에 다음 해 공휴일과 대체공휴일을 넣는다.
- **수시: QC**
  - 기능을 바꾼 뒤 `cd qa && npm run qc`를 실행한다.

### 아이디어 (사용자가 원하면)
- 가격 필터(예: 1박 ○만 원 이하)
- 요금 자동 갱신: prices.mjs를 Actions에 월 1회로 추가
- 지도 마커를 요금으로 표시
- 빈자리 알림(웹푸시/이메일). 서버가 필요하므로 구조 변경 확인이 필요하다
- supgaja.kr 추가 등록과 리디렉션. 등록 여부는 사용자가 결정한다
- 상표: 키프리스에서 '숲가자' 검색은 아직 안 함

## 6. 알아 둘 환경 문제

- **Dropbox 줄바꿈(CRLF)**
  - Windows와 동기화되면서 내용은 같고 줄바꿈만 다른 수정 표시(M)가 생긴다.
  - `git diff --ignore-cr-at-eol --stat`이 비어 있으면 줄바꿈 차이뿐이다.
  - 지난번 것은 `git stash`(이름 "crlf-only (dropbox)")에 보관해 두었다. 필요 없으면 사용자 확인 후 `git stash drop`.
- **Mac의 `web/node_modules`가 깨져 있음**
  - Dropbox 동기화로 실행 권한과 Mac용 rolldown 바이너리가 없어서 `npm run build`가 실패한다.
  - 지금까지는 스크래치 폴더에 `rsync -a --exclude node_modules --exclude dist web/ <tmp>/` 한 뒤 `npm ci && npm run build`로 검증했다.
  - 근본 해결은 `cd web && npm ci`인데, Windows 쪽 영향을 고려해 사용자에게 확인하고 진행한다.
- **Playwright**
  - `qa/`는 playwright-core 1.64.1을 쓰고 브라우저 캐시는 chromium-1248, webkit-2370, firefox-1555다.
  - 다른 버전으로 `playwright install`을 하면 기존 브라우저 캐시가 지워질 수 있다. 실제로 1.57에서 그런 일이 있었다.
- **Vercel CLI**
  - `vercel`이 설치돼 있고 계정은 chanyong-5535, 팀은 chanyong2다.
  - 배포 상태: `vercel ls forest-trip`
  - 도메인 상태: `vercel domains inspect supgaja.com`
- **DNS**
  - supgaja.com의 TXT 레코드 `google-site-verification=9m_qc...`는 GSC 인증용이니 지우지 않는다.

## 7. 빠른 점검 명령

```bash
cd ~/Library/CloudStorage/Dropbox/20_Dev/forest-trip
git pull --rebase                                   # 수집 봇이 data 커밋을 계속 올리므로 작업 전 필수
gh run list --workflow crawl.yml -L 5               # 수집 실행 상태
curl -s https://supgaja.com/data/meta.json | head -c 400   # 마지막 수집 시각, 성공/실패 건수
gh workflow run crawl.yml                           # 수동 수집 (약 30분)
cd qa && npm run qc                                 # 배포 사이트 QC
```
