import { randomUUID } from "node:crypto";
import { saveDb } from "../db/jsonStore.js";
import { findSessionFromRequest } from "./auth.js";
import { publicUser } from "../services/auth.js";
import { getPointBalance } from "../services/points.js";
import { readJson, sendJson } from "../utils/http.js";
import { requireFields } from "../utils/validation.js";
import { nowIso } from "../utils/time.js";

export async function handleUserRoutes({ req, res, db, url, segments }) {
  if (req.method === "POST" && url.pathname === "/users") {
    const body = await readJson(req);
    requireFields(body, ["name"]);

    const user = {
      id: randomUUID(),
      name: body.name,
      profileImageUrl: body.profileImageUrl ?? null,
      createdAt: nowIso()
    };

    db.users.push(user);
    await saveDb(db);
    sendJson(res, 201, user);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/me") {
    const session = findSessionFromRequest(req, db);
    const user = db.users.find((item) => item.id === session.userId);
    sendJson(res, 200, {
      user: publicUser(user),
      pointBalance: getPointBalance(db, session.userId)
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/me/rooms") {
    const session = findSessionFromRequest(req, db);
    const memberships = db.roomMembers.filter((member) => member.userId === session.userId);
    const membershipByRoomId = new Map(
      memberships.map((membership) => [membership.roomId, membership])
    );
    const roomIds = new Set([
      ...memberships.map((membership) => membership.roomId),
      ...db.rooms.filter((room) => room.hostUserId === session.userId).map((room) => room.id)
    ]);
    const rooms = [...roomIds]
      .map((roomId) => {
        const room = db.rooms.find((item) => item.id === roomId);
        if (!room) return null;
        const membership = membershipByRoomId.get(room.id);
        return {
          ...room,
          myRole: membership?.role ?? "host",
          memberCount: db.roomMembers.filter((member) => member.roomId === room.id).length
        };
      })
      .filter(Boolean);

    sendJson(res, 200, rooms);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/me/upcoming-meetings") {
    const session = findSessionFromRequest(req, db);
    const myRoomIds = db.roomMembers
      .filter((member) => member.userId === session.userId)
      .map((member) => member.roomId);
    const now = Date.now();
    const meetings = db.meetings
      .filter(
        (meeting) =>
          myRoomIds.includes(meeting.roomId) &&
          isVisibleMeetingForUser(meeting, session.userId) &&
          (meeting.status === "bidding" || new Date(meeting.scheduledAt).getTime() >= now)
      )
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .map((meeting) => ({
        ...meeting,
        room: db.rooms.find((room) => room.id === meeting.roomId) ?? null
      }));

    sendJson(res, 200, meetings);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/users") {
    sendJson(
      res,
      200,
      db.users.map((user) => ({
        ...publicUser(user),
        pointBalance: getPointBalance(db, user.id)
      }))
    );
    return true;
  }

  if (req.method === "GET" && segments[0] === "users" && segments[2] === "points") {
    const userId = segments[1];
    sendJson(res, 200, {
      userId,
      balance: getPointBalance(db, userId),
      transactions: db.pointTransactions.filter((transaction) => transaction.userId === userId)
    });
    return true;
  }

  return false;
}

function isVisibleMeetingForUser(meeting, userId) {
  const participantIds = Array.isArray(meeting.participantUserIds) ? meeting.participantUserIds : [];
  if (participantIds.length === 0) {
    if (meeting.createdByUserId) return meeting.createdByUserId === userId;
    return true;
  }
  if (meeting.createdByUserId && Number(meeting.capacity) === 1 && participantIds.length > 1) {
    return meeting.createdByUserId === userId;
  }
  if (Number(meeting.capacity) > 0 && participantIds.length > Number(meeting.capacity)) {
    return participantIds.slice(0, Number(meeting.capacity)).includes(userId);
  }
  return participantIds.includes(userId);
}
