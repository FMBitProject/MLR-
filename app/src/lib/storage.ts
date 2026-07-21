import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, t } from "./db";

// Storage for uploaded content files, behind a driver interface so the app
// code never touches the filesystem or database column directly.
//
//   STORAGE_DRIVER=local  -> .data/uploads/<key> (ephemeral; local dev only —
//                             never durable on Vercel's serverless filesystem)
//   STORAGE_DRIVER=db     -> Postgres bytea column on content_versions (default;
//                             uploads are capped at 4MB — see lib/upload.ts —
//                             so storing them inline avoids needing a separate
//                             object storage account)
//
// Note: an S3/R2 driver here is also the way past the 4MB upload cap, since it
// would let the browser PUT to storage directly instead of routing the bytes
// through a Server Action (and let downloads redirect to a signed URL rather
// than stream back through a Function).
//
// Keys are content version ids.

export interface Storage {
  put(key: string, data: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
}

const LOCAL_DIR = path.join(process.cwd(), ".data", "uploads");

const localStorage: Storage = {
  async put(key, data) {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, key), data);
  },
  async get(key) {
    try {
      return await fs.readFile(path.join(LOCAL_DIR, key));
    } catch {
      return null;
    }
  },
  async exists(key) {
    try {
      await fs.access(path.join(LOCAL_DIR, key));
      return true;
    } catch {
      return false;
    }
  },
};

// key == content version id. put() is only ever called right after the
// version row is inserted (see createVersionWithPipeline), so an update here
// is safe — the row always already exists.
const dbStorage: Storage = {
  async put(key, data) {
    await db.update(t.contentVersions).set({ fileData: data }).where(eq(t.contentVersions.id, key));
  },
  async get(key) {
    const row = (
      await db
        .select({ fileData: t.contentVersions.fileData })
        .from(t.contentVersions)
        .where(eq(t.contentVersions.id, key))
    )[0];
    return row?.fileData ?? null;
  },
  async exists(key) {
    const row = (
      await db
        .select({ fileData: t.contentVersions.fileData })
        .from(t.contentVersions)
        .where(eq(t.contentVersions.id, key))
    )[0];
    return !!row?.fileData;
  },
};

export const storage: Storage = process.env.STORAGE_DRIVER === "local" ? localStorage : dbStorage;
