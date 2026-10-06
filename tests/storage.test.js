import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  readData,
  saveData,
  saveMedia,
  getMedia,
  restore,
} from "../src/store.js";
test("records persist and photos survive reload of state", async () => {
  const id = await saveMedia(new Blob(["photo"], { type: "image/png" }));
  const state = {
    records: [
      {
        id: "record",
        title: "Хлеб",
        kind: "expense",
        amount: 55,
        date: "2026-10-06",
        time: "12:00",
        photo: id,
      },
    ],
    places: [],
    reminders: [],
    settings: { goal: 50000 },
  };
  await saveData(state);
  assert.equal((await readData()).records[0].amount, 55);
  assert.equal(await (await getMedia(id)).text(), "photo");
  await assert.rejects(
    restore({
      version: 1,
      state: { ...state, records: [{ ...state.records[0], amount: -1 }] },
    }),
  );
  assert.equal((await readData()).records[0].amount, 55);
  await restore({
    version: 1,
    state: { ...state, records: [{ ...state.records[0], amount: 75 }] },
    media: { [id]: "data:image/png;base64,cGhvdG8=" },
  });
  assert.equal((await readData()).records[0].amount, 75);
  assert.equal(await (await getMedia(id)).text(), "photo");
});
