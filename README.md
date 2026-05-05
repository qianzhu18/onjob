# OnJob

新人上岗 AI 培训 MVP。

支持这条最小闭环：

- 上传培训资料
- 自动解析与知识切分
- 基于资料问答
- 自动生成小测与综合考试
- 提交答案后给出得分和薄弱点

## 本地启动

```bash
npm install
npm start
```

默认地址：

- `http://127.0.0.1:4173`

## 当前支持格式

- `pdf`
- `docx`
- `pptx`
- `xlsx`
- `txt`
- `md`
- `csv`
- `json`
- `html`

## 核心接口

- `POST /api/upload`
- `POST /api/load-demo`
- `GET /api/project`
- `GET /api/knowledge/search`
- `POST /api/chat`
- `POST /api/quiz/submit`
- `POST /api/exam/submit`
- `GET /api/health`

## MVP 对外测试说明

这版已经可以给外部测试用户做 MVP 验证，但有边界：

1. 适合小规模测试，不适合正式生产
2. 每次上传会生成一个 `projectId`
3. 前端会自动记住当前 `projectId`
4. 如果接入 MiMo，需要在服务端配置 `.env`

## 部署建议

### 推荐方案

- 前端：Netlify
- 后端：Render / Railway / Fly.io

原因：

这个项目有 Node.js 文件上传和运行时状态，不适合只靠纯静态托管完成整套服务。

### Netlify 使用方式

Netlify 适合托管前端页面。

如果前后端分开部署，建议把前端里的 `/api/*` 请求通过 Netlify rewrite 或代理转发到后端域名。

### 后端环境变量

参考：

- [.env.example](/Users/mac/qianzhu Vault/project/新手上岗/.env.example)

可选 MiMo 变量：

- `MIMO_API_KEY`
- `MIMO_MODEL`
- `MIMO_ACCESS_MODE`
- `MIMO_API_COMPAT_MODE`

## 健康检查

部署后可以先测：

```bash
curl https://your-api-domain/api/health
```

返回 `ok: true` 说明服务已启动。
