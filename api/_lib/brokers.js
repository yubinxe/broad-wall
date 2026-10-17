// 증권사 보유 조회 — 서버 전용. 키는 환경변수에만 두고, 응답에 계좌번호·키를 넣지 않는다.
// KIS 규격: koreainvestment/open-trading-api (공식 GitHub) examples_llm/domestic_stock/inquire_balance 대조
// 토스증권 규격: 공식 OpenAPI 3.0 (https://openapi.tossinvest.com/openapi-docs/latest/openapi.json, 2026-10-17 대조)
//   POST /oauth2/token(form) → GET /api/v1/accounts(result[].accountSeq) → GET /api/v1/holdings(헤더 X-Tossinvest-Account=accountSeq, result.items[])
import { timingSafeEqual } from "node:crypto";

export const BROKERS = {
  kis: { name: "한국투자증권 (KIS Developers)", env: ["KIS_APP_KEY", "KIS_APP_SECRET", "KIS_ACCOUNT"], note: "국내주식 잔고조회 TTTC8434R · 모의 VTTC8434R · 실전 1회 50건(연속조회)" },
  toss: { name: "토스증권 Open API", env: ["TOSS_CLIENT_ID", "TOSS_CLIENT_SECRET"], note: "국내·미국 주식 보유 조회(종합매매 계좌) · 토큰 24시간 · 재발급 시 이전 토큰 무효" },
};
export const configured = (env, k) => BROKERS[k].env.every((n) => !!env[n]);

export function authorized(env, header) {
  const want = env.MERIDIAN_ADMIN_TOKEN; if (!want || want.length < 16) return false;
  const got = String(header || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

const num = (v) => { const n = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
let kisToken = null; // { value, exp } — 인스턴스 메모리 캐시(발급 빈도 제한 대응)

export async function kisHoldings(env, fetchFn = fetch) {
  const real = (env.KIS_ENV || "real") !== "mock";
  const base = real ? "https://openapi.koreainvestment.com:9443" : "https://openapivts.koreainvestment.com:29443";
  const [cano, prod] = String(env.KIS_ACCOUNT).replace(/\s/g, "").split("-");
  if (!/^\d{8}$/.test(cano || "") || !/^\d{2}$/.test(prod || "")) throw new Error("KIS_ACCOUNT 형식은 8자리-2자리");
  if (!kisToken || kisToken.exp < Date.now() + 60_000) {
    const r = await fetchFn(`${base}/oauth2/tokenP`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant_type: "client_credentials", appkey: env.KIS_APP_KEY, appsecret: env.KIS_APP_SECRET }) });
    const j = await r.json(); if (!r.ok || !j.access_token) throw new Error("KIS 토큰 발급 실패");
    kisToken = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  }
  const out = []; let fk = "", nk = "", trCont = "";
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams({ CANO: cano, ACNT_PRDT_CD: prod, AFHR_FLPR_YN: "N", OFL_YN: "", INQR_DVSN: "02", UNPR_DVSN: "01", FUND_STTL_ICLD_YN: "N", FNCG_AMT_AUTO_RDPT_YN: "N", PRCS_DVSN: "00", CTX_AREA_FK100: fk, CTX_AREA_NK100: nk });
    const r = await fetchFn(`${base}/uapi/domestic-stock/v1/trading/inquire-balance?${q}`, { headers: { "content-type": "application/json; charset=utf-8", authorization: `Bearer ${kisToken.value}`, appkey: env.KIS_APP_KEY, appsecret: env.KIS_APP_SECRET, tr_id: real ? "TTTC8434R" : "VTTC8434R", tr_cont: trCont, custtype: "P" } });
    const j = await r.json(); if (!r.ok || j.rt_cd !== "0") throw new Error("KIS 잔고조회 실패: " + (j.msg1 || r.status));
    for (const it of j.output1 || []) { const qty = num(it.hldg_qty); if (!qty) continue; out.push({ code: it.pdno, name: it.prdt_name, qty, avg: num(it.pchs_avg_pric), price: num(it.prpr), ccy: "KRW", cls: "EQ" }); }
    if (!["F", "M"].includes(r.headers.get?.("tr_cont"))) break; // 연속조회 없음
    fk = j.ctx_area_fk100 || ""; nk = j.ctx_area_nk100 || ""; trCont = "N";
  }
  return out;
}

let tossToken = null;
export async function tossHoldings(env, fetchFn = fetch) {
  const base = "https://openapi.tossinvest.com";
  if (!tossToken || tossToken.exp < Date.now() + 60_000) { // client 당 유효 토큰 1개 — 만료 전에는 재발급하지 않는다
    const body = new URLSearchParams({ grant_type: "client_credentials", client_id: env.TOSS_CLIENT_ID, client_secret: env.TOSS_CLIENT_SECRET });
    const r = await fetchFn(`${base}/oauth2/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    const j = await r.json().catch(() => ({})); if (!r.ok || !j.access_token) throw new Error(`토스증권 토큰 발급 실패 (${r.status} ${j.error || ""})`.trim());
    tossToken = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  }
  const auth = { authorization: `Bearer ${tossToken.value}` };
  let seq = env.TOSS_ACCOUNT_SEQ || env.TOSS_ACCOUNT_ID;
  if (!seq) {
    const r = await fetchFn(`${base}/api/v1/accounts`, { headers: auth }); const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("토스증권 계좌 목록 실패: " + r.status);
    const acc = (j.result || []).find((a) => a.accountType === "BROKERAGE") || (j.result || [])[0];
    if (!acc) throw new Error("토스증권 종합매매 계좌가 없습니다"); seq = acc.accountSeq;
  }
  const r = await fetchFn(`${base}/api/v1/holdings`, { headers: { ...auth, "X-Tossinvest-Account": String(seq) } });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error("토스증권 보유 조회 실패: " + r.status);
  return (j.result?.items || []).map((o) => ({ code: String(o.symbol || ""), name: String(o.name || o.symbol || ""), qty: num(o.quantity), avg: num(o.averagePurchasePrice), price: num(o.lastPrice), ccy: o.currency === "USD" ? "USD" : "KRW", cls: "EQ", market: o.marketCountry || null })).filter((h) => h.code && h.qty);
}
export const _reset = () => { kisToken = null; tossToken = null; };
