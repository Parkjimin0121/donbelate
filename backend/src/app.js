import { loadDb } from "./db/jsonStore.js";
import { sendJson } from "./utils/http.js";
import { handleAuthRoutes } from "./routes/auth.js";
import { handleUserRoutes } from "./routes/users.js";
import { handleRoomRoutes } from "./routes/rooms.js";
import { handleMeetingRoutes } from "./routes/meetings.js";

export async function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const db = await loadDb();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const segments = url.pathname.split("/").filter(Boolean);
  const context = { req, res, db, url, segments };

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (await handleAuthRoutes(context)) return;
  if (await handleUserRoutes(context)) return;
  if (await handleRoomRoutes(context)) return;
  if (await handleMeetingRoutes(context)) return;

  sendJson(res, 404, { error: "Not found." });
}
