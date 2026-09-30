import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../src/lib/password";
import {
  createSessionToken,
  SESSION_DURATION_SECONDS,
  verifySessionToken
} from "../src/lib/session";

process.env.AUTH_SECRET = "test-secret-with-more-than-thirty-two-characters";

test("password hashes verify only the original password", async () => {
  const hash = await hashPassword("correct horse battery");

  assert.match(hash, /^scrypt:/);
  assert.equal(await verifyPassword("correct horse battery", hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
  assert.equal(await verifyPassword("correct horse battery", "plain"), false);
});

test("a session token round-trips and lasts the long session", async () => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await createSessionToken("user-1", 3, issuedAt);
  const payload = await verifySessionToken(token);

  assert.deepEqual(payload, {
    exp: issuedAt + SESSION_DURATION_SECONDS,
    iat: issuedAt,
    userId: "user-1",
    sessionVersion: 3
  });
  assert.ok(SESSION_DURATION_SECONDS >= 60 * 60 * 24 * 90);
});

test("tampered, malformed and expired tokens are rejected", async () => {
  const token = await createSessionToken("user-1", 0);
  const [payload, signature] = token.split(".");
  const forgedPayload = Buffer.from(
    JSON.stringify({ exp: 9e9, iat: 0, userId: "other", sessionVersion: 0 })
  ).toString("base64url");

  assert.equal(await verifySessionToken(undefined), null);
  assert.equal(await verifySessionToken("garbage"), null);
  assert.equal(await verifySessionToken(`${token}.extra`), null);
  assert.equal(await verifySessionToken(`${forgedPayload}.${signature}`), null);
  assert.equal(await verifySessionToken(`${payload}.${signature}x`), null);

  const longAgo = Math.floor(Date.now() / 1000) - SESSION_DURATION_SECONDS - 1;
  assert.equal(
    await verifySessionToken(await createSessionToken("user-1", 0, longAgo)),
    null
  );
});

test("a token signed with another secret is rejected", async () => {
  const token = await createSessionToken("user-1", 0);
  process.env.AUTH_SECRET = "another-secret-with-more-than-thirty-two-chars";
  try {
    assert.equal(await verifySessionToken(token), null);
  } finally {
    process.env.AUTH_SECRET = "test-secret-with-more-than-thirty-two-characters";
  }
});
