# MealSnap × 카카오 챗봇 PoC 서버

냉장고 유통기한 지난 식재료를 카카오 챗봇에서 보여주고 쿠팡 재구매로 연결하는 **데모용 독립 서버**.
DB·이미지 없이 **그럴듯한 고정 목업**으로 응답한다. (실제 MealSnap 백엔드는 사내망에 있어 카카오가 외부에서 접근 불가하므로, 데모용으로 이 서버만 외부에 배포한다.)

## 엔드포인트
- `POST /api/kakao/webhook` — 카카오 스킬 응답(listCard + 쿠팡 링크). 발화로 분기:
  - "냉장고 관리"(기본): ⚠️ 유통기한 지난 재료 + 🧊 냉장고 전체 요약
  - "재료 재구매/구매/장보기": 만료 재료 → 쿠팡 재구매 링크
- `GET /api/health` — 헬스체크

## 로컬 실행
```
npm install
npm start           # PORT 환경변수 없으면 3000
# 테스트
curl -X POST http://localhost:3000/api/kakao/webhook \
  -H 'Content-Type: application/json' \
  -d '{"userRequest":{"utterance":"냉장고 관리"}}'
```

## Render 배포 (고정 URL, 무료)

Render 는 재배포·재시작해도 URL(`https://<이름>.onrender.com`)이 유지되므로 카카오 스킬 URL을 매번 바꿀 필요가 없다.

### 방법 A — GitHub 연결 (권장, 자동 재배포)
1. 이 `kakao-poc` 폴더를 **본인 GitHub 저장소**에 올린다. (사내 GitLab이 아니라 GitHub 이어야 Render가 연결 가능)
   ```
   cd kakao-poc
   git init && git add . && git commit -m "kakao poc"
   git remote add origin https://github.com/<본인>/mealsnap-kakao-poc.git
   git push -u origin main
   ```
2. https://render.com 로그인(무료) → **New +** → **Web Service** → 방금 만든 GitHub repo 선택
3. 설정 확인(대개 자동 감지): Runtime=Node, Build=`npm install`, Start=`npm start`, Instance=**Free**
4. **Create Web Service** → 빌드 완료되면 `https://<이름>.onrender.com` 발급

> repo 루트에 `render.yaml` 이 있으므로 **Blueprint** 로 만들면 설정이 자동 적용된다(New + → Blueprint).

### 방법 B — GitHub 없이
Render 무료 플랜은 Git 연결이 기본이라, GitHub 사용이 가장 간단하다. Git이 정 불가하면 Railway/Fly 등 CLI 배포형을 대안으로 검토.

## 배포 후 카카오 연결
1. 발급된 URL로 헬스체크: `curl https://<이름>.onrender.com/api/health`
2. 카카오 i-오픈빌더 → **스킬** → URL 을 **`https://<이름>.onrender.com/api/kakao/webhook`** 로 수정
   - **Test URL 칸에도 같은 주소**를 넣는다(비면 봇테스트가 실패함)
   - 저장
3. **시나리오** → "냉장고 관리" 블록 → 봇 응답을 **스킬데이터** 로 지정 → 이 스킬 선택 → 대표 발화 "냉장고 관리" 추가
4. "재료 재구매" 블록도 동일하게(같은 스킬 연결, 발화 "재료 재구매")
5. **배포**(오픈빌더 좌측 배포 메뉴) 후 **봇테스트**에서 "냉장고 관리" 입력 → 카드가 나오면 성공
6. 채널 관리자센터(business.kakao.com) → 하단 메뉴 버튼을 각 블록에 연결

## 주의
- Render 무료 플랜은 **15분 무요청 시 슬립** → 첫 호출이 몇 초 느릴 수 있다(카카오 5초 제한에 걸리면 재시도하면 깨어남). 데모 직전에 한 번 호출해 깨워두면 좋다.
- 목업 데이터는 `server.js` 의 `EXPIRED_ITEMS` / `FRESH_ITEMS` 에서 자유롭게 수정.
