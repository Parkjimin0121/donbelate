"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCheckin,
  createHorseBet,
  createMeetingComment,
  fetchArrivalStatus,
  fetchHorseBets,
  fetchLiveLocations,
  fetchMeeting,
  fetchMeetingComments,
  upsertLiveLocation,
  type ArrivalStatus,
  type HorseBet,
  type Meeting,
  type MeetingComment
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

type LiveTab = "info" | "map";
type SheetMode = "list" | "detail";

type NaverMapInstance = {
  setCenter: (latlng: unknown) => void;
};

declare global {
  interface Window {
    naver?: {
      maps: {
        LatLng: new (latitude: number, longitude: number) => unknown;
        Map: new (elementId: string, options: Record<string, unknown>) => NaverMapInstance;
        Marker: new (options: Record<string, unknown>) => unknown;
        Circle: new (options: Record<string, unknown>) => unknown;
        Position: {
          TOP_CENTER: string;
        };
      };
    };
    __naverMapsLoadingPromise?: Promise<void>;
  }
}

export default function LiveMeetingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams<{ meetingId: string }>();
  const meetingId = params.meetingId;
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<LiveTab>("info");
  const [sheetMode, setSheetMode] = useState<SheetMode>("list");
  const [selectedRunnerId, setSelectedRunnerId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [betError, setBetError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);

  const meetingQuery = useQuery({
    queryKey: ["meetings", meetingId],
    queryFn: () => fetchMeeting(meetingId),
    enabled: Boolean(meetingId)
  });

  const arrivalQuery = useQuery({
    queryKey: ["meetings", meetingId, "arrival-status"],
    queryFn: () => fetchArrivalStatus(meetingId),
    enabled: Boolean(meetingId),
    refetchInterval: 30000
  });

  const locationQuery = useQuery({
    queryKey: ["meetings", meetingId, "locations"],
    queryFn: () => fetchLiveLocations(meetingId),
    enabled: Boolean(meetingId),
    refetchInterval: 30000
  });

  const betsQuery = useQuery({
    queryKey: ["meetings", meetingId, "horse-bets"],
    queryFn: () => fetchHorseBets(meetingId),
    enabled: Boolean(meetingId),
    refetchInterval: 30000
  });

  const actualMeetingId = meetingQuery.data?.id ?? meetingId;

  const commentsQuery = useQuery({
    queryKey: ["meetings", actualMeetingId, "comments"],
    queryFn: () => fetchMeetingComments(actualMeetingId),
    enabled: Boolean(actualMeetingId),
    refetchInterval: 30000
  });

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token || !user || !meetingQuery.data || tab !== "map") return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        upsertLiveLocation(
          meetingId,
          {
            userId: user.id,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            isSharing: true
          },
          token
        )
          .then(() => locationQuery.refetch())
          .catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, [locationQuery, meetingId, meetingQuery.data, tab, token, user]);

  const meeting = meetingQuery.data;
  const effectiveParticipantIds =
    meeting?.capacity === 1 && user
      ? [user.id]
      : meeting?.participantUserIds && meeting.capacity && meeting.participantUserIds.length > meeting.capacity
        ? meeting.participantUserIds.slice(0, meeting.capacity)
        : meeting?.participantUserIds ?? [];
  const participantIds = new Set(effectiveParticipantIds);
  const hasParticipantFilter = participantIds.size > 0;
  const arrivals = (arrivalQuery.data ?? []).filter(
    (arrival) => !hasParticipantFilter || participantIds.has(arrival.userId)
  );
  const locations = (locationQuery.data ?? []).filter(
    (location) => !hasParticipantFilter || participantIds.has(location.userId)
  );
  const bets = (betsQuery.data ?? []).filter(
    (bet) =>
      (!hasParticipantFilter || participantIds.has(bet.bettorUserId)) &&
      (!hasParticipantFilter || participantIds.has(bet.targetUserId))
  );
  const comments = commentsQuery.data ?? [];
  const myArrival = arrivals.find((arrival) => arrival.userId === user?.id);
  const canCheckin = Boolean(meeting && currentTime >= new Date(meeting.scheduledAt).getTime() && !myArrival?.arrived);
  const isMeetingStarted = Boolean(meeting && currentTime >= new Date(meeting.scheduledAt).getTime());
  const arrivedMembers = arrivals
    .filter((arrival) => arrival.arrived)
    .sort((a, b) => new Date(a.arrivedAt ?? "").getTime() - new Date(b.arrivedAt ?? "").getTime());
  const lateMembers = arrivals.filter((arrival) => !arrival.arrived);
  const canSettle = Boolean(meeting && isMeetingStarted && arrivals.length > 0);
  const runners = lateMembers.length > 0 ? lateMembers : arrivals.slice(0, 2);
  const selectedRunner = runners.find((runner) => runner.userId === selectedRunnerId) ?? runners[0];

  async function handleCheckin() {
    if (!token || !user || !meeting) {
      router.push("/login");
      return;
    }

    setCheckinError(null);

    const submit = async (latitude: number, longitude: number, force = false) => {
      await createCheckin(meeting.id, { userId: user.id, latitude, longitude, force }, token);
      await upsertLiveLocation(meeting.id, { userId: user.id, latitude, longitude, isSharing: true }, token);
      await Promise.all([arrivalQuery.refetch(), locationQuery.refetch()]);
    };

    try {
      if (!navigator.geolocation) {
        await submit(meeting.latitude, meeting.longitude, true);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await submit(position.coords.latitude, position.coords.longitude, true);
          } catch (error) {
            setCheckinError(error instanceof Error ? error.message : "체크인하지 못했어요.");
          }
        },
        async () => {
          try {
            await submit(meeting.latitude, meeting.longitude, true);
          } catch (error) {
            setCheckinError(error instanceof Error ? error.message : "체크인하지 못했어요.");
          }
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } catch (error) {
      setCheckinError(error instanceof Error ? error.message : "체크인하지 못했어요.");
    }
  }

  async function handleBet(input: { targetUserId: string; predictedTime: string; amount: number }) {
    if (!token || !user || !meeting) {
      router.push("/login");
      return;
    }

    setBetError(null);
    try {
      const [hourText, minuteText] = input.predictedTime.split(":");
      const predicted = new Date(meeting.scheduledAt);
      predicted.setHours(Number(hourText), Number(minuteText), 0, 0);

      if (Number.isNaN(predicted.getTime())) {
        setBetError("예상 도착 시간을 다시 입력해주세요.");
        return;
      }

      await createHorseBet(
        meeting.id,
        {
          bettorUserId: user.id,
          targetUserId: input.targetUserId,
          predictedArrivedAt: predicted.toISOString(),
          amount: input.amount
        },
        token
      );
      await betsQuery.refetch();
    } catch (error) {
      setBetError(error instanceof Error ? error.message : "베팅하지 못했어요.");
    }
  }

  async function handleCommentSubmit() {
    if (!token || !user) {
      router.push("/login");
      return;
    }

    if (!meeting) {
      setCommentError("약속 정보를 불러온 뒤 다시 시도해주세요.");
      return;
    }

    if (!commentText.trim()) return;

    setCommentError(null);
    setIsCommentSubmitting(true);
    try {
      const comment = await createMeetingComment(meeting.id, { userId: user.id, content: commentText.trim() }, token);
      queryClient.setQueryData<MeetingComment[]>(["meetings", meeting.id, "comments"], [
        ...(commentsQuery.data ?? []),
        comment
      ]);
      setCommentText("");
      await commentsQuery.refetch();
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "의견을 보내지 못했어요.");
    } finally {
      setIsCommentSubmitting(false);
    }
  }

  return (
    <main className={tab === "map" ? "phone-frame live-page live-map-page" : "phone-frame live-page"}>
      <header className="page-header live-header">
        <button className="back-button bare-button" type="button" aria-label="뒤로가기" onClick={() => router.back()}>
          <span className="back-icon" aria-hidden="true" />
        </button>
        <h1>{meeting?.room?.name ?? "핀테크"}</h1>
        <button className="chat-button" type="button" aria-label="의견" onClick={() => setTab("map")}>
          <span className="chat-icon" aria-hidden="true" />
        </button>
      </header>

      <SegmentedTabs active={tab} onChange={setTab} />

      {tab === "info" ? (
        <InfoTab
          arrivedMembers={arrivedMembers}
          canCheckin={canCheckin}
          canSettle={canSettle}
          checkinError={checkinError}
          currentTime={currentTime}
          isMeetingStarted={isMeetingStarted}
          lateMembers={lateMembers}
          meeting={meeting}
          onCheckin={handleCheckin}
          onSettle={() => {
            if (meeting) router.push(`/meetings/${meeting.id}/settlement`);
          }}
        />
      ) : (
        <MapTab
          bets={bets}
          betError={betError}
          commentError={commentError}
          commentText={commentText}
          isCommentSubmitting={isCommentSubmitting}
          comments={comments}
          locations={locations}
          meeting={meeting}
          mode={sheetMode}
          onBet={handleBet}
          onCommentChange={setCommentText}
          onCommentSubmit={handleCommentSubmit}
          onModeChange={setSheetMode}
          onSelectRunner={(runnerId) => {
            setSelectedRunnerId(runnerId);
            setSheetMode("detail");
          }}
          runners={runners}
          selectedRunner={selectedRunner}
        />
      )}
    </main>
  );
}

