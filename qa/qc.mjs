// 숲빈자리 오픈 전 통합 QC 자동 점검
import { chromium, webkit, firefox } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = new URL('./out/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const axeSrc = fs.readFileSync(new URL('./node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const issues = [];
const log = (sev, area, where, msg) => { issues.push({ sev, area, where, msg }); console.log(`[${sev}] ${area} | ${where} | ${msg}`); };
const VIEWS = ['table', 'map', 'calendar', 'grid'];

const VP = {
  'PC 1920': { viewport: { width: 1920, height: 1080 } },
  'PC 1440': { viewport: { width: 1440, height: 900 } },
  'PC 2560': { viewport: { width: 2560, height: 1440 } },
  'PC 1280': { viewport: { width: 1280, height: 720 } },
  'PC 1920@125%': { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 },
  'iPhone SE': { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'iPhone 15': { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  'iPhone Pro Max': { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  'Galaxy S': { viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  'Fold 커버': { viewport: { width: 344, height: 882 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  'Fold 펼침': { viewport: { width: 690, height: 838 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
  'iPad 세로': { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'iPad 가로': { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  '폰 가로': { viewport: { width: 852, height: 393 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const ENGINES = { chromium, webkit, firefox };
const MATRIX = process.env.QUICK
  ? [['chromium', ['PC 1440', 'iPhone 15']]]
  : [
      ['chromium', Object.keys(VP)],
      ['webkit', ['PC 1440', 'iPhone SE', 'iPhone 15', 'iPad 세로', '폰 가로']],
      ['firefox', ['PC 1920', 'PC 1280', 'Galaxy S']],
    ];

async function pageChecks(p, eng, vpName, opt) {
  const touch = !!opt.hasTouch;
  for (const v of VIEWS) {
    const where = `${eng}/${vpName}/${v}`;
    const errs = [];
    const onErr = (e) => errs.push(String(e.message || e));
    const onCon = (m) => { if (m.type() === 'error') errs.push(m.text()); };
    p.on('pageerror', onErr); p.on('console', onCon);
    await p.goto(`${BASE}/?view=${v}&sidos=1`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(v === 'map' ? 2000 : 500);
    p.off('pageerror', onErr); p.off('console', onCon);
    for (const e of errs) if (!/maplibre|webgl|Failed to load resource.*tiles/i.test(e)) log('Major', '기능', where, `콘솔 오류: ${e.slice(0, 160)}`);
    const r = await p.evaluate((touch) => {
      const out = {};
      out.hscroll = document.documentElement.scrollWidth - innerWidth;
      // 화면 밖으로 넘치는 요소(가로 스크롤 영역 안은 제외)
      const inScroller = (el) => { for (let e = el.parentElement; e; e = e.parentElement) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowX)) return true; } return false; };
      out.overflow = [...document.querySelectorAll('main *')].filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.right > innerWidth + 1 && !inScroller(el);
      }).slice(0, 5).map((el) => el.className || el.tagName);
      if (touch) {
        out.small = [...document.querySelectorAll('button, a, select, input, [role=button], label.dd-opt')].filter((el) => {
          const b = el.getBoundingClientRect(); const s = getComputedStyle(el);
          if (!b.width || s.visibility === 'hidden' || el.closest('.maplibregl-ctrl-attrib,.gscroll,.cal-grid')) return false;
          if (el.matches('input[type=checkbox]') && el.closest('label')) return false;
          return b.height < 44 || b.width < 24;
        }).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}(${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)})`);
      }
      const hdr = document.querySelector('.top');
      out.hdrTop = hdr ? hdr.getBoundingClientRect().top : 0;
      return out;
    }, touch);
    if (r.hscroll > 0) log('Major', '반응형', where, `가로 스크롤 ${r.hscroll}px`);
    if (r.overflow.length) log('Minor', '반응형', where, `화면 밖 요소: ${r.overflow.join(', ')}`);
    if (r.small?.length) log('Minor', '터치', where, `44px 미만 터치 영역 ${r.small.length}개: ${[...new Set(r.small)].slice(0, 6).join(' ')}`);
    await p.screenshot({ path: `${OUT}${eng}_${vpName.replace(/[^\w가-힣]+/g, '_')}_${v}.png` });
    if (eng === 'chromium' && (vpName === 'PC 1440' || vpName === 'iPhone 15')) {
      for (const dark of [false, true]) {
        await p.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
        await p.addScriptTag({ content: axeSrc });
        const vio = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })).violations.map((x) => `${x.id}(${x.nodes.length}): ${x.nodes[0].target.join(' ')}`));
        for (const x of vio) log('Major', '접근성', `${where}${dark ? '/dark' : ''}`, `axe ${x}`);
      }
      await p.emulateMedia({ colorScheme: 'light' });
    }
  }
}

async function interactionChecks(b) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  const p = await ctx.newPage();
  const W = 'chromium/PC 1440';
  await p.goto(`${BASE}/?sidos=1`, { waitUntil: 'networkidle' });

  // 본문 바로가기
  await p.keyboard.press('Tab');
  const first = await p.evaluate(() => ({ t: document.activeElement?.textContent?.trim(), h: document.activeElement?.getAttribute('href') }));
  if (!/본문/.test(first.t || '')) log('Major', '접근성', W, `첫 Tab 초점이 본문 바로가기가 아님: "${first.t}"`);

  // 초점 표시 확인
  const outline = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 || s.boxShadow !== 'none'; });
  if (!outline) log('Major', '접근성', W, '초점 외곽선이 보이지 않음');

  // 탭 메뉴 방향키
  await p.focus('[role=tab][aria-selected=true]');
  await p.keyboard.press('ArrowRight');
  const tabSel = await p.evaluate(() => document.querySelector('[role=tab][aria-selected=true]')?.textContent);
  if (tabSel !== '지도') log('Minor', '접근성', W, `탭 메뉴에서 → 키로 다음 탭 이동 안 됨 (${tabSel})`);
  const tabpanel = await p.evaluate(() => !!document.querySelector('[role=tabpanel]'));
  if (!tabpanel) log('Minor', '접근성', W, 'role=tabpanel / aria-controls 연결 없음');
  await p.goto(`${BASE}/?sidos=1`, { waitUntil: 'networkidle' });

  // 드롭다운 키보드: Enter 열기, Esc 닫기 후 버튼으로 초점 복귀
  await p.focus('.dd-btn');
  await p.keyboard.press('Enter');
  const ddOpen = await p.isVisible('.dd-pop');
  await p.keyboard.press('Escape');
  const ddBack = await p.evaluate(() => document.activeElement?.classList.contains('dd-btn'));
  if (!ddOpen) log('Major', '접근성', W, '드롭다운이 Enter로 열리지 않음');
  if (!ddBack) log('Minor', '접근성', W, '드롭다운 Esc 후 초점이 버튼으로 돌아오지 않음');

  // 모달(상세) 초점 트랩·복귀·뒤로가기
  const opener = p.locator('.ftable .fname').first();
  await opener.focus();
  await p.keyboard.press('Enter');
  await p.waitForSelector('.drawer', { timeout: 5000 });
  let escaped = 0;
  for (let i = 0; i < 60; i++) { await p.keyboard.press('Tab'); if (!(await p.evaluate(() => !!document.activeElement?.closest('.drawer')))) escaped++; }
  if (escaped) log('Major', '접근성', W, `상세 팝업에서 Tab 초점이 ${escaped}번 팝업 밖으로 나감 (초점 트랩 없음)`);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  const back = await p.evaluate(() => document.activeElement?.classList.contains('fname'));
  if (!back) log('Major', '접근성', W, '상세 팝업을 닫은 뒤 초점이 연 버튼으로 돌아오지 않음');

  // 뒤로가기: 상세 열고 브라우저 뒤로 → 팝업만 닫히고 필터 유지
  await p.locator('.ftable .fname').first().click();
  await p.waitForSelector('.drawer');
  await p.goBack();
  await p.waitForTimeout(400);
  const st = await p.evaluate(() => ({ drawer: !!document.querySelector('.drawer'), url: location.search }));
  if (st.drawer) log('Major', 'UX', W, '상세 팝업이 열린 상태에서 뒤로가기 해도 팝업이 닫히지 않음');
  if (!/sidos=1/.test(st.url)) log('Major', 'UX', W, `뒤로가기 후 필터 사라짐 (${st.url})`);

  // 특수문자 검색
  for (const q of [`'"<>&`, '<script>alert(1)</script>', '%%%', '   ']) {
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${BASE}/?q=${encodeURIComponent(q)}`, { waitUntil: 'networkidle' });
    for (const v of VIEWS) { await p.click(`[role=tab]:has-text("${{ table: '목록', map: '지도', calendar: '달력', grid: '월간 그리드' }[v]}")`); await p.waitForTimeout(300); }
    if (errs.length) log('Critical', '기능', W, `검색어 ${q} 입력 시 오류: ${errs[0]}`);
  }

  // 빈 결과 상태
  for (const v of VIEWS) {
    await p.goto(`${BASE}/?view=${v}&q=없는휴양림zz`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(v === 'map' ? 1500 : 300);
    const has = await p.evaluate(() => { const e = document.querySelector('.empty'); return e ? { t: e.textContent, btn: !!e.querySelector('button') } : null; });
    if (!has) log('Minor', 'UX', `${W}/${v}`, '검색 결과 0건일 때 빈 화면 안내 없음');
    else if (!has.btn) log('Cosmetic', 'UX', `${W}/${v}`, '빈 결과 안내에 다음 행동(조건 초기화) 버튼 없음');
  }

  // 데이터 로드 실패
  const p2 = await ctx.newPage();
  await p2.route('**/data/status.json', (r) => r.abort());
  await p2.goto(BASE, { waitUntil: 'networkidle' });
  const errUi = await p2.evaluate(() => ({ t: document.querySelector('.loading')?.textContent || '', btn: !!document.querySelector('.loading button') }));
  if (!errUi.btn) log('Minor', 'UX', W, `데이터 로드 실패 시 다시 시도 버튼 없음 ("${errUi.t.slice(0, 40)}")`);
  // 로딩 상태
  const p3 = await ctx.newPage();
  await p3.route('**/data/status.json', async (r) => { await new Promise((s) => setTimeout(s, 1500)); await r.continue(); });
  await p3.goto(BASE, { waitUntil: 'commit' });
  await p3.waitForTimeout(700);
  const skel = await p3.evaluate(() => !!document.querySelector('.skeleton, .loading'));
  if (!skel) log('Minor', 'UX', W, '로딩 중 표시 없음');

  // 404 페이지
  const res = await p.goto(`${BASE}/no-such-page`, { waitUntil: 'networkidle' });
  const body404 = await p.evaluate(() => document.body.innerText.slice(0, 200));
  if (res.status() !== 404) log('Minor', '운영', W, `없는 주소 응답 코드 ${res.status()} (404 아님)`);
  if (!/홈|숲빈자리/.test(body404)) log('Minor', '운영', W, `전용 404 페이지 없음: "${body404.slice(0, 60)}"`);

  // SEO·메타
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const meta = await p.evaluate(() => {
    const g = (s) => document.querySelector(s)?.getAttribute('content') || document.querySelector(s)?.getAttribute('href') || '';
    return {
      title: document.title, desc: g('meta[name=description]'), ogt: g('meta[property="og:title"]'), ogd: g('meta[property="og:description"]'),
      ogi: g('meta[property="og:image"]'), ogu: g('meta[property="og:url"]'), tw: g('meta[name="twitter:card"]'), can: g('link[rel=canonical]'),
      icon: g('link[rel=icon]'), apple: g('link[rel=apple-touch-icon]'), theme: g('meta[name=theme-color]'), vp: g('meta[name=viewport]'),
      h: [...document.querySelectorAll('h1,h2,h3,h4')].map((e) => e.tagName).join(''), landmarks: ['header', 'nav', 'main', 'footer'].filter((t) => !document.querySelector(t)),
    };
  });
  for (const [k, label] of [['ogi', 'og:image'], ['ogu', 'og:url'], ['tw', 'twitter:card'], ['can', 'canonical'], ['apple', 'apple-touch-icon'], ['theme', 'theme-color']]) if (!meta[k]) log('Minor', 'SEO', W, `${label} 없음`);
  if (!/viewport-fit=cover/.test(meta.vp)) log('Minor', '모바일', W, 'viewport-fit=cover 없음 (노치/Safe Area 대응)');
  if (meta.landmarks.length) log('Minor', '접근성', W, `랜드마크 없음: ${meta.landmarks.join(',')}`);
  if (/H1H3|H2H4|H1H4/.test(meta.h)) log('Minor', '접근성', W, `헤딩 순서 건너뜀: ${meta.h.slice(0, 40)}`);
  for (const f of ['robots.txt', 'sitemap.xml']) {
    const rr = await p.request.get(`${BASE}/${f}`);
    const txt = await rr.text();
    if (!rr.ok() || /<!doctype html/i.test(txt)) log('Minor', 'SEO', W, `${f} 없음`);
  }
  if (meta.ogi) { const rr = await p.request.get(new URL(meta.ogi, BASE).href); if (!rr.ok()) log('Major', 'SEO', W, `og:image 깨짐 ${rr.status()}`); }

  // 링크 전수 검사(상세 팝업 포함)
  const hrefs = new Set();
  const grab = async () => (await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href))).forEach((h) => hrefs.add(h));
  await grab();
  await p.locator('.ftable .fname').first().click(); await p.waitForSelector('.drawer'); await grab();
  // 같은 호스트는 최대 3개만, 간격을 두고 검사(429 요청 제한 회피)
  const perHost = {};
  for (const h of hrefs) {
    const host = (() => { try { return new URL(h).host; } catch { return ''; } })();
    if (host && !host.includes('localhost') && (perHost[host] = (perHost[host] || 0) + 1) > 3) continue;
    await new Promise((s) => setTimeout(s, 400));
    if (/^(tel|mailto):/.test(h)) { if (!/^tel:[\d-]+$|^mailto:.+@/.test(h)) log('Minor', '링크', W, `형식 오류 ${h}`); continue; }
    if (/^javascript:|#$/.test(h)) { log('Minor', '링크', W, `임시 링크 ${h}`); continue; }
    try {
      const rr = await fetch(h, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (rr.status === 429) console.log(`  (요청 제한 429, 링크 판정 보류) ${h}`);
      else if (rr.status === 401 && h.includes('foresttrip.go.kr/rep/or/sssn/')) console.log(`  (로그인 필요 페이지, 정상) ${h}`);
      else if (rr.status >= 400) log('Major', '링크', W, `깨진 링크 ${rr.status} ${h}`);
    } catch (e) { log('Major', '링크', W, `접속 실패 ${h} ${e.message}`); }
  }
  console.log(`링크 ${hrefs.size}개 검사`);

  // 혼합 콘텐츠
  const http = await p.evaluate(() => [...document.querySelectorAll('[src],[href]')].map((e) => e.src || e.href).filter((u) => /^http:\/\//.test(u)));
  if (BASE.startsWith('https')) for (const u of http) log('Major', '보안', W, `http 리소스 ${u}`);

  // 한글 줄바꿈
  const wb = await p.evaluate(() => getComputedStyle(document.body).wordBreak);
  if (wb !== 'keep-all') log('Cosmetic', '디자인', W, `word-break: ${wb} (keep-all 권장)`);
  // 커서
  const cur = await p.evaluate(() => [...document.querySelectorAll('button:not(:disabled), a, select, [role=tab], .pin, label.dd-opt')].filter((e) => getComputedStyle(e).cursor !== 'pointer').map((e) => e.className || e.tagName).slice(0, 5));
  if (cur.length) log('Cosmetic', 'PC', W, `pointer 커서 아닌 클릭 요소: ${cur.join(', ')}`);
  await ctx.close();

  // 모바일 상세 팝업: 닫기 버튼과 Safe Area, 가로 모드
  for (const [name, o] of [['iPhone 15', VP['iPhone 15']], ['폰 가로', VP['폰 가로']]]) {
    const c = await b.newContext({ ...o, locale: 'ko-KR' });
    const q = await c.newPage();
    await q.goto(`${BASE}/?sidos=1`, { waitUntil: 'networkidle' });
    await q.locator('.ftable .fname').first().click();
    await q.waitForSelector('.drawer');
    const close = await q.evaluate(() => { const b = document.querySelector('.drawer [aria-label=닫기]').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.right <= innerWidth; });
    if (!close) log('Major', '모바일', `chromium/${name}`, '상세 팝업 닫기 버튼이 화면 밖');
    await q.screenshot({ path: `${OUT}drawer_${name.replace(/[^\w가-힣]+/g, '_')}.png` });
    await c.close();
  }
}

const t0 = Date.now();
for (const [eng, vps] of MATRIX) {
  const b = await ENGINES[eng].launch();
  for (const vp of vps) {
    const ctx = await b.newContext({ ...VP[vp], locale: 'ko-KR' }).catch(async () => b.newContext({ ...VP[vp], isMobile: undefined, locale: 'ko-KR' }));
    const p = await ctx.newPage();
    try { await pageChecks(p, eng, vp, VP[vp]); } catch (e) { log('Critical', '기능', `${eng}/${vp}`, `점검 중 실패: ${e.message.slice(0, 200)}`); }
    await ctx.close();
  }
  if (eng === 'chromium') await interactionChecks(b);
  await b.close();
}
fs.writeFileSync(`${OUT}issues.json`, JSON.stringify(issues, null, 1));
const by = issues.reduce((m, i) => ((m[i.sev] = (m[i.sev] || 0) + 1), m), {});
console.log(`\n완료 ${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(by));
