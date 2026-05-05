你这次要的“技术栈”，我理解成两层：

第一层是**做出商业审美官网的前端技术栈**。  
第二层是**让这个官网变成可运营、可转化、可迭代 MVP 的系统技术栈**。

你之前那份材料里已经有一个很重要的判断：成熟商业官网不能只当成前端页面，它应该支持品牌展示、产品说明、内容更新、SEO、表单转化、数据分析、快速迭代和稳定部署，所以本质是“前端框架 + 设计系统 + 内容系统 + 数据系统 + 转化系统 + 部署监控”。

下面我给你重新整理成一套更能落地的版本。

---

# 一、最终推荐技术栈

如果你要做 80% 的商业化 MVP 官网，我建议默认采用：

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
Framer Motion
MDX / Velite
Vercel
Tally / 飞书表单
PostHog
Vercel Analytics
```

如果项目继续发展，再加：

```text
Supabase
Resend
Cloudinary / ImageKit
Notion / 飞书多维表格 / Sanity
Sentry
Stripe
```

一句话版本：

```text
V1：Next.js + TypeScript + Tailwind + shadcn/ui + MDX + Vercel + 表单 + 分析

V2：加 Supabase / CMS / Resend / Cloudinary / PostHog

V3：加 Auth / Payment / Admin / CRM / Dashboard
```

---

# 二、技术栈的核心分层

## 1. 页面展示层

负责做出官网的页面结构、视觉、响应式和 SEO。

推荐：

```text
Next.js App Router
React
TypeScript
Vercel
```

为什么是 Next.js：

```text
适合官网
适合 SEO
适合内容页面
适合静态生成
也能扩展动态功能
部署顺畅
```

适合承载这些页面：

```text
/
首页

/product
产品介绍

/features
功能介绍

/cases
案例列表

/cases/[slug]
案例详情

/blog
内容列表

/blog/[slug]
内容详情

/pricing
价格页

/contact
联系页

/join
加入 / 申请 / Waitlist
```

你的材料里也提到，Next.js App Router + TypeScript + React Server Components 适合首页、活动、博客、成员、加入页这类官网结构。

---

## 2. 视觉与样式层

负责把页面做出“商业审美”，减少 AI 味。

推荐：

```text
Tailwind CSS
CSS Variables
class-variance-authority
tailwind-merge
clsx
```

这一层不要只理解成写样式，它的核心是建立 design token。

你至少要定义：

```text
颜色系统
字号系统
间距系统
圆角系统
阴影系统
容器宽度
卡片规则
按钮规则
响应式断点
```

推荐 token：

```text
Container：
1120 / 1200 / 1280px

Section Padding：
96 / 120 / 144px

Spacing：
8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128

Radius：
button 999px
card 20-24px
panel 28-36px

Shadow：
soft shadow
thin border
avoid heavy glow
```

Tailwind 不是为了快写 class，它真正的价值是让你的官网不再“每个区块单独调”，而是有统一视觉秩序。你的材料里也强调 Tailwind 要负责颜色、字号、间距、圆角、阴影、响应式布局，商业官网最怕每个页面单独调样式。

---

## 3. UI 与组件层

负责把官网变成可复用的组件系统。

推荐：

```text
shadcn/ui
Radix UI
Lucide React
Framer Motion
```

shadcn/ui 适合做基础 UI：

```text
Button
Badge
Card
Dialog
Tabs
Accordion
Input
Textarea
Dropdown
Avatar
```

但你不能只用 shadcn 默认样式。真正要做商业官网，需要自己封装商业组件。

你的商业组件库应该有：

```text
Navbar
Footer
Container
Section
SectionHeader

HeroWithPreview
ProductMockup
FeatureGrid
StepFlow
WorkflowPanel
ProofSection
CaseCard
BlogCard
EventCard
TestimonialCard
PricingCard
FAQSection
CTASection
```

最重要的判断：

```text
shadcn/ui 负责基础交互
自建组件负责商业审美
```

这点你之前材料里也讲到了：shadcn/ui 适合 Button、Badge、Dialog、Tabs、Accordion、Input、Card 等基础组件，但需要基于它做自己的商业组件库。

---

## 4. 内容系统层

负责让官网可以持续更新，而不是写死在页面里。

V1 推荐：

```text
MDX
Velite / Contentlayer
gray-matter
next-mdx-remote
```

适合管理：

```text
博客文章
案例
活动
往期记录
产品更新日志
FAQ
客户故事
资源库
```

目录可以这样：

```text
content/
  blog/
  cases/
  events/
  records/
  changelog/
  docs/