function SegmentedTabs({ active, onChange }: { active: LiveTab; onChange: (tab: LiveTab) => void }) {
  return (
    <nav className="live-tabs" aria-label="약속 실행 보기">
      <button className={active === "info" ? "live-tab live-tab-active" : "live-tab"} type="button" onClick={() => onChange("info")}>
        약속 정보
      </button>
      <button className={active === "map" ? "live-tab live-tab-active" : "live-tab"} type="button" onClick={() => onChange("map")}>
        지도
      </button>
    </nav>
  );
}

function InfoTab({
  arrivedMembers,
  canCheckin,
  canSettle,
  checkinError,
  currentTime,
  isMeetingStarted,
  lateMembers,
  meeting,
  onCheckin,
  onSettle
}: {
  arrivedMembers: ArrivalStatus[];
  canCheckin: boolean;
  canSettle: boolean;
  checkinError: string | null;
  currentTime: number;
  isMeetingStarted: boolean;
  lateMembers: ArrivalStatus[];
  meeting?: Meeting;
  onCheckin: () => void;
  onSettle: () => void;
}) {
  const finalLateFee = meeting?.finalLateFeePerMinute ?? meeting?.bidResult?.finalLateFeePerMinute ?? 189;

  return (
    <section className="live-info-content">
      <div className="live-summary">
        <div className="live-title-block">
          <span aria-hidden="true" />
          <div>
            <p>{meeting ? formatFullDate(meeting.scheduledAt) : "약속 날짜"}</p>
            <strong>{meeting?.title ?? "약속"}</strong>
          </div>
        </div>
        <div className="live-fee">
          <span>₩</span>
          <strong>{finalLateFee}</strong>
          <em>/ min</em>
        </div>
      </div>

      <div className="meeting-info-card">
        <p>
          <span className="pin-icon" aria-hidden="true" />
          {meeting?.locationName ?? "장소를 불러오는 중"}
        </p>
        <p>
          <span className="clock-icon" aria-hidden="true" />
          {meeting ? formatTime(meeting.scheduledAt) : "--:--"}
        </p>
      </div>

      <button className="checkin-button" disabled={!canCheckin} type="button" onClick={onCheckin}>
        체크인 하기
      </button>
      {isMeetingStarted ? (
        <button className="settle-button" disabled={!canSettle} type="button" onClick={onSettle}>
          {canSettle ? "정산하기" : "참여자 정보를 불러오는 중"}
        </button>
      ) : null}
      {checkinError ? <p className="live-error">{checkinError}</p> : null}

      <h2 className="arrival-heading">참여자 도착 정보</h2>
      <ArrivalGroup tone="early" members={arrivedMembers} meeting={meeting} now={currentTime} />
      <ArrivalGroup tone="late" members={lateMembers} meeting={meeting} now={currentTime} />
    </section>
  );
}

