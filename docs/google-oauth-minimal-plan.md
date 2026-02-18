# Google OAuth 最小可落地方案（外部 Auth 优先）

## 1. 现状评估

### 1.1 登录链路现状

- 前端登录页 `app/components/auth-credentials.tsx` 已有 OAuth 按钮，但 Google/Apple/Microsoft 默认禁用，仅作占位。
- NextChat 认证代理目前只有：
  - `POST /api/auth/login`
  - `POST /api/auth/register`
- 会话持久化使用 `persistAuthSession`，当前核心字段：
  - `accessToken`
  - `tokenType`
  - `email`
  - `userId`
  - `roles`
  - `plan`

### 1.2 术语边界（必须区分）

- **Google OAuth（身份登录）**：用户使用 Google 账号完成身份认证，得到登录会话。
- **Google API Key（模型调用）**：用于 Gemini 等模型请求，不用于用户身份认证。

---

## 2. 设计方案（最小改动）

### 2.1 总体架构

- 外部 Auth 服务负责：
  - OAuth start/callback
  - state 校验（建议 PKCE）
  - token 交换
  - 用户信息拉取
  - 账号绑定/创建
- NextChat 负责：
  - 新增两条轻量代理路由
  - 前端发起登录跳转
  - callback 回跳后的会话落地（复用 `persistAuthSession`）

### 2.2 新增接口契约草案

#### A) `GET /api/auth/oauth/google/start`

- 用途：启动 Google OAuth。
- 请求参数：无（可由外部服务内部生成 state/PKCE）。
- 响应：
  - 302 跳转到 Google 授权页（推荐）
  - 4xx/5xx JSON 错误（异常场景）
- 错误码建议：
  - `400` 配置缺失
  - `429` 频率限制
  - `500` 服务异常

#### B) `GET /api/auth/oauth/google/callback`

- 请求参数（Google 回调）：
  - `code`（成功授权）
  - `state`（CSRF 防护）
  - `error`（用户取消或拒绝授权）
- 成功响应（回跳给前端）示例：

```json
{
  "access_token": "<jwt-or-session-token>",
  "token_type": "Bearer",
  "email": "user@example.com",
  "userId": "user_123",
  "roles": ["user"],
  "plan": "free",
  "expires_in": 3600
}
```

- 错误码建议：
  - `400` 缺失 `code/state`
  - `401` state 校验失败
  - `403` 账号被禁用
  - `409` 账号绑定冲突
  - `500` token 交换失败

### 2.3 兼容性说明

- 现有 `login/register` 路由及接口完全保留，不变更行为。
- 前端仅新增 Google 登录入口，不影响 email/password 登录流程。
- 其他 OAuth（Apple/Microsoft）保持占位，避免扩大改造范围。

---

## 3. 风险清单

1. 回调参数暴露风险：若将 token 放在 URL query，需要 HTTPS 且尽快清理地址栏。
2. 外部 Auth 与前端会话字段不一致：需对齐 `userId/roles/plan/expires_in`。
3. 跨域与回调域名错误：Google Console 回调地址需精确匹配。
4. 开关控制遗漏：灰度阶段需允许快速关闭按钮入口。
5. 监控不足：无法区分取消授权、state 失效、外部 5xx。

---

## 4. 分阶段实施计划（1-2-3-4）

1. **阶段 1：接口契约与链路确认**
   - 明确 start/callback 契约、错误码、字段映射。
   - 明确 state/PKCE 在外部 Auth 实现，NextChat 只透传。

2. **阶段 2：NextChat 轻量代理**
   - 新增 `app/api/auth/oauth/google/start/route.ts`
   - 新增 `app/api/auth/oauth/google/callback/route.ts`
   - 保持 header 安全处理（移除 `www-authenticate`）。

3. **阶段 3：前端最小接入**
   - 启用 Google 按钮，点击跳转 start 路由。
   - callback 成功后复用 `persistAuthSession` 落地会话。
   - 补充中英文错误提示（取消授权、state 失效、服务异常）。

4. **阶段 4：联调与验收**
   - 覆盖成功、取消、缺参、state 不匹配、外部 5xx。
   - 提供部署变量、灰度策略、回滚策略。

---

## 5. 最小改动文件列表

### 外部 Auth 服务（待实现）

- `GET /api/auth/oauth/google/start`
- `GET /api/auth/oauth/google/callback`
- state/PKCE 存储与校验模块
- 账号绑定与用户资料映射模块

### NextChat（本仓库）

- `app/api/auth/oauth/google/start/route.ts`
- `app/api/auth/oauth/google/callback/route.ts`
- `app/components/auth-credentials.tsx`
- `app/utils/auth-session.ts`
- `app/locales/en.ts`
- `app/locales/cn.ts`
- `app/constant.ts`

---

## 6. 交互流程图（文字版）

1. 用户在登录页点击「使用 Google 登录」
2. 前端跳转 `/api/auth/oauth/google/start`
3. NextChat 代理到外部 Auth start
4. 外部 Auth 生成 state(+PKCE) 并跳转 Google 授权页
5. Google 回调 `/api/auth/oauth/google/callback?code=...&state=...`
6. NextChat 代理到外部 Auth callback
7. 外部 Auth 校验 state，换 token，拉 profile，绑定账号
8. 外部 Auth 回跳前端 `/#/auth?...`（成功或失败）
9. 前端写入 `persistAuthSession`，导航至 `/chat`

---

## 7. 上线前检查清单

- [ ] `NEXT_PUBLIC_HEXAGRAM_BASE_URL` 正确配置
- [ ] `NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH=true`（灰度环境）
- [ ] 外部 Auth Google Client ID/Secret 配置完成
- [ ] Google Console 回调域名与路径精确匹配
- [ ] 全链路 HTTPS
- [ ] Cookie: HttpOnly + Secure + SameSite
- [ ] 监控告警已覆盖 4xx/5xx

## 8. 灰度发布方案

- 先在测试环境开启 `NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH=true`
- 生产按环境或白名单用户逐步放量
- 观察关键指标：start 成功率、callback 成功率、state 失败率

## 9. 回滚方案

1. 将 `NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH` 设置为 `false`
2. 重新部署前端，Google 按钮自动不可用
3. 如需彻底回退，撤销本次新增两条 OAuth 代理路由
