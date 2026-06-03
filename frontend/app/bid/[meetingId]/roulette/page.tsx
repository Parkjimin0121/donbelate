"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMeeting, finalizeMeetingBid, type Meeting } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const BASE_SPINS = 6;
const SEGMENT_DEGREES = 90;
const POINTER_OFFSET_DEGREES = 0;
const SPIN_DURATION_MS = 3000;

const TEXT = {
  back: "\uB4A4\uB85C\uAC00\uAE30",
  title: "\uB8F0\uB81B \uB3CC\uB9AC\uAE30",
  wheel: "\uC9C0\uAC01\uBE44 \uB8F0\uB81B",
  spinning: "\uB3CC\uC544\uAC00\uB294 \uC911",
  spin: "\uC2A4\uD540",
  resultTitle: "\uB8F0\uB81B \uACB0\uACFC",
  error: "\uB8F0\uB81B\uC744 \uB3CC\uB9AC\uC9C0 \uBABB\uD588\uC5B4\uC694.",
  roomFallback: "\uBC29",
  feePrefix: "\uBD84\uB2F9 \uC9C0\uAC01\uBE44",
  confirmed: "\uD655\uC815",
  home: "\uD648\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30"
};

export default function RoulettePage() {
  const router = useRouter();
  const params = useParams<{ meetingId: string }>();
  const meetingId = params.meetingId;
  const token = useAuthStore((state) => state.token);
  const [resultMeeting, setResultMeeting] = useState<Meeting | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const meetingQuery = useQuery({
    queryKey: ["meetings", meetingId],
    queryFn: () => fetchMeeting(meetingId),
    enabled: Boolean(meetingId)
  });

  const meeting = resultMeeting ?? meetingQuery.data;
  const labels = useMemo(() => buildWheelLabels(meeting), [meeting]);
  const finalFee = meeting?.finalLateFeePerMinute ?? meeting?.bidResult?.finalLateFeePerMinute ?? labels[0];
  const alreadyFinalized = !isSpinning && !hasSpun && Boolean(meeting?.finalLateFeePerMinute);
  const showResult = hasSpun || alreadyFinalized;

  async function spinRoulette() {
    if (!token || isSpinning || showResult) return;

    setError(null);
    setHasSpun(false);
    setIsSpinning(true);

    try {
      const finalizedMeeting = meeting?.finalLateFeePerMinute ? meeting : await finalizeMeetingBid(meetingId, token);
      const nextLabels = buildWheelLabels(finalizedMeeting);
      const selectedIndex = getSelectedSegmentIndex(finalizedMeeting, nextLabels);
      const targetRotation = getTargetRotation(rotation, selectedIndex);

      setResultMeeting(finalizedMeeting);
      setRotation(targetRotation);

      window.setTimeout(() => {
        setIsSpinning(false);
        setHasSpun(true);
      }, SPIN_DURATION_MS);
    } catch (finalizeError) {
      setIsSpinning(false);
      setError(finalizeError instanceof Error ? finalizeError.message : TEXT.error);
    }
  }

  return (
    <main className="phone-frame simple-page roulette-page">
      <header className="page-header">
        <button className="back-button bare-button" type="button" aria-label={TEXT.back} onClick={() => router.replace(`/bid/${meetingId}`)}>
          <span className="back-icon" aria-hidden="true" />
        </button>
        <h1>{TEXT.title}</h1>
      </header>

      <section className="roulette-stage">
        <div className="roulette-pointer" aria-hidden="true" />
        <div
          className={isSpinning ? "roulette-wheel roulette-wheel-spinning" : "roulette-wheel"}
          style={{ transform: `rotate(${rotation}deg)` }}
          aria-label={TEXT.wheel}
        >
          {labels.map((label, index) => (
            <span key={`${label}-${index}`} className={`roulette-label roulette-label-${index + 1}`}>
              {label}P
            </span>
          ))}
        </div>
      </section>

      {!showResult ? (
        <button className="roulette-spin-button" disabled={isSpinning} type="button" onClick={spinRoulette}>
          {isSpinning ? TEXT.spinning : TEXT.spin}
        </button>
      ) : null}

      {error ? (
        <section className="roulette-result-card">
          <h2>{TEXT.resultTitle}</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {showResult ? (
        <section className="roulette-result-card">
          <h2>{meeting ? `${meeting.room?.name ?? TEXT.roomFallback} - ${meeting.title}` : TEXT.resultTitle}</h2>
          <p>
            {TEXT.feePrefix} <strong>{finalFee}P</strong> {TEXT.confirmed}
          </p>
        </section>
      ) : null}

      {showResult ? (
        <button className="roulette-home-button" type="button" onClick={() => router.push("/")}>
          {TEXT.home}
        </button>
      ) : null}
    </main>
  );
}

function buildWheelLabels(meeting?: Meeting | null) {
  const values = meeting?.bidResult?.quartiles
    ?.map((quartile) => quartile.average)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (values && values.length >= 4) return values.slice(0, 4);
  if (values && values.length > 0) return [...values, 100, 500, 1000].slice(0, 4);
  return [300, 100, 500, 1000];
}

function getSelectedSegmentIndex(meeting: Meeting, labels: number[]) {
  const selectedQuartile = meeting.bidResult?.selectedQuartile;
  if (typeof selectedQuartile === "number" && selectedQuartile >= 1 && selectedQuartile <= labels.length) {
    return selectedQuartile - 1;
  }

  const finalFee = meeting.finalLateFeePerMinute ?? meeting.bidResult?.finalLateFeePerMinute;
  const feeIndex = labels.findIndex((label) => label === finalFee);
  return Math.max(0, feeIndex);
}

function getTargetRotation(currentRotation: number, selectedIndex: number) {
  const normalizedCurrent = ((currentRotation % 360) + 360) % 360;
  const selectedAngle = selectedIndex * SEGMENT_DEGREES;
  const targetModulo = (360 - selectedAngle + POINTER_OFFSET_DEGREES) % 360;
  const distanceToTarget = (targetModulo - normalizedCurrent + 360) % 360;

  return currentRotation + BASE_SPINS * 360 + distanceToTarget;
}