function ArrivalGroup({
  members,
  meeting,
  now,
  tone
}: {
  members: ArrivalStatus[];
  meeting?: Meeting;
  now: number;
  tone: "early" | "late";
}) {
  if (members.length === 0) return null;

  return (
    <div className={tone === "early" ? "arrival-group arrival-group-early" : "arrival-group arrival-group-late"}>
      {members.map((member, index) => (
        <article key={member.userId} className="arrival-row">
          <Medal rank={tone === "early" ? index + 1 : null} />
          <span className="live-avatar" aria-hidden="true" />
          <div>
            <strong>{member.user?.name ?? "이름 없는 멤버"}</strong>
            <p>{member.arrivedAt ? `${formatTime(member.arrivedAt)} 도착` : "미도착"}</p>
          </div>
          <span className="arrival-pill">
            {tone === "early" ? formatEarlyArrival(meeting, member) : `${lateMinutes(meeting, now)}분 지각 중`}
          </span>
        </article>
      ))}
    </div>
  );
}

function Medal({ rank }: { rank: number | null }) {
  if (!rank || rank > 3) return <span className="arrival-medal empty">-</span>;
  return <span className={`arrival-medal arrival-medal-${rank}`}>{rank}</span>;
}

function MapTab({
  bets,
  betError,
  commentError,
  commentText,
  comments,
  isCommentSubmitting,
  locations,
  meeting,
  mode,
  onBet,
  onCommentChange,
  onCommentSubmit,
  onModeChange,
  onSelectRunner,
  runners,
  selectedRunner
}: {
  bets: HorseBet[];
  betError: string | null;
  commentError: string | null;
  commentText: string;
  comments: MeetingComment[];
  isCommentSubmitting: boolean;
  locations: Array<{ userId: string; latitude: number; longitude: number; user?: { name: string } | null }>;
  meeting?: Meeting;
  mode: SheetMode;
  onBet: (input: { targetUserId: string; predictedTime: string; amount: number }) => void;
  onCommentChange: (value: string) => void;
  onCommentSubmit: () => void;
  onModeChange: (mode: SheetMode) => void;
  onSelectRunner: (runnerId: string) => void;
  runners: ArrivalStatus[];
  selectedRunner?: ArrivalStatus;
}) {
  const runnersToShow = runners.slice(0, 2);

  return (
    <section className="live-map-content">
      <NaverMapCanvas locations={locations} meeting={meeting} onSelectRunner={onSelectRunner} runners={runnersToShow} />

      <div className="betting-sheet">
        <button className="sheet-handle" type="button" aria-label="베팅 패널" onClick={() => onModeChange(mode === "list" ? "detail" : "list")} />
        {mode === "list" ? (
          <RunnerList bets={bets} onSelectRunner={onSelectRunner} runners={runnersToShow} />
        ) : (
          <RunnerDetail
            betError={betError}
            commentError={commentError}
            bets={bets}
            commentText={commentText}
            comments={comments}
            isCommentSubmitting={isCommentSubmitting}
            onBet={onBet}
            onCommentChange={onCommentChange}
            onCommentSubmit={onCommentSubmit}
            runner={selectedRunner}
          />
        )}
      </div>
    </section>
  );
}

