# BROAD & WALL (구 MERIDIAN v2) — 퀀트 리서치 데스크 · 투자성향 · 퀀트 전략 · 백테스트 · 포트폴리오

Vercel 프로젝트 `invest-helper` (https://invest-helper-five.vercel.app). 정적 사이트 + Vercel 함수. 빌드 단계 없음, 의존성 0.

## 구조
```
index.html            앱 셸(해시 라우터)
css/meridian.css      디자인 시스템 — 편집 지면 × 터미널 패널
js/quant.js           데이터→월간 총수익, 룩어헤드 차단 뷰, 백테스트(비용·슬리피지·세금·리밸런싱), 지표, 전략, 스트레스
js/models.js          워크포워드 예측(기준선·AR(1)·릿지·로지스틱·랜덤포레스트) + 실전 비교
js/portfolio.js       CSV 파서·검증, 포트폴리오 분석, DEMO 데이터(분리)
js/vault.js           비공개 금고 — PBKDF2(310k)+AES-256-GCM, localStorage 암호문만 저장
js/profile.js         투자성향 8문항 → 5유형, 허용 낙폭
js/migrate.js         클래식 데이터 스캔·백업·가져오기(원본 비파괴)
js/charts.js, art.js  SVG 차트, 스카이라인·인장·길로셰
data/market.json      빌드된 월간 데이터(1972-01~) + 출처·SHA-256·품질 검증
api/broker/status.js  증권사 설정 여부(값 미노출)
api/broker/holdings.js 보유 조회(관리자 토큰 필수, no-store, 계좌번호 미포함)
api/_lib/brokers.js   KIS · 토스증권 클라이언트
classic/ → 이전 v1 배포로 리다이렉트(vercel.json)
tests/                node:test 18건
```

## 실행 · 검증
```
npm test                 # 18 tests
npm run data             # 데이터 재빌드(네트워크 필요) → data/market.json
python3 -m http.server 8900   # http://localhost:8900  (API 없이도 연동 외 기능 동작)
```

## 배포
Vercel `invest-helper` 프로젝트에 이 폴더를 그대로 배포(`vercel deploy --prod`). 환경변수(선택):

| 변수 | 용도 |
|---|---|
| `MERIDIAN_ADMIN_TOKEN` | 보유 조회 함수 보호(16자 이상) |
| `KIS_APP_KEY` `KIS_APP_SECRET` `KIS_ACCOUNT`(8-2) `KIS_ENV`(real/mock) | 한국투자증권 국내주식 잔고 |
| `TOSS_CLIENT_ID` `TOSS_CLIENT_SECRET` (`TOSS_ACCOUNT_ID`) | 토스증권 — 호출 IP 등록 필요 |

## 데이터 마이그레이션(클래식 → v2)
1. `/#/migrate` 스캔 — 새 키(`meridian.v2.*`) 외 localStorage 항목 나열
2. 백업 JSON 내려받기(원본 그대로)
3. 금고 생성(`/#/portfolio`) 후 가져오기 — 보유 후보만 `src: legacy` 로 추가, 원본 키 삭제 안 함
4. 클래식은 `/classic/` 에 계속 열람 가능 — 문제 시 그대로 되돌아갈 수 있음

## 한계(정직 표기)
- 시세: 월간 공개 데이터, 실시간 아님. S&P 500 은 월평균 지수.
- 무위험수익률 원자료 없음 → Sharpe 는 rf 0%.
- 10년 국채 수익은 모형 추정, 환율 미반영.
- 증권사 연동은 자격증명이 없어 실호출 미검증. 토스증권 공식 문서 원문은 작업 환경에서 접근 불가.

## 브랜드
- 이름 **BROAD & WALL** — NYSE 정문이 있는 브로드 스트리트와 월 스트리트의 교차로. 업무명 "Quant Research Desk".
- 마크: 거래소 정면(박공·기둥 6·기단) + 이중 괘선 액자. `favicon.svg` · `icons/` PNG · `js/art.js` `MARK` 동일 도형.
- 호환 유지: 환경변수 `MERIDIAN_ADMIN_TOKEN`, localStorage 키 `meridian.v2.*` 는 그대로(기존 금고·설정 보존).
- 상표 조사는 하지 않았습니다. 상용화 전 KIPRIS·USPTO 검색 필요.

## 배포 (Vercel)
- Build Command: `mkdir -p data && node scripts/build-data.mjs` — 배포 때마다 공개 원천 4종을 받아 `data/market.json` 생성(원천 SHA-256 기록). 원천 하나라도 실패하면 빌드 실패 → 기존 프로덕션 유지.
- Output Directory: `.` · Install Command: 없음 · Framework: Other.
- `/classic/` = 이전 v1 배포 주소로 리다이렉트.
