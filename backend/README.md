# Don't Be Late Backend

기획서 기반으로 만든 MVP 백엔드 API입니다. 프론트 UI 작업과 병행하기 쉽도록 의존성 없는 Node.js 서버와 JSON 파일 저장소를 사용합니다.

## 실행

```bash
cd backend
npm run dev
```

기본 주소는 `http://localhost:4000`입니다.

## 폴더 구조

```text
backend/
  src/
    app.js                 # 요청 라우팅 진입점
    server.js              # HTTP 서버 실행
    db/
      jsonStore.js         # JSON 파일 저장소 로드/저장
    routes/
      auth.js              # 자체 회원가입, 로그인, 로그아웃 API
      users.js             # 사용자, 포인트 API
      rooms.js             # 방, 멤버 API
      meetings.js          # 약속, 입찰, 체크인, 정산 API
    services/
      auth.js              # 비밀번호 해시, 세션 토큰 처리
      bids.js              # 이상치 제거, 4분위 룰렛 로직
      points.js            # 포인트 잔액 계산
      rooms.js             # 방 코드 생성
      settlements.js       # 지각비/대기 보상 정산 로직
    utils/
      errors.js            # HTTP 에러 생성
      geo.js               # 거리 계산
      http.js              # JSON 요청/응답 처리
      time.js              # 시간 계산
      validation.js        # 필수값 검증
```

## 구현 범위

- 사용자 생성/조회
- 자체 회원가입/로그인/로그아웃
- 방 만들기
- 방 코드로 참여하기
- 방 멤버 목록 조회
- 약속 만들기
- 지각비 입찰
- 이상치 제거 후 4분위 룰렛으로 최종 지각비 결정
- GPS 50m 기준 체크인
- 도착 정보 조회
- 지각비/대기 보상 포인트 정산
- 사용자 포인트 내역 조회

## 주요 API

### Health Check

```http
GET /health
```

### 사용자

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "minsu@example.com",
  "password": "password1234",
  "name": "민수"
}
```

```http
POST /auth/login
Content-Type: application/json

{
  "email": "minsu@example.com",
  "password": "password1234"
}
```

```http
GET /auth/me
Authorization: Bearer TOKEN
```

```http
POST /auth/logout
Authorization: Bearer TOKEN
```

```http
POST /users
Content-Type: application/json

{
  "name": "민수"
}
```

```http
GET /users
```

```http
GET /users/{userId}/points
```

### 방

```http
POST /rooms
Content-Type: application/json

{
  "name": "토요일 카페 모임",
  "hostUserId": "USER_ID"
}
```

```http
GET /rooms
```

```http
POST /rooms/join
Content-Type: application/json

{
  "code": "ABC123",
  "userId": "USER_ID"
}
```

```http
GET /rooms/{roomId}/members
```

### 약속

```http
POST /meetings
Content-Type: application/json

{
  "roomId": "ROOM_ID",
  "title": "홍대입구 2번 출구",
  "scheduledAt": "2026-05-18T10:00:00.000Z",
  "locationName": "홍대입구역",
  "latitude": 37.5572,
  "longitude": 126.9245,
  "capacity": 5
}
```

```http
GET /rooms/{roomId}/meetings
```

### 입찰

```http
POST /meetings/{meetingId}/bids
Content-Type: application/json

{
  "userId": "USER_ID",
  "amountPerMinute": 300
}
```

```http
GET /meetings/{meetingId}/bids
```

```http
POST /meetings/{meetingId}/finalize-bid
```

### 체크인과 도착 정보

```http
POST /meetings/{meetingId}/checkins
Content-Type: application/json

{
  "userId": "USER_ID",
  "latitude": 37.5572,
  "longitude": 126.9245
}
```

```http
GET /meetings/{meetingId}/arrival-status
```

### 정산

```http
POST /meetings/{meetingId}/settle
```

## 다음 단계

- 실제 DB 연결: SQLite/PostgreSQL/Supabase 중 선택
- 인증 추가: 카카오/구글/애플 로그인 또는 자체 로그인
- 실시간 위치 API: WebSocket 또는 Supabase Realtime
- 상점/찬스권 API 추가
- 테스트 코드 추가
