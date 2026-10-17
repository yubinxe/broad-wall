import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as P from "../js/portfolio.js";
import * as R from "../js/profile.js";
import { seal, open } from "../js/vault.js";
import { scanLegacy, backupLegacy } from "../js/migrate.js";
import * as B from "../api/_lib/brokers.js";
import status from "../api/broker/status.js";
import holdings from "../api/broker/holdings.js";

class LS { constructor(o = {}) { this.m = new Map(Object.entries(o)); } get length() { return this.m.size; } key(i) { return [...this.m.keys()][i]; } getItem(k) { return this.m.get(k) ?? null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }
globalThis.localStorage = new LS();

test("CSV: 한글 헤더·BOM·따옴표·쉼표 금액, 오류 행은 이유와 함께 제외", () => {
  const csv = '﻿종목코드,종목명,수량,평균단가,현재가,통화,자산군\nSPY,"S&P 500, ETF",10,"1,234.5",640,USD,주식\n005930,삼성전자,abc,70000,,KRW,주식\nGLD,금 ETF,3,190,,USD,금\nX,엔화,1,1,1,JPY,현금';
  const r = P.importHoldings(csv);
  assert.equal(r.holdings.length, 2); assert.equal(r.holdings[0].name, "S&P 500, ETF"); assert.equal(r.holdings[0].avg, 1234.5);
  assert.equal(r.holdings[1].cls, "GD"); assert.equal(r.holdings[1].price, null);
  assert.deepEqual(r.errors.map((e) => e.row), [3, 5]);
  assert.equal(P.importHoldings("이름,가격\na,1").errors[0].row, 1);
  const back = P.importHoldings(P.exportCSV(r.holdings)); assert.equal(back.holdings.length, 2);
});

test("분석: 평가액·손익·비중·기여도, 현재가 없으면 평균단가로 평가 표시", () => {
  const a = P.analyze([{ code: "A", name: "A", qty: 10, avg: 100, price: 150, ccy: "KRW", cls: "EQ" }, { code: "B", name: "B", qty: 1, avg: 1, price: null, ccy: "USD", cls: "BD" }], 1000);
  assert.equal(a.total, 2500); assert.equal(a.totalCost, 2000); assert.equal(a.pnl, 500); assert.equal(a.missingPrice, 1);
  assert.equal(a.rows[0].weight, 0.6); assert.equal(a.rows[0].contrib, 0.25);
  assert.deepEqual(P.classWeights({ EQ: 0.5, OTHER: 0.1, BD: 0.4 }), { EQ: 0.6, BD: 0.4, GD: 0, CASH: 0 });
  assert.ok(P.DEMO.every((h) => h.demo && h.name.startsWith("[DEMO]")));
});

test("금고: AES-GCM 암복호화, 틀린 암호구는 실패, 평문이 저장본에 남지 않음", async () => {
  const box = await seal({ holdings: [{ code: "SECRET-123" }], fx: 1300 }, "correct horse", 1000);
  assert.ok(!JSON.stringify(box).includes("SECRET-123"));
  assert.equal((await open(box, "correct horse")).holdings[0].code, "SECRET-123");
  await assert.rejects(open(box, "wrong pass!"));
});

test("성향: 점수 0–100, 5유형, 미완료 표시, 허용 낙폭으로 적합 판정", () => {
  const all = (pick) => Object.fromEntries(R.QUESTIONS.map((q) => [q.id, pick(q.o.map((o) => o[1]))]));
  assert.equal(R.score(all((v) => Math.max(...v))).type.name, "공격투자형");
  assert.equal(R.score(all((v) => Math.min(...v))).type.name, "안정형");
  assert.equal(R.score({ age: 4 }).complete, false);
  assert.ok(R.fits(R.TYPES[2], -0.19)); assert.ok(!R.fits(R.TYPES[2], -0.25));
});

test("마이그레이션: v2 키 제외, 보유 후보 탐지, 백업에 원본 그대로", () => {
  const ls = new LS({ "journal": JSON.stringify({ trades: [{ ticker: "nvda", qty: 3, avgPrice: 120 }, { memo: "x" }] }), "meridian.v2.vault": "{}", "theme": "dark" });
  const items = scanLegacy(ls);
  assert.deepEqual(items.map((i) => i.key), ["journal", "theme"]);
  assert.deepEqual(items[0].holdings[0], { code: "NVDA", name: "nvda", qty: 3, avg: 120, price: null, ccy: "KRW", cls: "EQ" });
  const bk = JSON.parse(backupLegacy(ls)); assert.equal(bk.data.journal, ls.getItem("journal")); assert.ok(!("meridian.v2.vault" in bk.data));
});

function call(h, { query = {}, headers = {}, method = "GET" } = {}) {
  return new Promise((resolve) => { const res = { headers: {}, code: 200, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b, headers: this.headers }); } }; Promise.resolve(h({ method, query, headers }, res)); });
}
test("상태 API: 값 노출 없이 설정 여부만", async () => {
  process.env.KIS_APP_KEY = "k-secret-value"; process.env.KIS_APP_SECRET = "s"; process.env.KIS_ACCOUNT = "12345678-01"; delete process.env.TOSS_CLIENT_ID;
  const r = await call(status);
  assert.equal(r.body.brokers.kis.configured, true); assert.equal(r.body.brokers.toss.configured, false);
  assert.ok(!JSON.stringify(r.body).includes("k-secret-value") && !JSON.stringify(r.body).includes("12345678"));
  assert.equal(r.headers["Cache-Control"], "no-store");
});
test("보유 API: 관리자 토큰 없으면 401, 짧은 토큰 설정은 무효", async () => {
  delete process.env.MERIDIAN_ADMIN_TOKEN;
  assert.equal((await call(holdings, { query: { broker: "kis" }, headers: { authorization: "Bearer x" } })).code, 401);
  process.env.MERIDIAN_ADMIN_TOKEN = "short";
  assert.equal((await call(holdings, { query: { broker: "kis" }, headers: { authorization: "Bearer short" } })).code, 401);
  process.env.MERIDIAN_ADMIN_TOKEN = "a-very-long-admin-token-123";
  assert.equal((await call(holdings, { query: { broker: "toss" }, headers: { authorization: "Bearer a-very-long-admin-token-123" } })).code, 409);
  assert.equal((await call(holdings, { query: { broker: "xx" }, headers: { authorization: "Bearer a-very-long-admin-token-123" } })).code, 400);
});
test("KIS 요청 규격(공식 예제 대조): tokenP → inquire-balance TTTC8434R, 계좌번호는 응답에 없음", async () => {
  B._reset(); const calls = [];
  const fake = async (url, init = {}) => { calls.push({ url, init }); if (url.endsWith("/oauth2/tokenP")) return { ok: true, json: async () => ({ access_token: "T", expires_in: 86400 }) };
    return { ok: true, headers: { get: () => "D" }, json: async () => ({ rt_cd: "0", output1: [{ pdno: "005930", prdt_name: "삼성전자", hldg_qty: "10", pchs_avg_pric: "71000.0000", prpr: "210000" }, { pdno: "000000", hldg_qty: "0" }] }) }; };
  const env = { KIS_APP_KEY: "AK", KIS_APP_SECRET: "AS", KIS_ACCOUNT: "12345678-01" };
  const h = await B.kisHoldings(env, fake);
  assert.deepEqual(h, [{ code: "005930", name: "삼성전자", qty: 10, avg: 71000, price: 210000, ccy: "KRW", cls: "EQ" }]);
  assert.match(calls[0].url, /^https:\/\/openapi\.koreainvestment\.com:9443\/oauth2\/tokenP$/);
  const u = new URL(calls[1].url); assert.equal(u.pathname, "/uapi/domestic-stock/v1/trading/inquire-balance"); assert.equal(u.searchParams.get("CANO"), "12345678"); assert.equal(u.searchParams.get("ACNT_PRDT_CD"), "01"); assert.equal(u.searchParams.get("INQR_DVSN"), "02");
  assert.equal(calls[1].init.headers.tr_id, "TTTC8434R"); assert.equal(calls[1].init.headers.custtype, "P");
  B._reset(); await B.kisHoldings({ ...env, KIS_ENV: "mock" }, fake); assert.equal(calls[3].init.headers.tr_id, "VTTC8434R"); assert.match(calls[2].url, /openapivts/);
  await assert.rejects(B.kisHoldings({ ...env, KIS_ACCOUNT: "123" }, fake), /형식/);
});
test("토스증권 요청 규격(공식 OpenAPI 예시 응답): form 토큰 → accountSeq 헤더 → result.items", async () => {
  B._reset(); const calls = [];
  const item = { symbol: "005930", name: "삼성전자", marketCountry: "KR", currency: "KRW", quantity: "100", lastPrice: "72000", averagePurchasePrice: "65000", marketValue: { purchaseAmount: "6500000", amount: "7200000" } };
  const fake = async (url, init = {}) => { calls.push({ url, init }); if (url.endsWith("/oauth2/token")) return { ok: true, json: async () => ({ access_token: "T", token_type: "Bearer", expires_in: 86400 }) }; if (url.endsWith("/accounts")) return { ok: true, json: async () => ({ result: [{ accountNo: "12345678901", accountSeq: 1, accountType: "BROKERAGE" }] }) }; return { ok: true, json: async () => ({ result: { totalPurchaseAmount: {}, items: [item, { ...item, symbol: "AAPL", name: "Apple", marketCountry: "US", currency: "USD", quantity: "2", lastPrice: "250.5", averagePurchasePrice: "150" }] } }) }; };
  const h = await B.tossHoldings({ TOSS_CLIENT_ID: "c", TOSS_CLIENT_SECRET: "s" }, fake);
  assert.deepEqual(h, [{ code: "005930", name: "삼성전자", qty: 100, avg: 65000, price: 72000, ccy: "KRW", cls: "EQ", market: "KR" }, { code: "AAPL", name: "Apple", qty: 2, avg: 150, price: 250.5, ccy: "USD", cls: "EQ", market: "US" }]);
  assert.equal(calls[0].init.headers["content-type"], "application/x-www-form-urlencoded"); assert.equal(calls[0].init.body.get("grant_type"), "client_credentials");
  assert.equal(calls[2].init.headers["X-Tossinvest-Account"], "1"); assert.equal(calls[2].init.headers.authorization, "Bearer T");
  await B.tossHoldings({ TOSS_CLIENT_ID: "c", TOSS_CLIENT_SECRET: "s", TOSS_ACCOUNT_SEQ: "3" }, fake); assert.equal(calls.length, 4, "토큰 재사용·계좌 조회 생략"); assert.equal(calls[3].init.headers["X-Tossinvest-Account"], "3");
  B._reset(); await assert.rejects(B.tossHoldings({ TOSS_CLIENT_ID: "c", TOSS_CLIENT_SECRET: "s" }, async () => ({ ok: false, status: 401, json: async () => ({ error: "invalid_client" }) })), /invalid_client/);
});

