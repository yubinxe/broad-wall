# 작업 메모 (다음 세션용)
- 저장소: github.com/yubinxe/broad-wall (main) · 운영: https://broad-wall.vercel.app (구 invest-helper-five.vercel.app 도 유지) · Vercel 프로젝트 broad-wall (prj_tp0gQZuKSMw8molSpRQToxb0o5pv) — GitHub main push 시 자동 배포
- **Vercel 첫 배포 원칙: Deployment Protection(Vercel Authentication/SSO) 끄기.** 켜 두면 CSP(script-src 'self')와 겹쳐 흰 화면.
- 배포: git push → (연결 시) 자동 / 아니면 MCP create_deployment gitSource {github, yubinxe/broad-wall, main} → target production.
- 빌드: vercel.json buildCommand `mkdir -p data && node scripts/build-data.mjs` (공개 원천 4종 수집, 실패 시 빌드 실패 → 기존 운영 유지).
- 구조: 1면 js/screens/home.js · 투자 데스크 js/screens/desk.js + 계산 js/desk.js · 섹션 문구 js/app.js COPY · 지면 CSS css/news.css(meridian.css 위에 덮음).
- /classic/ = 이전 v1 배포 주소로 리다이렉트(원본 파일은 저장소에 없음).
- 호환 유지: MERIDIAN_ADMIN_TOKEN, localStorage meridian.v2.*.
- 토스: 공식 OpenAPI(openapi.tossinvest.com/openapi-docs/latest/openapi.json) 대조 완료. 실계좌 = 사용자가 Vercel env 에 TOSS_CLIENT_ID/SECRET·MERIDIAN_ADMIN_TOKEN 등록해야 동작.
- 빈 화면(Safari) 원인: 첫 화면 View Transition 정지 → 첫 렌더는 전환 없이 그림 + js/boot.js 오류 표시.
- 섹션: 돈의 흐름(#/flows, 보고서 수치 미검증 → 링크만), 리스크 상황실(#/risk, js/risk.js 사건 17건 · 사건 기간/이후 6·12개월 반응 · 3갈래 시나리오), 뉴스 api/news?topic=world.
- 미해결: 시세 월간·지연(토스 키 등록 시 현재가).

## 2026-10-19
- 일반 창 오류 대응: core.sanitize(저장 설정 정화) · 라우트 try/catch 오류면+설정 초기화(원장 보존) · boot.js 는 이 사이트 스크립트 오류만 표시(확장 프로그램 오류 무시) · js/css/index no-cache.
- 1면 개편: 에세이 삭제 → 1면 쟁점/2면 경제·증시/3면 국제·지정학(js/topics.js 키워드 분류 + 판단 근거). /api/news?topic=all.
- Toss 키: Vercel sensitive env(TOSS_CLIENT_ID/SECRET). 채팅 노출 → 재발급 권고.
- 시세: 토스 우선 → 실패/미등록 시 공개 시세(api/_lib/public.js: 네이버 국내 종목·지수, Yahoo 차트 미국). 토스는 허용 IP 미등록으로 403(Vercel 유동 IP).
- 쟁점 분류 실데이터 점검: vote/은행/달러 단독 오분류 제거, 호르무즈·대이란·푸틴·젤렌스키·rate rises 추가.
- 부팅: js/*.js 모듈 ~20개 개별 요청 → 하나라도 끊기면 "지면을 펼치는 중"에 멈춤(WebKit에서 재현). 이제 `npm run build`(esbuild) → dist/app.js 단일 번들, boot.js 가 data-app 으로 주입·실패 시 1회 자동 새로고침. **js/ 수정 후 반드시 npm run build + index.html dist 버전 올리기.**
- 보도사진: RSS media:content/thumbnail(연합뉴스·BBC)만, PHOTO_HOSTS=CSP img-src 일치 필수. 1~3면 쟁점 사진 + 4면 '사진으로 보는 오늘'.
- 2026-10-19 **증권사 API 연동 제거**(사용자 결정: 공개 지면, 투자 의사결정 지원 도구). api/broker·brokers.js·증권 연결 화면·원장 불러오기 삭제. Vercel TOSS_* 값은 "removed"로 덮어씀(대시보드에서 삭제 가능). 시세 = 공개 시세만. 문구: "투자 의사결정 지원 지면 · 정보 제공 · 투자 권유 아님".
