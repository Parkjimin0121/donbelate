"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createRoom } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function NewRoomPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [roomName, setRoomName] = useState("");
  const [maxMembers, setMaxMembers] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      router.push("/login");
      return;
    }

    if (!roomName.trim()) {
      setError("방 이름을 입력해주세요.");
      return;
    }

    if (!maxMembers) {
      setError("인원 설정을 입력해주세요.");
      return;
    }

    const parsedMaxMembers = Number(maxMembers);
    if (!Number.isInteger(parsedMaxMembers) || parsedMaxMembers < 1 || parsedMaxMembers > 10) {
      setError("인원은 1명부터 10명까지 설정할 수 있어요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const room = await createRoom(
        {
          name: roomName.trim(),
          maxMembers: parsedMaxMembers
        },
        token
      );
      router.push(`/rooms/new/complete?code=${encodeURIComponent(room.code)}`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "방을 만들지 못했어요.";
      if (message.includes("Invalid session") || message.includes("Missing bearer token")) {
        clearAuth();
        setError("로그인 정보가 만료됐어요. 다시 로그인한 뒤 방을 만들어주세요.");
        router.push("/login");
        return;
      }

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="phone-frame simple-page">
      <PageHeader title="새로운 방 만들기" />

      <form className="room-form-card new-room-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>방 이름</span>
          <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
        </label>

        <label className="form-field">
          <span>인원 설정</span>
          <input
            inputMode="numeric"
            max={10}
            min={1}
            placeholder="최대 10명"
            type="number"
            value={maxMembers}
            onChange={(event) => setMaxMembers(event.target.value)}
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="primary-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "만드는 중" : "만들기"}
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