function NaverMapCanvas({
  locations,
  meeting,
  onSelectRunner,
  runners
}: {
  locations: Array<{ userId: string; latitude: number; longitude: number; user?: { name: string } | null }>;
  meeting?: Meeting;
  onSelectRunner: (runnerId: string) => void;
  runners: ArrivalStatus[];
}) {
  const rawId = useId();
  const mapId = `naver-map-${rawId.replace(/:/g, "")}`;
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID;

  useEffect(() => {
    if (!meeting || !clientId) return;

    let cancelled = false;
    loadNaverMaps(clientId)
      .then(() => {
        if (cancelled || !window.naver?.maps) return;

        const center = new window.naver.maps.LatLng(meeting.latitude, meeting.longitude);
        const map = new window.naver.maps.Map(mapId, {
          center,
          zoom: 16,
          zoomControl: true,
          zoomControlOptions: {
            position: window.naver.maps.Position.TOP_CENTER
          }
        });

        new window.naver.maps.Circle({
          map,
          center,
          radius: 50,
          strokeColor: "#ef7676",
          strokeOpacity: 0.8,
          strokeWeight: 1,
          fillColor: "#ef7676",
          fillOpacity: 0.18
        });

        new window.naver.maps.Marker({
          map,
          position: center,
          title: meeting.title
        });

        for (const location of locations) {
          new window.naver.maps.Marker({
            map,
            position: new window.naver.maps.LatLng(location.latitude, location.longitude),
            title: location.user?.name ?? "멤버 위치"
          });
        }

        map.setCenter(center);
        setIsMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError("네이버 지도를 불러오지 못했어요.");
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, locations, mapId, meeting]);

  if (clientId) {
    return (
      <div className="naver-map-wrap">
        <div id={mapId} className="naver-map-canvas" />
        {!isMapReady ? <p className="map-loading-text">{mapError ?? "네이버 지도를 불러오는 중"}</p> : null}
      </div>
    );
  }

  return (
    <div className="map-canvas">
      <div className="destination-radius">
        <span className="destination-pin">P</span>
      </div>
      {runners.map((runner, index) => (
        <button key={runner.userId} className={`runner-marker runner-marker-${index + 1}`} type="button" onClick={() => onSelectRunner(runner.userId)}>
          <span>{runner.user?.name ?? "멤버"}</span>
          <strong>말</strong>
          <em />
        </button>
      ))}
      {locations.slice(0, 2).map((location, index) => (
        <span key={location.userId} className={`live-location-dot live-location-dot-${index + 1}`}>
          {location.user?.name ?? "위치"}
        </span>
      ))}
      <p className="map-api-hint">네이버 지도 키를 넣으면 실제 지도가 표시됩니다.</p>
    </div>
  );
}

function loadNaverMaps(clientId: string) {
  if (window.naver?.maps) return Promise.resolve();
  if (window.__naverMapsLoadingPromise) return window.__naverMapsLoadingPromise;

  window.__naverMapsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load NAVER Maps."));
    document.head.appendChild(script);
  });

  return window.__naverMapsLoadingPromise;
}

