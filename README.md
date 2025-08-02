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

支持多个 AI 提供商，推荐使用 `gemini-2.5-flash` 模型，输入你的名字即可生成专属的魔法少女角色！

~~超级 Vibe 所以结构垃圾代码问题也很大仅供参考娱乐测试使用！~~

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

```json
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
- [ ] 立绘 AIGC 生成功能
- [ ] 角色卡片模板扩展

## 📁 项目结构

```
MahoShojo-Generator/
├── pages/                    # Next.js 页面路由
│   ├── _app.tsx             # 应用根组件
│   ├── index.tsx            # 主页面 - 魔法少女生成器
│   └── api/                 # API 路由
│       └── generate-magical-girl.ts  # 角色生成 API
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

<div style="text-align: center">🌸 为结构化生成献上祝福！ ✨</div>

