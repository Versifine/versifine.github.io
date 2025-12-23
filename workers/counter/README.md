# Cloudflare Counter Worker

提供一个最小的“共享计数器”API，用于静态站点（GitHub Pages）上的按钮 +1。

## 接口

- `GET  /api/get/<key>` -> `{ "value": number }`
- `POST /api/hit/<key>` -> `{ "value": number }`（也支持 `GET`）

示例：
- `https://<your-worker>.workers.dev/api/get/global:push`
- `https://<your-worker>.workers.dev/api/hit/global:push`

## 部署步骤

1. 安装依赖：
   - `cd workers/counter`
   - `npm i`
2. 登录 Cloudflare：
   - `npx wrangler login`
3. 部署：
   - `npm run deploy`
4. 记下输出的 Worker 地址（通常是 `https://<name>.<subdomain>.workers.dev`）

### 免费计划提示（Durable Objects）

如果你是 Cloudflare 免费计划，Durable Objects 需要使用 `new_sqlite_classes` 迁移来创建命名空间；否则部署会报错（例如错误码 `10097`）。本项目已按该要求配置。

### Windows 注意

你可能会在 `npm i` 或 `wrangler dev` 看到类似 `workerd.exe` 校验失败（例如 `EFTYPE` / `Failed to validate workerd binary`）。

- 这通常只影响 **本地开发**（`wrangler dev`），但 **不影响部署**（`wrangler deploy`）。
- 如果你需要本地 dev：
   - 尝试删除 `workers/counter/node_modules` 后重装；
   - 或检查杀毒/安全软件是否隔离了 `workerd.exe`；
   - 或使用 WSL/另一台机器进行本地开发。

## 本地开发

- 推荐：`npm run dev`（已配置为 `wrangler dev --remote`，避免 Windows 上 `workerd.exe` 的 `EFTYPE` 问题）

如果你想跑纯本地模式（不建议在你当前环境下）：
- `npx wrangler dev`（可能会触发 `EFTYPE`）

> Durable Objects / Workers 的免费额度与计费策略可能会随时间变化；如遇到控制台提示需要启用/升级，按 Cloudflare UI 指引操作即可。
