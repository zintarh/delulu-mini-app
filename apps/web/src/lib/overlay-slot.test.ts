import { test } from "node:test";
import assert from "node:assert/strict";
import { canAutoShow, setBlockingOverlay, takeAutoSlot } from "@/lib/overlay-slot";

function installStorage(name: "localStorage" | "sessionStorage") {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  Object.defineProperty(globalThis, name, { configurable: true, value: storage });
  return () => Reflect.deleteProperty(globalThis, name);
}

test("priority prompts take over blocking overlays and the automatic-prompt slot", () => {
  const restoreLocalStorage = installStorage("localStorage");
  const restoreSessionStorage = installStorage("sessionStorage");
  setBlockingOverlay("gift", true);
  takeAutoSlot("install");

  try {
    assert.equal(canAutoShow("vote", { firstVisit: true }), false);
    assert.equal(canAutoShow("vote", { firstVisit: true, priority: true }), true);
  } finally {
    setBlockingOverlay("gift", false);
    restoreLocalStorage();
    restoreSessionStorage();
  }
});
