# Admin 应用边界

`apps/admin` 提供独立 React 工作台与 Hono Worker BFF。Worker 校验 Cloudflare Access JWT，按稳定主体逐请求读取 D1 principal 与 capability；业务 API 使用 `/api/admin/v1/`。新增写能力由服务器配置逐项启用，默认关闭。生产 hostname 为 `admin.mahoshojo.colanns.me`，仓库默认配置不连接生产。

[正式部署与恢复验收 runbook](../../docs/runbooks/2026-09-12_143000_独立管理端部署与恢复验收.md)记录 Access、迁移、备份恢复与回滚顺序；[合成部署示例](./scripts/deploy.example.json)仅用于结构参考和 dry-run，不是生产配置。

## 安全入口

UI、静态资源与业务 API 同源，并经过 Worker 授权；`workers_dev` 与 preview URLs 均关闭，静态资源必须 `run_worker_first: true`。未知 API 不进入 SPA fallback。`/health/live` 只提供不访问业务资源的进程存活状态。

Access JWT 校验 RS256/JWKS、issuer、audience、有效期与主体类型。email 不作为内部主键；human 与 service 不互相降级映射。D1 principal 的禁用状态和 capability 每请求重读。`ADMIN_PRINCIPALS_JSON` 固定为 `[]`，不再作为生产授权目录。

写入要求精确同源 Origin、Fetch Metadata、自定义 CSRF header 和 JSON。操作记录、业务变更、通知和成功审计使用同一个原生 D1 batch；CAS 冲突和幂等键不一致拒绝覆盖。浏览器不包含服务器 binding、秘密或签名能力。

## 本地合成环境

先构建浏览器产物，再运行本地工具（可从仓库根目录执行）：

```sh
pnpm --filter @mahoshojo/admin run build
node apps/admin/scripts/local.mjs init
node apps/admin/scripts/local.mjs serve
```

访问 `http://127.0.0.1:8799/__fixture/login`。该工具仅绑定 `127.0.0.1`，校验 Host，使用内存中临时 RSA 密钥签发一小时有效的合成 Access JWT，并复用正式验签器、Worker、D1 principal 和业务 API。浏览器获得 HttpOnly、SameSite=Strict 本地 cookie；工具将其传递给同一 Worker 验签。该入口、密钥和 cookie 处理仅存在于 `scripts/`，不进入部署 bundle。

D1/R2 状态保存在 `apps/admin/.wrangler/state/v3`。初始化只接受空库或带本工具标记的合成库；不会覆盖已有业务库，也不会重新激活已撤权管理员。schema.sql 基线与所需增量 migration 只用于新建本地合成库；这不是生产 migration runner。增量 SQL 使用 Drizzle statement breakpoint，保留 trigger body。合成数据包含用户、两张数据卡和历史待审核更新。

需要验证操作确认、版本冲突、重试与通知时：

```sh
node apps/admin/scripts/local.mjs serve --writers
```

该模式使用独立合成 writer principal，只启用内容、标签和消息操作；不启用 AI 调用、清理、导出或真实外部资源。停止服务后，重新登录会使用新的一小时 JWT。撤权 fixture 要验证恢复时，使用新的隔离测试状态，不以初始化撤销禁用记录。

## Principal 控制工具

```sh
node apps/admin/scripts/principals.mjs bootstrap --local
node apps/admin/scripts/principals.mjs revoke --local
node apps/admin/scripts/principals.mjs restore --local
```

共用环境变量为 `ADMIN_PRINCIPAL_ID`、`ADMIN_CONTROL_REASON`、`ADMIN_CONTROL_OPERATOR_REF`。bootstrap 还需要 `ADMIN_ACCESS_ISSUER`、`ADMIN_ACCESS_AUDIENCE`、`ADMIN_ACCESS_JWKS_URL`、`ADMIN_ACCESS_JWT_FILE`、`ADMIN_BOOTSTRAP_CAPABILITIES`（JSON capability 数组）。token 文件只在控制工具中读取，首个管理员必须是验签成功的真实 human identity；没有公网 bootstrap 接口。所有成功操作持久审计。

`restore` 使用同一套真实 Access 验签配置，另由 `ADMIN_RESTORE_CAPABILITIES` 显式给出恢复后的权限。它只将同一 `issuer + subject + human kind`、同一 ID 的 disabled 主体原子恢复为 active；审计失败回滚，不新增主体、不覆盖 active 主体或其他身份。原唯一管理员可通过 Cloudflare 账户恢复精确入口策略后使用该工具，不能删除旧主体或审计再 bootstrap。

remote 模式必须显式 `--remote --confirm-remote`，并提供受保护 gateway 的 `ADMIN_CONTROL_GATEWAY_URL`、`ADMIN_CONTROL_GATEWAY_HMAC_SECRET`，需要时提供 Access service credentials。该模式属于仓库高风险边界，需在具体目标和操作可审阅后单独授权。本地 Miniflare 存储工具使用其 workerd 已支持的兼容日期；产品 Worker 的兼容日期独立维护。

## 独立部署与验证

`wrangler.jsonc` 保持 `.invalid` issuer、deny-all audience、零 D1 ID 和本地资源名称。私有生产配置通过 `ADMIN_DEPLOY_CONFIG` 指向受审阅 JSON，部署工具只接受固定 hostname、Worker-first ASSETS、一个 D1、两个私有 R2、一个有界 Queue consumer 与补偿 cron；拒绝额外入口、环境覆盖和 build hook。真实邮箱名单在 Cloudflare Access 中配置，秘密通过受控配置提供，不写入仓库。

```sh
pnpm --filter @mahoshojo/admin run test
pnpm --filter @mahoshojo/admin run lint
pnpm --filter @mahoshojo/admin run build
node apps/admin/scripts/deploy.mjs --dry-run
pnpm run check:admin-boundary
```

最后一个部署命令需要事先设置 `ADMIN_DEPLOY_CONFIG`。build 与 `--dry-run` 都不发布；独立发布 workflow 仅手动触发并使用 `admin-production` environment。Access 真实登录、错误 audience、直接入口、撤权、deny-all 和远程 migration 的生产验收不能由本地 fixture 代替。回滚优先关闭对应 writer、回退 Admin Worker 或 Access deny-all，不删除新增审计/作业表。
