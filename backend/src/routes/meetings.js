import { randomUUID } from "node:crypto";
import { saveDb } from "../db/jsonStore.js";
import { drawLateFee } from "../services/bids.js";
import { settleMeeting } from "../services/settlements.js";
import { distanceMeters } from "../utils/geo.js";
import { readJson, sendJson } from "../utils/http.js";
import { httpError } from "../utils/errors.js";
import { minutesLate, nowIso } from "../utils/time.js";
import { requireFields } from "../utils/validation.js";

export async function handleMeetingRoutes({ req, res, db, url, segments }) {
  if (req.method === "POST" && url.pathname === "/meetings") {
    const body = await readJson(req);
    requireFields(body, ["roomId", "title", "scheduledAt", "locationName", "latitude", "longitude"]);

    const meeting = {
      id: randomUUID(),
      roomId: body.roomId,
      title: body.title,
      scheduledAt: body.scheduledAt,
      locationName: body.locationName,
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      capacity: body.capacity ?? null,
      participantUserIds: normalizeParticipantUserIds(db, body.roomId, body.participantUserIds),
      bidDeadline: body.bidDeadline ?? null,
      finalLateFeePerMinute: null,
      bidResult: null,
      status: "bidding",
      createdAt: nowIso()
    };

    db.meetings.push(meeting);
    await saveDb(db);
    sendJson(res, 201, meeting);
    return true;
  }

  if (req.method === "GET" && segments[0] === "rooms" && segments[2] === "meetings") {
    const roomId = segments[1];
    sendJson(res, 200, db.meetings.filter((meeting) => meeting.roomId === roomId));
    return true;
  }

  if (req.method === "GET" && segments[0] === "meetings" && segments[1] && !segments[2]) {
    const meeting = findMeeting(db, segments[1]);
    sendJson(res, 200, {
      ...meeting,
      room: db.rooms.find((room) => room.id === meeting.roomId) ?? null
    });
    return true;
  }

  if (req.method === "POST" && segments[0] === "meetings" && segments[2] === "bids") {
    await createBid({ req, res, db, meetingId: segments[1] });
    return true;
  }

  if (req.method === "GET" && segments[0] === "meetings" && segments[2] === "bids") {
    const meetingId = segments[1];
    sendJson(res, 200, db.bids.filter((bid) => bid.meetingId === meetingId));
    return true;
  }

  if (req.method === "POST" && segments[0] === "meetings" && segments[2] === "finalize-bid") {
    await finalizeBid({ res, db, meetingId: segments[1] });
    return true;
  }

  if (req.method === "POST" && segments[0] === "meetings" && segments[2] === "checkins") {
    await createCheckin({ req, res, db, meetingId: segments[1] });
    return true;
  }

  if (req.method === "GET" && segments[0] === "meetings" && segments[2] === "arrival-status") {
    sendArrivalStatus({ res, db, meetingId: segments[1] });
    return true;
  }

  if (req.method === "GET" && segments[0] === "meetings" && segments[2] === "locations") {
    sendLiveLocations({ res, db, meetingId: segments[1] });
    return true;
  }

  if (req.method === "POST" && segments[0] === "meetings" && segments[2] === "locations") {
    await upsertLiveLocation({ req, res, db, meetingId: segments[1] });
    return true;
  }

  if (req.method === "GET" && segments[0] === "meetings" && segments[2] === "horse-bets") {
    sendHorseBets({ res, db, meetingId: segments[1] });
    return true;
  }

  if (req.method === "POST" && segments[0] === "meetings" && segments[2] === "horse-bets") {
    await createHorseBet({ req, res, db, meetingId: segments[1] });
    return true;
  }

  if (req.method === "GET" && segments[0] === "meetings" && segments[2] === "comments") {
    sendMeetingComments({ res, db, meetingId: segments[1] });
    return true;
  }

  if (req.method === "POST" && segments[0] === "meetings" && segments[2] === "comments") {
    await createMeetingComment({ req, res, db, meetingId: segments[1] });
    return true;
  }

  if (req.method === "POST" && segments[0] === "meetings" && segments[2] === "settle") {
    const meeting = findMeeting(db, segments[1]);
    const settlement = settleMeeting(db, meeting);
    await saveDb(db);
    sendJson(res, 200, settlement);
    return true;
  }

  return false;
}

