// 키 없이 받는 공개 시세(토스 미연결·차단 시 대체) — 국내 6자리 종목·지수는 네이버 증권, 미국 티커는 Yahoo Finance 차트.
// 둘 다 공식 공개 API가 아니므로 응답 형식이 바뀌면 조용히 빠지고, 화면에는 출처와 '지연 가능'을 함께 적는다.
const UA = { "user-agent": "Mozilla/5.0 (compatible; BroadWallReader/1.0)" };
const n = (v) => { const x = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(x) ? x : null; };
export const isKR = (s) => /^[0-9][0-9A-Z]{5}$/.test(s);
async function naver(kind, codes, fetchFn) {
  if (!codes.length) return [];
  const r = await fetchFn(`https://polling.finance.naver.com/api/realtime/domestic/${kind}/${codes.join(",")}`, { headers: UA, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`네이버 시세 ${r.status}`);
  const j = await r.json();
  return (j.datas || []).map((d) => ({ symbol: d.itemCode, name: d.stockName || null, price: n(d.closePrice), chg: n(d.fluctuationsRatio) == null ? null : n(d.fluctuationsRatio) / 100, currency: kind === "stock" ? "KRW" : null, at: d.localTradedAt || null, src: "네이버" })).filter((p) => p.price != null);
}
async function yahoo(sym, fetchFn) {
  const r = await fetchFn(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`, { headers: UA, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`Yahoo ${sym} ${r.status}`);
  const m = (await r.json())?.chart?.result?.[0]?.meta; const price = n(m?.regularMarketPrice); if (price == null) return null;
  const prev = n(m.previousClose) ?? n(m.chartPreviousClose), pct = n(m.regularMarketChangePercent);
  return { symbol: sym, name: null, price, chg: pct != null ? pct / 100 : prev ? price / prev - 1 : null, currency: m.currency || null, at: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null, src: "Yahoo" };
}
export async function publicPrices(symbols, fetchFn = fetch) {
  const errors = [], kr = symbols.filter(isKR), us = symbols.filter((s) => !isKR(s));
  const [a, b] = await Promise.all([
    naver("stock", kr, fetchFn).catch((e) => (errors.push(e.message), [])),
    Promise.all(us.map((s) => yahoo(s, fetchFn).catch((e) => (errors.push(e.message), null)))),
  ]);
  return { prices: [...a, ...b.filter(Boolean)], errors };
}
export const publicIndices = (fetchFn = fetch) => naver("index", ["KOSPI", "KOSDAQ"], fetchFn);
