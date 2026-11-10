// 휴양림 상세 페이지의 '시설 안내' 구역 (이슈 #22).
// 수집된 데이터(숲나들e 객실 목록·요금·정책)만으로 만든다. 외부 소개문·사진·후기는 쓰지 않는다.
// 상위 30곳(src/lib/top-forests.json)에만 붙인다. 표본 검수 통과 전 전체 공개 금지.

const FLAG_LABELS = { a: '에어컨', d: '반려견 동반 가능', e: '전기', w: '온수', h: '장애인 시설', v: '바우처' };
const KIND_NAME = { '01': '숙소', '02': '야영장' };
const UNIT = { '01': '실', '02': '곳' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만원` : `${n.toLocaleString()}원`);
const areaNum = (a) => { const m = /([\d.]+)\s*㎡/.exec(a || ''); return m ? Number(m[1]) : null; };
const range = (xs, fmt, unit = '') => {
  if (!xs.length) return null;
  const lo = Math.min(...xs), hi = Math.max(...xs);
  return lo === hi ? `${fmt(lo)}${unit}` : `${fmt(lo)}~${fmt(hi)}${unit}`;
};
const kstDate = (iso) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10);
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b; };

/** 휴양림 하나의 사실 요약. 숫자와 이름은 모두 f.goods 에서 센다. */
export function forestFacts(f) {
  const goods = (f.goods || []).map((g) => ({ ...g, cls: String(g.cls || '').trim(), name: String(g.name || '').trim() }));
  const kinds = ['01', '02'].filter((k) => goods.some((g) => g.kind === k));
  const byKind = {};
  for (const k of kinds) {
    const gs = goods.filter((g) => g.kind === k);
    const classes = new Map();
    for (const g of gs) {
      if (!classes.has(g.cls)) classes.set(g.cls, []);
      classes.get(g.cls).push(g);
    }
    byKind[k] = { gs, classes };
  }
  return { kinds, byKind, goods };
}

const priced = (gs) => gs.filter((g) => Array.isArray(g.pr) && g.pr.some((p) => p > 0));
const allPrices = (gs) => priced(gs).flatMap((g) => g.pr.filter((p) => p > 0));

/**
 * 고유 문단(본문 요약). 이 휴양림의 이름·객실 이름·수량·인원·면적·요금으로만 이뤄진다.
 * @returns {string} 일반 텍스트(HTML 이스케이프 전)
 */
export function uniqueParagraph(f) {
  const { kinds, byKind } = forestFacts(f);
  // 주소 끝에 휴양림 이름이 이미 있으면 떼어 이름이 두 번 나오지 않게 한다.
  const rawAddr = f.addr || `${f.sidoName} ${f.sigungu}`;
  const where = rawAddr.endsWith(` ${f.name}`) ? rawAddr.slice(0, -f.name.length - 1) : rawAddr;
  const parts = [];
  parts.push(`${f.name}${josa(f.name, '은', '는')} ${where}에 있는 ${f.type} 자연휴양림입니다.`);
  kinds.forEach((k, ki) => {
    const { gs, classes } = byKind[k];
    const cls = [...classes].sort((a, b) => b[1].length - a[1].length).map(([c, xs]) => `${c} ${xs.length}${UNIT[k]}`);
    const shown = cls.slice(0, 4).join(', ') + (cls.length > 4 ? ` 등 ${cls.length}가지 유형` : '');
    // 숲나들e 공개 화면과 다를 수 있다는 단서는 문단에 한 번만 붙인다.
    let s = ki === 0
      ? `숲가자가 수집한 ${KIND_NAME[k]}${k === '01' ? '는' : '은'} ${gs.length}${UNIT[k]}(${shown}) 기준이며 숲나들e 공개 화면과 다를 수 있습니다.`
      : `${KIND_NAME[k]}${k === '01' ? '는' : '은'} ${gs.length}${UNIT[k]}(${shown})입니다.`;
    const top = [...classes].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ko'))[0];
    if (classes.size > 1) s += ` 가장 많은 유형은 ${top[0]}${josa(top[0], '으로', '로')} 전체의 ${Math.round((top[1].length / gs.length) * 100)}%입니다.`;
    // 가장 작은 곳·가장 큰 곳을 이름으로 짚어 곳마다 다른 문장을 만든다.
    const withCap = gs.filter((g) => g.cap > 0);
    const byCap = [...withCap].sort((a, b) => a.cap - b.cap || a.name.localeCompare(b.name, 'ko'));
    const small = byCap[0], biggest = byCap[byCap.length - 1];
    const desc = (g) => `${g.cls} ‘${g.name}’(${g.cap}인${areaNum(g.area) > 0 ? `, ${g.area}` : ''})`;
    if (withCap.length > 1 && small.cap !== biggest.cap) s += ` 가장 작은 곳은 ${desc(small)}, 가장 큰 곳은 ${desc(biggest)}입니다.`;
    const ps = allPrices(gs);
    if (ps.length) {
      const cheapest = [...priced(gs)].sort((a, b) => Math.min(...a.pr.filter((p) => p > 0)) - Math.min(...b.pr.filter((p) => p > 0)) || a.name.localeCompare(b.name, 'ko'))[0];
      const lo = Math.min(...ps), hi = Math.max(...ps);
      const cheapName = `${cheapest.cls} ‘${cheapest.name}’`;
      s += lo === hi ? ` 1박 요금은 ${won(lo)}이고, 예로 ${cheapName}이 있습니다.` : ` 1박 요금은 ${won(lo)}에서 ${won(hi)} 사이이며, 가장 낮은 ${won(lo)}은 ${cheapName}입니다.`;
    }
    parts.push(s);
  });
  return parts.join(' ');
}

/** 이용 팁: 수집 항목(편의 표시·최대 숙박일·입퇴실 시각)에서 확인되는 것만 문장으로 만든다. */
export function usageTips(f) {
  const { kinds, byKind, goods } = forestFacts(f);
  const tips = [];
  const stay = [];
  for (const k of kinds) {
    const nights = byKind[k].gs.map((g) => g.maxNights).filter((n) => n > 0);
    if (nights.length) stay.push(`${KIND_NAME[k]} ${range(nights, (n) => n, '박')}`);
  }
  if (f.checkin || f.checkout) tips.push(`입실 ${f.checkin || '확인 필요'}, 퇴실 ${f.checkout || '확인 필요'}로 안내돼 있습니다${stay.length ? `. 한 번에 예약할 수 있는 기간은 ${stay.join(', ')}까지입니다` : ''}.`);
  else if (stay.length) tips.push(`한 번에 예약할 수 있는 기간은 ${stay.join(', ')}까지입니다.`);
  const total = goods.length;
  const parts = [];
  for (const [fl, label] of Object.entries(FLAG_LABELS)) {
    const n = goods.filter((g) => (g.flags || '').includes(fl)).length;
    if (n) parts.push(n === total ? `${label} 전체 ${n}개` : `${label} ${n}개`);
  }
  if (parts.length) tips.push(`수집한 객실·사이트 ${total}개 중 편의 표시가 있는 곳은 ${parts.join(', ')}입니다.`);
  return tips;
}

function classTable(f) {
  const { kinds, byKind } = forestFacts(f);
  const rows = [];
  for (const k of kinds) {
    for (const [cls, gs] of [...byKind[k].classes].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ko'))) {
      const caps = gs.map((g) => g.cap).filter((n) => n > 0);
      const areas = gs.map((g) => areaNum(g.area)).filter((n) => n);
      const ps = allPrices(gs);
      rows.push(`<tr><td>${KIND_NAME[k]}</td><td>${esc(cls)}</td><td>${gs.length}${UNIT[k]}</td><td>${caps.length ? range(caps, (n) => n, '인') : '-'}</td><td class="hide-sm">${areas.length ? range(areas, (n) => n, '㎡') : '-'}</td><td>${ps.length ? esc(range(ps, won)) : '-'}</td></tr>`);
    }
  }
  return `<table><thead><tr><th>구분</th><th>유형</th><th>수량</th><th>인원</th><th class="hide-sm">면적</th><th>1박 요금 범위</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

/**
 * 상세 페이지에 넣는 HTML 구역.
 * @param {object} f 수집 데이터의 휴양림
 * @param {string} generatedAt 수집 시각(ISO)
 */
export function detailSection(f, generatedAt) {
  const tips = usageTips(f);
  const day = kstDate(generatedAt);
  return `<section id="guide" aria-labelledby="guide-h"><h2 id="guide-h">${esc(f.name)} 시설 안내</h2>
<p>${esc(uniqueParagraph(f))}</p>
${classTable(f)}
${tips.length ? `<h3 style="font-size:1rem;margin:20px 0 6px">이용 전 확인할 점</h3><ul>${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
<p class="fsub">출처: 숲나들e에 공개된 객실 목록·요금표·예약정책. 확인일 ${day}(수집일). 요금은 비수기·성수기, 평일·주말 4가지 중 등록된 값의 최저~최고이며 실제 결제 금액은 숲나들e에서 확인하세요. 이 사이트는 숲나들e와 무관한 비공식 안내이며, 위 내용은 수집 데이터를 정리한 것으로 숲가자가 수집한 객실·사이트 기준이라 수련장·강의실 등 일부 시설이 빠졌을 수 있고, 시설·날짜에 따라 입퇴실 시각과 객실별 표시가 다를 수 있습니다. 외부 소개문·사진은 쓰지 않았습니다.</p></section>`;
}
