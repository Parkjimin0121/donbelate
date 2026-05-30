"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { login } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !password) {
      setError("이름과 비밀번호를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login({ name: name.trim(), password });
      setAuth({ token: result.token, user: result.user });
      router.push("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "로그인에 실패했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="phone-frame simple-page">
      <PageHeader title="로그인" />

      <form className="auth-form-card login-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>이름</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="form-field">
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="primary-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "로그인 중" : "로그인"}
        </button>

        <Link className="signup-link" href="/signup">
          처음이라면? 회원가입
        </Link>
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
