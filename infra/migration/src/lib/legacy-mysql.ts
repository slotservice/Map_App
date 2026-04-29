import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';

let pool: Pool | null = null;

export function getLegacyPool(): Pool {
  if (pool) return pool;
  pool = mysql.createPool({
    host: must('LEGACY_DB_HOST'),
    port: Number(process.env.LEGACY_DB_PORT ?? '3306'),
    user: must('LEGACY_DB_USER'),
    password: process.env.LEGACY_DB_PASSWORD ?? '',
    database: must('LEGACY_DB_NAME'),
    connectionLimit: 4,
    // Legacy MariaDB stored zips as numbers in some cases — don't let
    // mysql2 silently coerce empty strings to 0 elsewhere.
    typeCast: (field, next) => {
      if (field.type === 'JSON') return field.string();
      return next();
    },
  });
  return pool;
}

export async function legacyQuery<T extends RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await getLegacyPool().query<T[]>(sql, params);
  return rows;
}

export async function closeLegacy(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// ---- Row shapes (snake_case) -----------------------------------------------

export interface LegacyUserRow extends RowDataPacket {
  id: number;
  email: string;
  username: string;
  password: string; // bcrypt $2y$
  type: number; // 1=admin, 2=vendor, 4=worker
  phone: string | null;
  address: string | null;
  state: string | null;
  zip: string | null;
  status: number;
  created_at: string;
  updated_at: string;
  del_flg: number;
}

export interface LegacyMapRow extends RowDataPacket {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  del_flg: number;
}

export interface LegacyTaskRow extends RowDataPacket {
  id: number;
  map_id: number;
  store_id: number;
  name: string; // store name (legacy mis-naming)
  data: string; // JSON
  status: number; // 0=new, 1=pending, 2=complete
  client: number;
  worker: number | null;
  created_at: string;
  updated_at: string | null;
  del_flg: number;
}

export interface LegacyCompletionRow extends RowDataPacket {
  id: number;
  task_id: number;
  worker_id: number | null;
  images: string | null; // stringified JSON array
  checks: string | null;
  comments: string | null;
  trackstop: number;
  satisfied: number;
  firstname: string;
  lastname: string | null;
  signature: string | null; // path "signature/sign-….png"
  created_at: string;
  updated_at: string;
}

export interface LegacyMissingTagRow extends RowDataPacket {
  id: number;
  task_id: number;
  comment: string | null;
  img0: string | null;
  img1: string | null;
  img2: string | null;
  img3: string | null;
  worker_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface LegacyAssignsRow extends RowDataPacket {
  id: number;
  map_id: number | null;
  user_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LegacyTagEmailRow extends RowDataPacket {
  id: number;
  map_id: number | null;
  email: string;
  created_at: string;
  updated_at: string;
}
