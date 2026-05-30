"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signup } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
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
      await signup({ name: name.trim(), password });
      router.push("/signup/complete");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "회원가입에 실패했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="phone-frame simple-page">
      <PageHeader title="회원가입" />

      <form className="auth-form-card signup-form" onSubmit={handleSubmit}>
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
          {isSubmitting ? "가입 중" : "회원가입"}
        </button>
      </form>
    </main>
  );
}

function PageHeader({ title }: { title: string }) {
  return (
    <header className="page-header">
      <Link className="back-button" href="/login" aria-label="뒤로가기">
        <span className="back-icon" aria-hidden="true" />
      </Link>
      <h1>{title}</h1>
    </header>
  );
}
