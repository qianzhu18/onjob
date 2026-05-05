# 小米 MiMo API 沉淀

## 1. 目的

这份文档用于统一沉淀 Xiaomi MiMo 的：

- 官方接入方式
- 当前可用模型与能力边界
- `.env` 配置项定义
- `Base URL` 与 `API Key` 的选择规则
- 平时最容易踩坑的问题

适用目标：后续在这个项目里接入小米 MiMo 做文档问答、培训对话、小测与考试题生成。

## 2. 官方资料入口

- 官网欢迎页：<https://platform.xiaomimimo.com/docs/zh-CN/welcome>
- 给模型读取的文档目录：<https://platform.xiaomimimo.com/llms.txt>
- 全量单文件文档：<https://platform.xiaomimimo.com/llms-full.txt>
- First API Call：<https://platform.xiaomimimo.com/static/docs/quick-start/first-api-call.md>
- OpenAI 兼容接口：<https://platform.xiaomimimo.com/static/docs/api/chat/openai-api.md>
- Codex 配置：<https://platform.xiaomimimo.com/static/docs/integration/codex.md>
- 模型更新：<https://platform.xiaomimimo.com/static/docs/updates/model.md>
- 功能更新：<https://platform.xiaomimimo.com/static/docs/updates/feature.md>

## 3. 先说结论

小米 MiMo 目前最适合这个项目的接法，是走 **OpenAI 兼容协议**。

原因：

- 现成 SDK 最多
- 后续接 RAG、对话、出题都更顺
- 你的产品是网页服务，先用标准 `chat/completions` 最省事

不建议第一版就上 Anthropic 兼容协议，除非你已有现成 Anthropic SDK 依赖链。

## 4. 官方接口结论

### 4.1 OpenAI 兼容接口

请求地址：

```text
https://api.xiaomimimo.com/v1/chat/completions
```

SDK Base URL：

```text
https://api.xiaomimimo.com/v1
```

### 4.2 Anthropic 兼容接口

请求地址：

```text
https://api.xiaomimimo.com/anthropic/v1/messages
```

SDK Base URL：

```text
https://api.xiaomimimo.com/anthropic
```

### 4.3 认证方式

官方支持两种头：

```text
api-key: $MIMO_API_KEY
```

或

```text
Authorization: Bearer $MIMO_API_KEY
```

为了兼容更多 SDK，项目里优先采用：

```text
Authorization: Bearer $MIMO_API_KEY
```

## 5. 这个项目推荐的模型选择

### 5.1 文档问答 / 培训对话

首选：

```text
mimo-v2.5-pro
```

原因：

- 更适合长文档理解
- Agent 场景更强
- 更适合复杂问答和培训引导

### 5.2 成本敏感的日常问答

可选：

```text
mimo-v2.5
```

原因：

- 成本更低
- 支持多模态
- 适合大部分常规培训问答

### 5.3 语音场景

如果后续要做语音朗读、口播培训：

```text
mimo-v2.5-tts
```

或相关 VoiceClone / VoiceDesign 型号。

当前 MVP 先不纳入主链路。

## 6. 最关键：配置选择规则

MiMo 现在有两套接入模式，**这会直接影响 `base_url` 和 `api key` 格式**。

### 6.1 按量付费 MiMo API

适合：

- 刚开始开发
- 调试频率不高
- 用量不稳定

配置规则：

- `MIMO_ACCESS_MODE=payg`
- `MIMO_API_KEY` 形如 `sk-xxxxx`
- OpenAI Base URL: `https://api.xiaomimimo.com/v1`
- Anthropic Base URL: `https://api.xiaomimimo.com/anthropic`

### 6.2 Token Plan 订阅制

适合：

- 团队多人共用
- 后续会大量跑问答、题目生成、测试
- 需要更稳定地控预算

配置规则：

- `MIMO_ACCESS_MODE=token_plan`
- `MIMO_API_KEY` 形如 `tp-xxxxx`
- OpenAI Base URL: `https://token-plan-cn.xiaomimimo.com/v1`
- Anthropic Base URL: `https://token-plan-cn.xiaomimimo.com/anthropic`

## 7. 推荐的 `.env` 设计

本项目统一使用下面这套变量。不要把 URL 和模式写死在代码里。

```dotenv
MIMO_ACCESS_MODE=payg
MIMO_API_COMPAT_MODE=openai
MIMO_API_KEY=
MIMO_MODEL=mimo-v2.5-pro

MIMO_OPENAI_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_ANTHROPIC_BASE_URL=https://api.xiaomimimo.com/anthropic
MIMO_TOKEN_PLAN_OPENAI_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
MIMO_TOKEN_PLAN_ANTHROPIC_BASE_URL=https://token-plan-cn.xiaomimimo.com/anthropic

# 可选：如果你拿到平台给的专属 Base URL，可直接覆盖
MIMO_BASE_URL_OVERRIDE=
```

