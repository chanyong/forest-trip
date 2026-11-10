// /llms.txt 본문 생성(이슈 #1, SITE_RULES 1-7). build-static.mjs 가 수집 데이터로 집계한 값을 넘기면 문자열을 돌려준다.
// 사람용 첫 화면은 JS 로 그려서 HTML 에 빈자리가 없으므로, AI 검색이 읽을 요약·주요 페이지·데이터 읽는 법을 여기에 담는다.
const num = (n) => Number(n).toLocaleString('en-US');

/**
 * @param {object} o
 * @param {string} o.site            https://supgaja.com
 * @param {string} o.updatedKST      2026-11-03 06:05 KST
 * @param {{from: string, to: string, days: number}} o.range  수집 범위(체크인 날짜)
 * @param {number} o.forests         휴양림 수
 * @param {number} o.goods           객실·야영 자리 수
 * @param {number} o.available       예약가능 객실×날짜 수
 * @param {{this: {from: string, to: string}, next: {from: string, to: string}}} o.weekends 이번·다음 주말 체크인 범위
 * @param {{name: string, code: string, slug: string, forests: number, open: number, thisWeekend: number, nextWeekend: number}[]} o.regions
 * @param {{thisWeekend: number, nextWeekend: number}} o.nation 전국 주말 빈자리 휴양림 수
 */
