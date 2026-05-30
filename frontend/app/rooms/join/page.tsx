"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { joinRoom } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function JoinRoomPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      router.push("/login");
      return;
    }

    if (!code.trim()) {
      setError("초대 코드를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await joinRoom({ code: code.trim() }, token);
      router.push("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "방에 참가하지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="phone-frame simple-page">
      <PageHeader title="기존 방 참가하기" />

      <form className="room-form-card join-room-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>초대 코드</span>
          <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="primary-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "참가하는 중" : "참가하기"}
        </button>
      </form>
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
