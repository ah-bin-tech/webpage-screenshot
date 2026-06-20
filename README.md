# Webpage Screenshot

一个部署在 Cloudflare Workers 上的网页截图工具。
前端输入 URL 后，后端通过 Cloudflare Browser Rendering 打开目标页面并返回 PNG 截图；截图结果会缓存在 KV 中，重复请求可以直接命中缓存。

## 功能概览

- 输入网页 URL，一键生成截图。
- 支持整页截图或首屏视口截图。
- 截图视口固定为 `1920x1080`，页面加载等待策略为 `networkidle2`。
- 返回 PNG 图片，并在前端提供预览和下载。
- 使用 KV 缓存截图结果，默认缓存 1 天。
- 对用户输入 URL 做基础防护：仅允许 `http` / `https`，阻止本地、内网、链路本地和元数据地址，并通过 Cloudflare for Families 做内容分类过滤。

## 技术栈

- [Next.js](https://nextjs.org) 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Cloudflare Kumo UI
- OpenNext for Cloudflare
- Cloudflare Workers
- Cloudflare Browser Rendering
- Cloudflare KV
- Zod

## 目录结构

```text
.
├── public/
│   ├── _headers
│   └── favicon.svg
├── src/
│   ├── app/
│   │   ├── api/screenshot/route.ts  # 截图 API
│   │   ├── globals.css              # 全局样式和 Kumo/Tailwind 引入
│   │   ├── layout.tsx               # 页面元信息和字体
│   │   └── page.tsx                 # 截图表单、结果预览、下载入口
│   └── lib/
│       ├── browser.ts               # 读取 Cloudflare BROWSER 绑定
│       ├── cache.ts                 # KV JSON/二进制缓存封装
│       └── url-guard.ts             # URL 结构校验和内容过滤
├── next.config.ts
├── open-next.config.ts
├── wrangler.jsonc                   # Cloudflare Workers 配置
└── package.json
```

## 本地开发

安装依赖：

```bash
npm install
```

启动 Next.js 开发服务器：

```bash
npm run dev
```

打开 <http://localhost:3000> 即可访问页面。

> `src/app/api/screenshot/route.ts` 依赖 Cloudflare 的 `BROWSER` 和 `CACHE` 绑定。`next.config.ts` 已调用 `initOpenNextCloudflareForDev()`，用于在 `next dev` 中读取 Cloudflare 上下文；如果本地截图能力不可用，请优先使用 Cloudflare 运行时预览。

## Cloudflare 预览与部署

本项目通过 OpenNext 构建为 Cloudflare Worker。

本地预览 Cloudflare 运行时：

```bash
npm run preview
```

部署到 Cloudflare：

```bash
npm run deploy
```

只上传构建产物：

```bash
npm run upload
```

生成 Cloudflare 绑定类型：

```bash
npm run cf-typegen
```

## Cloudflare 绑定

`wrangler.jsonc` 当前配置了以下绑定：

| 绑定                    | 类型              | 用途                              |
| ----------------------- | ----------------- | --------------------------------- |
| `ASSETS`                | Assets            | 托管 OpenNext 静态资源            |
| `IMAGES`                | Images            | 支持 OpenNext 图片优化            |
| `WORKER_SELF_REFERENCE` | Service Binding   | OpenNext 缓存相关的 Worker 自引用 |
| `BROWSER`               | Browser Rendering | 执行网页截图                      |
| `CACHE`                 | KV Namespace      | 缓存 DNS 过滤结果和截图二进制     |

部署前需要确保 Cloudflare 账号中已启用对应能力，并且 `CACHE` KV namespace 的 `id` 与目标环境一致。

## API

### `POST /api/screenshot`

请求体：

```json
{
  "url": "https://cloudflare.com",
  "fullPage": true
}
```

字段说明：

- `url`：必填，目标网页地址，只支持 `http` 和 `https`。
- `fullPage`：可选，是否截取整页；未传时默认为 `false`。

成功响应：

- 响应体为图片二进制。
- `content-type` 通常为 `image/png`。
- `x-cache` 为 `HIT` 或 `MISS`，表示是否命中 KV 缓存。

常见错误：

| 状态码 | 场景                                                        |
| ------ | ----------------------------------------------------------- |
| `400`  | JSON 无效、参数无效、URL 协议不支持、URL 指向本地或私有网络 |
| `451`  | 目标域名被内容过滤器阻止                                    |
| `502`  | Cloudflare Browser Rendering 返回非成功响应                 |
| `500`  | 截图流程出现未预期错误                                      |

## 缓存策略

缓存逻辑位于 `src/lib/cache.ts`：

- 截图缓存 key 由 `url` 和 `fullPage` 生成。
- DNS 内容过滤结果按 host 缓存。
- 默认缓存版本为 `v1`，修改 `CACHE_VERSION` 可以整体失效旧缓存。
- 截图和 DNS 结果当前 TTL 都是 1 天。

## URL 安全策略

`src/lib/url-guard.ts` 会在调用浏览器截图前先检查用户输入：

- 只允许 `http:` 和 `https:`。
- 阻止 `localhost`、`.localhost`、`.local`、`.internal`。
- 阻止常见私有 IPv4 地址段，例如 `10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`。
- 阻止 loopback、link-local、CGNAT、IPv6 unique-local/link-local 等地址。
- 对普通域名调用 Cloudflare for Families DNS-over-HTTPS，过滤恶意和成人内容分类。

DNS 分类检查会在网络错误或解析失败时 fail open；结构性 SSRF 检查仍会强制执行。

## 常用脚本

| 命令                 | 说明                           |
| -------------------- | ------------------------------ |
| `npm run dev`        | 启动 Next.js 开发服务器        |
| `npm run build`      | 构建 Next.js 应用              |
| `npm run start`      | 启动 Next.js 生产服务器        |
| `npm run lint`       | 运行 ESLint                    |
| `npm run lint:fix`   | 自动修复 ESLint 问题           |
| `npm run preview`    | 构建并用 Cloudflare 运行时预览 |
| `npm run deploy`     | 构建并部署到 Cloudflare        |
| `npm run upload`     | 构建并上传到 Cloudflare        |
| `npm run cf-typegen` | 生成 Cloudflare 环境类型声明   |

## 开发提示

- 前端入口在 `src/app/page.tsx`，目前使用 Cloudflare Kumo 的 `LayerCard`、`Button`、`Checkbox` 组件。
- 截图 API 在 `src/app/api/screenshot/route.ts`，输入校验使用 Zod。
- Browser Rendering 调用集中在 `getBrowser().quickAction('screenshot', ...)`。
- 如果修改 Cloudflare 绑定，请同步更新 `wrangler.jsonc` 并重新运行 `npm run cf-typegen`。
