<!-- markdownlint-disable MD033 MD041 -->
<p align="center">
  <img src="./public/logo.svg" width="300" height="200" alt="MahoGen">
</p>

<div align="center">
  <!-- prettier-ignore-start -->
  <!-- markdownlint-disable-next-line MD036 -->
  <div>✨ 基于 AI 结构化生成的生成器 ✨</div>
  <a href="https://mahoshojo.colanns.me">试玩地址</a>
</div>

## ✨ 介绍
基于 AI 结构化生成的个性化魔法少女角色生成器，使用 Next.js 15 + React 19 + TypeScript + Vercel AI SDK 构建。

**V0.2.0 版本【战斗×成长×魔法少女】重大更新**：引入了全新的**角色成长循环**！现在，你的角色可以通过参与竞技场积累“历战记录”，并通过“成长升华”功能，让角色的设定随着经历而演变和进化！

支持多个 AI 提供商，推荐使用 `gemini-2.5-flash` 模型，输入你的名字或回答问卷，即可生成专属的、可成长的魔法少女角色！

~~超级 Vibe 所以结构垃圾代码问题也很大仅供参考娱乐测试使用！~~

## 核心功能

* **魔法少女生成器 (基于名字)**：输入你的名字，快速生成包含外貌、咒语和等级的魔法少女基本设定。
* **奇妙妖精大调查 (深度问卷)**：通过回答一系列问题，生成更具深度的、包含魔力构装、奇境规则和繁开状态的详细角色设定。
* **研究院残兽调查 (残兽生成)**：通过回答引导性问题，生成魔法少女的宿敌——“残兽”的详细档案。
* **魔法少女竞技场 (故事生成)**：上传2-4位参战者的设定文件（.json），AI将根据她们的设定与**历战记录**生成精彩故事。
    * **模式扩展**：新增**情景模式**，允许使用自定义场景进行故事创作！新增**指定分队**功能，体验团队对抗！
    * **经典模式**：参战者们将进行一场激烈的对决，争夺胜利。
    * **日常模式**：角色们将展开一段相对和平有趣的日常互动。
    * **羁绊模式**：战斗将更注重友情、热血与羁绊，角色的信念将成为关键。
* **成长升华**：上传一个包含“历战记录”的角色，AI将根据其全部经历，生成一个“成长后”的全新角色设定！
* **情景生成**：通过回答引导性问题，快速生成用于竞技场“情景模式”的自定义故事场景文件。
* **角色管理**：提供一个可视化的角色档案编辑器，可以查看、修改所有设定，并管理角色的“历战记录”与“原生性”状态。
* **配置驱动的AI安全策略**：通过环境变量，管理员可以灵活配置内容安全检查的范围、严格等级，并启用“连坐”机制，增强社区内容安全。
* **多语言生成**：现在AI生成功能支持选择输出语言，包括简繁中文、英语、日语和韩语。

## 🚀 快速开始

### 环境要求

- Node.js 18+ 或 Bun
- 支持的 AI 提供商 API Key（Gemini 等）

### 安装依赖

```bash
# 推荐使用 Bun
bun install

# 或使用 npm
npm install
```

### 环境配置

复制 `env.example` 为 `.env.local` 并配置你的 AI 提供商：

```bash
cp env.example .env.local
```

编辑 `.env.local`，配置 AI 提供商（支持多提供商自动故障转移）：

```shell
AI_PROVIDERS_CONFIG='[
  {{
    "name": "gemini_provider", 
    "apiKey": "your_gemini_api_key_here",
    "baseUrl": "https://xxx.com/v1",
    "model": "gemini-2.5-flash"
  },
  {
    "name": "gemini_provider", 
    "apiKey": "your_gemini_api_key_here",
    "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
    "model": "gemini-2.5-flash"
  }
]'
```

### 运行开发服务器

```bash
# 使用 Bun（支持 Turbopack）
bun run dev

# 或使用 npm
npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建生产版本

```bash
bun run build
bun run start
# 或
npm run build  
npm run start
```

## 📋 开发进度

- [x] AI 生成系统接入
- [x] 多 AI 提供商支持
- [x] 角色生成 Prompt Engineering
- [x] 自适应渐变配色
- [x] 图片保存功能优化
- [x] 图片预加载性能优化
- [x] 深度问卷生成功能
- [x] 角色对战故事生成功能
- [x] 队列系统与请求限流（已删除）
- [x] 用户排队等待界面（已删除）
- [x] 扩展预设角色库
- [x] 加入残兽生成器！魔法少女太多了，有违自然之道
- [x] 在竞技场中支持残兽参战！
- [x] 立绘 AIGC 生成功能
- [x] 在竞技场中新增【羁绊模式】！
- [x] 历战养成机制 (V0.2.0核心)
- [x] 角色成长升华 (V0.2.0)
- [x] 自定义情景生成 (V0.2.0)
- [x] 角色档案管理 (V0.2.0)
- [x] 竞技场模式扩展（情景模式、分队）(V0.2.0)
- [x] 问卷易用性改进 (V0.2.0)
- [ ] 角色卡片模板扩展
- [ ] 将系统通用化，模块化


## 星标情况

[![Star History Chart](https://api.star-history.com/svg?repos=colasama/MahoShojo-Generator&type=Date)](https://www.star-history.com/#colasama/MahoShojo-Generator&Date)

## 🧡 致谢
<div align="center">
  <p>本项目在线版本的大模型能力由</p>
  <p><b><a href="https://github.com/KouriChat/KouriChat"> 
    <img width="180" src="https://static.kourichat.com/pic/KouriChat.webp"/></br>
    基于 LLM 的情感陪伴程序</br>
    <span style="font-size: 20px">KouriChat</span>
  </a></b></p>
  <p>强力支持</p>
  <p><b>GitHub</b> | <a href="https://github.com/KouriChat/KouriChat">https://github.com/KouriChat/KouriChat</a></p>
  <p><b>项目官网</b> | <a href="https://kourichat.com/">https://kourichat.com/</a></p>
</div>

## 📁 项目结构

```
MahoShojo-Generator/
├── pages/
│   ├── _app.tsx
│   ├── index.tsx                # 主页面 - 功能选择
│   ├── name.tsx                 # 魔法少女（基于名字）生成页
│   ├── details.tsx              # 魔法少女（深度问卷）生成页
│   ├── canshou.tsx              # 残兽生成页
│   ├── battle.tsx               # 魔法少女竞技场页
│   ├── sublimation.tsx          # (新) 成长升华页
│   ├── scenario.tsx             # (新) 情景生成页
│   ├── character-manager.tsx    # (新) 角色管理页
│   ├── arrested.tsx             # 逮捕页
│   └── api/
│       ├── generate-magical-girl.ts
│       ├── generate-magical-girl-details.ts
│       ├── generate-canshou.ts
│       ├── generate-battle-story.ts
│       ├── generate-sublimation.ts      # (新) 升华API
│       ├── generate-scenario.ts         # (新) 情景生成API
│       └── verify-origin.ts
├── lib/
│   ├── ai.ts                   # AI 集成和类型定义
│   ├── config.ts               # 环境配置管理
│   └── signature.ts            # 数据签名与验证
├── components/
│   ├── MagicalGirlCard.tsx
│   ├── CanshouCard.tsx
│   └── BattleReportCard.tsx
├── public/
│   ├── questionnaire.json
│   ├── presets/
│   └── ...                     # 其他静态资源
├── types/
│   └── arena.d.ts              # (新) 竞技场相关类型
└── ...                         # 配置文件
```

---

<div style="text-align: center">✨ 为结构化生成献上祝福 ✨</div>
