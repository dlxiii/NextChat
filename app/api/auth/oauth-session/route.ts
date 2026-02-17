import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const OAUTH_SESSION_COOKIE = "hexagram-google-oauth-session";
const OAUTH_REMEMBER_COOKIE = "hexagram-google-oauth-remember";

/**
 * 从临时 HttpOnly cookie 中读取 OAuth 登录结果，返回给前端并立即清理。
 * 该接口只用于 OAuth 回调后的一次性会话交换。
 */
export async function GET() {
  const sessionRaw = cookies().get(OAUTH_SESSION_COOKIE)?.value;
  const remember = cookies().get(OAUTH_REMEMBER_COOKIE)?.value === "1";

  const response = NextResponse.json(
    sessionRaw
      ? { ok: true, remember, session: JSON.parse(sessionRaw) }
      : { ok: false },
  );

  response.cookies.delete(OAUTH_SESSION_COOKIE);
  response.cookies.delete(OAUTH_REMEMBER_COOKIE);
  return response;
}
