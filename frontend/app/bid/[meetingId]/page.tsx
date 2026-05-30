"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createBid,
  fetchMeeting,
  fetchMeetingBids,
  fetchRoomMembers,
  fetchUpcomingMeetings,
  type Bid,
  type RoomMember
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { BidBottomNav } from "../bid-bottom-nav";

export default function BidDetailPage() {
  const router = useRouter();
  const params = useParams<{ meetingId: string }>();
  const meetingId = params.meetingId;
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [amount, setAmount] = useState("300");
  const [error, setError] = useState<string | null>(null);

  const meetingQuery = useQuery({
    queryKey: ["meetings", meetingId],
    queryFn: () => fetchMeeting(meetingId),
    enabled: Boolean(meetingId)
  });

  const fallbackMeetingsQuery = useQuery({
    queryKey: ["me", "upcoming-meetings", token],
    queryFn: () => fetchUpcomingMeetings(token),
    enabled: Boolean(token)
  });

  const fallbackMeeting = fallbackMeetingsQuery.data?.find((item) => item.id === meetingId);
  const meeting = meetingQuery.data ?? fallbackMeeting;

  const membersQuery = useQuery({
    queryKey: ["rooms", meeting?.roomId, "members"],
    queryFn: () => fetchRoomMembers(meeting?.roomId ?? ""),
    enabled: Boolean(meeting?.roomId)
  });

  const bidsQuery = useQuery({
    queryKey: ["meetings", meetingId, "bids"],
    queryFn: () => fetchMeetingBids(meetingId),
    enabled: Boolean(meetingId)
  });

  const title = meeting ? `${meeting.room?.name ?? "방"} - ${meeting.title}` : "입찰";
  const members = membersQuery.data ?? [];
  const meetingMembers =
    meeting?.participantUserIds && meeting.participantUserIds.length > 0
      ? members.filter((member) => meeting.participantUserIds?.includes(member.userId))
      : meeting?.capacity === 1 && user
        ? members.filter((member) => member.userId === user.id)
      : members;
  const bids = bidsQuery.data ?? [];
  const didBid = bids.some((bid) => bid.userId === user?.id);
  const displayMembers =
    meetingMembers.length > 0
      ? meetingMembers
      : user && didBid
        ? [
            {
              id: `current-user-${user.id}`,
              roomId: meeting?.roomId ?? "",
              userId: user.id,
              role: "member",
              joinedAt: "",
              user
            }
          ]
        : [];
  const allBid =
    displayMembers.length > 0 &&
    displayMembers.every((member) => bids.some((bid) => bid.userId === member.userId));
  const pointBalance = 500;

  const bidByUserId = useMemo(() => new Map(bids.map((bid) => [bid.userId, bid])), [bids]);

  async function handleBid() {
    setError(null);
    if (!token || !user) {
      router.push("/login");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("입찰 포인트를 입력해주세요.");
      return;
    }

    try {
      await createBid(meetingId, { userId: user.id, amountPerMinute: parsedAmount }, token);
      await bidsQuery.refetch();
    } catch (bidError) {
      setError(bidError instanceof Error ? bidError.message : "입찰하지 못했어요.");
    }
  }

  return (
    <main className="phone-frame bid-page bid-detail-page">
      <header className="page-header">
        <button className="back-button bare-button" type="button" aria-label="뒤로가기" onClick={() => router.replace("/bid")}>
          <span className="back-icon" aria-hidden="true" />
        </button>
        <h1>{title}</h1>
      </header>

      <section className="bid-action-panel">
        <label className="bid-amount-box">
          <strong>P</strong>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
            aria-label="분당 지각비 입찰 포인트"
          />
          <span>현재 나의 포인트 : {pointBalance}P</span>
        </label>
        <button className="bid-primary-button" type="button" onClick={handleBid}>
          {didBid ? "다시 입찰하기" : "입찰하기"}
        </button>
        <Link
          className={allBid ? "bid-secondary-button" : "bid-secondary-button bid-secondary-disabled"}
          href={`/bid/${meetingId}/roulette`}
        >
          룰렛 돌리기
        </Link>
        {error ? <p className="wizard-error">{error}</p> : null}
      </section>

      <section className="bid-members-panel">
        <h2>입찰 현황</h2>
        <div className="bid-member-list">
          {membersQuery.isLoading || bidsQuery.isLoading ? <BidMemberRow name="불러오는 중" completed={false} /> : null}
          {!membersQuery.isLoading && displayMembers.length === 0 ? (
            <BidMemberRow name="멤버를 불러오지 못했어요" completed={false} />
          ) : null}
          {displayMembers.map((member) => (
            <BidMemberRow
              key={member.id}
              bid={bidByUserId.get(member.userId)}
              completed={bidByUserId.has(member.userId)}
              name={member.userId === user?.id ? "나" : displayMemberName(member)}
            />
          ))}
        </div>
      </section>

      <BidBottomNav />
    </main>
  );
}

function BidMemberRow({ name, completed, bid }: { name: string; completed: boolean; bid?: Bid }) {
  return (
    <article
      className={completed ? "bid-member-row bid-member-row-completed" : "bid-member-row bid-member-row-pending"}
      title={bid ? `${bid.amountPerMinute}P` : "미입찰"}
    >
      <span className="member-avatar" aria-hidden="true" />
      <strong>{name}</strong>
    </article>
  );
}

function displayMemberName(member: RoomMember) {
  return member.user?.name ?? "이름 없는 멤버";
}
