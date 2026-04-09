import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import {
  addSubscriber,
  removeSubscriber,
  getSubscriber,
  updateSubscriberTypes,
  updateSubscriberComponents,
  getSubscribersByType,
} from "../src/kv-store.js";

// Each test uses unique chatIds to avoid cross-test interference (miniflare KV persists across tests)
describe("kv-store", () => {
  const kv = env.claude_status;

  describe("addSubscriber / getSubscriber", () => {
    it("adds subscriber with default types", async () => {
      await addSubscriber(kv, 100, null);
      const sub = await getSubscriber(kv, 100, null);
      expect(sub).toEqual({ types: ["incident", "component"], components: [] });
    });

    it("adds subscriber with threadId", async () => {
      await addSubscriber(kv, 101, 456);
      const sub = await getSubscriber(kv, 101, 456);
      expect(sub).toEqual({ types: ["incident", "component"], components: [] });
    });

    it("handles threadId=0 (General topic)", async () => {
      await addSubscriber(kv, 102, 0);
      const sub = await getSubscriber(kv, 102, 0);
      expect(sub).toEqual({ types: ["incident", "component"], components: [] });
    });

    it("preserves existing data on re-subscribe", async () => {
      await addSubscriber(kv, 103, null);
      await updateSubscriberTypes(kv, 103, null, ["incident"]);
      await addSubscriber(kv, 103, null);
      const sub = await getSubscriber(kv, 103, null);
      expect(sub.types).toEqual(["incident"]);
    });
  });

  describe("removeSubscriber", () => {
    it("removes existing subscriber", async () => {
      await addSubscriber(kv, 200, null);
      await removeSubscriber(kv, 200, null);
      const sub = await getSubscriber(kv, 200, null);
      expect(sub).toBeNull();
    });
  });

  describe("updateSubscriberTypes", () => {
    it("updates types for existing subscriber", async () => {
      await addSubscriber(kv, 300, null);
      const result = await updateSubscriberTypes(kv, 300, null, ["incident"]);
      expect(result).toBe(true);
      const sub = await getSubscriber(kv, 300, null);
      expect(sub.types).toEqual(["incident"]);
    });

    it("returns false for non-existent subscriber", async () => {
      const result = await updateSubscriberTypes(kv, 99999, null, ["incident"]);
      expect(result).toBe(false);
    });
  });

  describe("updateSubscriberComponents", () => {
    it("sets component filter", async () => {
      await addSubscriber(kv, 400, null);
      await updateSubscriberComponents(kv, 400, null, ["API"]);
      const sub = await getSubscriber(kv, 400, null);
      expect(sub.components).toEqual(["API"]);
    });
  });

  describe("getSubscribersByType", () => {
    it("filters by event type", async () => {
      // Use unique IDs unlikely to collide with other tests
      await addSubscriber(kv, 50001, null);
      await updateSubscriberTypes(kv, 50001, null, ["incident"]);
      await addSubscriber(kv, 50002, null);
      await updateSubscriberTypes(kv, 50002, null, ["component"]);

      const incident = await getSubscribersByType(kv, "incident");
      const incidentIds = incident.map((s) => s.chatId);
      expect(incidentIds).toContain(50001);
      expect(incidentIds).not.toContain(50002);

      const component = await getSubscribersByType(kv, "component");
      const componentIds = component.map((s) => s.chatId);
      expect(componentIds).toContain(50002);
      expect(componentIds).not.toContain(50001);
    });

    it("filters by component name", async () => {
      await addSubscriber(kv, 60001, null);
      await updateSubscriberComponents(kv, 60001, null, ["API"]);
      await addSubscriber(kv, 60002, null); // no component filter = all

      const results = await getSubscribersByType(kv, "component", "API");
      const ids = results.map((s) => s.chatId);
      expect(ids).toContain(60001);
      expect(ids).toContain(60002);
    });

    it("excludes non-matching component filter", async () => {
      await addSubscriber(kv, 70001, null);
      await updateSubscriberComponents(kv, 70001, null, ["Console"]);

      const results = await getSubscribersByType(kv, "component", "API");
      const ids = results.map((s) => s.chatId);
      expect(ids).not.toContain(70001);
    });

    it("returns chatId as number", async () => {
      await addSubscriber(kv, 80001, null);
      const results = await getSubscribersByType(kv, "incident");
      const match = results.find((s) => s.chatId === 80001);
      expect(match).toBeDefined();
      expect(typeof match.chatId).toBe("number");
    });
  });
});
