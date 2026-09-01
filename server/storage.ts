// Independent S3-compatible object storage (works with AWS S3, Cloudflare R2,
// MinIO, Backblaze B2, DigitalOcean Spaces, ...). Configure via the S3_*
// environment variables (see .env.example). Files are uploaded server-side
// (buffered through this process) and downloaded via short-lived presigned
// GET URLs, so no bucket needs to be public and no secrets reach the client.
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  if (!ENV.s3Endpoint || !ENV.s3AccessKeyId || !ENV.s3SecretAccessKey || !ENV.s3Bucket) {
    throw new Error(
      "Storage config missing: set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_BUCKET",
    );
  }

  _client = new S3Client({
    region: ENV.s3Region || "auto",
    endpoint: ENV.s3Endpoint,
    forcePathStyle: ENV.s3ForcePathStyle,
    credentials: {
      accessKeyId: ENV.s3AccessKeyId,
      secretAccessKey: ENV.s3SecretAccessKey,
    },
  });
  return _client;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const client = getClient();
  const key = appendHashSuffix(normalizeKey(relKey));

  await client.send(
    new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    }),
  );

  return { key, url: `/api/storage/${key}` };
}

export async function storageGet(relKey: string): Promise<Uint8Array> {
  const client = getClient();
  const key = normalizeKey(relKey);
  const response = await client.send(
    new GetObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
    }),
  );
  if (!response.Body) {
    throw new Error("تعذر قراءة الملف من التخزين");
  }
  return new Uint8Array(await response.Body.transformToByteArray());
}

export async function storageGetSignedUrl(relKey: string, expiresInSeconds = 300): Promise<string> {
  const client = getClient();
  const key = normalizeKey(relKey);

  return getSignedUrl(client, new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}