async function createBid({ req, res, db, meetingId }) {
  const meeting = findMeeting(db, meetingId);

  const body = await readJson(req);
  requireFields(body, ["userId", "amountPerMinute"]);
  if (!isMeetingParticipant(meeting, body.userId)) {
    throw httpError(403, "Only meeting participants can bid.");
  }

  const amountPerMinute = Number(body.amountPerMinute);
  if (!Number.isFinite(amountPerMinute) || amountPerMinute <= 0) {
    throw httpError(400, "amountPerMinute must be a positive number.");
  }

  db.bids = db.bids.filter((bid) => !(bid.meetingId === meetingId && bid.userId === body.userId));

  const bid = {
    id: randomUUID(),
    meetingId,
    userId: body.userId,
    amountPerMinute,
    createdAt: nowIso()
  };

  db.bids.push(bid);
  await saveDb(db);
  sendJson(res, 201, bid);
}

async function finalizeBid({ res, db, meetingId }) {
  const meeting = findMeeting(db, meetingId);
  const bids = db.bids.filter((bid) => bid.meetingId === meetingId);
  if (bids.length === 0) throw httpError(409, "No bids submitted.");

  const bidResult = drawLateFee(bids.map((bid) => bid.amountPerMinute));
  meeting.bidResult = bidResult;
  meeting.finalLateFeePerMinute = bidResult.finalLateFeePerMinute;
  meeting.status = "scheduled";

  await saveDb(db);
  sendJson(res, 200, meeting);
}

async function createCheckin({ req, res, db, meetingId }) {
  const meeting = findMeeting(db, meetingId);
  const body = await readJson(req);
  requireFields(body, ["userId", "latitude", "longitude"]);
  if (!isMeetingParticipant(meeting, body.userId)) {
    throw httpError(403, "Only meeting participants can check in.");
  }

  const userLocation = {
    latitude: Number(body.latitude),
    longitude: Number(body.longitude)
  };
  const meetingLocation = {
    latitude: meeting.latitude,
    longitude: meeting.longitude
  };
  const distance = distanceMeters(userLocation, meetingLocation);

  if (distance > 50 && body.force !== true) {
    throw httpError(
      409,
      `Check-in is only available within 50m. Current distance: ${Math.round(distance)}m.`
    );
  }

  db.checkins = db.checkins.filter(
    (checkin) => !(checkin.meetingId === meetingId && checkin.userId === body.userId)
  );

  const checkin = {
    id: randomUUID(),
    meetingId,
    userId: body.userId,
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
    distanceMeters: Math.round(distance),
    arrivedAt: body.arrivedAt ?? nowIso(),
    createdAt: nowIso()
  };

  db.checkins.push(checkin);
  await saveDb(db);
  sendJson(res, 201, checkin);
}

function sendArrivalStatus({ res, db, meetingId }) {
  const meeting = findMeeting(db, meetingId);
  const members = getMeetingRoomMembers(db, meeting);
  const status = members.map((member) => {
    const checkin = db.checkins.find(
      (item) => item.meetingId === meetingId && item.userId === member.userId
    );

    return {
      userId: member.userId,
      user: db.users.find((user) => user.id === member.userId) ?? null,
      arrived: Boolean(checkin),
      arrivedAt: checkin?.arrivedAt ?? null,
      lateMinutes: checkin ? minutesLate(meeting.scheduledAt, checkin.arrivedAt) : null
    };
  });

  sendJson(res, 200, status);
}

function sendLiveLocations({ res, db, meetingId }) {
  const meeting = findMeeting(db, meetingId);
  const memberIds = new Set(getMeetingRoomMembers(db, meeting).map((member) => member.userId));
  const latestByUserId = new Map();

  for (const location of db.liveLocations.filter((item) => item.meetingId === meetingId)) {
    if (!memberIds.has(location.userId)) continue;
    const previous = latestByUserId.get(location.userId);
    if (!previous || new Date(location.updatedAt) > new Date(previous.updatedAt)) {
      latestByUserId.set(location.userId, location);
    }
  }

  sendJson(
    res,
    200,
    [...latestByUserId.values()].map((location) => ({
      ...location,
      user: db.users.find((user) => user.id === location.userId) ?? null
    }))
  );
}

