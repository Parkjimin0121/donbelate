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
  const arrivals = arrivalQuery.data ?? [];
  const lateSender = useMemo(() => pickLateSender(arrivals, meeting?.scheduledAt), [arrivals, meeting?.scheduledAt]);
  const senderName = lateSender?.user?.name ?? "친구";
  const hasLateFee = Boolean(lateSender);

  async function handleOpenApology() {
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
      setError(settleError instanceof Error ? settleError.message : "정산 내용을 불러오지 못했어요.");
    } finally {
      setIsSettling(false);
    }
  }

  return (
    <main className="phone-frame settlement-page">
      <header className="top-bar settlement-top-bar">
        <h1>DON&apos;T BE LATE</h1>
        <button className="login-button bare-button" type="button" onClick={() => router.push(user ? "/mypage" : "/login")}>
          {user ? `${user.name} 님` : "로그인"}
        </button>
      </header>

      <section className="settlement-backdrop" aria-hidden="true">
        <div className="quick-actions settlement-ghost-actions">
          <div className="action-card">
            <span className="plus-box-icon" />
            <span>새로운 방 만들기</span>
          </div>
          <div className="action-card">
            <span className="search-icon" />
            <span>기존 방 참가하기</span>
          </div>
        </div>

        <div className="content-panel settlement-ghost-panel">
          <h2>참가한 방</h2>
          <div className="dark-card settlement-ghost-card">
            <div className="dark-card-text">
              <strong>{meeting?.room?.name ?? "방 정보"}</strong>
              <span>참가 인원 {arrivals.length || 0}명</span>
            </div>
            <span className="trash-icon" />
          </div>
        </div>

        <div className="content-panel settlement-ghost-panel">
          <h2>다가오는 약속</h2>
          <div className="upcoming-meeting-card">
            <div className="upcoming-meeting-link">
              <div className="upcoming-meeting-copy">
                <strong>{meeting?.title ?? "약속"}</strong>
                <span>{meeting?.locationName ?? "약속 장소"}</span>
                <span>{meeting ? formatMeetingDateTime(meeting.scheduledAt) : "약속 시간"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="settlement-apology-card" aria-live="polite">
        <p className="settlement-eyebrow">{hasLateFee ? `${senderName}님에게서 사과가 도착했어요` : "오늘은 사과할 사람이 없어요"}</p>
        <p className="settlement-subcopy">
          {hasLateFee ? "늦은 마음을 포인트로 정산했어요." : "모두 약속을 잘 지켰어요."}
        </p>

        <button className="apple-button" type="button" onClick={handleOpenApology} disabled={isSettling || !hasLateFee}>
          <span className="apple-illustration" aria-hidden="true">
            <span className="apple-leaf" />
            <span className="apple-stem" />
            <span className="apple-body" />
          </span>
          <span className="apple-button-label">
            {isSettling ? "사과 여는 중" : hasLateFee ? "눌러서 사과내용 확인하기" : "정산할 지각비가 없어요"}
          </span>
        </button>

        {error ? <p className="settlement-error">{error}</p> : null}

        {settlement ? (
          <div className="settlement-result-panel">
            <div className="settlement-result-summary">
              <span>총 지각비</span>
              <strong>{settlement.totalLateFee.toLocaleString()}P</strong>
            </div>
            <div className="settlement-result-summary">
              <span>분당 지각비</span>
              <strong>{settlement.finalLateFeePerMinute.toLocaleString()}P</strong>
            </div>
            <div className="settlement-distribution-list">
              {settlement.distributions.map((item) => (
                <article key={item.userId} className="settlement-distribution-row">
                  <div>
                    <strong>{displayArrivalName(arrivals, item.userId)}</strong>
                    <span>{item.lateMinutes > 0 ? `${item.lateMinutes}분 지각` : `${item.waitingMinutes}분 기다림`}</span>
                  </div>
                  <b className={item.lateFee > 0 ? "settlement-negative" : "settlement-positive"}>
                    {item.lateFee > 0 ? `-${item.lateFee.toLocaleString()}P` : `+${item.reward.toLocaleString()}P`}
                  </b>
                </article>
              ))}
            </div>
            <button className="settlement-home-button" type="button" onClick={() => router.push("/")}>
              홈으로 돌아가기
            </button>
          </div>
        ) : null}
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

function displayArrivalName(arrivals: ArrivalStatus[], userId: string) {
  return arrivals.find((arrival) => arrival.userId === userId)?.user?.name ?? "멤버";
}

function formatMeetingDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "약속 시간";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
