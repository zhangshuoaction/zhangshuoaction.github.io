# Action Blog

基于 Astro 的中文静态博客，支持本地离线预览与 GitHub Pages 自动发布。

## 无服务预览（默认）

双击根目录的 preview.html 或 start.cmd，直接打开 offline/index.html。无需启动服务，关闭终端、退出聊天或重启电脑后仍可打开。只要文件保留，本地入口就一直可用。

离线目录是上次构建的内容快照。修改文章或样式后，运行 npm run build:offline 重新生成。该命令完成后会退出，不会保持后台服务。阅读现成文件不需要安装 Node.js。移动或分享时请保留整个 offline 文件夹。

## 开发与更新

需要 Node.js 22.23.4+（建议使用受 Astro 支持的偶数版本）与 npm。当前开发环境为 Node.js 24。

```cmd
cd /d D:\AI本地文件\action_blog
npm install
npm run dev
```

按终端实际输出的 Local 地址访问，默认 http://127.0.0.1:4321/。端口被占用时 Astro 会选择其他端口。

```cmd
npm run check
npm run build
npm run preview
```

构建产物位于 dist/；preview 用于查看构建后的静态网站。Ctrl+C 停止服务。

## 第一版范围与验收

- 默认入口显示博客列表，顶部导航与交互以文末最新规则为准。
- 文章按日期倒序；详情有目录、代码高亮、阅读时长和相邻文章。
- 标签和标签详情从公开文章自动生成，支持中文标签。
- 关于页、404、移动端样式、键盘焦点与跳转正文入口。
- 文章字段校验；草稿在详情路由、首页、列表、标签、RSS、Sitemap 中统一排除。
- RSS、Sitemap、robots.txt、canonical、Open Graph 和文章结构化数据。
- 四篇内容均为示例，页面有说明；另有一篇不公开的草稿用于展示规则。

第一版开发顺序：基础配置 → 内容集合 → 页面与样式 → 类型和构建检查 → 路由、链接、草稿验证 → 本地浏览器检查。构建通过不代表已部署或人工验收。

## 写一篇文章

在 src/content/blog/ 下创建 my-first-post.md：

```markdown
---
title: "我的第一篇文章"
description: "这篇文章讨论什么。"
pubDate: 2026-10-30
tags: ["日常实践"]
draft: false
sample: false
featured: false
---

## 从这里开始

这里是正文。
```

- title、description、pubDate 必填，其余字段有默认值。
- draft: true 的文章不进入公开页面；draft 默认 false。
- sample: true 显示示例说明，正式文章设为 false 或省略。
- featured: true 在首页优先显示；多个精选时选最新的一篇，没有精选时选最新文章。
- pubDate 用于排序，不提供定时发布；即使日期在未来，只要 draft 为 false 就会公开。
- 文件名形成文章 URL，发布后请保持稳定。
- 正文从二级标题开始，二级和三级标题自动加入目录。
- 文章专属截图推荐放在文章旁的 images/ 目录；公共图片放 public/images/。目录与引用示例见文末“文章图片与公共图片”。
- 代码块写上语言名即可高亮。阅读时长按正文长度估算。
- 删除示例文章后，它们会从所有派生页面中自动消失。

## 修改个人信息和样式

- src/consts.ts：名称、描述和作者。
- src/pages/about.astro：首页介绍以外的个人介绍文案。
- src/components/BlogArchive.astro：默认博客列表。
- src/styles/global.css：配色、字体、布局和响应式样式。
- public/favicon.svg：站点图标。

## GitHub Pages

仓库：https://github.com/zhangshuoaction/zhangshuoaction.github.io

网址：https://zhangshuoaction.github.io/

推送 main 后自动执行 .github/workflows/deploy.yml，检查并构建 dist 后发布。也可在 GitHub Actions 手动运行工作流。Node.js 使用 24，依赖版本由 package-lock.json 锁定。

