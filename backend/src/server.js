import http from "node:http";
import { handleRequest } from "./app.js";
import { sendJson } from "./utils/http.js";

const PORT = Number(process.env.PORT || 4000);

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (error) {
    sendJson(res, error.status ?? 500, {
      error: error.message ?? "Internal server error."
    });
  }
});

server.listen(PORT, () => {
  console.log(`Don't Be Late backend listening on http://localhost:${PORT}`);
});