function RunnerList({
  bets,
  onSelectRunner,
  runners
}: {
  bets: HorseBet[];
  onSelectRunner: (runnerId: string) => void;
  runners: ArrivalStatus[];
}) {
  return (
    <div className="runner-list">
      {runners.map((runner) => (
        <button key={runner.userId} className="runner-list-row" type="button" onClick={() => onSelectRunner(runner.userId)}>
          <span className="runner-face">말</span>
          <span>
            <strong>{runner.user?.name ?? "멤버"}</strong>
            <em>{bets.filter((bet) => bet.targetUserId === runner.userId).length}명 베팅 중</em>
          </span>
          <b aria-hidden="true">›</b>
        </button>
      ))}
    </div>
  );
}

function RunnerDetail({
  betError,
  bets,
  commentError,
  commentText,
  comments,
  isCommentSubmitting,
  onBet,
  onCommentChange,
  onCommentSubmit,
  runner
}: {
  betError: string | null;
  bets: HorseBet[];
  commentText: string;
  comments: MeetingComment[];
  commentError: string | null;
  isCommentSubmitting: boolean;
  onBet: (input: { targetUserId: string; predictedTime: string; amount: number }) => void;
  onCommentChange: (value: string) => void;
  onCommentSubmit: () => void;
  runner?: ArrivalStatus;
}) {
  const runnerBets = bets.filter((bet) => bet.targetUserId === runner?.userId);
  const total = runnerBets.reduce((sum, bet) => sum + bet.amount, 0);
  const [amount, setAmount] = useState("100");
  const [predictedTime, setPredictedTime] = useState(() => defaultPredictedTime());

  function handleBetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!runner) return;

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    onBet({
      targetUserId: runner.userId,
      predictedTime,
      amount: parsedAmount
    });
  }

  return (
    <div className="runner-detail">
      <div className="runner-detail-header">
        <span className="runner-face">말</span>
        <span>
          <strong>{runner?.user?.name ?? "멤버"}</strong>
          <em>{runnerBets.length}명 베팅 중</em>
        </span>
      </div>
      <form className="bet-form" onSubmit={handleBetSubmit}>
        <label>
          <span>예상 도착</span>
          <input type="time" value={predictedTime} onChange={(event) => setPredictedTime(event.target.value)} />
        </label>
        <label>
          <span>포인트</span>
          <input inputMode="numeric" min={1} type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <button type="submit" disabled={!runner}>
          베팅하기
        </button>
      </form>
      {betError ? <p className="live-error">{betError}</p> : null}

      <p className="bet-total">현재 총 {total}P가 걸려있어요.</p>
      {runnerBets.length === 0 ? <article className="bet-card">아직 베팅이 없어요.</article> : null}
      {runnerBets.map((bet) => (
        <article key={bet.id} className="bet-card">
          {bet.bettor?.name ?? "누군가"}님이 {formatTime(bet.predictedArrivedAt)} 도착에 {bet.amount}P 베팅했어요.
        </article>
      ))}

      <h2>의견</h2>
      <div className="comment-card">
        {comments.length === 0 ? <Comment name="시스템" text="아직 의견이 없어요." /> : null}
        {comments.map((comment) => (
          <Comment key={comment.id} name={comment.user?.name ?? "익명"} text={comment.content} />
        ))}
        {commentError ? <p className="live-error">{commentError}</p> : null}
        <form className="comment-input" onSubmit={(event) => {
          event.preventDefault();
          onCommentSubmit();
        }}>
          <input placeholder="메시지를 입력하세요." value={commentText} onChange={(event) => onCommentChange(event.target.value)} />
          <button type="submit" disabled={!commentText.trim() || isCommentSubmitting}>
            {isCommentSubmitting ? "…" : "↑"}
          </button>
        </form>
      </div>
    </div>
  );
}

function defaultPredictedTime() {
  const date = new Date(Date.now() + 15 * 60000);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function Comment({ name, text }: { name: string; text: string }) {
  return (
    <article className="comment-row">
      <strong>{name}</strong>
      <p>{text}</p>
    </article>
  );
}

function formatFullDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "long" }).format(date);
  return `${month}월 ${day}일 ${weekday}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatEarlyArrival(meeting: Meeting | undefined, member: ArrivalStatus) {
  if (!meeting || !member.arrivedAt) return "도착";
  const diff = Math.ceil((new Date(meeting.scheduledAt).getTime() - new Date(member.arrivedAt).getTime()) / 60000);
  if (diff < 0) return `${Math.abs(diff)}분 지각 도착`;
  if (diff === 0) return "정시에 도착";
  return `${diff}분 빨리 도착`;
}

function lateMinutes(meeting: Meeting | undefined, now: number) {
  if (!meeting) return 0;
  return Math.max(0, Math.ceil((now - new Date(meeting.scheduledAt).getTime()) / 60000));
}
