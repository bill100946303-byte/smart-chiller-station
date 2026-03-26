# system/diagram BFF 收口说明 v1

## 结论

`system/diagram` 在当前代码里已经完成了合同、路由和聚合实现。

当前仍然返回 `404` 的直接原因，不是接口没写，而是 **`127.0.0.1:8787` 上跑的不是 `chiller-bff`**。

现场验证结果很清楚：

- `curl http://127.0.0.1:8787/healthz` 返回 `404`
- 响应头 `Server: BaseHTTP/0.6 Python/3.14.3`
- `curl /bff/v1/sites/126lnoffice/system/topology` 也同样 `404`

这说明：

- 当前请求没有打到 `apps/chiller-bff/src/server.js`
- `system/diagram` 的 404 属于 **运行入口/端口占用问题**
- 不是 `system/diagram` 单独缺路由

补一条反证：

- 用同一份代码临时起 `BFF_PORT=8788 npm run dev`
- `GET /healthz` 返回 `200`
- `GET /bff/v1/sites/126lnoffice/system/diagram?layoutMode=auto&scope=full` 返回 `200`

一句话拍板：

- **要把当前 `system/diagram` 从 404 推到 200，最小动作是把 Node BFF 真正挂到目标端口，而不是再扩合同。**

## 当前 404 的直接原因

直接原因只有一条：

- `8787` 端口被 Python `BaseHTTP` 进程占用，当前并未对外提供 `chiller-bff` 的 `/bff/v1` 路由。

所以现状不是：

- `system/diagram` 没有写

而是：

- `system/diagram` 已写
- 但当前监听 `8787` 的进程不是这套 Node BFF

## 最小改动文件清单

如果以“把现有实现真正放出来”为目标，**最小代码闭环实际上已经在 repo 内齐了**。当前需要确认/保留的文件是：

- [v1.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/routes/v1.js)
  - 已注册 `GET /sites/:siteId/system/diagram`
- [systemDiagramService.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/services/systemDiagramService.js)
  - 已实现聚合输出
- [server.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/server.js)
  - 已挂载 `app.use("/bff/v1", buildV1Router(config))`
- [bff-v1.yaml](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/bff-v1.yaml)
  - 已定义 `system/diagram` 路径与 schema
- [system-diagram.json](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/examples/system-diagram.json)
  - 已有联调用 example

如果只问“还需要改哪些 repo 文件才能到 200”，答案是：

- **零新增业务文件**
- **零新增合同文件**
- 只需要把当前 Node BFF 进程真正切到对外端口

如果必须留一条运维/启动侧最小动作清单，则是：

1. 释放或绕开 `8787` 当前 Python 监听
2. 以 `apps/chiller-bff` 启动 Node 服务
3. 确保访问入口切到这份 Node BFF

## 达到 200 的最小闭环

最小闭环不需要开新业务域，也不需要再补新 DTO。

只要完成下面这 4 步即可：

1. 让 `apps/chiller-bff/src/server.js` 对外真正监听目标端口
2. 保持 [v1.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/routes/v1.js) 中的 `system/diagram` 路由注册生效
3. 继续使用 [systemDiagramService.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/services/systemDiagramService.js) 的聚合输出
4. 以前端验收命令验证 `200`

最小验收命令：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run dev
curl "http://127.0.0.1:8787/bff/v1/sites/126lnoffice/system/diagram?layoutMode=auto&scope=full"
```

如果 `8787` 仍被占用，则先临时验证：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
env BFF_PORT=8788 npm run dev
curl "http://127.0.0.1:8788/bff/v1/sites/126lnoffice/system/diagram?layoutMode=auto&scope=full"
```

这条链路已经实测可返回 `200`。

## 最小 response schema

顶层最小字段：

- `site`
- `generatedAt`
- `layoutMode`
- `scope`
- `freshness`
- `sourceStatus`
- `nodes`
- `edges`
- `groups`
- `stats`

`nodes[]` 最小字段：

- `id`
- `nodeType`
- `label`
- `systemType`
- `role`
- `group`
- `deviceIdRef`
- `deviceIds`
- `modelCategory`
- `positionHint`
- `rotationHint`
- `statusSummary`

`edges[]` 最小字段：

- `id`
- `from`
- `to`
- `edgeType`
- `pipeClass`
- `routeHint.points`

这已经在 [bff-v1.yaml](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/bff-v1.yaml) 中定义完毕，不需要再扩字段才能拿到首版 `200`。

## 是否可先用 topology/devices 聚合回退

可以，而且这就是最合理的 P0 路径。

首版 `system/diagram` 完全可以基于现有可用数据聚合，不需要新开数据域：

- `system/topology`
  - 提供主链语义
- `devices/list`
  - 提供真实设备数量、名称、`deviceId`
- `devices/{deviceId}`
  - 后续再补运行态细节，不阻塞首版 `200`

当前实现已经证明一件事：

- 即使上游 legacy 暂时不可达，也可以先返回 `200 + degraded sourceStatus`
- 前端可以先从“404 回退”升级到“合同已接通、运行态降级”

这比继续维持 `404` 更有价值，因为：

- 前端不再需要猜接口是否存在
- 合同已经稳定
- 后续只是在 `sourceStatus/freshness/deviceIdRef` 上逐步去掉降级态

## 哪些字段必须真实返回

第一版里，下面这些字段必须由运行时真实返回，不能省略：

- 顶层：`site`、`generatedAt`、`layoutMode`、`scope`、`freshness`、`sourceStatus`、`nodes`、`edges`、`groups`、`stats`
- 设备节点：`id`、`label`、`systemType`、`deviceIdRef`、`deviceIds`
- 连线：`id`、`from`、`to`、`pipeClass`、`routeHint.points`

第一版允许模板生成、不要求真实台账一比一的字段：

- 阀门节点本体
- `positionHint` 的精确坐标
- `rotationHint`
- `groups`
- `stats`

第一版允许先降级但必须显式返回的字段：

- `freshness`
- `sourceStatus`
- `statusSummary.degraded`

也就是说，首版重点不是“所有数据都完全真实”，而是：

- **合同结构真实可用**
- **设备主链真实可读**
- **降级状态真实可见**

## 主控下一步建议

只做这三件事，不要扩任务面：

1. 把 `8787` 切回 `chiller-bff` 监听
2. 用现有 `systemDiagramService` 直接对外返回 `200`
3. 用 `curl /system/diagram` 验证前端从接口不存在切到合同已联通

最终收口标准：

- `/healthz` 返回 `200`
- `/bff/v1/sites/126lnoffice/system/diagram?layoutMode=auto&scope=full` 返回 `200`
- 返回体包含 `nodes`、`edges`、`sourceStatus`、`freshness`
- 即使上游不可达，也不再返回 `404`
