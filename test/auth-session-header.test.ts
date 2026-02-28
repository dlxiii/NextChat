import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Headers, Request, Response } from "node-fetch";

(global as any).Headers = Headers;
(global as any).Response = Response;

(global as any).Request = Request;

const ORIGINAL_ENV = { ...process.env };

async function createNextRequest(headers: HeadersInit = {}) {
  const { NextRequest } = await import("next/server");
  const request = new Request("http://localhost/api/openai/chat/completions", {
    headers,
  });
  return new NextRequest(request as any);
}

describe("api auth session header behavior", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("injects system api key when x-hexagram-auth exists", async () => {
    process.env.OPENAI_API_KEY = "system-key-123";
    delete process.env.CODE;

    const { auth } = await import("../app/api/auth");
    const { ModelProvider } = await import("../app/constant");

    const req = await createNextRequest({
      "X-Hexagram-Auth": "Bearer login-token",
    });

    const result = auth(req, ModelProvider.GPT);

    expect(result.error).toBe(false);
    expect(req.headers.get("Authorization")).toBe("Bearer system-key-123");
  });

  it("accepts logged-in session even when access code is required", async () => {
    process.env.OPENAI_API_KEY = "system-key-123";
    process.env.CODE = "only-access-code";

    const { auth } = await import("../app/api/auth");
    const { ModelProvider } = await import("../app/constant");

    const req = await createNextRequest({
      "X-Hexagram-Auth": "Bearer login-token",
    });

    const result = auth(req, ModelProvider.GPT);

    expect(result.error).toBe(false);
    expect(req.headers.get("Authorization")).toBe("Bearer system-key-123");
  });
});
