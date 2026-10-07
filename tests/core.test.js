import test from "node:test";
import assert from "node:assert/strict";
import { localStamp, asUTC, totals, dueReminder } from "../src/core.js";
test("Bishkek date crosses UTC day boundary", () =>
  assert.equal(
    localStamp(new Date("2026-10-05T20:00:00Z")),
    "2026-10-06T02:00:00",
  ));
test("day totals separate savings from expenses", () =>
  assert.deepEqual(
    totals(
      [
        { date: "2026-10-06", kind: "expense", amount: 125 },
        { date: "2026-10-06", kind: "saving", amount: 500 },
        { date: "2026-10-05", kind: "expense", amount: 50 },
      ],
      "2026-10-06",
    ),
    { expense: 125, saving: 500 },
  ));
test("local event fires at Bishkek time only once", () => {
  const r = {
    enabled: true,
    repeat: "once",
    date: "2026-10-06",
    time: "21:00",
  };
  assert.equal(dueReminder(r, new Date("2026-10-06T14:59:00Z")), null);
  assert.equal(
    dueReminder(r, new Date("2026-10-06T15:00:00Z")).key,
    "2026-10-06",
  );
  assert.equal(
    dueReminder(
      { ...r, fired: "2026-10-06" },
      new Date("2026-10-06T15:01:00Z"),
    ),
    null,
  );
});
test("daily reminder becomes due again on the next Bishkek day", () => {
  const r = {
    enabled: true,
    repeat: "daily",
    date: "2026-10-06",
    time: "21:00",
    fired: "2026-10-06",
  };
  assert.equal(dueReminder(r, new Date("2026-10-06T16:00:00Z")), null);
  assert.equal(
    dueReminder(r, new Date("2026-10-07T15:00:00Z")).key,
    "2026-10-07",
  );
});
