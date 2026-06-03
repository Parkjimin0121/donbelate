"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  deleteRoom,
  fetchMyRooms,
  fetchRoomMeetings,
  fetchRoomMembers,
  leaveRoom,
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
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const roomsQuery = useQuery({
    queryKey: ["me", "rooms", token],
    queryFn: () => fetchMyRooms(token),
    enabled: Boolean(token)
  });

  const meetingsQuery = useQuery({
    queryKey: ["rooms", roomId, "meetings", token],
    queryFn: () => fetchRoomMeetings(roomId, token),
    enabled: Boolean(roomId && token)
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
  const isHostRoom = room?.myRole === "host";
  const canLeaveRoom = Boolean(room && room.myRole !== "host");

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleLeaveRoom() {
    if (!token || !room) return;

    const confirmed = window.confirm(`'${room.name}' 방에서 나갈까요?`);
    if (!confirmed) return;

    setLeaveError(null);
    setIsLeaving(true);
    try {
      await leaveRoom(room.id, token);
      router.replace("/");
    } catch (error) {
      setLeaveError(error instanceof Error ? error.message : "방에서 나가지 못했어요.");
    } finally {
      setIsLeaving(false);
    }
  }

  async function handleDeleteRoom() {
    if (!token || !room) return;

    const confirmed = window.confirm(`'${room.name}' 방을 삭제할까요?`);
    if (!confirmed) return;

    setLeaveError(null);
    setIsLeaving(true);
    try {
      await deleteRoom(room.id, token);
      router.replace("/");
    } catch (error) {
      setLeaveError(error instanceof Error ? error.message : "방을 삭제하지 못했어요.");
    } finally {
      setIsLeaving(false);
    }
  }

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
        <div className="room-header-title">
          <h1>{room?.name ?? (isLoading ? "방" : "방 정보")}</h1>
          {room?.code ? <span className="room-code-chip">{room.code}</span> : null}
        </div>
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
            const isSettling = isMeetingSettling(meeting);
            const isSettled = meeting.status === "settled";
            const status = isBidding ? "입찰중" : isSettling ? "정산중" : isSettled ? "완료됨" : inProgress ? "진행중" : "예정됨";
            return (
              <PromiseCard
                key={meeting.id}
                href={isBidding ? `/bid/${meeting.id}` : isSettling ? `/meetings/${meeting.id}/settlement` : inProgress ? `/meetings/${meeting.id}/live` : undefined}
                title={formatMeetingDateTime(meeting)}
                subtitle={meeting.title}
                status={status}
              />
            );
          })}
        </div>
      </section>

      <section className="detail-panel members-panel">
        <div className="section-title-row">
          <h2>멤버</h2>
          {canLeaveRoom ? (
            <button className="room-leave-button" disabled={isLeaving} type="button" onClick={handleLeaveRoom}>
              {isLeaving ? "나가는 중" : "방 나가기"}
            </button>
          ) : null}
          {isHostRoom ? (
            <button className="room-leave-button" disabled={isLeaving} type="button" onClick={handleDeleteRoom}>
              {isLeaving ? "삭제 중" : "방 삭제하기"}
            </button>
          ) : null}
        </div>
        <div className="detail-list-stack member-list-stack">
          {isLoading ? <MemberCard name="불러오는 중" /> : null}
          {token && !isLoading && members.length === 0 ? <MemberCard name="멤버가 없어요" /> : null}
          {members.map((member) => (
            <MemberCard key={member.id} name={displayMemberName(member)} />
          ))}
        </div>
        {leaveError ? <p className="room-leave-error">{leaveError}</p> : null}
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
        <div className="promise-card-link">{content}</div>
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
  if (meeting.status === "settled" || meeting.status === "settling") return false;

  const scheduledTime = new Date(meeting.scheduledAt).getTime();
  if (Number.isNaN(scheduledTime)) return false;

  return scheduledTime <= currentTime;
}

function isMeetingSettling(meeting: Meeting) {
  return meeting.status === "settling";
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