## 8. 项目内的选择逻辑

### 8.1 选择顺序

代码里建议按这个优先级取配置：

1. 如果 `MIMO_BASE_URL_OVERRIDE` 有值，直接用它
2. 否则看 `MIMO_ACCESS_MODE`
3. 再看 `MIMO_API_COMPAT_MODE`
4. 最后得到真实 `base_url`

### 8.2 伪代码

```ts
function resolveMimoBaseUrl(env: Record<string, string | undefined>) {
  if (env.MIMO_BASE_URL_OVERRIDE) return env.MIMO_BASE_URL_OVERRIDE;

  const accessMode = env.MIMO_ACCESS_MODE || "payg";
  const compatMode = env.MIMO_API_COMPAT_MODE || "openai";

  if (accessMode === "token_plan") {
    return compatMode === "anthropic"
      ? env.MIMO_TOKEN_PLAN_ANTHROPIC_BASE_URL
      : env.MIMO_TOKEN_PLAN_OPENAI_BASE_URL;
  }

  return compatMode === "anthropic"
    ? env.MIMO_ANTHROPIC_BASE_URL
    : env.MIMO_OPENAI_BASE_URL;
}
```

## 9. 这个项目建议的默认值

针对“上传文件 -> 文档问答 -> 培训引导 -> 自动出题 -> 综合测试”这个 MVP，默认配置建议如下：

```dotenv
MIMO_ACCESS_MODE=payg
MIMO_API_COMPAT_MODE=openai
MIMO_MODEL=mimo-v2.5-pro
```

原因：

- OpenAI 兼容协议最容易接
- `mimo-v2.5-pro` 更适合复杂文本理解与题目生成
- 第一阶段先验证效果，再决定是否切到 Token Plan 控成本

## 10. 平时最容易踩坑的点

### 10.1 `base_url` 和 key 混用

这是第一大坑。

- `sk-` 类型 key 不要配到 `token-plan-cn` 的 URL
- `tp-` 类型 key 不要配到 `api.xiaomimimo.com` 的普通按量 URL

### 10.2 代码里写死 URL

不要在代码里写死：

```text
https://api.xiaomimimo.com/v1
```

因为后面一旦改成 Token Plan，你就得全局找代码。

### 10.3 直接升级新版 Codex 配置思路

官方在 Codex 文档里明确写了：MiMo 目前 **还不兼容 Responses API**，仍然更适合走 **Chat Completions API**。

所以如果你后面用到某些只支持 `responses` 的新接法，要单独评估，不要想当然复用。

### 10.4 忽略 reasoning_content

官方文档提到，在 thinking 模式多轮工具调用时，后续请求保留前面的 `reasoning_content`，效果更好。  
如果后续你要做复杂 Agent 问答或工具链，这是值得保留的。

### 10.5 文档问答不等于培训效果

MiMo 只是底层模型。真正决定你的产品效果的，仍然是：

- 文档清洗质量
- RAG 切分
- 引用召回
- 题目生成模板
- 考试模式约束

## 11. 最小调用示例

### 11.1 Python

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["MIMO_API_KEY"],
    base_url=os.environ["MIMO_BASE_URL"]
)

resp = client.chat.completions.create(
    model=os.environ.get("MIMO_MODEL", "mimo-v2.5-pro"),
    messages=[
        {"role": "system", "content": "You are MiMo, an AI assistant developed by Xiaomi."},
        {"role": "user", "content": "请总结这份培训文档的关键流程"}
    ],
    temperature=0.3,
    max_completion_tokens=1500
)

print(resp.choices[0].message.content)
```

### 11.2 curl

```bash
curl --request POST "$MIMO_BASE_URL/chat/completions" \
  --header "Authorization: Bearer $MIMO_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "model": "mimo-v2.5-pro",
    "messages": [
      {"role": "system", "content": "You are MiMo, an AI assistant developed by Xiaomi."},
      {"role": "user", "content": "请总结这份培训文档的关键流程"}
    ],
    "temperature": 0.3,
    "max_completion_tokens": 1500
  }'
```

## 12. 推荐的项目文件职责

### 12.1 `.env`

只放：

- API Key
- 当前模式
- 当前模型
- Base URL 覆盖项

### 12.2 `API/API沉淀.md`

只放：

- 官方规则
- 选择逻辑
- 踩坑总结

### 12.3 `doc/小米MiMo-最新动态.md`

只放：

- 最新模型发布
- 最近功能变化
- 对本项目有影响的更新

## 13. 调研说明

你提到“使用 context MCP 调研”。我在当前会话里检查了可用 MCP 资源，结果是空的，没有可读的 context 资源可直接用。  
所以这次最新信息核对改用了小米官方站点的：

- `llms.txt`
- `sitemap.xml`
- 官方 Markdown 文档

这比二手转载更稳。
