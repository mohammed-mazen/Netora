import { execFile } from "node:child_process";

export type MysqldumpCommand = {
  bin: string;
  args: string[];
  env: Record<string, string>;
};

/**
 * Builds a mysqldump invocation from a MySQL DATABASE_URL (mysql://user:pass@host:port/db).
 *
 * Security: the password is passed through the MYSQL_PWD environment variable,
 * never as a CLI argument, so it cannot leak through `ps`/process listings or
 * shell history. The rest of the connection is passed as discrete argv entries
 * (no shell string interpolation), which also makes the command injection-proof
 * for weird-but-valid hostnames/database names.
 */
export function buildMysqldumpCommand(databaseUrl: string): MysqldumpCommand {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL غير صالحة لإنشاء أمر النسخ الاحتياطي");
  }
  if (parsed.protocol !== "mysql:") {
    throw new Error(`نظام قاعدة البيانات غير مدعوم لـ mysqldump: ${parsed.protocol}`);
  }
  const databaseName = parsed.pathname.replace(/^\//, "");
  if (!databaseName) {
    throw new Error("رابط قاعدة البيانات لا يحمل اسم قاعدة بيانات لنسخها");
  }
  const port = parsed.port || "3306";
  const args = [
    "-h", parsed.hostname,
    "-P", port,
    "-u", decodeURIComponent(parsed.username),
    "--single-transaction",
    "--no-tablespaces",
    databaseName,
  ];
  const env: Record<string, string> = {};
  if (parsed.password) {
    env.MYSQL_PWD = decodeURIComponent(parsed.password);
  }
  return { bin: "mysqldump", args, env };
}

export function mysqldumpDatabaseUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

/**
 * Runs mysqldump against the configured DATABASE_URL and returns the dump as a
 * Buffer. Throws if DATABASE_URL is missing or mysqldump is not installed /
 * fails, so callers can fall back to the logical JSON snapshot.
 */
export function runMysqldump(): Promise<Buffer> {
  const databaseUrl = mysqldumpDatabaseUrl();
  if (!databaseUrl) throw new Error("DATABASE_URL غير مضبوطة لتشغيل mysqldump");
  const command = buildMysqldumpCommand(databaseUrl);
  return new Promise((resolve, reject) => {
    execFile(command.bin, command.args, { env: { ...process.env, ...command.env }, maxBuffer: 512 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      resolve(Buffer.from(stdout, "utf8"));
    });
  });
}