test("투자 데스크: 체온계·신호 변경·리밸런싱 계산", async () => {
  const K = await import("../js/desk.js"), Q = await import("../js/quant.js");
  const m = JSON.parse(readFileSync(new URL("../data/market.json", import.meta.url))), D = Q.prepare(m);
  const th = K.thermometer(D, m);
  assert.ok(th.now.dd <= 0 && th.now.dd > -1, "고점 대비는 0 이하");
  for (const p of Object.values(th.pct)) assert.ok(p >= 0 && p <= 1);
  assert.equal(th.rank.length, 3);
  const sc = K.signalChanges(D, { trend: { N: 10 }, dualmom: { L: 12 }, voltarget: { target: 0.1 }, riskparity: { L: 12 } });
  assert.ok(sc.every((s) => Math.abs(Object.values(s.next).reduce((a, b) => a + b, 0) - 1) < 1e-9));
  const r = K.rebalance({ EQ: 700, BD: 300, GD: 0, CASH: 0 }, { EQ: 0.6, BD: 0.4 }, { costBps: 10, slipBps: 0, band: 0.05 });
  assert.equal(r.total, 1000); assert.ok(Math.abs(r.rows[0].diff + 100) < 1e-9 && Math.abs(r.rows[1].diff - 100) < 1e-9);
  assert.ok(Math.abs(r.fee - 0.2) < 1e-9 && r.needed && Math.abs(r.turnover - 0.1) < 1e-9);
});

