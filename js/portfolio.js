// 보유 종목 입력(CSV·수동)과 분석. 현재가는 사용자가 넣는다 — 자동 시세 연동이 없으므로 '입력 기준가'로 표시한다.
export const CLASSES = { EQ: "주식", BD: "채권", GD: "금", CASH: "현금", OTHER: "기타" };
const HEAD = {
  code: ["code", "ticker", "symbol", "종목코드", "티커", "코드", "pdno"],
  name: ["name", "종목명", "종목", "상품명", "prdt_name"],
  qty: ["qty", "quantity", "shares", "수량", "보유수량", "hldg_qty"],
  avg: ["avg", "avg_price", "cost", "평균단가", "매입단가", "매입평균가", "pchs_avg_pric"],
  price: ["price", "last", "현재가", "기준가", "prpr"],
  ccy: ["ccy", "currency", "통화"],
  cls: ["class", "asset_class", "자산군", "분류"],
};
const CLS_ALIAS = { 주식: "EQ", 국내주식: "EQ", 해외주식: "EQ", etf: "EQ", equity: "EQ", stock: "EQ", 채권: "BD", bond: "BD", 금: "GD", gold: "GD", 현금: "CASH", cash: "CASH", 예수금: "CASH" };

export function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === "," || ch === "\t") { row.push(cell); cell = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
const toNum = (s) => { if (s == null) return NaN; const v = String(s).replace(/[,\s₩$원]/g, ""); return v === "" ? NaN : Number(v); };

// 반환: { holdings, errors } — 오류 행은 버리지 않고 이유와 함께 돌려준다
export function importHoldings(text) {
  const rows = parseCSV(text); if (!rows.length) return { holdings: [], errors: [{ row: 0, msg: "빈 파일" }] };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = Object.fromEntries(Object.entries(HEAD).map(([k, al]) => [k, head.findIndex((h) => al.includes(h))]));
  const errors = [];
  if (col.qty < 0 || (col.code < 0 && col.name < 0)) return { holdings: [], errors: [{ row: 1, msg: "필수 열 없음 — 종목코드(또는 종목명)·수량이 필요합니다" }] };
  const holdings = [];
  rows.slice(1).forEach((r, i) => {
    const g = (k) => (col[k] >= 0 ? (r[col[k]] ?? "").trim() : "");
    const h = { code: g("code").toUpperCase(), name: g("name") || g("code"), qty: toNum(g("qty")), avg: toNum(g("avg")), price: toNum(g("price")), ccy: (g("ccy") || "KRW").toUpperCase(), cls: CLS_ALIAS[g("cls").toLowerCase()] || CLS_ALIAS[g("cls")] || (g("cls") ? "OTHER" : "EQ") };
    const why = [];
    if (!(h.qty >= 0)) why.push("수량이 숫자가 아님");
    if (g("avg") && !(h.avg >= 0)) why.push("평균단가가 숫자가 아님");
    if (g("price") && !(h.price >= 0)) why.push("현재가가 숫자가 아님");
    if (!["KRW", "USD"].includes(h.ccy)) why.push("통화는 KRW·USD 만 지원");
    if (why.length) errors.push({ row: i + 2, msg: why.join(", ") }); else holdings.push({ ...h, avg: Number.isFinite(h.avg) ? h.avg : null, price: Number.isFinite(h.price) ? h.price : null, id: crypto.randomUUID?.() || String(Math.random()) });
  });
  return { holdings, errors };
}
export function exportCSV(holdings) {
  const esc = (v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : (v ?? ""));
  return ["종목코드,종목명,수량,평균단가,현재가,통화,자산군", ...holdings.map((h) => [h.code, h.name, h.qty, h.avg, h.price, h.ccy, CLASSES[h.cls] || h.cls].map(esc).join(","))].join("\n");
}

// 분석: fx = USD→KRW 환율(사용자 입력). 현재가 없으면 평균단가로 평가하고 '가격 미입력'으로 표시
export function analyze(holdings, fx = 1300) {
  const rows = holdings.map((h) => {
    const k = h.ccy === "USD" ? fx : 1, px = h.price ?? h.avg ?? 0, value = h.qty * px * k, cost = h.avg != null ? h.qty * h.avg * k : null;
    return { ...h, value, cost, pnl: cost != null ? value - cost : null, ret: cost ? value / cost - 1 : null, stalePrice: h.price == null };
  });
  const total = rows.reduce((s, r) => s + r.value, 0), totalCost = rows.reduce((s, r) => s + (r.cost ?? r.value), 0);
  rows.forEach((r) => { r.weight = total ? r.value / total : 0; r.contrib = totalCost && r.pnl != null ? r.pnl / totalCost : 0; });
  const byClass = {}; rows.forEach((r) => (byClass[r.cls] = (byClass[r.cls] || 0) + r.weight));
  const pnl = rows.reduce((s, r) => s + (r.pnl ?? 0), 0);
  const hhi = rows.reduce((s, r) => s + r.weight ** 2, 0);
  return { rows: rows.sort((a, b) => b.value - a.value), total, totalCost, pnl, ret: totalCost ? pnl / totalCost : 0, byClass, effectiveN: hhi ? 1 / hhi : 0, top: rows[0] || null, missingPrice: rows.filter((r) => r.stalePrice).length };
}
// 자산군 비중 → 퀀트 엔진 자산(EQ/BD/GD/CASH). 기타는 주식 위험으로 보수적으로 매핑
export function classWeights(byClass) { return { EQ: (byClass.EQ || 0) + (byClass.OTHER || 0), BD: byClass.BD || 0, GD: byClass.GD || 0, CASH: byClass.CASH || 0 }; }

// 데모 보유 — 실제 자산과 섞이지 않도록 별도 키 · 'DEMO' 표시 · 가상 수치
export const DEMO = [
  { code: "SPY", name: "[DEMO] S&P 500 ETF", qty: 20, avg: 480, price: 640, ccy: "USD", cls: "EQ" },
  { code: "IEF", name: "[DEMO] 미국 7–10년 국채 ETF", qty: 60, avg: 98, price: 95, ccy: "USD", cls: "BD" },
  { code: "GLD", name: "[DEMO] 금 ETF", qty: 15, avg: 190, price: 390, ccy: "USD", cls: "GD" },
  { code: "005930", name: "[DEMO] 국내 대형주", qty: 40, avg: 72000, price: 210000, ccy: "KRW", cls: "EQ" },
  { code: "CASH", name: "[DEMO] 예수금", qty: 1, avg: 3000000, price: 3000000, ccy: "KRW", cls: "CASH" },
].map((h, i) => ({ ...h, id: "demo-" + i, demo: true }));
