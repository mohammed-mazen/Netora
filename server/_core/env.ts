export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Email (lowercase-compared) that is auto-promoted to role="admin" on registration.
  ownerEmail: process.env.OWNER_EMAIL ?? "",
  isProduction: process.env.NODE_ENV === "production",

  // S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, Backblaze B2, ...).
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "auto",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "",
  // Set to "true" for providers that require path-style addressing (e.g. MinIO).
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
};
