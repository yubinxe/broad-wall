# 작업 메모 (다음 세션용)
- 저장소: github.com/yubinxe/broad-wall (main) · 운영: https://invest-helper-five.vercel.app · Vercel prj_tp0gQZuKSMw8molSpRQToxb0o5pv
- **Vercel 첫 배포 원칙: Deployment Protection(Vercel Authentication/SSO) 끄기.** 켜 두면 CSP(script-src 'self')와 겹쳐 흰 화면.
- 배포: git push → (연결 시) 자동 / 아니면 MCP create_deployment gitSource {github, yubinxe/broad-wall, main} → target production.
- 빌드: vercel.json buildCommand `mkdir -p data && node scripts/build-data.mjs` (공개 원천 4종 수집, 실패 시 빌드 실패 → 기존 운영 유지).
- 구조: 1면 js/screens/home.js · 투자 데스크 js/screens/desk.js + 계산 js/desk.js · 섹션 문구 js/app.js COPY · 지면 CSS css/news.css(meridian.css 위에 덮음).
- /classic/ = 이전 v1 배포 주소로 리다이렉트(원본 파일은 저장소에 없음).
- 호환 유지: MERIDIAN_ADMIN_TOKEN, localStorage meridian.v2.*.
- 미해결: 토스 API 미검증·IP 등록 필요, 시세 월간·지연, 실계좌 연결 없음.
