# Don't Be Late Frontend

Next.js, TypeScript, Turbopack, Zustand, TanStack Query 기반 프론트엔드입니다.

## 실행

```bash
cd frontend
npm install
npm run dev
```

기본 API 주소는 `http://localhost:4000`입니다. 다른 주소를 쓰려면 `.env.local`에 설정합니다.

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

## 현재 구현

- 첫 화면 UI
- 참가한 방 목록 조회 연결
- 다가오는 약속 조회 연결
- 새 방 만들기/기존 방 참가하기 임시 동작
- Zustand 토큰 저장소
- TanStack Query Provider