```

一篇内容应该有 frontmatter：

```md
---
title: "How we built the first MVP"
slug: "first-mvp"
date: "2026-05-01"
cover: "/images/cases/first-mvp.jpg"
excerpt: "A real build story from idea to launch."
tags: ["MVP", "AI", "Product"]
---
```

这一层非常关键。很多人做官网失败，是因为所有内容都写死在组件里，后续没法运营。你之前材料里也明确说，V1 最推荐 MDX + Contentlayer / Velite，因为不用后台，直接改文件就能更新内容，适合小团队。

---

## 5. CMS 层

当内容变多，运营成员也要参与，就需要 CMS。

选择顺序：

```text
V1：MDX
V2：Notion / 飞书多维表格 / Airtable
V3：Sanity / Payload / Strapi
V4：自建 Admin + 数据库
```

不同选择适合不同阶段：

```text
MDX：
适合技术团队、小内容量、快速上线

Notion / 飞书多维表格：
适合小团队运营、活动管理、成员管理、内容更新

Sanity / Payload：
适合长期商业项目、复杂内容模型、权限管理

自建 Admin：
适合真正平台化产品
```

你给的材料里也把 CMS 分成轻量方案和专业方案，轻量方案适合活动、文章、成员、报名信息，专业方案适合长期运营、多人协作、复杂内容模型和权限管理。

---

## 6. 数据层

当官网开始收集真实用户数据，就需要数据库。

推荐：

```text
Supabase
```

可选：

```text
Neon + Prisma
PlanetScale
Firebase
```

Supabase 适合 MVP，因为它同时提供：

```text
PostgreSQL
Auth
Storage
Edge Functions
API
Row Level Security
```

适合存：

```text
leads
线索表

subscriptions
订阅表

contact_messages
联系表

waitlist
等待名单

registrations
报名表

members
成员表

projects
项目表

feedback
反馈表
```

V1 可以不用数据库，但要预留数据模型。  
一旦需要站内表单、报名、订阅、用户反馈，就接 Supabase。

你的材料里也提到，Supabase 适合报名信息、订阅邮箱、成员信息、活动参与记录、表单反馈、项目提交，并且有 PostgreSQL、鉴权、文件存储和 API 生成能力。

---

## 7. 转化系统层

商业官网必须能让用户行动。

V1 不建议自研复杂系统，先用外部工具：

```text
Tally
Typeform
飞书表单
Google Forms
问卷星
Cal.com
Calendly
```

常见转化动作：

```text
加入 waitlist
申请试用
预约 Demo
报名活动
订阅 newsletter
联系合作
下载资料
购买套餐
```

V2 再升级成：

```text
React Hook Form
Zod
Supabase
Resend
Stripe
```

典型组合：

```text
表单校验：React Hook Form + Zod
数据存储：Supabase
邮件通知：Resend
支付：Stripe
分析埋点：PostHog
```

你的材料里也提到，商业官网一定要有转化闭环，早期可以用飞书表单、Tally、Typeform，进阶后再用自建表单 + Supabase + Resend。

---

## 8. 邮件系统层

有报名、订阅、申请、联系之后，就需要邮件。

推荐：

```text
Resend
React Email
```

可用于：

```text
报名成功通知
申请确认
活动提醒
newsletter
合作联系通知
产品更新推送
```

V1 可以先不用。  
V2 一旦有 waitlist、报名、订阅，就接 Resend。

---

## 9. 图片与媒体层

商业官网的可信度很大程度来自真实视觉素材。

V1：

```text
public/images
```

V2：

```text
Cloudinary
ImageKit
Supabase Storage
```

适合管理：

```text
产品截图
案例封面
活动照片
成员头像
文章封面
客户 Logo
Open Graph 图片
```

如果图片多，尽早接 Cloudinary / ImageKit。  
如果图片少，先用 public/images 就够。

---

## 10. 动效层

推荐：

```text
Framer Motion
```

但动效只做轻交互：

```text
section fade in
card hover lift
image subtle zoom
accordion open
button transition
page transition
```

不要做：

```text
满屏粒子
复杂滚动视差
过度 3D
高频闪烁
霓虹乱飞
```

商业官网动效标准：

```text
轻
慢
稳
服务阅读
```

你材料里也提到，Framer Motion 适合页面淡入、卡片 hover、图片轻微缩放、section 滚动出现和按钮状态，但要避免过度 3D、满屏粒子和复杂视差。

---

## 11. SEO 层

商业官网不能只好看，还要能被搜索和分享。

Next.js 里必须做：

```text
metadata title
description
Open Graph
Twitter Card
canonical
sitemap.xml
robots.txt
structured data
```

内容页面必须有：

```text
title
description
cover
slug
date
tags
author
```

SEO 文件：

```text
lib/seo.ts
app/sitemap.ts
app/robots.ts
```

你材料里也强调了这些 SEO 基础，包括 metadata、Open Graph、canonical、sitemap、robots 和 structured data。

---

## 12. 数据分析层

推荐：

```text
Vercel Analytics
PostHog
Microsoft Clarity
Sentry
```

各自用途：

```text
Vercel Analytics：
看访问量、性能和基础流量

