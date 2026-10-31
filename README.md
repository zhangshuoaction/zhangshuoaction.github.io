# 张硕Action · Action Blog

使用 Astro 构建的个人静态博客。日常维护以 Markdown 文章和图片为主，列表、文章页、搜索索引、标签和 RSS 会在构建时一起更新。

- 网站：[zhangshuoaction.github.io](https://zhangshuoaction.github.io/)
- 源码：[GitHub 仓库](https://github.com/zhangshuoaction/zhangshuoaction.github.io)

## 1. 日常主要看哪里

| 内容 | 位置 |
| --- | --- |
| 文章与文章配图 | `src/content/blog/` |
| 公共图片、站点图标 | `public/` |
| 博客名称、描述、作者 | `src/consts.ts` |
| 关于页介绍 | `src/pages/about.astro` |
| 公众号名称、二维码 | `src/data/contacts.ts` |
| 给 AI 的项目约定 | `AGENTS.md` |

`dist/` 是自动生成的网站，不需要手动编辑。写作时主要关注 `src/content/blog/`。

## 2. 一篇文章一个文件夹

正文文件名与文章文件夹名保持一致，文章和专属图片放在一起：

```text
src/content/blog/
└─ my-first-post/
   ├─ my-first-post.md
   └─ images/
      ├─ Pasted image 20261030160000.png
      └─ Pasted image 20261030160100.png
```

`my-first-post/my-first-post.md` 对应网站地址 `/blog/my-first-post/`。网址由文件夹名决定，不会重复为 `/blog/my-first-post/my-first-post/`。

文件夹名建议使用小写英文和短横线，文章中文标题写在正文顶部的 `title` 中。发布后尽量保持文件夹名稳定；迁移和改名时要检查旧链接。每个文章文件夹只放一篇 Markdown 正文。空的 `images/` 中可能有 `.gitkeep`，它用于让 Git 保留该目录，有图片后可以删除。

### 新建文章

1. 在 `src/content/blog/` 新建文件夹，例如 `my-first-post`。
2. 在里面新建同名文件 `my-first-post.md`，复制下面的模板。
3. 将配图放到该文章的 `images/`，完成后构建并检查页面。

```markdown
---
title: "我的第一篇文章"
description: "用一句话说明文章在讨论什么。"
pubDate: 2026-10-30
tags: ["日常实践"]
draft: false
sample: false
---

## 从这里开始

这里是正文。

![截图说明](<./images/Pasted image 20261030160000.png>)
```

模板中的图片行是写法示例，使用时换成真实文件，或先删除图片行。

| 字段 | 用途 |
| --- | --- |
| `title` | 必填，网站显示的文章标题 |
| `description` | 必填，文章摘要 |
| `pubDate` | 必填，发布日期，用于倒序排列 |
| `updatedDate` | 可选，更新日期 |
| `tags` | 可选，标签列表，默认空列表；兼容 Obsidian 的 # 前缀，网站读取时自动去掉前缀 |
| `draft` | 默认 `false`；设为 `true` 时不发布 |
| `sample` | 默认 `false`；设为 `true` 时显示示例文章提示 |
| `featured` | 兼容保留字段；当前列表仍按日期排序 |

日期格式为 `YYYY-MM-DD`。未来日期不会自动隐藏文章，需要暂不公开时使用 `draft: true`。草稿不会出现在文章页、列表、搜索、标签、RSS 和 Sitemap 中。

正文从二级标题 `##` 开始，二级与三级标题会生成文章目录。代码块注明语言即可高亮。示例内容可使用 sample: true 标记，正式文章保持 sample: false。

## 3. 用 Obsidian 维护

在 Obsidian 中选择“打开文件夹作为仓库”，打开本机的 `D:\AI本地文件\action_blog\src\content\blog`。这样侧边栏主要显示文章和配图。

打开“设置 → 文件与链接”，建议设置：

- 新建笔记的存放位置：**当前文件所在的文件夹**。
- 新附件的默认位置：**当前文件夹下的子文件夹**，子文件夹名填 `images`。
- 新链接格式：**基于当前笔记的相对路径**。
- 关闭 **使用双链 / Wikilinks**，使用标准 Markdown 链接和图片。
- 开启 **自动更新内部链接**，在 Obsidian 内整理资源时便于同步修改引用。

选项名称可能因语言版本略有不同，含义见 [Obsidian 文件与链接设置](https://obsidian.md/help/settings) 和 [附件设置](https://obsidian.md/help/attachments)。

每次新建文章，先创建文章文件夹和同名正文；之后粘贴截图，Obsidian 会将附件放入当前文章的 `images/`。

图片文件名可以保留 `Pasted image ...png`。手写路径时使用下面的方式包裹空格：

```markdown
![截图说明](<./images/Pasted image 20261030160000.png>)
```

Obsidian 自动生成的 `%20` 空格编码路径也可以使用。构建会处理文章相对路径图片，不需要将截图另外复制到 `public/` 或 `dist/`。跨文章复用的图片可放到 `public/images/`，在网站中引用 `/images/文件名.png`。

本项目使用标准 Markdown，没有加入 Obsidian 的 `![[图片]]`、`[[双链]]` 或笔记嵌入转换。Obsidian 中保存文件只会更新源码，网站要在构建或开发服务刷新后才更新。

Obsidian 的本机设置目录 `.obsidian/` 与废纸篓 `.trash/` 已忽略，不会提交到 GitHub。

## 4. 本地查看网站

需要 Node.js 22.23.4 或更新的受支持版本，当前项目使用 Node.js 24 和 npm。以下命令在 Windows CMD 中运行。

首次使用先安装依赖：

```cmd
cd /d "D:\AI本地文件\action_blog"
npm ci
```

写作时想即时查看网页：

```cmd
cd /d "D:\AI本地文件\action_blog"
npm run dev
```

查看正式构建结果：

```cmd
cd /d "D:\AI本地文件\action_blog"
npm run build
npm run preview
```

打开终端显示的 Local 网址，通常是 [http://127.0.0.1:4321/](http://127.0.0.1:4321/)。保持终端运行，结束时按 `Ctrl+C`。

构建只生成一个 `dist/`。修改文章或样式后重新构建，才能更新这个目录。直接通过 `file://` 双击其中的 HTML 可能丢失样式或无法跳转，请使用上述 HTTP 网址查看完整效果。

## 5. 发布到 GitHub Pages

本地保存、构建和线上发布是三个独立动作。将源文件提交并推送到 GitHub 的 `main` 后，GitHub Actions 会自动检查、构建并发布网站；只修改本地文件不会更新线上网站。

在仓库的 [Actions](https://github.com/zhangshuoaction/zhangshuoaction.github.io/actions) 中查看发布结果。部署使用 `dist/`，无需手工上传这个目录；依赖、构建产物和浏览器测试截图（artifacts/）均不提交到源码仓库；文章配图和站点公共图片需要提交。

正式域名在 `astro.config.mjs` 中配置；目前使用用户站点根路径，不需要额外的项目路径前缀。

## 6. 页面与联系方式

博客已包含文章列表与详情、目录、代码高亮、标题和正文搜索（命中高亮）、深浅色模式（深色背景 #3C3C3C）、阅读进度及回顶部、标签、关于、订阅、RSS 和 Sitemap。顶部导航滚动时保持可见，文章目录以竖线表示层级，详情页提供“返回”按钮及 50px 的回顶部按钮。

博客目录每页显示 10 篇，超过 10 篇自动生成底部分页。桌面左侧标签按公开文章数倒序排列，选择标签进入筛选结果，“全部博客”切回全部文章；切换标签从第 1 页开始，手机端标签位于列表上方。文章列表依次显示标题、完整日期与标签、简介，不展示阅读时长。分页和标签页均在构建时生成，无需额外服务或接口。亮色主题采用中性灰白与深灰文字，绿色用于 hover 和焦点反馈。

公众号当前名称为“张硕Action”，二维码为明确的占位。以后将真实二维码放入 `public/images/`，再将 `src/data/contacts.ts` 中的 `wechat.qrcode` 设置为 `/images/实际文件名.png`。

界面调整主要涉及 `src/components/`、`src/layouts/`、`src/styles/` 和 `src/scripts/`；路由和独立页面在 `src/pages/`。

## 7. 检查与其他目录

| 命令 | 作用 |
| --- | --- |
| `npm run check` | 检查类型与文章字段 |
| `npm run verify` | 类型检查、构建、文章网址与链接检查、草稿和订阅检查 |
| `node scripts/verify-production.mjs` | 检查正式域名、RSS、Sitemap 和页面元信息 |
| `npm run verify:navigation` | 构建后用本机 Edge 检查搜索、主题和移动端交互 |

浏览器检查会临时启动本机 HTTP 服务，结束后关闭并清理临时浏览器目录；截图保存在 `artifacts/navigation/`。可用 `BLOG_BROWSER_PATH` 指定其他 Chromium 浏览器路径。

`scripts/` 保存检查脚本，`.github/` 保存部署流程，`.astro/` 是 Astro 自动生成的数据，`node_modules/` 是安装的依赖，`artifacts/` 是本机验证记录。这些目录日常写作无需操作。


## 8. 完整目录用途与 GitHub 标记

标记说明：**上传**表示应提交到 GitHub 源码仓库；**仅本地**表示不提交。文章正文和配图属于源码，网站由 GitHub Actions 另行构建和发布。

| 目录或文件 | 用途 | GitHub 标记 |
| --- | --- | --- |
| src/ | 网站源代码，包含下面各子目录 | 上传 |
| src/content/blog/ | 文章正文；每篇文章的 images/ 保存专属截图和配图 | 上传，正文和图片一起提交 |
| src/components/ | 导航、文章卡片、阅读进度等组件 | 上传 |
| src/layouts/ | 页面公共布局和元信息 | 上传 |
| src/pages/ | 文章、关于、订阅、标签等页面及 RSS、robots 入口 | 上传 |
| src/styles/ | 配色、排版、响应式样式 | 上传 |
| src/scripts/ | 搜索、主题和阅读进度等浏览器交互 | 上传 |
| src/lib/ | 文章网址、筛选、标签和搜索等公共逻辑 | 上传 |
| src/data/ | 联系方式等站点数据 | 上传 |
| src/consts.ts、src/content.config.ts | 站点信息和文章字段、加载规则 | 上传 |
| public/ | 图标、社交封面、二维码、公共图片及 .nojekyll 等原样发布资源 | 上传 |
| scripts/ | 构建结果、导航与生产配置的检查脚本 | 上传 |
| .github/workflows/ | GitHub Pages 自动检查、构建和发布流程 | 上传 |
| README.md | 给使用者的写作、Obsidian、预览和发布说明 | 上传 |
| AGENTS.md | 给 AI 的项目协作约定 | 上传 |
| .gitignore | 全项目共用的 Git 忽略规则 | 上传 |
| package.json、package-lock.json | 项目命令、依赖和版本锁定 | 上传 |
| astro.config.mjs、tsconfig.json | Astro 和 TypeScript 配置 | 上传 |
| .env.example | 不含真实密钥的环境变量示例 | 上传 |
| node_modules/ | 安装生成的依赖 | 仅本地，已忽略 |
| dist/ | 构建生成的网站；Actions 将其作为站点产物发布 | 仅本地构建产物，不提交源码 |
| .astro/ | Astro 自动生成的数据、缓存和类型 | 仅本地，已忽略 |
| artifacts/ | 浏览器测试截图、部署检查记录等验证证据 | 仅本地，已忽略 |
| .obsidian/、.trash/、.claudian/（任意层级） | Obsidian 配置、回收站及本机 AI 插件设置，使用后才会出现 | 仅本地，已忽略 |
| .env、其他 .env.*（除 .env.example） | 本机环境变量和私密配置 | 仅本地，已忽略 |
| .tools/、.browser-check-*/、*.log | 本机辅助工具、临时浏览器目录和日志 | 仅本地，已忽略 |
| .git/ | 本机 Git 历史、索引和仓库元数据 | 仅本地，由 Git 自身管理 |

- **文章截图需要上传，浏览器测试截图不上传。** 前者在文章的 images/ 中，后者在 artifacts/ 中。
- **draft: true 不代表仅本地。** 它只阻止生成公开博客页面，源文件仍会随 Git 提交进入 GitHub；公开仓库中仍可看到源码。私密草稿应存放在仓库外。
- README.md 和 AGENTS.md 需要上传，但不会自动成为博客文章。其他仅供本机使用的 Markdown 笔记不要放入 src/content/blog/，该目录会将 Markdown 当文章校验和加载。
- .gitkeep 是保留空目录的占位文件，可以上传；文章 images/ 中有真实图片后可删除。
- 以上标记由 .gitignore 配合目录约定执行，不需要重命名目录。已被 Git 跟踪的文件不会因为新增忽略规则而自动停止跟踪。
