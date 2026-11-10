// 데이터 인사이트(/insights) 계산과 본문 만들기 (이슈 #23)
// 입력: 수집 데이터(status.json)와 일별 요약(data/history). 빌드 때마다 다시 계산하며 손으로 쓴 수치는 없다.
// 마감률 = (예약완료 + 대기) ÷ (예약가능 + 대기 + 예약완료), 체크인 날짜별 객실·야영 자리 칸 기준.
// 휴무(C)·공사(R)·추첨(P)·기간 밖(.)은 예약을 받지 않는 칸이므로 분모에서 뺀다.
export const MIN_CELLS = 300; // 이보다 칸 수가 적은 행은 비율을 보여 주지 않는다
export const MIN_DAYS_FOR_SERIES = 2;

const cellKind = (c) => (c === 'A' ? 'open' : c === 'F' ? 'full' : /^[1-9]$/.test(c) ? 'wait' : null);
const blank = () => ({ open: 0, full: 0, wait: 0 });
export const cells = (t) => t.open + t.full + t.wait;

// 칸 묶음 { open, full, wait } 의 마감률(%) 또는 표본 부족이면 null
export const closedRate = (t) => {
  const n = cells(t);
  return n >= MIN_CELLS ? Math.round(((t.full + t.wait) / n) * 100) : null;
};

/**
 * @param {object} status   status.json
 * @param {object} o
 * @param {number} o.first  첫 데이터 날짜 인덱스
 * @param {(iso:string)=>number} o.dow  요일(0=일)
 * @param {(i:number)=>string} o.dateOf  인덱스 → ISO 날짜
 * @param {(sido:string)=>string|undefined} o.regionName
 */
export function computeStats(status, o) {
  const byDow = { '01': Array.from({ length: 7 }, blank), '02': Array.from({ length: 7 }, blank) };
  const byMonth = new Map(); // 'YYYY-MM' -> { '01': tally, '02': tally }
  const byRegion = new Map(); // 지역명 -> tally
  const byForest = [];
  const total = blank();
  let firstISO = null, lastISO = null;
  for (const f of status.forests) {
    const ft = blank();
    for (const g of f.goods) {
      const kd = g.kind === '02' ? '02' : '01';
      for (let i = o.first; i < g.s.length; i++) {
        const k = cellKind(g.s[i]);
        if (!k) continue;
        const iso = o.dateOf(i);
        if (!firstISO || iso < firstISO) firstISO = iso;
        if (!lastISO || iso > lastISO) lastISO = iso;
        byDow[kd][o.dow(iso)][k]++;
        const mo = iso.slice(0, 7);
        if (!byMonth.has(mo)) byMonth.set(mo, { '01': blank(), '02': blank() });
        byMonth.get(mo)[kd][k]++;
        ft[k]++; total[k]++;
      }
    }
    const rn = o.regionName(f.sido) || f.sidoName;
    if (!byRegion.has(rn)) byRegion.set(rn, blank());
    for (const k of ['open', 'full', 'wait']) byRegion.get(rn)[k] += ft[k];
    byForest.push({ f, t: ft });
  }
  return { byDow, byMonth, byRegion, byForest, total, firstISO, lastISO };
}

// 일별 요약 이력에서 전국 합계 열: [{ date, forests, lodging, camp }]
export function historySeries(history) {
  return history.map((h) => {
    const rows = Object.values(h.f || {});
    return { date: h.date, forests: rows.length, lodging: rows.reduce((n, r) => n + (r[0] || 0), 0), camp: rows.reduce((n, r) => n + (r[1] || 0), 0) };
  });
}

const fmtYmd = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const num = (n) => Number(n).toLocaleString('en-US');
const pctCell = (t) => { const r = closedRate(t); return r == null ? '<span class="fsub">표본 부족</span>' : `${r}%`; };