PostHog：
看按钮点击、转化漏斗、事件追踪

Microsoft Clarity：
看用户录屏、热力图、滚动行为

Sentry：
看前端错误和线上异常
```

你要埋点的事件：

```text
hero_cta_click
pricing_cta_click
demo_request_submit
waitlist_submit
case_card_click
blog_card_click
form_start
form_submit
scroll_50
scroll_90
```

材料里也说了，数据分析至少要看首页访问量、活动卡点击率、加入按钮点击率、报名转化率、滚动深度和移动端表现。

---

## 13. 部署与工程层

推荐：

```text
GitHub
Vercel
Preview Deployment
Production Deployment
Domain
Environment Variables
```

工作流：

```text
本地开发
push 到 GitHub
Vercel 自动生成 Preview
确认后 merge
自动部署 Production
数据分析观察
下一轮迭代
```

Vercel 是 Next.js 官网最省心的部署方案，你材料里也提到它有自动部署、预览链接、域名配置简单、性能好等优势。

---

# 三、按 MVP 阶段选技术栈

## V0：一天验证版

适合只想测试想法。

```text
Next.js
Tailwind CSS
shadcn/ui
Vercel
Tally / 飞书表单
```

做什么：

```text
首页
一个 CTA
一个表单
基础分析
```

不要做：

```text
数据库
登录
后台
支付
复杂 CMS
```

---

## V1：可信官网版

适合正式对外展示。

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
Framer Motion
MDX / Velite
Vercel
Tally / 飞书表单
Vercel Analytics
PostHog
```

要做到：

```text
首页
案例 / 博客 / 活动 / 内容详情页
真实产品预览
转化表单
SEO
移动端适配
基础埋点
```

这是最推荐的默认版本。

---

## V2：可运营版

适合开始持续更新和收集数据。

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
Supabase
Notion / 飞书多维表格 / Sanity
Resend
Cloudinary
PostHog
Clarity
Sentry
Vercel
```

新增能力：

```text
内容后台
报名数据
订阅邮箱
邮件通知
图片管理
热力图
错误监控
```

---

## V3：产品化官网版

适合官网和产品连在一起。

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
Supabase / Neon
Prisma
Auth.js / Clerk
Stripe
Resend
PostHog
Sentry
Cloudinary
Vercel
```

新增能力：

```text
用户登录
Dashboard
支付
权限
用户数据
订单
Admin
CRM
```

---

# 四、标准项目目录

这是我建议你以后所有商业 MVP 都用的结构。

```text
project/
  app/
    layout.tsx
    page.tsx

    about/
      page.tsx

    product/
      page.tsx

    pricing/
      page.tsx

    blog/
      page.tsx
      [slug]/
        page.tsx

    cases/
      page.tsx
      [slug]/
        page.tsx

    contact/
      page.tsx

  components/
    layout/
      Navbar.tsx
      Footer.tsx
      Container.tsx
      Section.tsx
      PageShell.tsx

    sections/
      HeroSection.tsx
      ProblemSection.tsx
      SolutionSection.tsx
      ProductPreviewSection.tsx
      WorkflowSection.tsx
      FeatureSection.tsx
      ProofSection.tsx
      PricingSection.tsx
      FAQSection.tsx
      CTASection.tsx

    cards/
      FeatureCard.tsx
      CaseCard.tsx
      BlogCard.tsx
      TestimonialCard.tsx
      PricingCard.tsx

    ui/
      button.tsx
      badge.tsx
      card.tsx
      input.tsx
      dialog.tsx
      tabs.tsx
      accordion.tsx

  content/
    blog/
    cases/
    changelog/
    docs/

  data/
    site.ts
    nav.ts
    features.ts
    testimonials.ts
    pricing.ts
    faq.ts

  lib/
    content.ts
    seo.ts
    analytics.ts
    utils.ts
    constants.ts

  public/
    images/
      hero/
      product/
      cases/
      blog/
      logos/
      og/

  styles/
    globals.css
```

