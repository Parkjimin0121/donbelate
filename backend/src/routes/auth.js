import { randomUUID } from "node:crypto";
import { saveDb } from "../db/jsonStore.js";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  normalizeLoginName,
  publicUser,
  verifyPassword
} from "../services/auth.js";
import { httpError } from "../utils/errors.js";
import { readJson, sendJson } from "../utils/http.js";
import { nowIso } from "../utils/time.js";
import { requireFields } from "../utils/validation.js";

export async function handleAuthRoutes({ req, res, db, url }) {
  if (req.method === "POST" && url.pathname === "/auth/signup") {
    const body = await readJson(req);
    requireFields(body, ["password", "name"]);

    const loginName = normalizeLoginName(body.name);
    const email = body.email ? normalizeEmail(body.email) : `${loginName}@dontbelate.local`;
    if (db.users.some((user) => user.loginName === loginName || user.email === email)) {
      throw httpError(409, "Name is already registered.");
    }

    const user = {
      id: randomUUID(),
      email,
      loginName,
      name: body.name,
      profileImageUrl: body.profileImageUrl ?? null,
      passwordHash: hashPassword(body.password),
      createdAt: nowIso()
    };
    db.users.push(user);

    const token = createSessionToken();
    db.sessions.push({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashSessionToken(token),
      createdAt: nowIso()
    });

    await saveDb(db);
    sendJson(res, 201, { user: publicUser(user), token });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/auth/login") {
    const body = await readJson(req);
    requireFields(body, ["password"]);

    const loginName = normalizeLoginName(body.name ?? body.email ?? "");
    if (!loginName) throw httpError(400, "Missing required field: name");

    const user = db.users.find(
      (item) => item.loginName === loginName || item.email === normalizeEmail(loginName)
    );
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      throw httpError(401, "Invalid name or password.");
    }

    const token = createSessionToken();
    db.sessions.push({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashSessionToken(token),
      createdAt: nowIso()
    });

    await saveDb(db);
    sendJson(res, 200, { user: publicUser(user), token });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/auth/me") {
    const session = findSessionFromRequest(req, db);
    const user = db.users.find((item) => item.id === session.userId);
    sendJson(res, 200, { user: publicUser(user) });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/auth/logout") {
    const token = readBearerToken(req);
    if (token) {
      const tokenHash = hashSessionToken(token);
      db.sessions = db.sessions.filter((session) => session.tokenHash !== tokenHash);
      await saveDb(db);
    }

    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

export function findSessionFromRequest(req, db) {
  const token = readBearerToken(req);
  if (!token) throw httpError(401, "Missing bearer token.");

  const tokenHash = hashSessionToken(token);
  const session = db.sessions.find((item) => item.tokenHash === tokenHash);
  if (!session) throw httpError(401, "Invalid session.");

  return session;
}

export function readBearerToken(req) {
  const authorization = req.headers.authorization ?? "";
  const [type, token] = authorization.split(" ");
  return type?.toLowerCase() === "bearer" ? token : null;
}
