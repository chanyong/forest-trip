// Aside REPL 스크립트: 로그인된 숲나들e 탭에서 시도별 휴양림·객실 마스터를 수집한다.
// 사용: aside repl "$(cat master.repl.js)" 로 시작한 뒤, master.poll.js 로 결과를 가져온다.
// evaluate 30초 제한 때문에 페이지 안에서 백그라운드로 돌리고 window.__master 에 쌓는다.
const tM = (await listBrowserTabs()).find(x => x.url.includes('foresttrip.go.kr/rep/or/sssn/monthRsrvtStatus'));
const pM = tM ? await attachBrowserTab(tM.targetId)
  : await openTab('https://www.foresttrip.go.kr/rep/or/sssn/monthRsrvtStatus.do?hmpgId=FRIP&menuId=001004');
await pM.evaluate(() => { window.__master = { done: false, sidos: {}, log: [] }; (async () => { for (const sido of ['1','2','3','4','5','6','7','8','9']) { window.__master.sidos[sido] = await (async (sido) => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const post = (u, d) => new Promise((res, rej) => $.ajax({
    url: u, type: 'post', dataType: 'json',
    beforeSend: x => x.setRequestHeader('X-Ajax-call', 'true'),
    data: JSON.stringify(d), success: res, error: x => rej(new Error(u + ' ' + x.status)),
  }));
  const nf = () => new Promise(res => NetFunnel_Action({ action_id: 'action8', service_id: 'service_1' },
    { success: (ev, ret) => res(ret.data.key), error: () => res(null), stop: () => res(null) }));
  const today = new Date().toISOString().slice(0, 7).replace('-', '');
  const forests = [];
  const instts = await post('/rep/or/selectInsttListForMonthRsrvt.do', { srchSido: sido });
  for (const it of instts) {
    const f = { insttId: it.insttId, name: it.insttNm, sido, types: {} };
    try {
      const sth = await post('/rep/or/selectSthngListForMonthRsrvt.do', { insttId: it.insttId });
      f.lastDay = sth.rsrvtPolcy?.monthLastDay || null;
      if (sth.gnrlRsrvtTrnseDtm && (!f.lastDay || sth.gnrlRsrvtTrnseDtm > f.lastDay)) f.lastDay = sth.gnrlRsrvtTrnseDtm;
      for (const s of sth.sthngList || []) {
        const code = s.upperGoodsClsscCd || s.goodsClsscCd;
        if (!code) continue;
        const key = await nf();
        const g = await post('/rep/or/sssn/selectRsrvtGoodsListForMonthRsrvt.do', {
          insttId: it.insttId, upperGoodsClsscCd: code, inqurSctin: '01',
          srchDate: today, lastDay: f.lastDay, netfunnelKey: key,
        });
        NetFunnel_Complete();
        f.types[code] = (g.rsrvtGoodsList || []).map(x => x.goodsId);
        await sleep(400);
      }
    } catch (e) { f.error = String(e.message || e); }
    forests.push(f);
  }
  return forests;
})(sido); window.__master.log.push('done ' + sido); } window.__master.done = true; })().catch(e => { window.__master.error = String(e); window.__master.done = true; }); });
console.log('started');
