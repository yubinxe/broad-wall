// GET /api/broker/holdings?broker=kis|toss — 관리자 토큰 필수 · 캐시 금지 · 계좌번호 미포함
import { BROKERS, configured, authorized, kisHoldings, tossHoldings } from "../_lib/brokers.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Robots-Tag", "noindex");
  if (req.method !== "GET") return res.status(405).json({ error: "GET 만 허용" });
  const env = process.env;
  if (!authorized(env, req.headers.authorization)) return res.status(401).json({ error: "인증 필요" });
  const k = String(req.query?.broker || "");
  if (!BROKERS[k]) return res.status(400).json({ error: "broker=kis|toss" });
  if (!configured(env, k)) return res.status(409).json({ error: `${BROKERS[k].name} 자격증명이 설정되지 않았습니다` });
  try {
    const holdings = k === "kis" ? await kisHoldings(env) : await tossHoldings(env);
    return res.status(200).json({ broker: k, fetched_at: new Date().toISOString(), holdings });
  } catch (e) { return res.status(502).json({ error: e.message }); }
}
