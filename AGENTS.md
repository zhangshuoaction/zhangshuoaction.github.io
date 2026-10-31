# AGENTS.md

本文件是本项目唯一的 AI 协作入口，适用于整个仓库。面向使用者的写作、Obsidian 设置和预览步骤见 README.md；修改这些流程时同步更新 README。

## 项目与边界

- 项目是 Astro + TypeScript 静态博客，站点名称以 src/consts.ts 为准，当前为“张硕Action”。
- 网站通过 GitHub Actions 构建 dist 并发布到 https://zhangshuoaction.github.io/；部署配置在 .github/workflows/deploy.yml。
- 开始修改前检查 git status，保留用户未提交的文章、图片与界面改动；在用户授权范围内连续实施、检查和修复。
- 从实际问题和必要能力出发选择最小改动，中文输出先给结论，再给依据、验证结果及必要限制。

## 内容约定

- 每篇文章一个文件夹：src/content/blog/<文章标识>/<文章标识>.md；专属配图放该文件夹的 images/。空 images 中的 .gitkeep 用于保留 Git 目录，有图片后可移除。
- 文章标识建议用小写英文与短横线；中文标题写入 frontmatter.title。每个文章文件夹只保留一篇正文。
- 网址由文件夹决定。src/lib/post-id.mjs 是 ID 规则的唯一实现，供 src/content.config.ts 和构建检查共同使用；迁移文章时保留已有 URL。
- 使用标准 Markdown 图片相对路径；带空格的图片路径用尖括号包裹或使用 URL 编码。Obsidian 双链、笔记嵌入和专用语法没有转换支持。
- 文章字段和默认值以 src/content.config.ts 为准；draft: true 在列表、详情、搜索、标签、RSS 和 Sitemap 中均须排除。正式文章使用 sample: false。
- 构建时由 Astro 处理文章图片。公共资源放 public/，公共图片使用 /images/... 网站路径；保持图片引用与真实文件名一致。
- 用户正文与元信息仅按任务要求编辑。调整文章路径或资源文件名时，同时检查所有引用。
- Obsidian 本机设置与废纸篓由 .gitignore 排除；不要把其中的笔记发布为文章。

## 修改位置

- src/components/、src/layouts/：共享界面与布局；src/pages/：页面路由及 RSS、robots。
- src/styles/、src/scripts/：样式与浏览器交互；src/lib/：文章与搜索等公共逻辑。
- src/consts.ts：站点信息；src/data/contacts.ts：联系方式，公众号二维码继续保留当前明确占位，直到用户提供真实图片。
- scripts/：构建与浏览器检查；.github/workflows/：GitHub Pages 部署。
- dist/ 是生成结果；修改源文件后重新构建，不直接维护产物。构建只输出 dist，保持现有单一产物流程。

## 验证与交付

- 文章、图片、内容加载或路由调整后运行 npm run verify；涉及线上地址或发布配置时，再运行 node scripts/verify-production.mjs。
- 修改导航、搜索、主题或阅读交互时，构建后运行 npm run verify:navigation，使用实际浏览器检查相应页面。该检查会临时启动 HTTP 服务并在结束后关闭。
- 迁移内容必须核对文章数量、原网址、图片显示、草稿过滤和 RSS/Sitemap；构建成功与实际浏览器验证分别报告。
- 清理本次创建的临时文件和进程。递归删除或移动前核对绝对路径，确保目标在本项目及任务范围内。
- 交付说明具体改动、已通过的检查和未完成项。用户未授权的发布、删除正文或改变既有公开 URL，先说明影响并取得确认；已明确授权的任务无需重复询问。
