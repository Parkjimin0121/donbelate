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

const TEXT = {
  bid: "\uC785\uCC30",
  bidAction: "\uC785\uCC30\uD558\uAE30",
  bidDone: "\uC785\uCC30 \uC644\uB8CC",
  roulette: "\uB8F0\uB81B \uB3CC\uB9AC\uAE30",
  pointLabel: "\uD604\uC7AC \uB098\uC758 \uD3EC\uC778\uD2B8",
  invalidAmount: "\uC785\uCC30 \uD3EC\uC778\uD2B8\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.",
  bidError: "\uC785\uCC30\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.",
  bidStatus: "\uC785\uCC30 \uD604\uD669",
  loading: "\uBD88\uB7EC\uC624\uB294 \uC911",
  noMembers: "\uBA64\uBC84\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694",
  me: "\uB098",
  unknownMember: "\uC774\uB984 \uC5C6\uB294 \uBA64\uBC84",
  notBid: "\uBBF8\uC785\uCC30",
  roomFallback: "\uBC29",
  back: "\uB4A4\uB85C\uAC00\uAE30"
};

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

  const title = meeting ? `${meeting.room?.name ?? TEXT.roomFallback} - ${meeting.title}` : TEXT.bid;
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
  const allBid = displayMembers.length > 0 && displayMembers.every((member) => bids.some((bid) => bid.userId === member.userId));
  const pointBalance = 500;
  const bidByUserId = useMemo(() => new Map(bids.map((bid) => [bid.userId, bid])), [bids]);

  async function handleBid() {
    if (didBid) return;

    setError(null);
    if (!token || !user) {
      router.push("/login");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(TEXT.invalidAmount);
      return;
    }

    try {
      await createBid(meetingId, { userId: user.id, amountPerMinute: parsedAmount }, token);
      await bidsQuery.refetch();
    } catch (bidError) {
      setError(bidError instanceof Error ? bidError.message : TEXT.bidError);
    }
  }

  return (
    <main className="phone-frame bid-page bid-detail-page">
      <header className="page-header">
        <button className="back-button bare-button" type="button" aria-label={TEXT.back} onClick={() => router.replace("/bid")}>
          <span className="back-icon" aria-hidden="true" />
        </button>
        <h1>{title}</h1>
      </header>

      <section className="bid-action-panel">
        <label className="bid-amount-box">
          <strong>P</strong>
          <input
            inputMode="numeric"
            disabled={didBid}
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
            aria-label={TEXT.bidAction}
          />
          <span>{TEXT.pointLabel} : {pointBalance}P</span>
        </label>
        <button className="bid-primary-button" type="button" disabled={didBid} onClick={handleBid}>
          {didBid ? TEXT.bidDone : TEXT.bidAction}
        </button>
        {allBid ? (
          <Link className="bid-secondary-button" href={`/bid/${meetingId}/roulette`}>
            {TEXT.roulette}
          </Link>
        ) : (
          <span className="bid-secondary-button bid-secondary-disabled">{TEXT.roulette}</span>
        )}
        {error ? <p className="wizard-error">{error}</p> : null}
      </section>

      <section className="bid-members-panel">
        <h2>{TEXT.bidStatus}</h2>
        <div className="bid-member-list">
          {membersQuery.isLoading || bidsQuery.isLoading ? <BidMemberRow name={TEXT.loading} completed={false} /> : null}
          {!membersQuery.isLoading && displayMembers.length === 0 ? <BidMemberRow name={TEXT.noMembers} completed={false} /> : null}
          {displayMembers.map((member) => (
            <BidMemberRow
              key={member.id}
              bid={bidByUserId.get(member.userId)}
              completed={bidByUserId.has(member.userId)}
              name={member.userId === user?.id ? TEXT.me : displayMemberName(member)}
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
      title={bid ? `${bid.amountPerMinute}P` : TEXT.notBid}
    >
      <span className="member-avatar" aria-hidden="true" />
      <strong>{name}</strong>
    </article>
  );
}

function displayMemberName(member: RoomMember) {
  return member.user?.name ?? TEXT.unknownMember;
}