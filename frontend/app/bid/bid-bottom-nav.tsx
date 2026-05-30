import Link from "next/link";

export function BidBottomNav() {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      <Link className="nav-item" href="/">
        <span className="nav-icon nav-icon-home" aria-hidden="true" />
        <span>홈</span>
      </Link>
      <button className="nav-item" type="button">
        <span className="nav-icon nav-icon-shop" aria-hidden="true" />
        <span>상점</span>
      </button>
      <Link className="nav-item nav-item-active" href="/bid">
        <span className="nav-icon nav-icon-bid" aria-hidden="true" />
        <span>입찰</span>
      </Link>
      <Link className="nav-item" href="/mypage">
        <span className="nav-icon nav-icon-profile" aria-hidden="true" />
        <span>마이페이지</span>
      </Link>
    </nav>
  );
}