test("뉴스: RSS 파싱(CDATA·엔티티)·3일 초과 제외·중복 제거·실패 출처 표시", async () => {
  const N = await import("../api/news.js"), now = Date.parse("2026-10-17T06:00:00Z");
  const xml = `<rss><channel><item><title><![CDATA[코스피 &amp; 환율]]></title><link>https://a.kr/1</link><pubDate>Sat, 17 Oct 2026 13:48:39 +0900</pubDate></item><item><title>옛 기사</title><link>https://a.kr/2</link><pubDate>Mon, 27 Jan 2025 14:27:15 -0500</pubDate></item><item><title>[부고] 홍길동씨 별세</title><link>https://a.kr/3</link><pubDate>Sat, 17 Oct 2026 12:00:00 +0900</pubDate></item><item><title>링크 없음</title><pubDate>Sat, 17 Oct 2026 10:00:00 +0900</pubDate></item></channel></rss>`;
  assert.deepEqual(N.parseRSS(xml, "X")[0], { src: "X", title: "코스피 & 환율", link: "https://a.kr/1", t: Date.parse("2026-10-17T04:48:39Z") });
  const d = await N.collect(async (u) => (u.includes("ft.com") ? { ok: false, status: 403 } : { ok: true, text: async () => xml }), now);
  assert.equal(d.kr.length, 1, "중복·오래된 기사 제외"); assert.equal(d.kr[0].title, "코스피 & 환율");
  assert.ok(d.failed.some((f) => f.startsWith("Financial Times")));
});
test("토스증권 현재가: /api/v1/prices · 지표는 market-indicators 경로", async () => {
  B._reset(); const calls = [];
  const fake = async (url, init = {}) => { calls.push(url); if (url.endsWith("/oauth2/token")) return { ok: true, json: async () => ({ access_token: "T", expires_in: 86400 }) }; return { ok: true, json: async () => ({ result: [{ symbol: url.includes("indicators") ? "KOSPI" : "005930", timestamp: "2026-03-25T09:30:00.123+09:00", lastPrice: "72000", currency: "KRW" }] }) }; };
  const env = { TOSS_CLIENT_ID: "c", TOSS_CLIENT_SECRET: "s" };
  assert.deepEqual(await B.tossPrices(env, ["005930"], {}, fake), [{ symbol: "005930", price: 72000, currency: "KRW", at: "2026-03-25T09:30:00.123+09:00" }]);
  await B.tossPrices(env, ["KOSPI", "KOSDAQ"], { indicators: true }, fake);
  assert.match(calls[1], /\/api\/v1\/prices\?symbols=005930$/); assert.match(calls[2], /\/api\/v1\/market-indicators\/prices\?symbols=KOSPI%2CKOSDAQ$/); assert.equal(calls.length, 3, "토큰 1회");
});
