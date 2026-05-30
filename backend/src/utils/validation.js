import { httpError } from "./errors.js";

export function requireFields(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw httpError(400, `Missing required field: ${field}`);
    }
  }
}
