import { test } from "node:test";
import assert from "node:assert/strict";
import { daypartFor, isDaypart, DAYPART_BOOT_SCRIPT } from "./daypart";

const at = (h: number, m = 0) => new Date(2026, 10, 13, h, m);

test("daypart boundaries", () => {
  assert.equal(daypartFor(at(4, 59)), "night");
  assert.equal(daypartFor(at(5)), "dawn");
  assert.equal(daypartFor(at(10, 59)), "dawn");
  assert.equal(daypartFor(at(11)), "day");
  assert.equal(daypartFor(at(16, 59)), "day");
  assert.equal(daypartFor(at(17)), "dusk");
  assert.equal(daypartFor(at(19, 59)), "dusk");
  assert.equal(daypartFor(at(20)), "night");
  assert.equal(daypartFor(at(0)), "night");
});

test("isDaypart", () => {
  assert.ok(isDaypart("night"));
  assert.ok(!isDaypart("noon"));
  assert.ok(!isDaypart(null));
});

test("boot script agrees with daypartFor for every hour", () => {
  for (let h = 0; h < 24; h++) {
    const attrs: Record<string, string> = {};
    const fakeDate = class extends Date {
      constructor() {
        super(2026, 10, 13, h, 30);
      }
    };
    new Function("document", "location", "Date", "URLSearchParams", DAYPART_BOOT_SCRIPT)(
      { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } },
      { search: "" },
      fakeDate,
      URLSearchParams,
    );
    assert.equal(attrs["data-daypart"], daypartFor(at(h, 30)), `hour ${h}`);
  }
});
