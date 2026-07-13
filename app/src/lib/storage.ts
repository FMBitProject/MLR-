import fs from "node:fs/promises";
import path from "node:path";

// Object storage for uploaded content files, behind a driver interface so the
// app code never touches the filesystem or S3 directly.
//
//   STORAGE_DRIVER=local  -> .data/uploads/<key> (dev; ephemeral on Vercel)
//   STORAGE_DRIVER=s3     -> S3 / Cloudflare R2 (production)
//
// Keys are opaque strings (we use the content version id).

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

function createS3Storage(): Storage {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("STORAGE_DRIVER=s3 but S3_BUCKET is not set");

  // Imported lazily so the local driver never pulls in the AWS SDK.
  type S3Module = typeof import("@aws-sdk/client-s3");
  let clientPromise: Promise<{ mod: S3Module; client: InstanceType<S3Module["S3Client"]> }> | null =
    null;
  const load = () => {
    clientPromise ??= import("@aws-sdk/client-s3").then((mod) => ({
      mod,
      client: new mod.S3Client({
        region: process.env.S3_REGION ?? "auto",
        endpoint: process.env.S3_ENDPOINT, // e.g. R2: https://<acct>.r2.cloudflarestorage.com
        credentials:
          process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
              }
            : undefined,
      }),
    }));
    return clientPromise;
  };

  const keyFor = (key: string) => `${process.env.S3_PREFIX ?? "uploads"}/${key}`;

  return {
    async put(key, data, contentType) {
      const { mod, client } = await load();
      await client.send(
        new mod.PutObjectCommand({
          Bucket: bucket,
          Key: keyFor(key),
          Body: data,
          ContentType: contentType,
        }),
      );
    },
    async get(key) {
      const { mod, client } = await load();
      try {
        const res = await client.send(
          new mod.GetObjectCommand({ Bucket: bucket, Key: keyFor(key) }),
        );
        const bytes = await res.Body?.transformToByteArray();
        return bytes ? Buffer.from(bytes) : null;
      } catch (e) {
        if ((e as { name?: string }).name === "NoSuchKey") return null;
        throw e;
      }
    },
    async exists(key) {
      const { mod, client } = await load();
      try {
        await client.send(new mod.HeadObjectCommand({ Bucket: bucket, Key: keyFor(key) }));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const storage: Storage =
  process.env.STORAGE_DRIVER === "s3" ? createS3Storage() : localStorage;
