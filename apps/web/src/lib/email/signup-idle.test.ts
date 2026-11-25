import assert from "node:assert/strict";
import test from "node:test";
import { signupIdleEmail } from "@/lib/email/signup-idle";

test("the idle-signup email explains the live rewards and nothing extra", () => {
  const email = signupIdleEmail();
  assert.match(email.body, /plus 10%/);
  assert.match(email.body, /a little on each day you keep/);
  assert.match(email.body, /1,000,000 G\$/);
  assert.match(email.body, /first 14 days/);
  assert.match(email.body, /5,000 G\$/);
  assert.match(email.body, /Naira bank account/);
  assert.match(email.body, /100 G\$/);
  assert.match(email.body, /username and a photo/);
  assert.equal(email.path, "/sign-in");
  assert.doesNotMatch(email.body, /welcome gift|top 10|instantly|cash out instantly/i);
});