这套结构的核心是把页面、组件、内容、数据、工具函数、图片资源分开，后续不会乱。

---

# 五、必须沉淀的数据模型

任何商业官网，不管项目是什么，至少有这些模型。

## Site

```ts
export type SiteConfig = {
  name: string
  tagline: string
  description: string
  url: string
  ogImage: string
  links: {
    twitter?: string
    github?: string
    email?: string
  }
}
```

## Feature

```ts
export type Feature = {
  title: string
  description: string
  icon?: string
  image?: string
}
```

## Case

```ts
export type CaseItem = {
  slug: string
  title: string
  excerpt: string
  cover: string
  industry?: string
  result?: string
  tags: string[]
}
```

## Post

```ts
export type Post = {
  slug: string
  title: string
  excerpt: string
  date: string
  cover: string
  tags: string[]
  author?: string
}
```

## Testimonial

```ts
export type Testimonial = {
  quote: string
  name: string
  role: string
  company?: string
  avatar?: string
}
```

## PricingPlan

```ts
export type PricingPlan = {
  name: string
  price: string
  description: string
  features: string[]
  cta: string
  highlighted?: boolean
}
```

## Lead

```ts
export type Lead = {
  name?: string
  email: string
  company?: string
  message?: string
  source: string
}
```

这些模型会决定你的官网是不是可维护。

---

# 六、技术选型的判断心法

## 什么时候只用 MDX？

```text
内容少
团队会 GitHub
更新频率低
想快速上线
不需要后台
```

## 什么时候上 CMS？

```text
内容多
运营要更新
活动 / 案例 / 文章频繁变化
图片多
需要多人协作
```

## 什么时候上 Supabase？

```text
要存用户数据
要存报名信息
要做订阅
要做表单管理
要做成员 / 项目 / 申请数据
```

## 什么时候上 Auth？

```text
用户要登录
用户有 Dashboard
不同用户看到不同内容
有权限管理
```

## 什么时候上 Stripe？

```text
要收费
要订阅
要订单
要发票
```

## 什么时候上 Sanity / Payload？

```text
内容成为核心资产
有复杂内容模型
多人编辑
需要审核与权限
长期运营
```

---

# 七、真正的默认方案

如果你现在要从 0 开一个商业 MVP，我建议直接这样：

```text
框架：Next.js App Router
语言：TypeScript
样式：Tailwind CSS
组件：shadcn/ui + 自建商业组件
动效：Framer Motion
内容：MDX + Velite
表单：Tally / 飞书表单
分析：Vercel Analytics + PostHog
部署：Vercel
版本管理：GitHub
```

当项目开始有人用，再升级：

```text
数据库：Supabase
邮件：Resend
图片：Cloudinary
CMS：Notion / 飞书 / Sanity
错误监控：Sentry
用户录屏：Clarity
支付：Stripe
```

---

# 八、最终架构图

```text
User
 ↓
Next.js App Router
 ↓
Pages
首页 / 产品 / 案例 / 内容 / 价格 / 联系
 ↓
Components
Hero / Preview / Feature / Proof / CTA / Cards
 ↓
Design System
Tailwind tokens / shadcn/ui / custom components
 ↓
Content
MDX / CMS / static data
 ↓
Conversion
Tally / Form / Supabase / Resend / Stripe
 ↓
Analytics
Vercel Analytics / PostHog / Clarity / Sentry
 ↓
Deploy
GitHub / Vercel / Domain
```

---

# 九、最重要的结论

做可信商业官网，技术栈不要围绕“炫技”选，围绕这 5 个能力选：

```text
展示能力：Next.js + Tailwind + shadcn/ui
审美能力：Design Token + 自建商业组件
内容能力：MDX / CMS
转化能力：表单 / Supabase / Resend / Stripe
迭代能力：Vercel + PostHog + Clarity + Sentry
```

最推荐的 V1 技术栈就是：

```text
Next.js + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion + MDX + Vercel + Tally/飞书表单 + PostHog
```

这套栈能让你快速做出一个有商业质感、能持续更新、能收集线索、能观察数据、能继续扩展成产品的 MVP 官网。