import { randomBytes } from "crypto";

/**
 * OAuthStatePayload 是我们在 OAuth state 中编码的数据。
 *
 * 设计思路：
 * 1) state 需要防篡改与可追踪，因此包含 nonce。
 * 2) 登录后是否“记住我”属于前端登录语义，也一起编码到 state。
 * 3) 不放敏感信息（如 token），仅放流程控制字段。
 */
export type OAuthStatePayload = {
  nonce: string;
  remember: boolean;
};

/**
 * 生成安全随机 nonce，用于 OAuth CSRF 防护。
 */
export function createOAuthNonce() {
  return randomBytes(24).toString("base64url");
}

/**
 * 将 state payload 编码成 URL 安全字符串。
 * 这里使用 base64url(JSON) 方便跨服务透传。
 */
export function encodeOAuthState(payload: OAuthStatePayload) {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf8").toString("base64url");
}

/**
 * 从 state 解码出 payload。
 * 如遇到格式错误，返回 null（而非抛异常），
 * 以便调用方统一给出“非法 state”响应。
 */
export function decodeOAuthState(state: string | null | undefined) {
  if (!state) return null;
  try {
    const json = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<OAuthStatePayload>;
    if (typeof parsed?.nonce !== "string") return null;
    return {
      nonce: parsed.nonce,
      remember: Boolean(parsed.remember),
    } satisfies OAuthStatePayload;
  } catch {
    return null;
  }
}

/**
 * 从后端响应中提取 Google 授权地址。
 * 兼容两类后端：
 * - 直接 30x Location 跳转
 * - 返回 JSON（authUrl/url/authorizationUrl）
 */
export function pickAuthorizationUrl(response: Response, bodyText: string) {
  const location = response.headers.get("location");
  if (location) return location;

  if (!bodyText) return null;
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>;
    const fromJson =
      body.authUrl ?? body.url ?? body.authorizationUrl ?? body.redirectUrl;
    return typeof fromJson === "string" ? fromJson : null;
  } catch {
    return null;
  }
}

/**
 * 提取 OAuth 回调后端返回的 token payload。
 *
 * 兼容字段：
 * - access_token/token_type/email/userId/roles/plan（现有登录流）
 * - accessToken/tokenType（常见驼峰命名）
 */
export function pickSessionPayload(bodyText: string) {
  if (!bodyText) return null;
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>;
    const accessToken =
      (body.access_token as string | undefined) ??
      (body.accessToken as string | undefined);
    if (!accessToken) return null;
    return {
      access_token: accessToken,
      token_type:
        (body.token_type as string | undefined) ??
        (body.tokenType as string | undefined),
      email: body.email as string | undefined,
      userId: body.userId as string | undefined,
      roles: body.roles as string[] | undefined,
      plan: body.plan as string | undefined,
    };
  } catch {
    return null;
  }
}
