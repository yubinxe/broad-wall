// GET /api/quotes?symbols=AAPL,005930 — 관심종목 현재가 + 국내 지수 + 기준 환율(ECB, 일간)
// 토스증권 키가 있고 통하면 토스, 아니면(미등록·허용 IP 차단 등) 공개 시세(네이버·Yahoo)로 채운다. 키·계좌 정보는 응답에 넣지 않는다.
import { configured, tossPrices } from "./_lib/brokers.js";
import { publicPrices, publicIndices } from "./_lib/public.js";
const SYM = /^[A-Za-z0-9.\-]{1,12}$/;
export async function quotes(env, syms, fetchFn = fetch) {
  const out = { fetched_at: new Date().toISOString(), live: false, source: null, prices: [], indicators: [], fx: null, errors: [] }, toss = configured(env, "toss");
  await Promise.all([
    (async () => { try { const r = await fetchFn("https://api.frankfurter.dev/v1/latest?from=USD&to=KRW,JPY,EUR", { signal: AbortSignal.timeout(5000) }); const j = await r.json(); out.fx = { date: j.date, base: "USD", rates: j.rates, src: "ECB 기준환율(일간, Frankfurter)" }; } catch (e) { out.errors.push("환율: " + e.message); } })(),
    (async () => { if (toss) try { out.prices = (await tossPrices(env, syms, {}, fetchFn)).map((p) => ({ ...p, src: "토스증권" })); } catch (e) { out.errors.push(e.message); } })(),
    (async () => { if (toss) try { out.indicators = (await tossPrices(env, ["KOSPI", "KOSDAQ"], { indicators: true }, fetchFn)).map((p) => ({ ...p, src: "토스증권" })); } catch (e) { out.errors.push(e.message); } })(),
  ]);
  const have = new Set(out.prices.map((p) => p.symbol)), miss = syms.filter((s) => !have.has(s));
  await Promise.all([
    miss.length && publicPrices(miss, fetchFn).then((r) => { out.prices.push(...r.prices); out.errors.push(...r.errors); }),
    !out.indicators.length && publicIndices(fetchFn).then((r) => (out.indicators = r), (e) => out.errors.push(e.message)),
  ]);
  const srcs = [...new Set([...out.prices, ...out.indicators].map((p) => p.src))];
  out.live = srcs.length > 0; out.source = srcs.join(" · ") || null; out.errors = [...new Set(out.errors)];
  return out;
}
export default async function handler(req, res) {
  const syms = String(req.query?.symbols || "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYM.test(s)).slice(0, 20);
  const out = await quotes(process.env, syms);
  res.setHeader("cache-control", out.live ? "public, s-maxage=30, stale-while-revalidate=60" : "public, s-maxage=600");
  res.status(200).json(out);
}
