"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMyRooms,
  fetchRoomMeetings,
  fetchRoomMembers,
  type Meeting,
  type RoomMember
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function RoomDetailPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const token = useAuthStore((state) => state.token);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const roomsQuery = useQuery({
    queryKey: ["me", "rooms", token],
    queryFn: () => fetchMyRooms(token),
    enabled: Boolean(token)
  });

  const meetingsQuery = useQuery({
    queryKey: ["rooms", roomId, "meetings"],
    queryFn: () => fetchRoomMeetings(roomId),
    enabled: Boolean(roomId)
  });

  const membersQuery = useQuery({
    queryKey: ["rooms", roomId, "members"],
    queryFn: () => fetchRoomMembers(roomId),
    enabled: Boolean(roomId)
  });

  const room = useMemo(
    () => roomsQuery.data?.find((item) => item.id === roomId),
    [roomId, roomsQuery.data]
  );
  const meetings = meetingsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const isLoading = roomsQuery.isLoading || meetingsQuery.isLoading || membersQuery.isLoading;

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="phone-frame simple-page room-detail-page">
      <header className="page-header">
        <button
          className="back-button bare-button"
          type="button"
          aria-label="뒤로가기"
          onClick={() => router.push("/")}
        >
          <span className="back-icon" aria-hidden="true" />
        </button>
        <h1>{room?.name ?? (isLoading ? "방" : "방 정보")}</h1>
      </header>

      <section className="room-action-area">
        <Link className="create-meeting-button" href={`/rooms/${roomId}/meetings/new`}>
          <span className="plain-plus-icon" aria-hidden="true" />
          <span>약속 만들기</span>
        </Link>
      </section>

      <section className="detail-panel promise-panel">
        <h2>약속</h2>
        <div className="detail-list-stack">
          {isLoading ? <PromiseCard title="불러오는 중" /> : null}
          {!token ? <PromiseCard title="로그인이 필요해요" /> : null}
          {token && !isLoading && !room ? <PromiseCard title="참가한 방을 찾지 못했어요" /> : null}
          {token && room && !isLoading && meetings.length === 0 ? (
            <PromiseCard title="예정된 약속이 없어요" />
          ) : null}
          {meetings.map((meeting) => {
            const inProgress = isMeetingInProgress(meeting, currentTime);
            const isBidding = meeting.status === "bidding";
            return (
              <PromiseCard
                key={meeting.id}
                href={isBidding ? `/bid/${meeting.id}` : inProgress ? `/meetings/${meeting.id}/live` : undefined}
                title={formatMeetingDateTime(meeting)}
                subtitle={meeting.title}
                status={isBidding ? "입찰중" : inProgress ? "진행중" : undefined}
              />
            );
          })}
        </div>
      </section>

      <section className="detail-panel members-panel">
        <h2>멤버</h2>
        <div className="detail-list-stack member-list-stack">
          {isLoading ? <MemberCard name="불러오는 중" /> : null}
          {token && !isLoading && members.length === 0 ? <MemberCard name="멤버가 없어요" /> : null}
          {members.map((member) => (
            <MemberCard key={member.id} name={displayMemberName(member)} />
          ))}
        </div>
      </section>
    </main>
  );
}

function PromiseCard({
  href,
  title,
  subtitle,
  status
}: {
  href?: string;
  title: string;
  subtitle?: string;
  status?: string;
}) {
  const content = (
    <>
      <div className="promise-copy">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      {status ? <span className="promise-status">{status}</span> : null}
    </>
  );

  return (
    <article className="promise-card">
      {href ? (
        <Link className="promise-card-link" href={href}>
          {content}
        </Link>
      ) : (
        content
      )}
    </article>
  );
}

function MemberCard({ name }: { name: string }) {
  return (
    <article className="member-card">
      <span className="member-avatar" aria-hidden="true" />
      <strong>{name}</strong>
    </article>
  );
}

function displayMemberName(member: RoomMember) {
  if (member.user?.name) return member.user.name;
  return member.role === "host" ? "방장" : "이름 없는 멤버";
}

function isMeetingInProgress(meeting: Meeting, currentTime: number) {
  if (meeting.status === "settled") return false;

  const scheduledTime = new Date(meeting.scheduledAt).getTime();
  if (Number.isNaN(scheduledTime)) return false;

  return scheduledTime <= currentTime;
}

function formatMeetingDateTime(meeting: Meeting) {
  const date = new Date(meeting.scheduledAt);
  if (Number.isNaN(date.getTime())) return meeting.title;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "long" }).format(date);
  const time = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);

  return `${month}월 ${day}일 ${weekday} ${time}`;
}
