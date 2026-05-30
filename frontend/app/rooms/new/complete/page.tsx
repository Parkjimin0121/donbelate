"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function NewRoomCompletePage() {
  return (
    <Suspense fallback={<CompleteLayout code="" />}>
      <CompleteContent />
    </Suspense>
  );
}

function CompleteContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";

  return <CompleteLayout code={code} />;
}

function CompleteLayout({ code }: { code: string }) {

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
  }

  return (
    <main className="phone-frame simple-page">
      <PageHeader title="새로운 방 만들기" />

      <section className="complete-card" aria-label="방 생성 완료">
        <div className="complete-title">
          <span className="info-icon" aria-hidden="true">
            i
          </span>
          <strong>방이 만들어졌습니다</strong>
        </div>
        <p>초대 코드 : {code || "생성된 코드 없음"}</p>
        <button className="copy-button" type="button" onClick={copyCode}>
          코드 복사하기
        </button>
      </section>
    </main>
  );
}

function PageHeader({ title }: { title: string }) {
  return (
    <header className="page-header">
      <Link className="back-button" href="/" aria-label="뒤로가기">
        <span className="back-icon" aria-hidden="true" />
      </Link>
      <h1>{title}</h1>
    </header>
  );
}
