import test from "node:test";
import assert from "node:assert/strict";
import {
  makeAdminCookie,
  validAdminCookie,
  equal,
  sameOrigin,
} from "../server/cloud.js";
import { validEndpoint } from "../server/delivery.js";
test("admin session rejects tampering and expiration", () => {
  process.env.ADMIN_SESSION_SECRET = "test-only-secret-0123456789-abcdef";
  const token = makeAdminCookie(1000);
  assert.equal(validAdminCookie(token, 1001), true);
  assert.equal(validAdminCookie(token, 3601001), false);
  assert.equal(validAdminCookie(token + "x", 1001), false);
  assert.equal(validAdminCookie("", 1001), false);
});
test("admin secrets and origin checks", () => {
  assert.equal(equal("secret", "secret"), true);
  assert.equal(equal("secret", "different"), false);
  assert.equal(
    sameOrigin({
      headers: { origin: "https://evil.example", host: "karman.example" },
    }),
    false,
  );
  assert.equal(
    sameOrigin({
      headers: { origin: "https://karman.example", host: "karman.example" },
    }),
    true,
  );
});
test("push endpoint does not accept arbitrary destinations", () => {
  assert.equal(
    validEndpoint("https://fcm.googleapis.com/fcm/send/example"),
    true,
  );
  assert.equal(validEndpoint("https://web.push.apple.com/QExample"), true);
  assert.equal(validEndpoint("https://evil.example/fcm.googleapis.com"), false);
  assert.equal(validEndpoint("http://127.0.0.1"), false);
});
