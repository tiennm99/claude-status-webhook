import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleQueue } from "../src/queue-consumer.js";

/**
 * Create a mock queue message with ack/retry tracking
 */
function mockMessage(body) {
  return {
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

describe("handleQueue", () => {
  let env;

  beforeEach(() => {
    env = {
      BOT_TOKEN: "test-token",
      claude_status: {
        delete: vi.fn(),
      },
    };
    vi.restoreAllMocks();
  });

  it("acks on successful send", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const msg = mockMessage({ chatId: 123, html: "<b>test</b>" });
    await handleQueue({ messages: [msg] }, env);
    expect(msg.ack).toHaveBeenCalled();
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("removes subscriber and acks on 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const msg = mockMessage({ chatId: 123, threadId: null, html: "<b>test</b>" });
    await handleQueue({ messages: [msg] }, env);
    expect(msg.ack).toHaveBeenCalled();
    expect(env.claude_status.delete).toHaveBeenCalled();
  });

  it("retries on 429 rate limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "5" }),
      })
    );
    const msg = mockMessage({ chatId: 123, html: "<b>test</b>" });
    await handleQueue({ messages: [msg] }, env);
    expect(msg.retry).toHaveBeenCalled();
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it("retries on 5xx server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    const msg = mockMessage({ chatId: 123, html: "<b>test</b>" });
    await handleQueue({ messages: [msg] }, env);
    expect(msg.retry).toHaveBeenCalled();
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it("retries on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network fail")));
    const msg = mockMessage({ chatId: 123, html: "<b>test</b>" });
    await handleQueue({ messages: [msg] }, env);
    expect(msg.retry).toHaveBeenCalled();
  });

  it("skips malformed messages", async () => {
    const msg = mockMessage({ chatId: null, html: null });
    await handleQueue({ messages: [msg] }, env);
    expect(msg.ack).toHaveBeenCalled();
  });
});
