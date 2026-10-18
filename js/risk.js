// 지정학·정치·금융 충격의 과거 사례와 그때 자산 반응 — DOM 없음(테스트 가능).
// 날짜는 사건이 시장에 반영된 달(월간 자료 기준). 결과는 월평균 지수라 일중 낙폭보다 작다.
import * as Q from "./quant.js";
export const TYPES = { war: "전쟁·무력 충돌", unrest: "정치·사회 불안(시위·선거·국민투표)", fin: "금융위기", policy: "정책·무역 충격", pandemic: "감염병", terror: "테러" };
export const EVENTS = [
  { id: "oil73", type: "war", name: "욤키푸르 전쟁·석유 금수(1차 오일쇼크)", from: "1973-10", to: "1974-03", kw: "oil|석유|중동|middle east" },
  { id: "iran79", type: "war", name: "이란 혁명·인질 사태(2차 오일쇼크)", from: "1979-11", to: "1980-03", kw: "iran|이란|oil|석유" },
  { id: "bm87", type: "fin", name: "블랙먼데이", from: "1987-10", to: "1987-11", kw: "crash|폭락" },
  { id: "gulf90", type: "war", name: "이라크의 쿠웨이트 침공", from: "1990-08", to: "1990-10", kw: "iraq|이라크|oil|유가" },
  { id: "ltcm98", type: "fin", name: "러시아 디폴트·LTCM", from: "1998-08", to: "1998-09", kw: "default|디폴트|hedge fund" },
  { id: "sep01", type: "terror", name: "9·11 테러", from: "2001-09", to: "2001-09", kw: "terror|테러|attack" },
  { id: "iraq03", type: "war", name: "이라크 전쟁 개전", from: "2003-03", to: "2003-04", kw: "war|전쟁|invasion" },
  { id: "gfc08", type: "fin", name: "리먼 브러더스 파산", from: "2008-09", to: "2009-02", kw: "bank|은행|credit|신용" },
  { id: "greece10", type: "unrest", name: "그리스 재정위기·긴축 반대 시위", from: "2010-05", to: "2010-06", kw: "greece|그리스|protest|시위|debt|부채" },
  { id: "us11", type: "policy", name: "미국 신용등급 강등·유로존 위기", from: "2011-08", to: "2011-09", kw: "downgrade|등급|debt ceiling|부채한도" },
  { id: "brexit16", type: "unrest", name: "브렉시트 국민투표", from: "2016-06", to: "2016-06", kw: "referendum|국민투표|election|선거|uk|영국" },
  { id: "trade18", type: "policy", name: "미·중 무역분쟁 격화", from: "2018-10", to: "2018-12", kw: "tariff|관세|trade|무역|china|중국" },
  { id: "gilets18", type: "unrest", name: "프랑스 '노란 조끼' 시위", from: "2018-11", to: "2019-01", kw: "france|프랑스|protest|시위|strike|파업|paris|파리" },
  { id: "covid20", type: "pandemic", name: "코로나19 팬데믹", from: "2020-02", to: "2020-03", kw: "virus|바이러스|pandemic|감염" },
  { id: "ukr22", type: "war", name: "러시아의 우크라이나 침공", from: "2022-02", to: "2022-03", kw: "russia|러시아|ukraine|우크라이나|war|전쟁" },
  { id: "svb23", type: "fin", name: "실리콘밸리은행(SVB) 파산", from: "2023-03", to: "2023-03", kw: "bank|은행|svb" },
  { id: "isr23", type: "war", name: "이스라엘–하마스 전쟁", from: "2023-10", to: "2023-10", kw: "israel|이스라엘|gaza|가자|middle east|중동" },
];
const A = ["EQ", "BD", "GD"];
const cum = (D, a, i0, i1) => { let g = 1; for (let k = i0; k <= i1; k++) g *= 1 + (D.R[a][k] ?? 0); return g - 1; };
// 사건 기간 수익 + 종료 후 3·6·12개월 수익 (자료 범위를 넘으면 null)
export function reaction(D, ev) {
  const i0 = D.dates.indexOf(ev.from), i1 = D.dates.indexOf(ev.to), T = D.dates.length - 1;
  if (i0 < 1 || i1 < i0) return null;
  const after = (n) => (i1 + n <= T ? Object.fromEntries(A.map((a) => [a, cum(D, a, i1 + 1, i1 + n)])) : null);
  return { ...ev, during: Object.fromEntries(A.map((a) => [a, cum(D, a, i0, i1)])), after3: after(3), after6: after(6), after12: after(12) };
}
const med = (xs) => { const v = xs.filter((x) => x != null).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
export function summary(rows) {
  const pick = (k, a) => rows.map((r) => r[k]?.[a] ?? null).filter((x) => x != null);
  const s = (k) => Object.fromEntries(A.map((a) => { const v = pick(k, a); return [a, { med: med(v), worst: v.length ? Math.min(...v) : null, best: v.length ? Math.max(...v) : null, up: v.length ? v.filter((x) => x > 0).length / v.length : null, n: v.length }]; }));
  return { n: rows.length, during: s("during"), after6: s("after6"), after12: s("after12") };
}
// 세 갈래 시나리오: 조기 진정(사례 최선) · 기준(중앙값) · 확전·전이(사례 최악) — 사건 기간 자산 반응을 비중에 대입
export function scenarios(sum, w) {
  const p = (f) => A.reduce((s, a) => s + (w[a] || 0) * (sum.during[a][f] ?? 0), 0);
  return [{ key: "calm", name: "조기 진정", ret: p("best") }, { key: "base", name: "기준(과거 중앙값)", ret: p("med") }, { key: "escalate", name: "확전·금융 전이", ret: p("worst") }];
}