astro.config.mjs 默认 site 为正式网址，RSS、Sitemap 和页面 canonical 使用该域名。SITE_URL 可通过进程环境变量覆盖，.env.example 仅作示例，不会被配置文件自动加载。

本仓库使用用户站点根路径，无需 /action_blog/ 前缀。以后改成项目子路径时，需要重新适配站内路径后再发布。

npm run build:offline 继续生成无需服务的离线快照。截图、离线产物和依赖不提交到仓库。社交封面仍为 SVG，二维码按当前确认规则保留占位。

## 已执行的验证（2026-10-30）

- Astro 类型检查：18 个文件，0 errors / 0 warnings / 0 hints。
- 静态构建：13 个 HTML 页面。
- 产物检查：281 个站内链接和锚点；RSS、Sitemap、草稿过滤、代码高亮和目录通过。
- 本地 HTTP 检查：主要页面与 RSS / Sitemap / robots 返回 200；草稿和不存在的地址返回自定义 404。
- 浏览器自动化工具启动超时，桌面与手机视觉效果尚待人工确认。
- GitHub 同步、部署和正式内容验收尚未进行。

后续可运行 npm run verify 重新执行类型、构建和产物检查。上面的数量对应初始示例内容，新增或删除文章后会变化。

Windows 下双击 start.cmd 打开已有离线文件；需要自动刷新开发时，另行运行 npm run dev，按 Ctrl+C 停止开发服务。

## 离线导出说明

- npm run build:offline：正常构建 dist，然后生成独立的 offline 文件夹并检查 file 协议链接。
- 页面、文章、中文标签、样式、图标和目录锚点使用可移动的相对文件路径，页面链接显式指向 index.html。
- preview.html 是稳定入口，start.cmd 仅打开文件，不启动进程驻留的服务。
- dist 继续保留标准网站产物，后续 GitHub 部署可以使用原来的构建流程。
- 离线快照移除了面向网站的 canonical、OG URL / image 和结构化数据，正式网站仍保留 SEO 信息。
- RSS 和 Sitemap 是静态 XML 快照，其站点地址保留构建时配置；正式 RSS 订阅在网站上线后使用。
- 以后新增依赖模块脚本的交互时，离线导出会明确报错，需要另行适配 file 协议。

### 离线验证（2026-10-30）

已生成 13 个离线 HTML 页面，281 个 file 协议链接、资源和锚点检查通过；移动到含中文名称的临时目录后再次检查通过，临时目录已删除。标准网站产物检查也通过。未启动或驻留本地服务。

## 顶部导航与交互（2026-10-30）

本轮确认并实现：

1. 顶部总高度为 60px，桌面与手机端一致。
2. 去掉首页导航，默认入口显示博客列表；原“文章”导航改为“博客”，/blog/ 保持可访问。
3. 去掉顶部标签导航；标签页面暂保留，后续由文章目录方案继续调整。
4. 订阅进入 /subscribe/ 页面，含 RSS 地址、复制入口和其他平台预留区，尚未填入未提供的平台链接。
5. 订阅右侧为搜索按钮，检索全部已发布文章的标题和正文；支持部分关键词、相邻顺序字符模糊匹配、多个词组合，不区分英文大小写，优先展示标题匹配，草稿排除。Ctrl/⌘+K 打开，Esc 关闭。
6. 搜索右侧为深色模式开关；深色覆盖页面、弹窗、正文和代码高亮。保存选择，离线导航附带主题参数以兼容 file 协议的存储隔离。

搜索索引和交互脚本均嵌入 HTML，不依赖网络请求或服务。修改内容后运行 npm run build:offline 即会同步更新离线索引。

后续调整位置：src/components/Header.astro（导航）、src/components/BlogArchive.astro（博客列表）、src/pages/subscribe.astro（订阅与平台内容）、src/styles/navigation.css（导航/搜索/深色样式）、src/lib/search.mjs（搜索规则）。

