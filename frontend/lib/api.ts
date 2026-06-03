const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type Room = {
  id: string;
  name: string;
  code: string;
  hostUserId: string;
  maxMembers?: number | null;
  memberCount?: number;
  myRole?: string;
};

export type User = {
  id: string;
  name: string;
  loginName?: string;
  email?: string;
  profileImageUrl?: string | null;
};

export type RoomMember = {
  id: string;
  roomId: string;
  userId: string;
  role: "host" | "member" | string;
  joinedAt: string;
  user: User | null;
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type Meeting = {
  id: string;
  roomId: string;
  title: string;
  scheduledAt: string;
  locationName: string;
  latitude: number;
  longitude: number;
  capacity?: number | null;
  participantUserIds?: string[];
  finalLateFeePerMinute?: number | null;
  bidResult?: {
    finalLateFeePerMinute: number;
    selectedQuartile: number;
    quartiles: Array<{
      index: number;
      values: number[];
      min: number | null;
      max: number | null;
      average: number | null;
    }>;
  } | null;
  status?: "bidding" | "scheduled" | "settling" | "settled" | string;
  settledAt?: string | null;
  room?: Room | null;
};

export type Bid = {
  id: string;
  meetingId: string;
  userId: string;
  amountPerMinute: number;
  createdAt: string;
};

export type ArrivalStatus = {
  userId: string;
  user: User | null;
  arrived: boolean;
  arrivedAt: string | null;
  lateMinutes: number | null;
};

export type Checkin = {
  id: string;
  meetingId: string;
  userId: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  arrivedAt: string;
  createdAt: string;
};

export type LiveLocation = {
  id: string;
  meetingId: string;
  userId: string;
  latitude: number;
  longitude: number;
  isSharing: boolean;
  updatedAt: string;
  createdAt: string;
  user?: User | null;
};

export type HorseBet = {
  id: string;
  meetingId: string;
  bettorUserId: string;
  targetUserId: string;
  predictedArrivedAt: string;
  amount: number;
  createdAt: string;
  bettor?: User | null;
  target?: User | null;
};

export type MeetingComment = {
  id: string;
  meetingId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: User | null;
};

export type SettlementDistribution = {
  userId: string;
  lateMinutes: number;
  waitingMinutes: number;
  lateFee: number;
  reward: number;
};

export type Settlement = {
  id: string;
  meetingId: string;
  finalLateFeePerMinute: number;
  totalLateFee: number;
  totalWaitingMinutes: number;
  distributions: SettlementDistribution[];
  createdAt: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  meetingId?: string;
  roomId?: string;
  type: string;
  title: string;
  message: string;
  href?: string;
  readAt?: string | null;
  createdAt: string;
};
export type MeResponse = {
  user: User;
  pointBalance: number;
  noShowStack: number;
};

export type PointTransaction = {
  id: string;
  userId: string;
  meetingId?: string;
  type: string;
  amount: number;
  createdAt: string;
};

export type UserPointsResponse = {
  userId: string;
  balance: number;
  transactions: PointTransaction[];
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function fetchMyRooms(token: string | null) {
  return request<Room[]>("/me/rooms", {
    headers: authHeaders(token)
  });
}

export function fetchMe(token: string | null) {
  return request<MeResponse>("/me", {
    headers: authHeaders(token)
  });
}

export function fetchUserPoints(userId: string) {
  return request<UserPointsResponse>(`/users/${userId}/points`);
}

export function fetchMyNotifications(token: string | null) {
  return request<AppNotification[]>("/me/notifications", {
    headers: authHeaders(token)
  });
}
export function fetchUpcomingMeetings(token: string | null) {
  return request<Meeting[]>("/me/upcoming-meetings", {
    headers: authHeaders(token)
  });
}

export function fetchRoomMeetings(roomId: string, token: string | null = null) {
  return request<Meeting[]>(`/rooms/${roomId}/meetings`, {
    headers: authHeaders(token)
  });
}

export function fetchRoomMembers(roomId: string) {
  return request<RoomMember[]>(`/rooms/${roomId}/members`);
}

export function fetchMeeting(meetingId: string) {
  return request<Meeting>(`/meetings/${meetingId}`);
}

export function fetchMeetingBids(meetingId: string) {
  return request<Bid[]>(`/meetings/${meetingId}/bids`);
}

export function createBid(
  meetingId: string,
  input: { userId: string; amountPerMinute: number },
  token: string | null
) {
  return request<Bid>(`/meetings/${meetingId}/bids`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function finalizeMeetingBid(meetingId: string, token: string | null) {
  return request<Meeting>(`/meetings/${meetingId}/finalize-bid`, {
    method: "POST",
    headers: authHeaders(token)
  });
}

export function fetchArrivalStatus(meetingId: string) {
  return request<ArrivalStatus[]>(`/meetings/${meetingId}/arrival-status`);
}

export function createCheckin(
  meetingId: string,
  input: { userId: string; latitude: number; longitude: number; force?: boolean },
  token: string | null
) {
  return request<Checkin>(`/meetings/${meetingId}/checkins`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function fetchLiveLocations(meetingId: string) {
  return request<LiveLocation[]>(`/meetings/${meetingId}/locations`);
}

export function upsertLiveLocation(
  meetingId: string,
  input: { userId: string; latitude: number; longitude: number; isSharing?: boolean },
  token: string | null
) {
  return request<LiveLocation>(`/meetings/${meetingId}/locations`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function fetchHorseBets(meetingId: string) {
  return request<HorseBet[]>(`/meetings/${meetingId}/horse-bets`);
}

export function createHorseBet(
  meetingId: string,
  input: {
    bettorUserId: string;
    targetUserId: string;
    predictedArrivedAt: string;
    amount: number;
  },
  token: string | null
) {
  return request<HorseBet>(`/meetings/${meetingId}/horse-bets`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function fetchMeetingComments(meetingId: string) {
  return request<MeetingComment[]>(`/meetings/${meetingId}/comments`);
}

export function createMeetingComment(
  meetingId: string,
  input: { userId: string; content: string },
  token: string | null
) {
  return request<MeetingComment>(`/meetings/${meetingId}/comments`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function settleMeeting(meetingId: string, token: string | null) {
  return request<Settlement>(`/meetings/${meetingId}/settle`, {
    method: "POST",
    headers: authHeaders(token)
  });
}

export function createRoom(
  input: { name: string; maxMembers: number },
  token: string | null
) {
  return request<Room>("/rooms", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function joinRoom(input: { code: string }, token: string | null) {
  return request<Room>("/rooms/join", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function deleteRoom(roomId: string, token: string | null) {
  return request<{ ok: true }>(`/rooms/${roomId}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
}

export function leaveRoom(roomId: string, token: string | null) {
  return request<{ ok: true }>(`/rooms/${roomId}/leave`, {
    method: "POST",
    headers: authHeaders(token)
  });
}

export function createMeeting(
  input: {
    roomId: string;
    title: string;
    scheduledAt: string;
    locationName: string;
    latitude: number;
    longitude: number;
    capacity?: number | null;
    participantUserIds?: string[];
  },
  token: string | null
) {
  return request<Meeting>("/meetings", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function createUser(input: { name: string }) {
  return request<User>("/users", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function signup(input: { name: string; password: string }) {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function login(input: { name: string; password: string }) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function logout(token: string | null) {
  return request<{ ok: true }>("/auth/logout", {
    method: "POST",
    headers: authHeaders(token)
  });
}

