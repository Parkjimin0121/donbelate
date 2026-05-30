import { randomUUID } from "node:crypto";
import { saveDb } from "../db/jsonStore.js";
import { findSessionFromRequest, readBearerToken } from "./auth.js";
import { makeRoomCode } from "../services/rooms.js";
import { readJson, sendJson } from "../utils/http.js";
import { httpError } from "../utils/errors.js";
import { requireFields } from "../utils/validation.js";
import { nowIso } from "../utils/time.js";

export async function handleRoomRoutes({ req, res, db, url, segments }) {
  if (req.method === "POST" && url.pathname === "/rooms") {
    const body = await readJson(req);
    requireFields(body, ["name", "maxMembers"]);

    const session = readBearerToken(req) ? findSessionFromRequest(req, db) : null;
    const hostUserId = session?.userId ?? body.hostUserId;
    if (!hostUserId) throw httpError(401, "Login is required to create a room.");

    const maxMembers = Number(body.maxMembers);
    if (!Number.isInteger(maxMembers) || maxMembers < 1 || maxMembers > 10) {
      throw httpError(400, "maxMembers must be an integer between 1 and 10.");
    }

    const room = {
      id: randomUUID(),
      name: body.name,
      maxMembers,
      code: makeRoomCode(),
      hostUserId,
      createdAt: nowIso()
    };

    db.rooms.push(room);
    db.roomMembers.push({
      id: randomUUID(),
      roomId: room.id,
      userId: hostUserId,
      role: "host",
      joinedAt: nowIso()
    });

    await saveDb(db);
    sendJson(res, 201, room);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/rooms") {
    sendJson(res, 200, db.rooms);
    return true;
  }

  if (req.method === "DELETE" && segments[0] === "rooms" && segments[1] && !segments[2]) {
    const session = findSessionFromRequest(req, db);
    const roomId = segments[1];
    const room = db.rooms.find((item) => item.id === roomId);
    if (!room) throw httpError(404, "Room not found.");
    if (room.hostUserId !== session.userId) {
      throw httpError(403, "Only the room host can delete this room.");
    }

    const meetingIds = db.meetings
      .filter((meeting) => meeting.roomId === roomId)
      .map((meeting) => meeting.id);

    db.rooms = db.rooms.filter((item) => item.id !== roomId);
    db.roomMembers = db.roomMembers.filter((member) => member.roomId !== roomId);
    db.meetings = db.meetings.filter((meeting) => meeting.roomId !== roomId);
    db.bids = db.bids.filter((bid) => !meetingIds.includes(bid.meetingId));
    db.checkins = db.checkins.filter((checkin) => !meetingIds.includes(checkin.meetingId));
    db.settlements = db.settlements.filter(
      (settlement) => !meetingIds.includes(settlement.meetingId)
    );
    db.pointTransactions = db.pointTransactions.filter(
      (transaction) => !meetingIds.includes(transaction.meetingId)
    );

    await saveDb(db);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/rooms/join") {
    const body = await readJson(req);
    requireFields(body, ["code"]);

    const session = readBearerToken(req) ? findSessionFromRequest(req, db) : null;
    const userId = session?.userId ?? body.userId;
    if (!userId) throw httpError(401, "Login is required to join a room.");

    const room = db.rooms.find((item) => item.code === body.code.toUpperCase());
    if (!room) throw httpError(404, "Room code not found.");

    const exists = db.roomMembers.some(
      (member) => member.roomId === room.id && member.userId === userId
    );

    if (!exists) {
      db.roomMembers.push({
        id: randomUUID(),
        roomId: room.id,
        userId,
        role: "member",
        joinedAt: nowIso()
      });
    }

    await saveDb(db);
    sendJson(res, 200, room);
    return true;
  }

  if (req.method === "GET" && segments[0] === "rooms" && segments[2] === "members") {
    const roomId = segments[1];
    const members = db.roomMembers
      .filter((member) => member.roomId === roomId)
      .map((member) => ({
        ...member,
        user: db.users.find((user) => user.id === member.userId) ?? null
      }));

    sendJson(res, 200, members);
    return true;
  }

  return false;
}
