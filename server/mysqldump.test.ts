import { describe, expect, it } from "vitest";
import { buildMysqldumpCommand } from "./mysqldump";

describe("buildMysqldumpCommand", () => {
  it("parses a mysql URL into a mysqldump command without leaking the password via argv", () => {
    const { bin, args, env } = buildMysqldumpCommand("mysql://user:s3cr3t@db.example.com:3306/netora");
    expect(bin).toBe("mysqldump");
    expect(args).toContain("netora");
    expect(args).not.toContain("s3cr3t");
    expect(env.MYSQL_PWD).toBe("s3cr3t");
  });

  it("uses the default port 3306 when none is provided", () => {
    const { args } = buildMysqldumpCommand("mysql://root:pass@localhost/netora");
    expect(args).toContain("-P");
    expect(args).toContain("3306");
  });

  it("always adds single-transaction and no-savepoint flags for a consistent dump", () => {
    const { args } = buildMysqldumpCommand("mysql://root:pass@localhost/netora");
    expect(args).toContain("--single-transaction");
    expect(args).toContain("--no-tablespaces");
  });

  it("rejects a non-mysql scheme", () => {
    expect(() => buildMysqldumpCommand("postgres://user:pass@localhost/netora")).toThrow(/mysql/i);
  });

  it("rejects a URL without a database name", () => {
    expect(() => buildMysqldumpCommand("mysql://user:pass@localhost")).toThrow(/قاعدة البيانات/i);
  });

  it("preserves special characters in the password via the env var", () => {
    const { args, env } = buildMysqldumpCommand("mysql://user:p%40ss%2Bword@localhost:3307/netora");
    expect(env.MYSQL_PWD).toBe("p@ss+word");
    expect(args.join(" ")).not.toContain("p@ss");
  });
});