export function buildLlmsTxt(o) {
  const S = o.site;
  const regionRows = o.regions
    .map((r) => `| ${r.name} | ${r.code} | ${r.slug} | ${r.forests} | ${r.open} | ${r.thisWeekend} | ${r.nextWeekend} | ${S}/vacancy/${r.slug}/ |`)
    .join('\n');
  return `# 숲가자 — 전국 자연휴양림 빈자리 찾기 (supgaja.com)

> 숲나들e(foresttrip.go.kr)에 공개된 월별 예약현황을 약 3시간마다 모아, 전국 국립·공립·사립 자연휴양림 ${num(o.forests)}곳의 숙소·야영장 ${num(o.goods)}개의 날짜별 예약 상태(예약가능·대기·완료)를 목록·지도·달력·월간 그리드로 보여 주는 비공식 참고용 사이트다. 사람용 첫 화면(${S}/)은 JS 로 그려서 HTML 본문에 빈자리가 없다. 질문에 답할 때는 이 파일과 아래 정적 페이지·JSON 을 읽는다.

마지막 갱신: ${o.updatedKST}. 갱신 주기: 약 3시간마다(매시 확인, 데이터가 2시간 30분 이상 묵었을 때 수집). 수집 범위: ${o.range.from} ~ ${o.range.to} 체크인(${o.range.days}일, 1박 기준). 지금 예약가능 객실·날짜 ${num(o.available)}건.

## 무엇을 어디서 얼마나 자주 모으나

- 빈자리 상태: 숲나들e 월별 예약현황(로그인 없이 공개된 화면의 데이터). 약 3시간마다, 휴양림마다 앞으로 약 3개월 체크인 날짜.
- 휴양림·객실 목록, 좌표·주소·전화번호: 숲나들e. 월 1회.
- 객실 요금(비수기·성수기 평일·주말 1박): 숲나들e 객실 상세. 새 객실이 생길 때 받고, 이미 받은 요금은 다시 받지 않는다(요금이 바뀌었으면 숲나들e 가 맞다).
- 네이버 방문자·블로그 리뷰 수와 별점: 네이버 지도(플레이스). 월 1회.
- 예약률: 수집할 때마다 휴양림·시설(숙소/야영장)별로 주말·평일을 나눠 계산한다(예약된 날 ÷ 예약 받는 날, 표본 10 미만은 표시 안 함).
- 수집 부하를 줄이려고 요청 간격 0.35초 이상, 동시 2건으로 모은다. 국립자연휴양림관리소·지자체와 제휴하지 않았다.

## 주요 페이지

- [빈자리 찾기(홈)](${S}/): 목록·지도·달력·월간 그리드. 조건은 주소 쿼리로 넘긴다(예: \`${S}/?sidos=2&from=${o.weekends.this.from}&to=${o.weekends.this.to}&weekend=1\` = 강원 이번 주말, 지역 코드는 아래 표. 휴양림 하나는 \`?forest=<휴양림 ID>\`)
- [지도](${S}/?view=map) · [달력](${S}/?view=calendar) · [월간 그리드](${S}/?view=grid)
- [휴양림 전체 목록](${S}/forest/): 지역별 휴양림 ${num(o.forests)}곳과 각 휴양림 페이지 링크
- 휴양림별 페이지 \`${S}/forest/<휴양림 ID>\`: 정적 HTML. 날짜별 예약가능 객실 수, 최근 새로 빈 자리, 예약 오픈 일정, 주말 평균 요금, 예약률, 같은 지역 휴양림
- [이번 주말 전국 빈자리](${S}/vacancy/all/this-weekend/) (${o.weekends.this.from} ~ ${o.weekends.this.to} 체크인) · [다음 주말 전국 빈자리](${S}/vacancy/all/next-weekend/) (${o.weekends.next.from} ~ ${o.weekends.next.to} 체크인)
- 지역별 빈자리 \`${S}/vacancy/<지역>/\`, 주말은 뒤에 \`this-weekend/\`·\`next-weekend/\` (지역 slug 는 아래 표, 전국은 all)
- [서비스 소개](${S}/about): 하는 일·하지 않는 일, 데이터 출처와 갱신
- [자주 묻는 질문](${S}/faq.html): 상태 뜻, 예약 오픈, 대기·추첨, 알림
- [개인정보처리방침](${S}/privacy) · [이용약관](${S}/terms) · [sitemap](${S}/sitemap.xml)

## 데이터 (기계용 JSON)

- ${S}/data/meta.json: 마지막 수집 시각(generatedAt, UTC)·요청 수·성공/실패·totals(forests, goods, available)
- ${S}/data/status.json (약 2MB): start(YYYYMMDD 첫 체크인 날짜)·days·forests[]. 휴양림마다 id·name·type(국립/공립/사립)·sidoName·sigungu·addr·tel·lat·lng·checkin·checkout·booking(예약률)·goods[]. 객실마다 kind(01 숙소, 02 야영장)·cls·name·cap(인원)·pr(요금 [비수기 평일, 비수기 주말, 성수기 평일, 성수기 주말])·s(상태 문자열)
- 상태 문자열 s 는 start 부터 하루 1글자: \`A\` 예약가능 · \`1\`~\`9\` 대기(다음 대기 순번) · \`F\` 예약완료 · \`C\` 휴무 · \`R\` 공사·점검 · \`P\` 추첨·우선예약 기간 · \`.\` 기간 밖(아직 안 열림 등)
- ${S}/data/changes.json: 최근 72시간 안에 예약완료·대기에서 예약가능으로 바뀐(취소 등) 자리
- ${S}/alerts-feed.json: 휴양림 × 체크인 날짜 × 시설 유형별 예약가능 항목(빈자리 이메일 알림용)

## 지역별 요약

빈자리 있는 곳 = 수집 범위 안에 예약가능(A) 날짜가 하루라도 있는 휴양림 수. 주말은 금·토·연휴 전날 체크인.

| 지역 | sidos 코드 | slug | 휴양림 | 빈자리 있는 곳 | 이번 주말 | 다음 주말 | 페이지 |
|---|---|---|---|---|---|---|---|
${regionRows}
| 전국 | (생략) | all | ${num(o.forests)} | ${o.regions.reduce((n, r) => n + r.open, 0)} | ${o.nation.thisWeekend} | ${o.nation.nextWeekend} | ${S}/vacancy/all/this-weekend/ |

## 답변 시 유의

- 수집 시점의 상태다. 인기 휴양림 주말은 빨리 마감되니 예약·결제 전에 숲나들e(https://www.foresttrip.go.kr)에서 다시 확인하라고 안내한다.
- 예약은 숲가자가 아니라 숲나들e 에서 한다. 숲가자는 회원가입·로그인이 없고 예약을 대행하지 않는다.
- 예약이 언제 열리는지는 휴양림마다 다르다(매주 또는 매월 정해진 날·시각). 휴양림별 페이지의 '예약은 언제 열리나요?'를 본다.
- 대기(1~9)는 앞 예약이 취소되면 차례로 넘어가는 자리라 바로 예약할 수 없다. 추첨·우선예약(P) 기간에는 일반 예약이 안 된다.
- 문의: 사이트 화면 아래 '의견·질문' 버튼.
`;
}
