# 网络热梗档案馆设计

## 目标

建立一个低部署成本的网络热梗人工档案馆。访客无需注册即可浏览和搜索已发布热梗；注册用户可以提交和编辑内容；管理员审核所有变更后发布，并保留贡献者标识。

## 一期范围

- 首页浮空、缓慢旋转的热梗文字云。
- `LIST` 和 `CARD` 两种浏览入口。
- 热梗详情弹窗，占桌面视口约 80%，移动端为近全屏可滚动面板。
- 内容字段：名称、别名、简短释义、起源、原本含义、新的意义、使用场景、初次登场地点、图片 URL、视频 URL、标签、贡献者。
- 访客搜索和查看公开内容。
- 用户注册、登录、提交新增、提交编辑、查看自己的审核状态。
- 管理员审核新增、编辑、删除申请，并查看前后版本差异和驳回原因。
- 外部媒体链接，不在一期实现文件上传。

一期明确不包含自动抓取、点赞、评论、复杂推荐、第三方 OAuth 和复杂分类体系。

## 技术方案

采用 Express 单体服务、SQLite 和原生 HTML/CSS/JavaScript。服务端同时提供页面静态文件和 JSON API，使用 SQLite 文件保存数据。密码使用成熟密码哈希算法保存，登录使用服务端会话；管理员账号通过初始化命令创建。

该方案依赖少，适合单机 Node.js 部署。SQLite 文件和媒体 URL 不需要额外云服务，但部署环境必须提供持久化磁盘和数据库备份。

## 数据模型

### users

- `id`
- `username`
- `password_hash`
- `role`: `user` 或 `admin`
- `created_at`

### memes

- `id`
- `name`
- `aliases`
- `summary`
- `origin`
- `original_meaning`
- `new_meaning`
- `usage_scenes`
- `first_appearance`
- `image_url`
- `video_url`
- `tags`
- `contributor_id`
- `status`: `published` 或 `archived`
- `created_at`
- `updated_at`

### revisions

- `id`
- `meme_id`, 新增申请允许为空
- `author_id`
- `type`: `create`, `update` 或 `delete`
- `payload_json`, 保存完整待审核内容
- `change_note`
- `status`: `pending`, `approved` 或 `rejected`
- `reviewer_id`
- `review_note`
- `created_at`
- `reviewed_at`

### sessions

- `id`
- `user_id`
- `expires_at`

公开接口只返回 `published` 热梗。用户编辑始终创建 revision，不直接改公开记录。管理员通过后在事务中更新热梗并标记 revision；驳回只记录原因。删除采用归档，保留历史数据和贡献记录。

## 页面和交互

### 首页

首页采用“词云主场”方向：深色墨绿色背景、偏暖的纸张色内容层、克制的衬线标题与无衬线正文。热梗文字使用不同字号、角度和缓慢漂浮动画，动画支持 `prefers-reduced-motion` 降级。搜索框常驻，`LIST`、`CARD` 入口位于首屏明确位置。

### 浏览和搜索

列表页以可扫描的行展示名称、简释、标签和更新时间；卡片页以图片、名称和简释组成网格。搜索通过服务端参数查询名称、别名、简释和标签，结果状态为空时展示明确提示。公开页面不要求登录。

### 详情

点击词云、列表项或卡片打开详情弹窗。弹窗包含完整字段、图片和可选视频嵌入。外部媒体加载失败时显示链接而不是破坏布局。关闭按钮、遮罩点击和 `Escape` 均可关闭；弹窗打开时禁止背景滚动。

### 用户和审核

用户登录后可以提交新增或编辑内容，并查看待审核、已通过、已驳回状态。编辑已发布热梗也先进入审核队列。管理员后台按待审核时间排序，展示字段级前后差异，支持通过或驳回并填写原因。通过后公开页面立即读取新版本，贡献者显示提交用户名称。

## API 边界

- `GET /api/memes`: 公开列表、搜索和筛选
- `GET /api/memes/:id`: 公开详情
- `POST /api/auth/register`: 注册
- `POST /api/auth/login`: 登录
- `POST /api/auth/logout`: 登出
- `GET /api/me`: 当前用户
- `GET /api/me/revisions`: 当前用户的提交记录
- `POST /api/revisions`: 创建新增或编辑申请
- `GET /api/admin/revisions`: 管理员待审核列表
- `POST /api/admin/revisions/:id/approve`: 通过申请
- `POST /api/admin/revisions/:id/reject`: 驳回申请

所有写接口校验登录、输入长度、URL 协议和角色权限。管理员 API 额外要求 `role=admin`。

## 错误处理和安全

- 输入校验失败返回 `400`，未登录返回 `401`，无权限返回 `403`，资源不存在返回 `404`。
- 密码不明文保存；会话设置过期时间并使用 HttpOnly Cookie。
- SQLite 查询使用参数绑定，避免拼接 SQL。
- 外部图片和视频只允许 `https://` URL；前端渲染用户内容时使用文本节点或安全转义，避免 XSS。
- 管理员审核操作写入审核人和时间；生产环境通过环境变量设置会话密钥。
- 提供数据库备份命令和初始化管理员命令。

## 验证策略

- API 测试：公开查询、搜索、注册登录、权限、revision 创建、审核通过和驳回。
- 数据测试：审核通过更新内容且保留贡献者，驳回不改变公开版本，删除变为归档。
- 浏览器测试：词云点击弹窗、列表/卡片入口、搜索、登录、提交、管理员审核、移动端弹窗滚动。
- 手工视觉检查：桌面和移动端首屏、动画降级、无图片/无视频和外部媒体失败状态。

## 部署

部署只需要 Node.js、项目文件、SQLite 数据目录和环境变量。使用单个 Node 进程启动 Express；反向代理和 HTTPS 可由 Nginx、Caddy 或托管平台提供。数据库目录必须挂载持久化磁盘，并定期复制备份。
