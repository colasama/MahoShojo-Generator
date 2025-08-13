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

支持多个 AI 提供商，推荐使用 `gemini-2.5-flash` 模型，输入你的名字或回答问卷，即可生成专属的魔法少女角色！

~~超级 Vibe 所以结构垃圾代码问题也很大仅供参考娱乐测试使用！~~

## 核心功能

* **魔法少女生成器 (基于名字)**：输入你的名字，快速生成包含外貌、咒语和等级的魔法少女基本设定。
* **奇妙妖精大调查 (深度问卷)**：通过回答一系列问题，生成更具深度的、包含魔力构装、奇境规则和繁开状态的详细角色设定。
* **魔法少女竞技场 (故事生成)**：上传2-4位参战者的设定文件（.json），参战者可以是**魔法少女**或**残兽**。AI将生成他们之间精彩的战斗故事和详细的战后报告。
    * **普通模式**：参战者们将进行一场激烈的对决，争夺胜利。
    * **【新】羁绊模式**：参战者们将根据羁绊和感情，寻找通往理想结局的途径。
* **研究院残兽调查 (残兽生成)**：新增功能！通过回答一系列关于核心概念和欲望的问题，生成魔法少女的宿敌——“残兽”的详细档案。

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
- [ ] 历战养成机制
- [ ] 角色卡片模板扩展
- [ ] 将系统通用化，模块化


## 后续工作笔记

可以在每一场战斗完成后，允许用户获取参战的所有魔法少女的新设定文件。设定文件中还会保存魔法少女的历次战斗记录，包括战斗报告标题、参战者、胜利者。

然后在竞技场生成战斗时，如果设定文件内容中包含战斗记录，则将其一并提供给AI。这样，就可以使得用户过往的战斗影响未来的战斗，实现历战养成机制了。

1. 在每位参战魔法少女的设定文件里增加一个 battle_history 数组字段。每场战斗结束后，向该数组追加一个战斗记录对象，例如：

```
{
  "title": "【震撼】“花级”翠雀降临！“芽级”白玫逆风而上，昔日师徒竞技场上演情感与力量的悲歌！",
  "participants": ["翠雀", "白玫"],
  "winner": "翠雀"
}
```

2. 生成战斗时读取历史记录并传给AI：在 generate-battle-story 里加载所有参战者的设定文件，如果 battle_history 存在，就将这些信息一起拼接到 prompt 中，作为 AI 生成的上下文，让它能参考过往的对战历史。

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
├── pages/                    # Next.js 页面路由
│   ├── _app.tsx             # 应用根组件
│   ├── index.tsx            # 主页面 - 功能选择
│   ├── name.tsx             # 魔法少女（基于名字）生成页
│   ├── details.tsx          # 魔法少女（深度问卷）生成页
│   ├── battle.tsx           # 魔法少女竞技场页
│   ├── canshou.tsx          # 残兽生成页
│   └── api/                 # API 路由
│       ├── generate-magical-girl.ts
│       ├── generate-magical-girl-details.ts
│       ├── generate-battle-story.ts
│       └── generate-canshou.ts
├── lib/                     # 工具库
│   ├── ai.ts               # AI 集成和类型定义
│   └── config.ts           # 环境配置管理
├── styles/                  # 样式文件
│   └── globals.css         # 全局样式和动画
├── public/                  # 静态资源
│   ├── logo.svg            # 主 Logo
│   ├── logo-white.svg      # 白色 Logo（用于保存图片）
│   ├── mahou-title.svg     # 标题图标
│   └── ...                 # 其他图标和资源
├── types/                   # TypeScript 类型声明
├── config/                  # 配置文件
├── tests/                   # 测试文件
├── env.example             # 环境变量示例
└── ...                     # 配置文件
```

---

<div style="text-align: center">✨ 为结构化生成献上祝福 ✨</div>
