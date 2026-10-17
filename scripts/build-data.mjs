// 시장 데이터 빌드 — 공개 데이터(PDDL)를 받아 품질 검증 후 data/market.json 으로 고정한다.
// 실행: node scripts/build-data.mjs   (빌드 시점에만 네트워크 사용, 화면은 정적 파일만 읽음)
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const SRC = {
  spx: { url: "https://raw.githubusercontent.com/datasets/s-and-p-500/main/data/data.csv", name: "S&P 500 (Robert Shiller · FRED)", license: "ODC-PDDL-1.0", origin: "http://www.econ.yale.edu/~shiller/data.htm" },
  y10: { url: "https://raw.githubusercontent.com/datasets/bond-yields-us-10y/main/data/monthly.csv", name: "미국 10년 국채 금리 (Federal Reserve H.15)", license: "ODC-PDDL-1.0", origin: "https://www.federalreserve.gov/releases/h15/" },
  gold: { url: "https://raw.githubusercontent.com/datasets/gold-prices/main/data/monthly.csv", name: "금 가격 USD/oz (World Bank Pink Sheet)", license: "ODC-PDDL-1.0", origin: "https://www.worldbank.org/en/research/commodity-markets" },
  cpi: { url: "https://raw.githubusercontent.com/datasets/cpi-us/main/data/cpiai.csv", name: "미국 CPI-U (BLS)", license: "ODC-PDDL-1.0", origin: "https://www.bls.gov/cpi/" },
};
const START = "1972-01"; // 금 자유변동(1971-08 닉슨 쇼크) 이후 전 자산 공통 구간

const csv = (t) => t.trim().split(/\r?\n/).slice(1).map((l) => l.split(","));
const ym = (d) => d.slice(0, 7);
const num = (v) => (v === undefined || v === "" || Number(v) === 0 ? null : Number(v)); // 원천 파일의 0.0 은 '결측'

const raw = {}, meta = {};
for (const [k, s] of Object.entries(SRC)) {
  const r = await fetch(s.url); if (!r.ok) throw new Error(k + " " + r.status);
  const t = await r.text(); raw[k] = csv(t);
  meta[k] = { ...s, sha256: createHash("sha256").update(t).digest("hex"), rows: raw[k].length };
}
const map = (rows, iDate, iVal) => new Map(rows.map((r) => [ym(r[iDate]), num(r[iVal])]));
const spx = map(raw.spx, 0, 1), div = map(raw.spx, 0, 2), y10 = map(raw.y10, 0, 1), gold = map(raw.gold, 0, 1), cpi = map(raw.cpi, 0, 1);

const lastOf = (m) => [...m.entries()].filter(([, v]) => v != null).map(([d]) => d).sort().pop();
const END = [lastOf(spx), lastOf(y10), lastOf(gold), lastOf(cpi)].sort()[0];
const months = []; for (let [y, m] = START.split("-").map(Number); ; m++) { if (m > 12) { m = 1; y++; } const d = `${y}-${String(m).padStart(2, "0")}`; if (d > END) break; months.push(d); }

const quality = { checks: [], imputed: {}, missing: {} };
const q = (ok, msg) => quality.checks.push({ ok, msg });
let lastDiv = null, divImp = 0;
const rows = months.map((d) => {
  let dv = div.get(d) ?? null;
  if (dv == null) { dv = lastDiv; divImp++; quality.imputed[d] = (quality.imputed[d] || []).concat("div"); } else lastDiv = dv;
  return { d, spx: spx.get(d) ?? null, div: dv, y10: y10.get(d) ?? null, gold: gold.get(d) ?? null, cpi: cpi.get(d) ?? null };
});
for (const f of ["spx", "y10", "gold", "cpi"]) { const miss = rows.filter((r) => r[f] == null).map((r) => r.d); quality.missing[f] = miss; q(miss.length === 0, `${f}: ${months.length}개월 중 결측 ${miss.length}${miss.length ? ' (' + miss.join(', ') + ' — 직전 값 유지)' : ''}`); }
q(true, `배당: 결측 ${divImp}개월은 직전 관측 배당(연율)을 유지해 보간 — 화면에 '보간' 표시`);
// 이상치: 월간 변동 ±35% 초과
for (const f of ["spx", "gold"]) { for (let i = 1; i < rows.length; i++) { const a = rows[i - 1][f], b = rows[i][f]; if (a && b && Math.abs(b / a - 1) > 0.35) q(false, `${f} ${rows[i].d} 월간 변동 ${((b / a - 1) * 100).toFixed(1)}% — 이상치 후보(원자료 유지, 실제 사건 여부 확인 대상)`); } }
// 날짜 단조·중복
q(new Set(months).size === months.length, "날짜 중복 없음 · 월 단위 연속");
q(rows.every((r) => r.y10 == null || (r.y10 > 0 && r.y10 < 20)), "10년물 금리 0–20% 범위");

const out = {
  version: 1, built_at: new Date().toISOString(), start: START, end: END, frequency: "monthly",
  notes: [
    "S&P 500 지수는 Shiller 원자료 기준 '월평균' 값이다(월말 종가 아님) — 변동성·MDD 가 일별 기준보다 작게 나온다.",
    "주식 총수익 = 가격수익 + 배당(연율)/12/지수. 10년 국채 총수익은 매월 만기 10년 액면채로 교체하는 모형 추정치다.",
    "단기국채(무위험) 금리 원자료가 없어 Sharpe 는 무위험수익률 0% 가정으로 계산한다.",
    "모든 자산은 USD 기준 — 원/달러 환율 효과는 반영하지 않는다.",
    "실시간 시세가 아니다. 마지막 데이터 월: " + END,
  ],
  sources: meta, quality,
  cols: ["d", "spx", "div", "y10", "gold", "cpi"],
  rows: rows.map((r) => [r.d, r.spx == null ? null : +r.spx.toFixed(2), r.div == null ? null : +r.div.toFixed(3), r.y10, r.gold == null ? null : +r.gold.toFixed(2), r.cpi == null ? null : +r.cpi.toFixed(3)]),
};
writeFileSync(new URL("../data/market.json", import.meta.url), JSON.stringify(out));
console.log(`months ${months.length} ${START}..${END}`, quality.checks.filter((c) => !c.ok).length, "warnings");