验收命令：npm run verify；npm run verify:navigation。浏览器脚本默认使用本机 Edge，可用 BLOG_BROWSER_PATH 指定其他 Chromium 浏览器。截图保留在 artifacts/navigation；测试临时浏览器目录会自动删除。

本轮验证结果：26 个文件类型检查，0 errors / 0 warnings / 0 hints；14 个页面和 320 个离线链接/资源/锚点通过检查。真实 Edge 通过 file:// 打开并验证 60px 导航、默认博客、标题/正文搜索、模糊搜索、草稿排除、Esc 关闭、深色模式跨页保持、订阅 RSS 地址、代码深色配色，以及 375px / 320px 布局。页面无网络请求。浏览器截图已检查，临时浏览器配置已清理；产品人工确认仍由使用者完成。

## 简化导航与页脚（2026-10-30）

最新调整：订阅移到主导航，顺序为“博客、关于、订阅”；名称下方副标题移除。博客列表取消顶部英文标签、大标题和介绍，保留文章数量、排序与列表；仅为辅助技术保留不可见的页面主标题。全站页脚只保留居中的版权行“© 当前年份 Action Blog · Built with Astro”。右侧保留搜索和深色模式开关，导航高度仍为 60px。

## 联系方式卡片（2026-10-30）

订阅页标题为“你可以通过下面的方式找到我”，移除顶部英文和介绍。桌面两列、640px 以下单列。RSS 卡片仅保留圆角图标按钮、RSS订阅标题、地址框及复制按钮。微信公众号卡片展示圆角图标、名称“张硕Action”和明确的二维码占位，真实二维码待后续提供。其他平台介绍卡片已移除，后续可以在同一个网格中继续添加联系方式。

公众号配置位于 src/data/contacts.ts，收到真实二维码后将图片放入 public/images/，再设置 wechat.qrcode 为对应 /images/ 路径。卡片样式位于 src/styles/subscribe.css。

## 文章图片与公共图片（2026-10-30）

推荐新增文章使用“一篇文章一个文件夹”，正文与专属截图一起管理：

```text
src/content/blog/
  my-first-post/
    index.md
    images/
      process.png
      result.jpg
public/images/
  shared/
    common-flow.png
```

- 文章专属截图：放在文章自己的 `images/` 目录，在 `index.md` 中写 `![流程截图](./images/process.png)`。
- 跨文章复用的公共图片：放在 `public/images/shared/`，引用 `![公共流程图](/images/shared/common-flow.png)`；站点图标继续保留在 `public/`。
- `index.md` 继续使用前面的文章字段模板。目录名形成文章地址，例如 `my-first-post/index.md` 对应 `/blog/my-first-post/`。
- 旧的 `my-first-post.md` 写法仍支持；迁移时移动为 `my-first-post/index.md`，不要同时保留这两份正文，以免文章地址重复。
- 正文使用 Markdown 图片语法和相对路径；无需手动把文章截图复制到 `public/`、`dist/` 或 `offline/`。
- 新增或修改文章、截图后，运行 `npm run build:offline` 更新离线预览。构建会处理本地图片，并将资源带入离线目录。
- 整理或迁移文章时，把文章文件夹整体移动，同时更新受影响的图片引用。

## GitHub Pages 发布配置（2026-10-30）

目标仓库：https://github.com/zhangshuoaction/zhangshuoaction.github.io ，正式网址：https://zhangshuoaction.github.io/ 。推送 main 或手动触发工作流后，由 GitHub Actions 使用 Node.js 24 构建并发布 dist；本地 offline、依赖、截图和临时浏览器目录不上传。

astro.config.mjs 的默认 site 已改为正式网址，RSS、Sitemap、canonical 和 robots 使用正式地址；保留 SITE_URL 环境变量覆盖。离线预览入口和生成方式保持可用。

工作流会检查类型、静态页面链接和生产元信息，再将产物部署到 github-pages 环境。微信公众号二维码目前仍是明确的占位，示例文章仍按示例标注。

发布配置不等于部署成功。实际结果以 Actions 部署状态和正式网址检查为准。