// 해석 문장: 숙소 기준으로 표본이 충분한 요일끼리만 비교한다
export function dowSentence(byDowLodging, DOW) {
  const ranked = byDowLodging.map((t, i) => ({ d: DOW[i], v: closedRate(t) })).filter((r) => r.v != null).sort((x, y) => y.v - x.v);
  if (ranked.length < 2) return '표본이 충분한 요일이 2개 미만이라 요일을 비교하지 않습니다.';
  const hi = ranked[0], lo = ranked[ranked.length - 1];
  return `수집된 칸 기준으로 숙소 마감률이 가장 높은 체크인 요일은 ${hi.d}요일(${hi.v}%), 가장 낮은 요일은 ${lo.d}요일(${lo.v}%)입니다.`;
}

/** 본문 HTML. 문장은 모두 계산값에서 만든다. ctx: { esc, DOW, forestUrl, kstTime, rangeText, forestCount, stats, series } */
export function insightsBody(ctx) {
  const { esc, DOW, forestUrl, kstTime, stats, series } = ctx;
  const n = cells(stats.total);
  const dowTable = `<div style="overflow-x:auto"><table><thead><tr><th>체크인 요일</th><th>숙소 마감률</th><th>야영장 마감률</th><th>표본(칸)</th></tr></thead><tbody>${DOW
    .map((d, i) => { const a = stats.byDow['01'][i], b = stats.byDow['02'][i]; return `<tr><td>${d}요일</td><td>${pctCell(a)}</td><td>${pctCell(b)}</td><td>${num(cells(a) + cells(b))}</td></tr>`; }).join('')}</tbody></table></div>`;

  const months = [...stats.byMonth.keys()].sort();
  const monthTable = `<div style="overflow-x:auto"><table><thead><tr><th>체크인 월</th><th>숙소 마감률</th><th>야영장 마감률</th><th>표본(칸)</th></tr></thead><tbody>${months
    .map((m) => { const x = stats.byMonth.get(m); return `<tr><td>${+m.slice(0, 4)}년 ${+m.slice(5, 7)}월</td><td>${pctCell(x['01'])}</td><td>${pctCell(x['02'])}</td><td>${num(cells(x['01']) + cells(x['02']))}</td></tr>`; }).join('')}</tbody></table></div>`;

  const regionTable = `<div style="overflow-x:auto"><table><thead><tr><th>지역</th><th>마감률</th><th>표본(칸)</th></tr></thead><tbody>${[...stats.byRegion]
    .map(([name, t]) => `<tr><td>${esc(name)}</td><td>${pctCell(t)}</td><td>${num(cells(t))}</td></tr>`).join('')}</tbody></table></div>`;

  const top = stats.byForest.map(({ f, t }) => ({ f, v: closedRate(t), n: cells(t) })).filter((x) => x.v != null).sort((a, b) => b.v - a.v || b.n - a.n).slice(0, 10);
  const topList = top.length
    ? `<ol class="flist">${top.map(({ f, v, n: c }) => `<li><a href="${forestUrl(f)}">${esc(f.name)}</a><div class="fsub">${esc(f.sidoName)} ${esc(f.sigungu)} · 마감률 ${v}% · 표본 ${num(c)}칸</div></li>`).join('')}</ol>`
    : '<p class="note">표본이 충분한 휴양림이 없어 순위를 보여 주지 않습니다.</p>';

  const days = series.length;
  const histRange = days ? `${fmtYmd(series[0].date)} ~ ${fmtYmd(series[days - 1].date)}` : '없음';
  const seriesBlock = days >= MIN_DAYS_FOR_SERIES
    ? `<div style="overflow-x:auto"><table><thead><tr><th>수집일</th><th>숙소 예약가능 건수</th><th>야영장 예약가능 건수</th><th>휴양림 수</th></tr></thead><tbody>${series
        .map((s) => `<tr><td>${fmtYmd(s.date)}</td><td>${num(s.lodging)}</td><td>${num(s.camp)}</td><td>${s.forests}</td></tr>`).join('')}</tbody></table></div>
<p class="note">수집 이력이 ${days}일뿐입니다. 이 정도로는 늘어나는지 줄어드는지, 계절·요일에 따른 흐름이 있는지 말할 수 없어서 추세를 해석하지 않고 숫자만 보여 드립니다.</p>`
    : '<p class="note">수집 이력이 하루뿐이라 일별 비교를 보여 주지 않습니다.</p>';

  return `<p class="crumb"><a href="/">숲가자</a> › 데이터 인사이트</p>
<h1>자연휴양림 빈자리 데이터 인사이트 (초판)</h1>
<p class="lead">숲가자가 직접 모은 예약 상태를 요일·월·지역별로 집계했습니다. 지금 조회되는 체크인 날짜 ${esc(ctx.rangeText)}의 ${num(n)}칸(휴양림 ${ctx.forestCount}곳의 객실·야영 자리 × 날짜)을 계산했고, 빌드 때마다 새로 계산합니다.</p>
<p class="stamp">마지막 갱신 ${esc(kstTime)} · 출처 숲나들e 월별 예약현황을 숲가자가 집계 · 1박 체크인 기준</p>

<h2>읽기 전에: 기간과 한계</h2>
<ul>
<li><b>집계 시점</b>: ${esc(kstTime)} 수집분 한 시점입니다. 지난 기간의 기록이 아니라 앞으로 날짜의 예약 현황입니다.</li>
<li><b>이력</b>: 일별 요약 이력은 ${days}일치(${histRange})뿐이라 짧습니다.</li>
<li><b>마감률 산식</b>: (예약완료 + 대기) ÷ (예약가능 + 대기 + 예약완료). 휴무·공사·추첨·아직 열리지 않은 칸은 뺍니다. 예약이 열린 정도가 날짜마다 달라서 먼 달일수록 마감률이 낮게 보일 수 있습니다.</li>
<li><b>표본</b>: 칸 수가 ${MIN_CELLS}개 미만인 항목은 비율을 숨기고 "표본 부족"으로 표시합니다.</li>
<li>연휴와 휴양림별 사정은 보정하지 않았고, 아래 값은 원인을 설명하지 않습니다.</li>
</ul>

<h2>요일별 마감률</h2>
<p>${esc(dowSentence(stats.byDow['01'], DOW))}</p>
${dowTable}

<h2>월별 마감률</h2>
<p>체크인 날짜가 속한 달별입니다. 앞쪽 달은 이미 지난 날짜가 빠져 칸이 적고, 뒤쪽 달은 예약이 아직 덜 열려 있어 표본이 적을 수 있습니다.</p>
${monthTable}

<h2>지역별 마감률</h2>
${regionTable}

<h2>마감률이 높은 휴양림 10곳</h2>
<p>표본이 ${MIN_CELLS}칸 이상인 휴양림 중 마감률 순입니다. 객실 수가 적은 곳은 한두 칸에도 값이 크게 변하고, 예약이 일찍 열리는 곳은 높게 나올 수 있습니다. 인기를 직접 재는 값은 아닙니다.</p>
${topList}

<h2>수집 이력</h2>
<p>하루 한 번 마지막 수집 기준으로 쌓은 전국 예약가능 건수 합계입니다.</p>
${seriesBlock}

<h2>출처와 문의</h2>
<p>숲나들e(foresttrip.go.kr)에 로그인 없이 공개된 월별 예약현황을 약 3시간마다 모아 숲가자가 직접 집계한 값입니다. 원자료를 그대로 옮기지 않고 요약한 통계이며, 실제 예약 가능 여부는 <a href="https://www.foresttrip.go.kr" target="_blank" rel="noopener">숲나들e</a>에서 확인하세요. 오류 제보·문의: <a href="mailto:supgaja@gmail.com">supgaja@gmail.com</a></p>
<p><a href="/forest/">휴양림 전체 목록</a> · <a href="/vacancy/all/this-weekend/">이번 주말 빈자리</a> · <a href="/about">소개</a></p>`;
}
