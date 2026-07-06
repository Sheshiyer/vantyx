import { test, expect } from "bun:test";
import { signLeadToken, verifyLeadToken } from "./leadToken";

const SECRET = "test-secret-value";

test("a freshly signed token verifies and round-trips the payload", async () => {
  const token = await signLeadToken({ leadId: "ld_1", slug: "ratan-kodigehalli", exp: Date.now() + 60_000 }, SECRET);
  const payload = await verifyLeadToken(token, SECRET);
  expect(payload?.leadId).toBe("ld_1");
  expect(payload?.slug).toBe("ratan-kodigehalli");
});

test("a tampered token fails verification", async () => {
  const token = await signLeadToken({ leadId: "ld_1", slug: "s", exp: Date.now() + 60_000 }, SECRET);
  const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
  expect(await verifyLeadToken(tampered, SECRET)).toBeNull();
});

test("an expired token fails verification", async () => {
  const token = await signLeadToken({ leadId: "ld_1", slug: "s", exp: Date.now() - 1 }, SECRET);
  expect(await verifyLeadToken(token, SECRET)).toBeNull();
});
