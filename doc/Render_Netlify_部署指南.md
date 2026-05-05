# Render + Netlify 部署指南

这份指南适合第一次把这个项目部署到公网。

目标架构：

- 前端：Netlify
- 后端：Render

---

## 1. 部署前先确认

你当前仓库里需要有这些文件：

- [server.js](/Users/mac/qianzhu Vault/project/新手上岗/server.js)
- [app.js](/Users/mac/qianzhu Vault/project/新手上岗/app.js)
- [config.js](/Users/mac/qianzhu Vault/project/新手上岗/config.js)
- [render.yaml](/Users/mac/qianzhu Vault/project/新手上岗/render.yaml)

---

## 2. 先部署后端到 Render

### 2.1 注册并登录

打开：

- [Render Dashboard](https://dashboard.render.com/)

建议直接用 GitHub 登录。

### 2.2 连接 GitHub 仓库

首次使用时，Render 会要求你授权 GitHub。

确保把这个仓库授权进去：

- [qianzhu18/onjob](https://github.com/qianzhu18/onjob)

### 2.3 创建 Web Service

在 Render 后台点击：

1. `New +`
2. `Web Service`
3. 选择 GitHub 仓库 `onjob`

### 2.4 基本配置怎么填

如果 Render 识别到 [render.yaml](/Users/mac/qianzhu Vault/project/新手上岗/render.yaml)，可以直接按默认继续。

如果手动填写，建议这样配：

- Name: `onjob-api`
- Runtime: `Node`
- Branch: `main`
- Build Command: `npm install`
- Start Command: `npm start`

### 2.5 环境变量

最少不配也能跑。

如果你要接 MiMo，再加这些：

- `MIMO_API_KEY`
- `MIMO_MODEL`
- `MIMO_ACCESS_MODE`
- `MIMO_API_COMPAT_MODE`

如果前端和后端分域部署，建议再加：

- `CORS_ALLOW_ORIGIN=*`

如果你后面只想允许 Netlify 域名访问，再改成你的正式前端域名。

### 2.6 等待部署完成

部署成功后，Render 会给你一个公网地址，形如：

```text
https://onjob-api.onrender.com
```

先打开健康检查：

```text
https://onjob-api.onrender.com/api/health
```

如果看到 `ok: true`，说明后端已经成功上线。

---

## 3. 再部署前端到 Netlify

### 3.1 先改前端配置

打开：

- [config.js](/Users/mac/qianzhu Vault/project/新手上岗/config.js)

把：

```js
apiBaseUrl: "",
```

改成你的 Render 地址，比如：

```js
apiBaseUrl: "https://onjob-api.onrender.com",
```

保存后提交到 GitHub。

### 3.2 登录 Netlify

打开：

- [Netlify Dashboard](https://app.netlify.com/)

### 3.3 新建站点

点击：

1. `Add new site`
2. `Import an existing project`
3. 选择 GitHub
4. 选择仓库 `onjob`

### 3.4 构建配置怎么填

因为这个前端是纯静态页面，建议这样配：

- Build command: 留空
- Publish directory: `.`

如果界面要求必须填构建命令，也可以填：

```text
echo "static site"
```

### 3.5 部署完成后测试

部署成功后，Netlify 会给你一个域名。

打开页面后做这几个测试：

1. 进入首页
2. 点击上传资料
3. 先点击“演示文件”或上传一个你自己的文件
4. 看是否能生成章节
5. 测一下聊天
6. 测一下小测和综合考试

---

## 4. 没有企业文档时怎么验收

你现在没有真实企业资料，也完全可以验收。

建议用这三类材料：

### 方案 A：直接用仓库里的演示材料

- `新人上岗AI培训_商业计划书.pptx`

适合先验证：

- 文件解析
- 章节生成
- 检索问答
- 小测考试

### 方案 B：拿一份你自己的文档

比如：

- 一份产品 PRD
- 一份项目方案
- 一份客服 SOP
- 一份销售培训资料

只要内容稍微结构化，就能验证问答和出题效果。

### 方案 C：手写一份最小测试资料

你可以自己做一个 `md` 文件，内容包括：

1. 公司介绍
2. 上岗流程
3. 常见问题
4. 风险处理

这样最容易观察系统是否真的“理解”了结构。

---

## 5. 你要重点验收什么

公网给学长试用前，至少验这 6 项：

1. 页面能打开
2. 文件能上传
3. 上传后能生成章节
4. 问答能回到资料内容
5. 小测和综合考试能提交
6. 得分和薄弱点能返回

---

## 6. 当前版本的上线边界

这版适合：

- 小规模外部试用
- 学长/朋友体验
- 收集第一轮反馈

这版还不适合：

- 大规模正式商用
- 企业级并发使用
- 强隔离多租户环境

---

## 7. 下一阶段应该怎么进化

等第一轮有人试过之后，优先做：

1. 用户登录
2. 项目列表 / 历史记录
3. 数据库存储
4. 更强的 RAG 检索
5. 真正模型化的题目生成
