"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchMeetingBids, fetchUpcomingMeetings, type Meeting } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { BidBottomNav } from "./bid-bottom-nav";

export default function BidPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const meetingsQuery = useQuery({
    queryKey: ["me", "upcoming-meetings", token],
    queryFn: () => fetchUpcomingMeetings(token),
    enabled: Boolean(token)
  });

  const meetings = (meetingsQuery.data ?? []).filter((meeting) => meeting.status === "bidding");

  return (
    <main className="phone-frame bid-page">
      <header className="top-bar">
        <h1>DON&apos;T BE LATE</h1>
        <span className="login-button user-name-label">{user ? `${user.name} 님` : "로그인"}</span>
      </header>

      <section className="bid-waiting-panel">
        <h2>입찰 대기 약속</h2>
        <div className="bid-meeting-list">
          {!token ? <BidMeetingCardEmpty label="로그인이 필요해요" /> : null}
          {token && meetingsQuery.isLoading ? <BidMeetingCardEmpty label="불러오는 중" /> : null}
          {token && !meetingsQuery.isLoading && meetings.length === 0 ? (
            <BidMeetingCardEmpty label="입찰 대기 약속이 없어요" />
          ) : null}
          {meetings.map((meeting) => (
            <BidMeetingCard key={meeting.id} meeting={meeting} userId={user?.id ?? ""} />
          ))}
        </div>
      </section>

      <BidBottomNav />
    </main>
  );
}

function BidMeetingCard({ meeting, userId }: { meeting: Meeting; userId: string }) {
  const bidsQuery = useQuery({
    queryKey: ["meetings", meeting.id, "bids"],
    queryFn: () => fetchMeetingBids(meeting.id),
    enabled: Boolean(meeting.id)
  });
  const didBid = bidsQuery.data?.some((bid) => bid.userId === userId) ?? false;

  return (
    <Link className={didBid ? "bid-meeting-card bid-meeting-card-done" : "bid-meeting-card"} href={`/bid/${meeting.id}`}>
      <div className="bid-meeting-copy">
        <strong>{meeting.title}</strong>
        <span className="bid-meeting-place">{meeting.locationName}</span>
        <span className="bid-meeting-time">{formatMeetingDateTime(meeting.scheduledAt)}</span>
      </div>
      <div className="bid-meeting-side">
        <span className={didBid ? "bid-state-pill bid-state-done" : "bid-state-pill bid-state-pending"}>
          {didBid ? "입찰완료" : "미입찰"}
        </span>
        <span className="bid-deadline">{formatBidDeadline(meeting.scheduledAt)}</span>
      </div>
    </Link>
  );
}

function BidMeetingCardEmpty({ label }: { label: string }) {
  return (
    <article className="bid-meeting-card">
      <strong>{label}</strong>
    </article>
  );
}

function formatBidDeadline(value: string) {
  const scheduledAt = new Date(value).getTime();
  if (Number.isNaN(scheduledAt)) return "마감 시간 미정";

  const minutesLeft = Math.max(0, Math.ceil((scheduledAt - Date.now()) / 60000));
  if (minutesLeft <= 5) return `마감 ${minutesLeft}분 전`;
  if (minutesLeft < 60) return `마감 ${minutesLeft}분 전`;
  if (minutesLeft < 1440) return `마감 ${Math.ceil(minutesLeft / 60)}시간 전`;
  return `마감 D-${Math.ceil(minutesLeft / 1440)}`;
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
