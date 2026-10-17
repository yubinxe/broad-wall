// 투자성향 자가진단 — 참고용. 금융회사가 법령에 따라 실시하는 투자자 정보 확인(적합성 원칙)을 대체하지 않는다.
export const QUESTIONS = [
  { id: "age", q: "연령대", o: [["만 19세 미만", 1], ["19–34세", 4], ["35–49세", 3], ["50–64세", 2], ["65세 이상", 0]] },
  { id: "horizon", q: "이 돈을 쓰지 않고 둘 수 있는 기간", o: [["1년 미만", 0], ["1–3년", 1], ["3–5년", 2], ["5–10년", 3], ["10년 이상", 4]] },
  { id: "exp", q: "투자 경험", o: [["예적금만", 0], ["펀드·ETF", 2], ["개별 주식", 3], ["파생·레버리지까지", 4]] },
  { id: "know", q: "주식·채권의 위험을 설명할 수 있는 정도", o: [["거의 모른다", 0], ["기본 개념은 안다", 2], ["상품별 위험을 비교할 수 있다", 3], ["가격 결정 원리까지 안다", 4]] },
  { id: "share", q: "총 금융자산 중 이번 투자 비중", o: [["50% 이상", 0], ["30–50%", 1], ["10–30%", 3], ["10% 미만", 4]] },
  { id: "income", q: "향후 소득 전망", o: [["줄어들 것", 0], ["유지", 2], ["늘어날 것", 4]] },
  { id: "loss", q: "1년 뒤 평가액이 −20%라면", o: [["즉시 전부 판다", 0], ["일부 판다", 1], ["그대로 둔다", 3], ["더 산다", 4]] },
  { id: "goal", q: "기대하는 결과", o: [["원금 보전이 최우선", 0], ["물가보다 조금 높은 수익", 1], ["시장 평균 수익", 3], ["높은 수익을 위해 큰 손실도 감수", 4]] },
];
export const TYPES = [
  { key: 1, name: "안정형", max: 20, mdd: 0.05, eq: [0, 0.1], strategies: ["permanent", "riskparity"], note: "원금 손실을 피하는 것이 우선. 예금·단기채 중심이 맞고, 이 화면의 전략은 대부분 위험이 큽니다." },
  { key: 2, name: "안정추구형", max: 40, mdd: 0.12, eq: [0.1, 0.3], strategies: ["riskparity", "permanent"], note: "변동을 줄이는 분산 전략을 우선 검토하세요." },
  { key: 3, name: "위험중립형", max: 60, mdd: 0.2, eq: [0.3, 0.6], strategies: ["trend", "s6040", "voltarget"], note: "손실 구간을 제한하는 규칙 기반 배분이 맞습니다." },
  { key: 4, name: "적극투자형", max: 80, mdd: 0.3, eq: [0.5, 0.8], strategies: ["s6040", "trend", "dualmom"], note: "주식 비중이 높아도 되지만 하락기 규칙을 미리 정하세요." },
  { key: 5, name: "공격투자형", max: 101, mdd: 0.45, eq: [0.7, 1], strategies: ["dualmom", "eq"], note: "큰 손실을 견딜 수 있다는 답변입니다. 레버리지는 이 점수와 무관하게 별도 검토가 필요합니다." },
];
export function score(answers) {
  const max = QUESTIONS.reduce((s, q) => s + Math.max(...q.o.map((o) => o[1])), 0);
  const raw = QUESTIONS.reduce((s, q) => s + (answers[q.id] ?? 0), 0);
  const pct = Math.round((raw / max) * 100);
  const type = TYPES.find((t) => pct < t.max);
  return { pct, type, complete: QUESTIONS.every((q) => answers[q.id] != null) };
}
// 전략 적합도: 테스트 구간 MDD 가 성향 허용치 이내인지
export const fits = (type, mdd) => Math.abs(mdd) <= type.mdd;
