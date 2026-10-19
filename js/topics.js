// 헤드라인 쟁점 분류 + 쟁점별 판단 근거 — DOM 없음(테스트 가능).
// 분류는 제목 키워드 일치만 쓴다(기사 본문·감성 추정 없음). 근거 수치는 사이트 자료(월간)와 과거 사례에서만 계산한다.
import * as K from "./risk.js";
export const TOPICS = [
  { id: "geo", page: 3, name: "전쟁·지정학", risk: "war", re: /\bwars?\b|missile|strike on|invasion|troops|military|nato|ukrain|russia|israel|gaza|\biran|hamas|hezbollah|taiwan|north korea|putin|zelensk|hormuz|전쟁|미사일|공습|침공|군사|휴전|우크라|러시아|이스라엘|가자|이란(?:의|은|이|과|산|군| 핵| 정부| 공격|·|,| ")|대이란|호르무즈|유조선|푸틴|젤렌스키|대만|북한|중동/i },
  { id: "unrest", page: 3, name: "정치·시위·선거", risk: "unrest", re: /protest|riot|\bstrikes?\b|unrest|election|votes? (on|to)|referendum|impeach|\bcoup\b|parliament|government collapse|시위|파업|폭동|선거|투표|탄핵|쿠데타|의회|내각|총리|불신임/i },
  { id: "rates", page: 2, name: "금리·중앙은행", re: /\bfed\b|federal reserve|powell|rate cuts?|rate hikes?|rate rises?|interest rates?|treasury yield|bond yield|ecb|boj|bank of england|inflation|cpi|연준|금리|기준금리|한은|한국은행|국채|물가|인플레|파월|fomc/i },
  { id: "trade", page: 2, name: "무역·관세", risk: "policy", re: /tariff|trade war|trade deal|export control|sanction|wto|관세|무역|수출 ?규제|제재|통상/i },
  { id: "fin", page: 2, name: "금융·신용", risk: "fin", re: /bank (run|failure|collapse)|default|credit (crunch|crisis|spread|market)|bankrupt|insolven|liquidity (crunch|crisis)|bailout|private credit|junk bond|뱅크런|은행 ?(위기|파산|부실)|부도|디폴트|파산|유동성 위기|신용 ?(경색|위기|등급)|부실|후순위채|회사채|\bpf\b/i },
  { id: "oil", page: 2, name: "유가·원자재", re: /\boil\b|crude|opec|brent|wti|natural gas|lng|copper|gold price|commodit|유가|원유|석유|opec|천연가스|원자재|구리|금값|금 ?가격/i },
  { id: "chips", page: 2, name: "반도체·AI", re: /chip|semiconductor|nvidia|tsmc|samsung elec|sk hynix|\bai\b|artificial intelligence|data center|hbm|반도체|엔비디아|삼성전자|하이닉스|tsmc|인공지능|데이터센터|hbm/i },
  { id: "fx", page: 2, name: "환율·달러", re: /dollar (index|strength|weak|rall|slump|fall|rise)|strong dollar|weak dollar|currency|\byen\b|korean won|yuan|exchange rate|forex|fx\b|환율|달러 ?(강세|약세|인덱스)|원[·/-]?달러|원화|엔화|위안|외환/i },
  { id: "pandemic", page: 3, name: "감염병", risk: "pandemic", re: /virus|pandemic|outbreak|epidemic|bird flu|h5n1|감염|바이러스|팬데믹|확진|조류독감/i },
];
// 기사마다 첫 일치 쟁점 하나에만 넣는다(중복 집계 방지). 우선순위 = TOPICS 순서
export function classify(items) {
  const g = Object.fromEntries(TOPICS.map((t) => [t.id, []])), seen = new Set();
  for (const a of items) {
    if (!a?.title || seen.has(a.title)) continue; seen.add(a.title);
    const t = TOPICS.find((x) => x.re.test(a.title)); if (t) g[t.id].push(a);
  }
  return TOPICS.map((t) => ({ ...t, items: g[t.id].sort((a, b) => (b.t || 0) - (a.t || 0)) })).filter((t) => t.items.length).sort((a, b) => b.items.length - a.items.length || (b.items[0].t || 0) - (a.items[0].t || 0));
}
// 쟁점에 대응하는 과거 사례 요약(위험 유형이 있는 쟁점만). 유가 쟁점은 석유 관련 전쟁 사례로 본다
export function analog(D, topic) {
  const evs = topic.id === "oil" ? K.EVENTS.filter((e) => ["oil73", "iran79", "gulf90", "ukr22"].includes(e.id)) : topic.risk ? K.EVENTS.filter((e) => e.type === topic.risk) : [];
  const rows = evs.map((e) => K.reaction(D, e)).filter(Boolean);
  return rows.length ? { rows, sum: K.summary(rows) } : null;
}
