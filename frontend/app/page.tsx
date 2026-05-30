"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { deleteRoom, fetchMyRooms, fetchUpcomingMeetings, type Meeting } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function HomePage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const roomsQuery = useQuery({
    queryKey: ["me", "rooms", token],
    queryFn: () => fetchMyRooms(token),
    enabled: Boolean(token)
  });

  const meetingsQuery = useQuery({
    queryKey: ["me", "upcoming-meetings", token],
    queryFn: () => fetchUpcomingMeetings(token),
    enabled: Boolean(token)
  });

  const firstMeeting = meetingsQuery.data?.[0];
  const roomCards = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);

  async function handleDeleteRoom(roomId: string, roomName: string) {
    if (!token) return;

    const confirmed = window.confirm(`정말로 '${roomName}' 방을 삭제할까요?`);
    if (!confirmed) return;

    setDeleteError(null);
    try {
      await deleteRoom(roomId, token);
      await roomsQuery.refetch();
      await meetingsQuery.refetch();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "방을 삭제하지 못했어요.");
    }
  }

  return (
    <main className="phone-frame">
      <header className="top-bar">
        <h1>DON&apos;T BE LATE</h1>
        {user ? (
          <span className="login-button user-name-label">{user.name}님</span>
        ) : (
          <Link className="login-button" href="/login">
            로그인
          </Link>
        )}
      </header>

      <section className="quick-actions" aria-label="방 작업">
        <Link className="action-card" href="/rooms/new">
          <span className="plus-box-icon" aria-hidden="true" />
          <span>새로운 방 만들기</span>
        </Link>
        <Link className="action-card" href="/rooms/join">
          <span className="search-icon" aria-hidden="true" />
          <span>기존 방 참가하기</span>
        </Link>
      </section>

      <section className="content-panel rooms-panel">
        <h2>참가한 방</h2>
        <div className="list-stack">
          {token && roomsQuery.isLoading ? <DarkCard label="불러오는 중" /> : null}
          {!token ? <DarkCard label="로그인이 필요해요" /> : null}
          {deleteError ? <p className="form-error room-error">{deleteError}</p> : null}
          {token && roomCards.length === 0 && !roomsQuery.isLoading ? (
            <DarkCard label="참가한 방이 없어요" />
          ) : null}
          {roomCards.map((room) => (
            <DarkCard
              key={room.id}
              label={room.name}
              meta={`참가 인원 ${room.memberCount ?? 0}명`}
              href={`/rooms/${room.id}`}
              deletable={room.myRole === "host"}
              onDelete={() => handleDeleteRoom(room.id, room.name)}
            />
          ))}
        </div>
      </section>

      <section className="content-panel meetings-panel">
        <h2>다가오는 약속</h2>
        <div className="list-stack">
          {token && meetingsQuery.isLoading ? <DarkCard label="불러오는 중" /> : null}
          {!token ? <DarkCard label="로그인이 필요해요" /> : null}
          {token && !firstMeeting && !meetingsQuery.isLoading ? (
            <DarkCard label="예정된 약속이 없어요" />
          ) : null}
          {firstMeeting ? (
            <UpcomingMeetingCard meeting={firstMeeting} />
          ) : null}
        </div>
      </section>

      <nav className="bottom-nav" aria-label="주요 메뉴">
        <NavItem active icon="home" label="홈" />
        <NavItem icon="shop" label="상점" />
        <NavItem icon="bid" label="입찰" href="/bid" />
        <NavItem icon="profile" label="마이페이지" href="/mypage" />
      </nav>
    </main>
  );
}

function UpcomingMeetingCard({ meeting }: { meeting: Meeting }) {
  const roomName = meeting.room?.name ?? "방 정보 없음";
  const href = meeting.status === "bidding" ? `/bid/${meeting.id}` : isMeetingStarted(meeting.scheduledAt) ? `/meetings/${meeting.id}/live` : undefined;

  const content = (
    <>
      <div className="upcoming-meeting-copy">
        <strong>{meeting.title}</strong>
        <span>{meeting.locationName}</span>
        <span>{formatMeetingDateTime(meeting.scheduledAt)}</span>
      </div>
      <span className="upcoming-room-name">{roomName}</span>
    </>
  );

  return (
    <article className="upcoming-meeting-card">
      {href ? (
        <Link className="upcoming-meeting-link" href={href}>
          {content}
        </Link>
      ) : (
        <div className="upcoming-meeting-link">{content}</div>
      )}
    </article>
  );
}

function DarkCard({
  label,
  meta,
  href,
  deletable = false,
  onDelete
}: {
  label: string;
  meta?: string;
  href?: string;
  deletable?: boolean;
  onDelete?: () => void;
}) {
  const content = (
    <div className="dark-card-text">
      <strong>{label}</strong>
      {meta ? <span>{meta}</span> : null}
    </div>
  );

  return (
    <article className="dark-card">
      {href ? (
        <Link className="dark-card-link" href={href} aria-label={`${label} 방으로 이동`}>
          {content}
        </Link>
      ) : (
        content
      )}
      {deletable ? (
        <button className="delete-button" type="button" aria-label={`${label} 삭제`} onClick={onDelete}>
          <span className="trash-icon" aria-hidden="true" />
        </button>
      ) : null}
    </article>
  );
}

function NavItem({
  active = false,
  icon,
  href,
  label
}: {
  active?: boolean;
  icon: "home" | "shop" | "bid" | "profile";
  href?: string;
  label: string;
}) {
  const content = (
    <>
      <span className={`nav-icon nav-icon-${icon}`} aria-hidden="true" />
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <Link className={active ? "nav-item nav-item-active" : "nav-item"} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <button className={active ? "nav-item nav-item-active" : "nav-item"} type="button">
      {content}
    </button>
  );
}

function formatMeetingDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "약속 시간 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function isMeetingStarted(value: string) {
  const scheduledAt = new Date(value).getTime();
  return Number.isFinite(scheduledAt) && scheduledAt <= Date.now();
}
