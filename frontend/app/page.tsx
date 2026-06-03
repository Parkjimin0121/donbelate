"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { deleteRoom, fetchMyNotifications, fetchMyRooms, fetchUpcomingMeetings, type AppNotification, type Meeting } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const TEXT = {
  login: "\uB85C\uADF8\uC778",
  userSuffix: " \uB2D8",
  roomActions: "\uBC29 \uC791\uC5C5",
  newRoom: "\uC0C8\uB85C\uC6B4 \uBC29 \uB9CC\uB4E4\uAE30",
  joinRoom: "\uAE30\uC874 \uBC29 \uCC38\uAC00\uD558\uAE30",
  notifications: "\uC54C\uB9BC",
  joinedRooms: "\uCC38\uAC00\uD55C \uBC29",
  loading: "\uBD88\uB7EC\uC624\uB294 \uC911",
  loginRequired: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD574\uC694",
  deleteRoomError: "\uBC29\uC744 \uC0AD\uC81C\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.",
  noRooms: "\uCC38\uAC00\uD55C \uBC29\uC774 \uC5C6\uC5B4\uC694",
  memberCount: "\uCC38\uAC00 \uC778\uC6D0",
  memberUnit: "\uBA85",
  upcomingMeetings: "\uB2E4\uAC00\uC624\uB294 \uC57D\uC18D",
  noMeetings: "\uC608\uC815\uB41C \uC57D\uC18D\uC774 \uC5C6\uC5B4\uC694",
  roomFallback: "\uBC29 \uC815\uBCF4 \uC5C6\uC74C",
  moveToRoom: "\uBC29\uC73C\uB85C \uC774\uB3D9",
  delete: "\uC0AD\uC81C",
  mainMenu: "\uC8FC\uC694 \uBA54\uB274",
  home: "\uD648",
  shop: "\uC0C1\uC810",
  bid: "\uC785\uCC30",
  mypage: "\uB9C8\uC774\uD398\uC774\uC9C0",
  timeFallback: "\uC57D\uC18D \uC2DC\uAC04 \uC5C6\uC74C"
};

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

  const notificationsQuery = useQuery({
    queryKey: ["me", "notifications", token],
    queryFn: () => fetchMyNotifications(token),
    enabled: Boolean(token)
  });

  const notifications = notificationsQuery.data ?? [];
  const roomCards = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);
  const meetingCards = useMemo(() => meetingsQuery.data ?? [], [meetingsQuery.data]);
  const visibleMeetings = meetingCards.slice(0, 3);
  const homeDensityClass = [
    "phone-frame",
    `home-room-count-${Math.min(roomCards.length, 3)}`,
    `home-meeting-count-${Math.min(visibleMeetings.length, 3)}`
  ].join(" ");

  async function handleDeleteRoom(roomId: string, roomName: string) {
    if (!token) return;

    const confirmed = window.confirm(`'${roomName}' ${TEXT.delete}?`);
    if (!confirmed) return;

    setDeleteError(null);
    try {
      await deleteRoom(roomId, token);
      await roomsQuery.refetch();
      await meetingsQuery.refetch();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : TEXT.deleteRoomError);
    }
  }

  return (
    <main className={homeDensityClass}>
      <header className="top-bar">
        <h1>DON&apos;T BE LATE</h1>
        {user ? (
          <span className="login-button user-name-label">{user.name}{TEXT.userSuffix}</span>
        ) : (
          <Link className="login-button" href="/login">
            {TEXT.login}
          </Link>
        )}
      </header>

      <section className="quick-actions" aria-label={TEXT.roomActions}>
        <Link className="action-card" href="/rooms/new">
          <span className="plus-box-icon" aria-hidden="true" />
          <span>{TEXT.newRoom}</span>
        </Link>
        <Link className="action-card" href="/rooms/join">
          <span className="search-icon" aria-hidden="true" />
          <span>{TEXT.joinRoom}</span>
        </Link>
      </section>

      {notifications.length > 0 ? (
        <section className="notification-panel" aria-label={TEXT.notifications}>
          {notifications.slice(0, 2).map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </section>
      ) : null}

      <section className="content-panel rooms-panel">
        <h2>{TEXT.joinedRooms}</h2>
        <div className="list-stack">
          {token && roomsQuery.isLoading ? <DarkCard label={TEXT.loading} /> : null}
          {!token ? <DarkCard label={TEXT.loginRequired} /> : null}
          {deleteError ? <p className="form-error room-error">{deleteError}</p> : null}
          {token && roomCards.length === 0 && !roomsQuery.isLoading ? <DarkCard label={TEXT.noRooms} /> : null}
          {roomCards.map((room) => (
            <DarkCard
              key={room.id}
              label={room.name}
              meta={`${TEXT.memberCount} ${room.memberCount ?? 0}${TEXT.memberUnit}`}
              href={`/rooms/${room.id}`}
              deletable={room.myRole === "host"}
              onDelete={() => handleDeleteRoom(room.id, room.name)}
            />
          ))}
        </div>
      </section>

      <section className="content-panel meetings-panel">
        <h2>{TEXT.upcomingMeetings}</h2>
        <div className="list-stack">
          {token && meetingsQuery.isLoading ? <DarkCard label={TEXT.loading} /> : null}
          {!token ? <DarkCard label={TEXT.loginRequired} /> : null}
          {token && visibleMeetings.length === 0 && !meetingsQuery.isLoading ? <DarkCard label={TEXT.noMeetings} /> : null}
          {visibleMeetings.map((meeting) => (
            <UpcomingMeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      </section>

      <nav className="bottom-nav" aria-label={TEXT.mainMenu}>
        <NavItem active icon="home" label={TEXT.home} />
        <NavItem icon="shop" label={TEXT.shop} />
        <NavItem icon="bid" label={TEXT.bid} href="/bid" />
        <NavItem icon="profile" label={TEXT.mypage} href="/mypage" />
      </nav>
    </main>
  );
}

function NotificationCard({ notification }: { notification: AppNotification }) {
  const content = (
    <>
      <strong>{notification.title}</strong>
      <span>{notification.message}</span>
    </>
  );

  return notification.href ? (
    <Link className="notification-card" href={notification.href}>
      {content}
    </Link>
  ) : (
    <article className="notification-card">{content}</article>
  );
}

function UpcomingMeetingCard({ meeting }: { meeting: Meeting }) {
  const roomName = meeting.room?.name ?? TEXT.roomFallback;
  const href = meeting.status === "bidding" ? `/bid/${meeting.id}` : meeting.status === "settling" ? `/meetings/${meeting.id}/settlement` : isMeetingStarted(meeting.scheduledAt) ? `/meetings/${meeting.id}/live` : undefined;

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
        <Link className="dark-card-link" href={href} aria-label={`${label} ${TEXT.moveToRoom}`}>
          {content}
        </Link>
      ) : (
        content
      )}
      {deletable ? (
        <button className="delete-button" type="button" aria-label={`${label} ${TEXT.delete}`} onClick={onDelete}>
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

function isMeetingStarted(value: string) {
  const scheduledAt = new Date(value).getTime();
  return Number.isFinite(scheduledAt) && scheduledAt <= Date.now();
}