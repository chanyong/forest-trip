// 백그라운드 마스터 수집 상태/결과 조회
const tP = (await listBrowserTabs()).find(x => x.url.includes('foresttrip.go.kr/rep/or/sssn/monthRsrvtStatus'));
const pP = await attachBrowserTab(tP.targetId);
const stP = await pP.evaluate(() => JSON.stringify(window.__master || null));
console.log('@@' + stP);
