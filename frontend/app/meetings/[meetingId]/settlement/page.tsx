"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchArrivalStatus,
  fetchMeeting,
  settleMeeting,
  type ArrivalStatus,
  type Settlement
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const TEXT = {
  appName: "DON\u2019T BE LATE",
  login: "\uB85C\uADF8\uC778",
  userSuffix: " \uB2D8",
  newRoom: "\uC0C8\uB85C\uC6B4 \uBC29 \uB9CC\uB4E4\uAE30",
  joinRoom: "\uAE30\uC874 \uBC29 \uCC38\uAC00\uD558\uAE30",
  rooms: "\uCC38\uAC00\uD55C \uBC29",
  roomFallback: "\uBC29 \uC815\uBCF4",
  memberCount: "\uCC38\uAC00 \uC778\uC6D0",
  memberUnit: "\uBA85",
  upcoming: "\uB2E4\uAC00\uC624\uB294 \uC57D\uC18D",
  meetingFallback: "\uC57D\uC18D",
  placeFallback: "\uC57D\uC18D \uC7A5\uC18C",
  timeFallback: "\uC57D\uC18D \uC2DC\uAC04",
  friend: "\uCE5C\uAD6C",
  noAppleTitle: "\uC624\uB298\uC740 \uC0AC\uACFC\uD560 \uC0AC\uB78C\uC774 \uC5C6\uC5B4\uC694",
  noAppleSub: "\uBAA8\uB450 \uC57D\uC18D\uC744 \uC798 \uC9C0\uCF30\uC5B4\uC694.",
  beforeSub: "\uB2A6\uC740 \uB9C8\uC74C\uC744 \uD3EC\uC778\uD2B8\uB85C \uC815\uC0B0\uD588\uC5B4\uC694.",
  opening: "\uC0AC\uACFC \uC5EC\uB294 \uC911",
  openLabel: "\uB20C\uB7EC\uC11C \uC0AC\uACFC\uB0B4\uC6A9 \uD655\uC778\uD558\uAE30",
  receiveLabel: "\uB20C\uB7EC\uC11C \uC9C0\uAC01\uBE44 \uBC1B\uAE30",
  noLateFee: "\uC815\uC0B0\uD560 \uC9C0\uAC01\uBE44\uAC00 \uC5C6\uC5B4\uC694",
  error: "\uC815\uC0B0 \uB0B4\uC6A9\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694.",
  received: "\uBC1B\uC744 \uC9C0\uAC01\uBE44",
  paid: "\uB0B4\uC57C \uD560 \uC9C0\uAC01\uBE44",
  total: "\uCD1D \uC815\uC0B0\uAE08",
  won: "\uC6D0"
};

