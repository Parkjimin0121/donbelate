"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe, fetchUserPoints, logout, type PointTransaction } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const FALLBACK_REVIEWS = [
  "지각을 너무 자주해... 그만 지각하자!!",
  "지각할 때마다 커피 사줌. 어떤날은 너의 지각을 기다리기도 함ㅋㅋㅋ"
];

const FALLBACK_TRANSACTIONS = [
  { id: "charge", type: "point_charge", amount: 800 },
  { id: "reward", type: "waiting_reward", amount: 700 },
  { id: "late", type: "late_fee", amount: -500 }
] as PointTransaction[];

export default function MyPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const storedUser = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const meQuery = useQuery({
    queryKey: ["me", token],
    queryFn: () => fetchMe(token),
    enabled: Boolean(token)
  });

  const user = meQuery.data?.user ?? storedUser;

  const pointsQuery = useQuery({
    queryKey: ["users", user?.id, "points"],
    queryFn: () => fetchUserPoints(user?.id ?? ""),
    enabled: Boolean(user?.id)
  });

  const balance = pointsQuery.data?.balance ?? meQuery.data?.pointBalance ?? 1200;
  const transactions =
    pointsQuery.data && pointsQuery.data.transactions.length > 0
      ? pointsQuery.data.transactions.slice(-3).reverse()
      : FALLBACK_TRANSACTIONS;

  async function handleLogout() {
    await logout(token).catch(() => undefined);
    clearAuth();
    router.replace("/login");
  }

  return (
    <main className="phone-frame mypage-page">
      <header className="top-bar">
        <h1>DON&apos;T BE LATE</h1>
        <span className="login-button user-name-label">{user ? `${user.name} 님` : "로그인"}</span>
      </header>

      <section className="profile-summary-card">
        <span className="mypage-avatar" aria-hidden="true" />
        <div className="profile-main">
          <span className="profile-badge">성실 납부자</span>
          <strong>{user?.name ?? "사용자"}</strong>
        </div>
        <button className="profile-edit-button" type="button">
          프로필 편집
        </button>
        <button className="logout-button" type="button" onClick={handleLogout}>
          로그아웃
        </button>
      </section>

      <section className="point-summary-card">
        <h2>내 포인트</h2>
        <strong>{balance} P</strong>
      </section>

      <section className="mypage-panel point-history-panel">
        <h2>포인트 사용내역</h2>
        <div className="point-history-list">
          {transactions.map((transaction) => (
            <article key={transaction.id} className="point-history-row">
              <span>{transactionLabel(transaction.type)}</span>
              <strong>{transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="mypage-panel review-panel">
        <h2>나의 리뷰</h2>
        <div className="review-list">
          {FALLBACK_REVIEWS.map((review) => (
            <article key={review} className="review-card">
              {review}
            </article>
          ))}
        </div>
      </section>

      <nav className="bottom-nav" aria-label="주요 메뉴">
        <Link className="nav-item" href="/">
          <span className="nav-icon nav-icon-home" aria-hidden="true" />
          <span>홈</span>
        </Link>
        <button className="nav-item" type="button">
          <span className="nav-icon nav-icon-shop" aria-hidden="true" />
          <span>상점</span>
        </button>
        <Link className="nav-item" href="/bid">
          <span className="nav-icon nav-icon-bid" aria-hidden="true" />
          <span>입찰</span>
        </Link>
        <Link className="nav-item nav-item-active" href="/mypage">
          <span className="nav-icon nav-icon-profile" aria-hidden="true" />
          <span>마이페이지</span>
        </Link>
      </nav>
    </main>
  );
}

function transactionLabel(type: string) {
  switch (type) {
    case "point_charge":
      return "포인트 충전";
    case "waiting_reward":
      return "핀테크 저녁약속 정산비";
    case "late_fee":
      return "핀테크 회의 지각비";
    default:
      return "포인트 내역";
  }
}
