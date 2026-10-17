import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as Q from "../js/quant.js";
import * as M from "../js/models.js";

const market = JSON.parse(readFileSync(new URL("../data/market.json", import.meta.url), "utf8"));
const D = Q.prepare(market);

test("데이터: 월 단위 연속 · 출처·라이선스·해시 기록", () => {
  assert.equal(market.rows.length, D.dates.length);
  for (const s of Object.values(market.sources)) { assert.match(s.sha256, /^[0-9a-f]{64}$/); assert.equal(s.license, "ODC-PDDL-1.0"); }
  for (let i = 1; i < D.dates.length; i++) { const [y0, m0] = D.dates[i - 1].split("-").map(Number), [y1, m1] = D.dates[i].split("-").map(Number); assert.equal((y1 - y0) * 12 + m1 - m0, 1, D.dates[i]); }
  assert.ok(market.notes.some((n) => /실시간 시세가 아니다/.test(n)));
});

test("룩어헤드 차단: 미래 가격·당월 CPI 접근은 예외", () => {
  const v = Q.viewAt(D, 100);
  assert.throws(() => v.price("EQ", 101), /lookahead/);
  assert.throws(() => v.ret("EQ", 101), /lookahead/);
  assert.throws(() => v.cpi(100), /CPI 발표 지연/);
  assert.doesNotThrow(() => v.cpi(99));
  const cheat = { warmup: 12, weights: (v) => (v.ret("EQ", v.t + 1) > 0 ? { EQ: 1 } : { BD: 1 }) };
  assert.throws(() => Q.backtest(D, cheat), /lookahead/);
});

test("지표: 매월 +1% 일정 → CAGR 12.68%, 변동성·MDD 0", () => {
  const m = Q.metrics(Array(24).fill(0.01));
  assert.equal(m.cagr.toFixed(4), "0.1268"); assert.equal(m.mdd, 0); assert.ok(m.vol < 1e-12);
  const m2 = Q.metrics([0.1, -0.5, 0.2]);
  assert.equal(m2.mdd.toFixed(4), "-0.5000"); assert.equal(m2.calmar, m2.cagr / 0.5);
});

test("비용·슬리피지·세금은 결과를 낮추고, 0 이면 제거된다", () => {
  const s = Q.STRATEGIES.dualmom;
  const free = Q.backtest(D, s, { L: 12 }, { costBps: 0, slipBps: 0, taxRate: 0 });
  const paid = Q.backtest(D, s, { L: 12 });
  assert.equal(free.costs, 0); assert.equal(free.taxes, 0);
  assert.ok(paid.final < free.final); assert.ok(paid.costs > 0 && paid.taxes > 0);
  const hold = Q.backtest(D, Q.STRATEGIES.eq, {}, { costBps: 10, slipBps: 5 });
  assert.equal(hold.taxes, 0, "매도 없는 보유 전략은 실현이익 과세 없음");
});

test("리밸런싱 주기: 연 1회는 월 1회보다 회전율이 낮다", () => {
  const m = Q.backtest(D, Q.STRATEGIES.s6040, {}, { rebalance: "monthly" }), a = Q.backtest(D, Q.STRATEGIES.s6040, {}, { rebalance: "annual" });
  assert.ok(a.turnover < m.turnover);
});

test("파라미터는 학습 구간만으로 선택 — 검증·테스트 데이터를 바꿔도 선택 불변", () => {
  const sel = Q.selectParams(D, "trend");
  const D2 = structuredClone(D); for (let t = D2.dates.indexOf("2000-01"); t < D2.dates.length; t++) { D2.R.EQ[t] = -D2.R.EQ[t]; D2.px.EQ[t] = 1; }
  assert.deepEqual(Q.selectParams(D2, "trend").best, sel.best);
});

test("구간 분리: 학습·검증·테스트가 겹치지 않는다", () => {
  for (let i = 1; i < Q.SPLITS.length; i++) assert.ok(Q.SPLITS[i].from > Q.SPLITS[i - 1].to);
  const sm = Q.splitMetrics(Q.backtest(D, Q.STRATEGIES.s6040), Q.backtest(D, Q.STRATEGIES.eq));
  assert.equal(sm.length, 3); assert.ok(sm.every((s) => s.m && s.m.months > 100 && s.m.beta != null));
});

test("워크포워드: 미래 구간 데이터를 바꿔도 과거 예측은 그대로(누설 없음)", () => {
  const a = M.walkForward(D, { start: "1995-01" });
  const D2 = structuredClone(D); const cut = D2.dates.indexOf("2010-01");
  for (let t = cut; t < D2.dates.length; t++) { D2.R.EQ[t] *= -3; D2.y10[t] = 15; D2.px.EQ[t] *= 2; }
  const b = M.walkForward(D2, { start: "1995-01" });
  const upto = a.dates.indexOf("2010-01");
  for (const k of Object.keys(M.MODELS)) assert.deepEqual(b.preds[k].slice(0, upto), a.preds[k].slice(0, upto), k);
});

test("스트레스 시나리오: 2008 금융위기에 주식 100%는 손실, 채권 100%는 손실이 아니다", () => {
  const gfc = (w) => Q.stressTest(D, w).find((s) => s.key === "gfc").ret;
  assert.ok(gfc({ EQ: 1 }) < -0.3); assert.ok(gfc({ BD: 1 }) > 0);
});
