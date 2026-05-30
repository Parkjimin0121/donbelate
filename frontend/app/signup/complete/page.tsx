import Link from "next/link";

export default function SignupCompletePage() {
  return (
    <main className="phone-frame simple-page">
      <header className="page-header">
        <Link className="back-button" href="/login" aria-label="뒤로가기">
          <span className="back-icon" aria-hidden="true" />
        </Link>
        <h1>회원가입</h1>
      </header>

      <section className="signup-complete-card" aria-label="회원가입 완료">
        <div className="complete-title">
          <span className="info-icon" aria-hidden="true">
            i
          </span>
          <strong>회원가입이 완료되었습니다</strong>
        </div>
        <p>로그인 후 이용하세요 :)</p>
      </section>
    </main>
  );
}
