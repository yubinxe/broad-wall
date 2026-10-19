// GET /api/quotes?symbols=AAPL,005930 — 관심종목 현재가 + 국내 지수 + 기준 환율(ECB, 일간)
// 증권사 계좌·API 연동 없음 — 공개 시세(국내 네이버 · 미국 Yahoo)만 쓴다. 개인 정보·키를 다루지 않는다.
import { publicPrices, publicIndices } from "./_lib/public.js";
const SYM = /^[A-Za-z0-9.\-]{1,12}$/;
export async function quotes(syms, fetchFn = fetch) {
  const out = { fetched_at: new Date().toISOString(), live: false, source: null, prices: [], indicators: [], fx: null, errors: [] };
  await Promise.all([
    (async () => { try { const r = await fetchFn("https://api.frankfurter.dev/v1/latest?from=USD&to=KRW,JPY,EUR", { signal: AbortSignal.timeout(5000) }); const j = await r.json(); out.fx = { date: j.date, base: "USD", rates: j.rates, src: "ECB 기준환율(일간, Frankfurter)" }; } catch (e) { out.errors.push("환율: " + e.message); } })(),
    syms.length && publicPrices(syms, fetchFn).then((r) => { out.prices = r.prices; out.errors.push(...r.errors); }),
    publicIndices(fetchFn).then((r) => (out.indicators = r), (e) => out.errors.push(e.message)),
  ]);
  const srcs = [...new Set([...out.prices, ...out.indicators].map((p) => p.src))];
  out.live = srcs.length > 0; out.source = srcs.join(" · ") || null; out.errors = [...new Set(out.errors)];
  return out;
}
export default async function handler(req, res) {
  const syms = String(req.query?.symbols || "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYM.test(s)).slice(0, 20);
  const out = await quotes(syms);
  res.setHeader("cache-control", out.live ? "public, s-maxage=30, stale-while-revalidate=60" : "public, s-maxage=600");
  res.status(200).json(out);
}
