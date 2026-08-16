import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const DEFAULT_OUT_DIR = join(REPO_ROOT, "cli", "out");
const temporaryRoots: string[] = [];

function makeTemporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vantyx-new-client-test-"));
  temporaryRoots.push(root);
  return root;
}

function runDryRun(outDir: string, assetsDir: string) {
  return Bun.spawnSync(
    [
      process.execPath,
      "cli/src/new-client.ts",
      "--slug",
      "proof-tenant",
      "--name",
      "Proof Tenant",
      "--views",
      "main:Main View",
      "--times",
      "day:Day",
      "--floors",
      "10f:10th Floor",
      "--assets",
      assetsDir,
      "--admin-email",
      "owner.sensitive@example.test",
      "--worker",
      "https://operator:password@preview.example.test/internal?token=url-secret",
      "--out-dir",
      outDir,
    ],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, ADMIN_SECRET: "environment-secret" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
}

async function runApply(options: {
  outDir: string;
  assetsDir: string;
  workerUrl: string;
  binDir: string;
}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const child = Bun.spawn(
    [
      process.execPath,
      "cli/src/new-client.ts",
      "--slug",
      "proof-tenant",
      "--name",
      "Proof Tenant",
      "--views",
      "main:Main View",
      "--times",
      "day:Day",
      "--floors",
      "10f:10th Floor",
      "--assets",
      options.assetsDir,
      "--admin-email",
      "owner.sensitive@example.test",
      "--worker",
      options.workerUrl,
      "--out-dir",
      options.outDir,
      "--apply",
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        PATH: `${options.binDir}${delimiter}${process.env.PATH ?? ""}`,
        ADMIN_SECRET: "environment-secret",
        CLOUDFLARE_API_TOKEN: "",
        CLOUDFLARE_ACCOUNT_ID: "",
        CF_ACCOUNT_ID: "",
        CF_ZONE_ID: "",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("new-client evidence", () => {
  test("writes deterministic config and preflight artifacts only to the selected output directory", () => {
    const root = makeTemporaryRoot();
    const assetsDir = join(root, "assets");
    const outDir = join(root, "first-output");
    const secondOutDir = join(root, "second-output");
    mkdirSync(join(assetsDir, "10f", "day"), { recursive: true });
    writeFileSync(join(assetsDir, "10f", "day", "main.jpg"), "test-image");

    const first = runDryRun(outDir, assetsDir);
    const second = runDryRun(secondOutDir, assetsDir);

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(first.stderr.toString()).toBe("");
    expect(existsSync(join(outDir, "proof-tenant.config.json"))).toBe(true);
    expect(existsSync(join(outDir, "proof-tenant.preflight.json"))).toBe(true);
    expect(existsSync(DEFAULT_OUT_DIR)).toBe(false);
    expect(readFileSync(join(outDir, "proof-tenant.config.json"), "utf8")).toBe(
      readFileSync(join(secondOutDir, "proof-tenant.config.json"), "utf8"),
    );
    expect(readFileSync(join(outDir, "proof-tenant.preflight.json"), "utf8")).toBe(
      readFileSync(join(secondOutDir, "proof-tenant.preflight.json"), "utf8"),
    );
  });

  test("redacts email, credentials, secrets, and machine-local paths from plan evidence", () => {
    const root = makeTemporaryRoot();
    const assetsDir = join(root, "private-assets");
    const outDir = join(root, "isolated-output");
    mkdirSync(join(assetsDir, "10f", "day"), { recursive: true });
    writeFileSync(join(assetsDir, "10f", "day", "main.jpg"), "test-image");

    const result = runDryRun(outDir, assetsDir);
    const stdout = result.stdout.toString();
    const receiptText = readFileSync(join(outDir, "proof-tenant.preflight.json"), "utf8");
    const receipt = JSON.parse(receiptText) as {
      mode: string;
      status: string;
      target: { workerOrigin: string };
      steps: Array<{ id: string; email?: string; source?: string }>;
    };

    expect(result.exitCode).toBe(0);
    expect(receipt.mode).toBe("dry-run");
    expect(receipt.status).toBe("planned");
    expect(receipt.target.workerOrigin).toBe("https://preview.example.test");
    expect(receipt.steps.find((step) => step.id === "invite-owner")?.email).toBe("[redacted-email]");
    expect(receipt.steps.find((step) => step.id === "upload-asset")?.source).toBe("<assets>/10f/day/main.jpg");

    for (const sensitiveValue of [
      "owner.sensitive@example.test",
      "operator",
      "password",
      "url-secret",
      "environment-secret",
      root,
      assetsDir,
      outDir,
    ]) {
      expect(receiptText).not.toContain(sensitiveValue);
      expect(stdout).not.toContain(sensitiveValue);
    }
  });

  test("keeps apply-mode transcript redacted when remote tools and invite responses contain sensitive data", async () => {
    const root = makeTemporaryRoot();
    const assetsDir = join(root, "private-assets");
    const outDir = join(root, "isolated-output");
    const binDir = join(root, "bin");
    const providerPath = ["", "private", "provider-path"].join("/");
    mkdirSync(join(assetsDir, "10f", "day"), { recursive: true });
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(assetsDir, "10f", "day", "main.jpg"), "test-image");
    const wranglerPath = join(binDir, "wrangler");
    writeFileSync(
      wranglerPath,
      `#!/bin/sh\nprintf '%s\\n' 'provider output ${providerPath}?token=provider-secret'\n`,
    );
    chmodSync(wranglerPath, 0o755);

    let invited = false;
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        invited = new URL(request.url).pathname === "/api/auth/invite";
        return Response.json({
          emailed: true,
          activateUrl: "https://activate.example.test/start?token=activation-secret",
        });
      },
    });

    try {
      const workerUrl = `http://operator:password@127.0.0.1:${server.port}/private?token=url-secret`;
      const result = await runApply({ outDir, assetsDir, workerUrl, binDir });
      const transcript = `${result.stdout}\n${result.stderr}`;
      const receiptText = readFileSync(join(outDir, "proof-tenant.preflight.json"), "utf8");

      expect(result.exitCode).toBe(0);
      expect(invited).toBe(true);
      expect(transcript).toContain("APPLYING (remote)");
      expect(transcript).toContain("email and activation URL withheld from transcript");
      expect(receiptText).toContain('"mode": "apply"');

      for (const sensitiveValue of [
        "owner.sensitive@example.test",
        "operator",
        "password",
        "url-secret",
        "environment-secret",
        "activation-secret",
        "provider-secret",
        providerPath,
        root,
        assetsDir,
        outDir,
      ]) {
        expect(receiptText).not.toContain(sensitiveValue);
        expect(transcript).not.toContain(sensitiveValue);
      }
    } finally {
      server.stop(true);
    }
  });
});