async function upsertLiveLocation({ req, res, db, meetingId }) {
  const meeting = findMeeting(db, meetingId);
  const body = await readJson(req);
  requireFields(body, ["userId", "latitude", "longitude"]);
  if (!isMeetingParticipant(meeting, body.userId)) {
    throw httpError(403, "Only meeting participants can share location.");
  }

  db.liveLocations = db.liveLocations.filter(
    (location) => !(location.meetingId === meetingId && location.userId === body.userId)
  );

  const location = {
    id: randomUUID(),
    meetingId,
    userId: body.userId,
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    isSharing: body.isSharing !== false,
    updatedAt: nowIso(),
    createdAt: nowIso()
  };

  db.liveLocations.push(location);
  await saveDb(db);
  sendJson(res, 201, location);
}

function sendHorseBets({ res, db, meetingId }) {
  findMeeting(db, meetingId);
  const bets = db.horseBets
    .filter((bet) => bet.meetingId === meetingId)
    .map((bet) => ({
      ...bet,
      bettor: db.users.find((user) => user.id === bet.bettorUserId) ?? null,
      target: db.users.find((user) => user.id === bet.targetUserId) ?? null
    }));

  sendJson(res, 200, bets);
}

async function createHorseBet({ req, res, db, meetingId }) {
  const meeting = findMeeting(db, meetingId);
  const body = await readJson(req);
  requireFields(body, ["bettorUserId", "targetUserId", "predictedArrivedAt", "amount"]);
  if (!isMeetingParticipant(meeting, body.bettorUserId) || !isMeetingParticipant(meeting, body.targetUserId)) {
    throw httpError(403, "Only meeting participants can bet.");
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw httpError(400, "amount must be a positive number.");
  }

  const bet = {
    id: randomUUID(),
    meetingId,
    bettorUserId: body.bettorUserId,
    targetUserId: body.targetUserId,
    predictedArrivedAt: body.predictedArrivedAt,
    amount,
    createdAt: nowIso()
  };

  db.horseBets.push(bet);
  await saveDb(db);
  sendJson(res, 201, bet);
}

function sendMeetingComments({ res, db, meetingId }) {
  findMeeting(db, meetingId);
  const comments = db.meetingComments
    .filter((comment) => comment.meetingId === meetingId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((comment) => ({
      ...comment,
      user: db.users.find((user) => user.id === comment.userId) ?? null
    }));

  sendJson(res, 200, comments);
}

async function createMeetingComment({ req, res, db, meetingId }) {
  const meeting = findMeeting(db, meetingId);
  const body = await readJson(req);
  requireFields(body, ["userId", "content"]);
  if (!isMeetingParticipant(meeting, body.userId)) {
    throw httpError(403, "Only meeting participants can comment.");
  }

  const content = String(body.content).trim();
  if (!content) throw httpError(400, "content must not be empty.");

  const comment = {
    id: randomUUID(),
    meetingId,
    userId: body.userId,
    content,
    createdAt: nowIso()
  };

  db.meetingComments.push(comment);
  await saveDb(db);
  sendJson(res, 201, {
    ...comment,
    user: db.users.find((user) => user.id === comment.userId) ?? null
  });
}

function findMeeting(db, meetingId) {
  const meeting = db.meetings.find((item) => item.id === meetingId);
  if (!meeting) throw httpError(404, "Meeting not found.");
  return meeting;
}

function normalizeParticipantUserIds(db, roomId, participantUserIds) {
  const roomMemberIds = new Set(
    db.roomMembers.filter((member) => member.roomId === roomId).map((member) => member.userId)
  );

  if (!Array.isArray(participantUserIds)) return [...roomMemberIds];

  const selectedIds = participantUserIds
    .map((userId) => String(userId))
    .filter((userId, index, ids) => roomMemberIds.has(userId) && ids.indexOf(userId) === index);

  return selectedIds.length > 0 ? selectedIds : [...roomMemberIds];
}

function getMeetingRoomMembers(db, meeting) {
  const members = db.roomMembers.filter((member) => member.roomId === meeting.roomId);
  if (!Array.isArray(meeting.participantUserIds) || meeting.participantUserIds.length === 0) return members;

  const participantIds = new Set(meeting.participantUserIds);
  return members.filter((member) => participantIds.has(member.userId));
}

function isMeetingParticipant(meeting, userId) {
  if (!Array.isArray(meeting.participantUserIds) || meeting.participantUserIds.length === 0) return true;
  return meeting.participantUserIds.includes(userId);
}
