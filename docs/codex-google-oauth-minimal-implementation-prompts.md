# 给 Codex 的完整中文提示词：Google OAuth 最小实施（外部 Auth 服务优先）

> 目标：指导 Codex 以**最小成本**落地 Google OAuth。
> 路线：优先在现有外部 Auth 服务实现 OAuth 主流程，NextChat 仅做轻量代理与会话接入。

---

## 使用说明

你可以把下面提示词按顺序逐段发给 Codex（建议从「总控提示词」开始，再按阶段执行）。

---

## 0. 总控提示词（先发这一段）

你是资深全栈工程师。请在现有项目中落地 Google OAuth，遵循以下原则：

1. **架构原则（必须）**
   - 优先在现有外部 Auth 服务实现 OAuth（start/callback/token/profile/账号绑定）。
   - NextChat 仅新增轻量代理路由与前端跳转逻辑，尽量不重构现有登录体系。
   - 保持与现有 email/password 登录并存，避免破坏已有接口。

2. **安全原则（必须）**
   - 必须实现 state 校验；建议支持 PKCE。
   - Cookie 使用 HttpOnly + Secure + SameSite。
   - 日志中不得泄露 access token / refresh token / client secret。

3. **工程原则（必须）**
   - 先给出实施计划，再逐步编码。
   - 每一步修改后，运行必要测试（至少 lint/构建；有 e2e 就跑）。
   - 修改核心函数时，补充 docstring、关键注释和流程说明。
   - 所有变更给出文件清单、回滚方案、验收标准。

4. **输出格式（必须）**
   - 先输出：现状评估 + 设计方案 + 风险清单。
   - 再输出：分阶段代码修改（每阶段可独立提交）。
   - 最后输出：部署配置、联调步骤、验收 checklist。

请先读取仓库并给出“最小可落地方案”的实施计划（按 1-2-3-4 阶段拆分）。

---

## 1. 阶段一提示词：梳理现状与确定接口契约

请完成以下任务，并先不要大改代码：

1. 识别现有登录链路：
   - 前端登录页组件、OAuth 按钮状态。
   - NextChat 的 `/api/auth/login` 与 `/api/auth/register` 代理逻辑。
   - 现有会话持久化字段（如 accessToken、tokenType 等）。

2. 明确 Google OAuth 新增接口契约（优先外部 Auth 服务）：
   - `GET /api/auth/oauth/google/start`
   - `GET /api/auth/oauth/google/callback`
   - 返回成功后会话结构（至少：access_token、token_type、email、userId、roles、plan、expires_in）。

3. 输出内容：
   - 一份“接口契约草案”（请求参数、响应示例、错误码）。
   - 一份“兼容性说明”（不影响现有 login/register）。
   - 一份“最小改动文件列表”（按外部 Auth 与 NextChat 分组）。

要求：文档中明确区分“Google OAuth（身份登录）”与“Google API Key（模型调用）”。

---

## 2. 阶段二提示词：先实现 NextChat 轻量代理（最小改动）

请在 NextChat 中实现以下最小改动：

1. 新增 OAuth 代理路由：
   - `app/api/auth/oauth/google/start/route.ts`
   - `app/api/auth/oauth/google/callback/route.ts`

2. 路由行为要求：
   - 代理到外部 Auth 服务对应地址（基于既有 `HEXAGRAM_BASE_URL` 风格）。
   - 透传必要 headers，移除可能导致浏览器认证弹窗的 header（参考现有 auth 代理风格）。
   - callback 支持将外部结果安全转发给前端（或进行重定向）。

3. 编码要求：
   - 为核心函数添加 docstring（说明输入、输出、异常处理、为何这样设计）。
   - 增加关键注释：安全边界、header 处理原因、与旧链路兼容点。

4. 交付要求：
   - 给出完整 diff。
   - 给出本地验证命令（lint/build）。
   - 不修改与 OAuth 无关逻辑。

---

## 3. 阶段三提示词：前端启用 Google 登录入口与会话接入

请在前端做“最小可用”接入：

1. 登录页改造：
   - 启用 Google 按钮（去掉 disabled）。
   - 点击后跳转 `/api/auth/oauth/google/start`。
   - 其他 OAuth（Apple/Microsoft）保持占位，不改行为。

2. 回跳处理：
   - 在 callback 后，根据返回结果写入现有会话存储（复用 `persistAuthSession`）。
   - 失败时给出用户可理解的 toast（取消授权、state 失效、服务器异常）。

3. 文案与可维护性：
   - 补充中英文文案（成功、失败、取消、重试建议）。
   - 关键流程添加注释：登录跳转 -> callback -> session 落地 -> 导航。

4. 交付要求：
   - 给出交互流程图（文字版即可）。
   - 给出异常分支清单。

---

## 4. 阶段四提示词：安全加固、联调与验收

请在不扩大改造范围的前提下完成以下工作：

1. 安全与可靠性检查：
   - state 必须校验；若外部 Auth 已做，NextChat 侧仅负责透传与错误兜底。
   - 清理日志中的敏感信息。
   - 明确 Cookie 策略与过期策略。

2. 联调测试用例（至少）：
   - 正常授权登录成功。
   - 用户取消授权。
   - callback 缺失 code/state。
   - state 不匹配。
   - 外部 Auth 5xx。

3. 验收输出（必须）：
   - “上线前检查清单”（环境变量、回调域名、HTTPS、跨域、监控）。
   - “灰度发布方案”（按环境/按用户比例）。
   - “回滚方案”（一键关闭 `ENABLE_GOOGLE_OAUTH` 并回退按钮）。

---

## 5. 一次性交付提示词（如果你希望 Codex 一次做完）

请直接完成 Google OAuth 最小实施，采用“外部 Auth 服务优先，NextChat 轻代理接入”路线，严格要求：

- 新增 NextChat 代理路由：
  - `/api/auth/oauth/google/start`
  - `/api/auth/oauth/google/callback`
- 前端登录页启用 Google 按钮并接入跳转。
- 回调后复用现有会话机制写入登录态。
- 增加中英文错误文案与用户提示。
- 核心函数补充 docstring + 详细注释 + 实现流程说明。
- 输出所有变更文件与关键代码解释。
- 执行并汇报：lint、build、（若可用）Playwright e2e。
- 给出部署步骤、环境变量模板、验收清单、回滚策略。

注意事项：
- 不要把 Google API Key（模型调用）与 Google OAuth（身份登录）混用。
- 不破坏现有 email/password 登录。
- 不泄露密钥与 token。

---

## 6. 给 Codex 的验收标准（可复制）

完成后请按以下标准自检并逐条打勾：

- [ ] Google 按钮可点击并发起 OAuth。
- [ ] start/callback 路由可用，且与外部 Auth 连通。
- [ ] 登录成功后可写入会话并进入已登录页面。
- [ ] 取消授权/异常回调能被正确提示。
- [ ] login/register 原链路无回归。
- [ ] 构建通过，关键测试通过。
- [ ] 文档完善（变量、部署、回滚、风险）。

