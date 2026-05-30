import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
const DB_PATH = join(DATA_DIR, "db.json");
const STATE_ID = "dontbelate";

const initialDb = {
  users: [],
  rooms: [],
  roomMembers: [],
  meetings: [],
  bids: [],
  checkins: [],
  liveLocations: [],
  horseBets: [],
  meetingComments: [],
  settlements: [],
  pointTransactions: [],
  sessions: []
};

let poolPromise = null;

export async function loadDb() {
  if (process.env.DATABASE_URL) {
    return loadPostgresDb();
  }

  await mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await readFile(DB_PATH, "utf8");
    return { ...initialDb, ...JSON.parse(raw) };
  } catch {
    await saveDb(initialDb);
    return structuredClone(initialDb);
  }
}

export async function saveDb(db) {
  if (process.env.DATABASE_URL) {
    await savePostgresDb(db);
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

async function loadPostgresDb() {
  const pool = await getPool();
  await ensureStateTable(pool);

  const result = await pool.query("select data from app_state where id = $1", [STATE_ID]);
  if (result.rowCount > 0) {
    return normalizeDb(result.rows[0].data);
  }

  const db = structuredClone(initialDb);
  await savePostgresDb(db);
  return db;
}

async function savePostgresDb(db) {
  const pool = await getPool();
  await ensureStateTable(pool);
  await pool.query(
    `
      insert into app_state (id, data, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (id)
      do update set data = excluded.data, updated_at = now()
    `,
    [STATE_ID, JSON.stringify(normalizeDb(db))]
  );
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = import("pg").then(({ Pool }) => {
      const shouldUseSsl =
        process.env.DATABASE_SSL === "true" ||
        /render\.com|amazonaws\.com|supabase\./i.test(process.env.DATABASE_URL ?? "");

      return new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined
      });
    });
  }

  return poolPromise;
}

async function ensureStateTable(pool) {
  await pool.query(`
    create table if not exists app_state (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);
}

function normalizeDb(db) {
  return {
    ...structuredClone(initialDb),
    ...(db ?? {})
  };
}
