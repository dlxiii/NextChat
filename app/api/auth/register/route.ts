import { NextRequest } from "next/server";
import { HEXAGRAM_BASE_URL } from "@/app/constant";
import { fetchWithOptionalProxy } from "@/app/utils/proxy-fetch";

const AUTH_BASE_URL = HEXAGRAM_BASE_URL.replace(/\/$/, "");

async function proxyAuth(req: NextRequest, action: "login" | "register") {
  const requestBody = await req.text();

  const response = await fetchWithOptionalProxy(
    `${AUTH_BASE_URL}/auth/${action}`,
    {
      method: req.method,
      headers: {
        "Content-Type": req.headers.get("Content-Type") ?? "application/json",
      },
      body: requestBody,
      redirect: "manual",
    },
  );

  const headers = new Headers(response.headers);
  headers.delete("www-authenticate");
  headers.delete("content-encoding");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function POST(req: NextRequest) {
  return proxyAuth(req, "register");
}
