/**
 * PRD2 E3 is the security heart of project2: the user's own API key lives in
 * the same settings store as everything else, and the sync pushes every
 * settings row to the cloud. Without the LOCAL_ONLY_SETTINGS filter, the key
 * would leak. These tests pin both directions — push and pull — so the
 * protection stays structural.
 */

import { describe, expect, it } from "vitest";

import { LOCAL_ONLY_SETTINGS } from "@/lib/db/sync";

describe("LOCAL_ONLY_SETTINGS", () => {
  it("contains the provider API key", () => {
    expect(LOCAL_ONLY_SETTINGS).toContain("aiProviderKey");
  });

  it("does not contain the provider configuration itself", () => {
    // The config (provider, base URL, model — no secret) syncs normally so a
    // second device knows which provider to use; only the key stays local.
    expect(LOCAL_ONLY_SETTINGS).not.toContain("aiProvider");
  });

  it("filters the key out of a push payload", () => {
    const rows = [
      { key: "level", value: "b1" },
      { key: "aiProviderKey", value: "sk-secret" },
      { key: "aiProvider", value: '{"provider":"groq"}' },
    ];
    const pushed = rows.filter((r) => !LOCAL_ONLY_SETTINGS.includes(r.key));
    expect(pushed.map((r) => r.key)).toEqual(["level", "aiProvider"]);
    expect(JSON.stringify(pushed)).not.toContain("sk-secret");
  });

  it("filters the key out of a pull merge", () => {
    const remote = [
      { key: "aiProviderKey", value: "sk-from-another-device" },
      { key: "aiProvider", value: '{"provider":"groq"}' },
    ];
    const applied = remote.filter((r) => !LOCAL_ONLY_SETTINGS.includes(r.key));
    expect(applied.map((r) => r.key)).toEqual(["aiProvider"]);
  });
});
