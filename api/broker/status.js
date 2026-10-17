// GET /api/broker/status — 설정 여부만(값은 절대 반환하지 않음)
import { BROKERS, configured } from "../_lib/brokers.js";
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const env = process.env;
  res.status(200).json({
    checked_at: new Date().toISOString(),
    auth: !!(env.MERIDIAN_ADMIN_TOKEN && env.MERIDIAN_ADMIN_TOKEN.length >= 16),
    brokers: Object.fromEntries(Object.entries(BROKERS).map(([k, b]) => [k, { name: b.name, configured: configured(env, k), note: b.note }])),
    quotes: "월간 공개 데이터(지연) — 실시간 시세 없음",
  });
}
