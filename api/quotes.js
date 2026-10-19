// GET /api/quotes?symbols=AAPL,005930 — 관심종목 현재가(토스증권, 자격증명 등록 시) + 기준 환율(ECB, 일간)
// 키·계좌 정보는 응답에 넣지 않는다. 종목은 최대 20개, 30초 캐시.
import { configured, tossPrices } from "./_lib/brokers.js";
const SYM = /^[A-Za-z0-9.\-]{1,12}$/;
export default async function handler(req, res) {
  const env = process.env, syms = String(req.query?.symbols || "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYM.test(s)).slice(0, 20);
  const out = { fetched_at: new Date().toISOString(), live: configured(env, "toss"), prices: [], indicators: [], fx: null, errors: [] };
  await Promise.all([
    (async () => { try { const r = await fetch("https://api.frankfurter.dev/v1/latest?from=USD&to=KRW,JPY,EUR", { signal: AbortSignal.timeout(5000) }); const j = await r.json(); out.fx = { date: j.date, base: "USD", rates: j.rates, src: "ECB 기준환율(일간, Frankfurter)" }; } catch (e) { out.errors.push("환율: " + e.message); } })(),
    out.live && (async () => { try { out.prices = await tossPrices(env, syms); } catch (e) { out.errors.push(e.message); } })(),
    out.live && (async () => { try { out.indicators = await tossPrices(env, ["KOSPI", "KOSDAQ"], { indicators: true }); } catch (e) { out.errors.push(e.message); } })(),
  ]);
  res.setHeader("cache-control", out.live ? "public, s-maxage=30, stale-while-revalidate=60" : "public, s-maxage=600");
  res.status(200).json({ ...out, errors: [...new Set(out.errors)] });
}
