import test from "node:test";
import assert from "node:assert/strict";
import { localStamp, asUTC, totals, dueReminder } from "../src/core.js";
import { nextDue, cleanReminders } from "../server/push.js";
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
test("daily recurrence chooses tomorrow after due time", () => {
  const r = {
    enabled: true,
    repeat: "daily",
    date: "2026-10-06",
    time: "21:00",
  };
  assert.equal(
    nextDue(r, asUTC("2026-10-06T22:00")),
    asUTC("2026-10-07T21:00"),
  );
  assert.equal(nextDue({ ...r, enabled: false }), null);
});
test("server rejects malformed reminders", () =>
  assert.throws(() =>
    cleanReminders([
      {
        id: "a",
        title: "a",
        time: "27:10",
        repeat: "daily",
        date: "2026-10-06",
      },
    ]),
  ));