export default function MeetingSettlementPage() {
  const router = useRouter();
  const params = useParams<{ meetingId: string }>();
  const meetingId = params.meetingId;
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  const meetingQuery = useQuery({
    queryKey: ["meetings", meetingId],
    queryFn: () => fetchMeeting(meetingId),
    enabled: Boolean(meetingId)
  });

  const arrivalQuery = useQuery({
    queryKey: ["meetings", meetingId, "arrival-status"],
    queryFn: () => fetchArrivalStatus(meetingId),
    enabled: Boolean(meetingId)
  });

  const meeting = meetingQuery.data;
  const participantIds = new Set(meeting?.participantUserIds ?? []);
  const hasParticipantFilter = participantIds.size > 0;
  const arrivals = (arrivalQuery.data ?? []).filter(
    (arrival) => !hasParticipantFilter || participantIds.has(arrival.userId)
  );
  const lateSender = useMemo(() => pickLateSender(arrivals, meeting?.scheduledAt), [arrivals, meeting?.scheduledAt]);
  const senderName = lateSender?.user?.name ?? TEXT.friend;
  const hasLateFee = Boolean(lateSender);
  const myDistribution = settlement?.distributions.find((item) => item.userId === user?.id);
  const displayAmount = settlement ? amountForDisplay(settlement, myDistribution) : 0;
  const displayCaption = myDistribution?.reward
    ? TEXT.received
    : myDistribution?.lateFee
      ? TEXT.paid
      : TEXT.total;

  async function handleOpenApology() {
    if (settlement) {
      router.push("/mypage");
      return;
    }

    if (!token) {
      router.push("/login");
      return;
    }

    setError(null);
    setIsSettling(true);
    try {
      const result = await settleMeeting(meetingId, token);
      setSettlement(result);
    } catch (settleError) {
      setError(settleError instanceof Error ? settleError.message : TEXT.error);
    } finally {
      setIsSettling(false);
    }
  }

  return (
    <main className="phone-frame settlement-page settlement-apple-page">
      <header className="top-bar settlement-top-bar">
        <h1>{TEXT.appName}</h1>
        <button className="login-button bare-button" type="button" onClick={() => router.push(user ? "/mypage" : "/login")}>
          {user ? user.name + TEXT.userSuffix : TEXT.login}
        </button>
      </header>

      <section className="settlement-backdrop" aria-hidden="true">
        <div className="quick-actions settlement-ghost-actions">
          <div className="action-card">
            <span className="plus-box-icon" />
            <span>{TEXT.newRoom}</span>
          </div>
          <div className="action-card">
            <span className="search-icon" />
            <span>{TEXT.joinRoom}</span>
          </div>
        </div>

        <div className="content-panel settlement-ghost-panel">
          <h2>{TEXT.rooms}</h2>
          <div className="dark-card settlement-ghost-card">
            <div className="dark-card-text">
              <strong>{meeting?.room?.name ?? TEXT.roomFallback}</strong>
              <span>{TEXT.memberCount} {arrivals.length || 0}{TEXT.memberUnit}</span>
            </div>
            <span className="trash-icon" />
          </div>
        </div>

        <div className="content-panel settlement-ghost-panel">
          <h2>{TEXT.upcoming}</h2>
          <div className="upcoming-meeting-card">
            <div className="upcoming-meeting-link">
              <div className="upcoming-meeting-copy">
                <strong>{meeting?.title ?? TEXT.meetingFallback}</strong>
                <span>{meeting?.locationName ?? TEXT.placeFallback}</span>
                <span>{meeting ? formatMeetingDateTime(meeting.scheduledAt) : TEXT.timeFallback}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="settlement-apology-card settlement-apple-stage" aria-live="polite">
        <p className="settlement-eyebrow">
          {hasLateFee ? senderName + "\uB2D8\uC5D0\uAC8C\uC11C \uC0AC\uACFC\uAC00 \uB3C4\uCC29\uD588\uC5B4\uC694" : TEXT.noAppleTitle}
        </p>
        <p className="settlement-subcopy">{hasLateFee ? TEXT.beforeSub : TEXT.noAppleSub}</p>

        <button
          className={settlement ? "apple-button apple-button-open" : "apple-button"}
          type="button"
          onClick={handleOpenApology}
          disabled={isSettling || !hasLateFee}
        >
          <span className="apple-image-wrap" aria-hidden="true">
            <img className="settlement-apple-image" src={settlement ? "/settlement-apple-open.svg" : "/settlement-apple.svg"} alt="" />
            {settlement ? <span className="apple-amount-text">{displayAmount.toLocaleString()}{TEXT.won}</span> : null}
          </span>
          <span className="apple-button-label">
            {isSettling ? TEXT.opening : settlement ? TEXT.receiveLabel : hasLateFee ? TEXT.openLabel : TEXT.noLateFee}
          </span>
        </button>

        {settlement ? <p className="settlement-amount-caption">{displayCaption}</p> : null}
        {error ? <p className="settlement-error">{error}</p> : null}
      </section>
    </main>
  );
}

function pickLateSender(arrivals: ArrivalStatus[], scheduledAt?: string) {
  const scheduledTime = scheduledAt ? new Date(scheduledAt).getTime() : Date.now();
  const nowLateMinutes = Math.max(1, Math.ceil((Date.now() - scheduledTime) / 60000));

  return arrivals
    .map((arrival) => ({
      ...arrival,
      displayLateMinutes: arrival.arrived ? arrival.lateMinutes ?? 0 : nowLateMinutes
    }))
    .filter((arrival) => arrival.displayLateMinutes > 0)
    .sort((a, b) => b.displayLateMinutes - a.displayLateMinutes)[0];
}

function amountForDisplay(
  settlement: Settlement,
  distribution: Settlement["distributions"][number] | undefined
) {
  if (!distribution) return settlement.totalLateFee;
  if (distribution.reward > 0) return distribution.reward;
  if (distribution.lateFee > 0) return distribution.lateFee;
  return settlement.totalLateFee;
}

function formatMeetingDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return TEXT.timeFallback;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
