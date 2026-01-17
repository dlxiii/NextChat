import { NextRequest } from "next/server";
import { HEXAGRAM_BASE_URL } from "@/app/constant";

const USER_BASE_URL = HEXAGRAM_BASE_URL.replace(/\/$/, "");

async function proxyProfile(req: NextRequest) {
  const response = await fetch(`${USER_BASE_URL}/api/user/profile`, {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("Content-Type") ?? "application/json",
      Authorization: req.headers.get("Authorization") ?? "",
    },
    body: req.body,
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
  });

  const headers = new Headers(response.headers);
  headers.delete("www-authenticate");
  headers.delete("content-encoding");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function GET(req: NextRequest) {
  return proxyProfile(req);
}

export async function PUT(req: NextRequest) {
  return proxyProfile(req);
}
