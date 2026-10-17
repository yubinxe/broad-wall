// 증권사 보유 조회 — 서버 전용. 키는 환경변수에만 두고, 응답에 계좌번호·키를 넣지 않는다.
// KIS 규격: koreainvestment/open-trading-api (공식 GitHub) examples_llm/domestic_stock/inquire_balance 대조
// 토스증권 규격: 공식 문서 원문(developers.tossinvest.com) 미열람 — 2차 자료 교차 확인값. 실제 호출 전 openapi.json 대조 필요.
import { timingSafeEqual } from "node:crypto";

export const BROKERS = {
  kis: { name: "한국투자증권 (KIS Developers)", env: ["KIS_APP_KEY", "KIS_APP_SECRET", "KIS_ACCOUNT"], note: "국내주식 잔고조회 TTTC8434R · 모의 VTTC8434R · 실전 1회 50건(연속조회)" },
  toss: { name: "토스증권 Open API", env: ["TOSS_CLIENT_ID", "TOSS_CLIENT_SECRET"], note: "등록 IP에서만 호출 가능 — Vercel 기본 출구 IP는 고정이 아님" },
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
  if (!tossToken || tossToken.exp < Date.now() + 60_000) {
    const body = new URLSearchParams({ grant_type: "client_credentials", client_id: env.TOSS_CLIENT_ID, client_secret: env.TOSS_CLIENT_SECRET });
    const r = await fetchFn(`${base}/oauth2/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    const j = await r.json(); if (!r.ok || !j.access_token) throw new Error(r.status === 403 ? "토스증권 403 — 호출 IP가 등록되지 않았을 수 있습니다" : "토스증권 토큰 발급 실패");
    tossToken = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  }
  const auth = { authorization: `Bearer ${tossToken.value}` };
  let account = env.TOSS_ACCOUNT_ID;
  if (!account) { const r = await fetchFn(`${base}/api/v1/accounts`, { headers: auth }); const j = await r.json(); if (!r.ok) throw new Error("토스증권 계좌 목록 실패: " + r.status); const list = j.result ?? j.data ?? j.accounts ?? j; account = (Array.isArray(list) ? list[0] : null)?.accountId ?? (Array.isArray(list) ? list[0] : null)?.id; }
  if (account == null) throw new Error("토스증권 계좌 식별자를 찾지 못했습니다");
  const r = await fetchFn(`${base}/api/v1/holdings`, { headers: { ...auth, "X-Tossinvest-Account": String(account) } });
  const j = await r.json(); if (!r.ok) throw new Error("토스증권 보유 조회 실패: " + r.status);
  const items = j.result?.holdings ?? j.result ?? j.data ?? j.holdings ?? [];
  // 응답 필드명은 공식 스키마 대조 전 — 흔한 이름을 차례로 시도하고, 못 읽은 항목은 버린다
  const g = (o, ks) => { for (const k of ks) if (o[k] != null) return o[k]; return null; };
  return (Array.isArray(items) ? items : []).map((o) => ({ code: String(g(o, ["stockCode", "symbol", "code", "ticker"]) ?? ""), name: String(g(o, ["stockName", "name", "productName"]) ?? ""), qty: num(g(o, ["quantity", "qty", "holdingQuantity"])), avg: num(g(o, ["averagePrice", "avgPrice", "purchasePrice"])), price: num(g(o, ["currentPrice", "price", "lastPrice"])), ccy: String(g(o, ["currency"]) ?? "KRW").toUpperCase() === "USD" ? "USD" : "KRW", cls: "EQ" })).filter((h) => h.code && h.qty);
}
export const _reset = () => { kisToken = null; tossToken = null; };
