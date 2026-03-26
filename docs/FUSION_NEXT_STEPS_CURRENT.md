# FUSION_NEXT_STEPS_CURRENT

## 1. 目标

本文把 `gpt54-fusion-review-v1.md` 里的建议收敛成当前仓库可执行的最小实施路线。

执行前提：

- 不推倒重来
- 不新开平行主项目
- 不打断当前 `apps/chiller-bff + apps/chiller-shell-v1 + legacy 承接` 主线
- 先固化已签收成果，再扩新的能力面

## 2. 当前结论

融合建议结论：`部分采纳`

理由：

- 建议里的治理原则是对的：
  - 旧系统做内核
  - 统一接口做桥梁
  - 新壳做页面与扩展
  - 用文档和线程规则避免失控
- 但建议里的目录示例偏 Python/FastAPI，不适合直接套到当前仓库。
- 当前仓库已经形成 Node BFF、React Shell、legacy adapter、scripts、docs 的稳定主结构，应该沿现状增量演进。

是否建议立刻进入融合治理阶段：`yes`

## 3. 哪些建议马上可做

### 3.1 立即可做：治理文档固化

已落地或正在落地：

- `ARCHITECTURE_CURRENT.md`
- `FIELD_MAPPING_CURRENT.md`
- `API_SURFACE_CURRENT.md`
- `THREAD_RULES_CURRENT.md`

下一步应持续维护这些文档，而不是反复重写口头规则。

### 3.2 立即可做：继续把现有聚合逻辑收成统一 service

当前最适合继续收口的方向：

- 设备统一 service
  - list / tree / detail / topology 的字段与来源收口
- 告警统一 service
  - summary / list / severity / stale 的统一回退
- 趋势统一 service
  - overview / trends / recommendations 的指标口径收口
- freshness / sourceStatus 统一 service
  - 作为所有后续接口的标准诊断层

这类工作应在 `apps/chiller-bff/src/services/*` 内增量完成，不另建平行 `api/` 主目录。

### 3.3 立即可做：给未来能力预留 API 位，但不立即实现

可以现在在治理文档里明确预留：

- `GET|POST /bff/v1/sites/{siteId}/optimize`
- `GET|POST /bff/v1/sites/{siteId}/simulate`
- `POST /bff/v1/sites/{siteId}/assistant/query`

但当前只做预留命名与输入输出边界，不进入实现线程。

### 3.4 立即可做：稳定维护已落地主线

当前最该做的是：

- 维护已签收页面
- 维持治理文档与主账本一致
- 将趋势历史问题保留为复盘与防回归依据
- 保持 `/optimize-demo` 在治理态，不继续扩成真引擎

### 3.5 立即可做：新增“最小演示页”思路，复用现有 shell

如果后续真的要做 optimize/simulate，不应该新开一个独立前端，而应该：

- 继续用 `apps/chiller-shell-v1`
- 新增独立演示路由，如：
  - `/station-demo`
  - `/optimize-demo`
- 与现有 `/dashboard /devices /alarms /trend-analysis` 并存

## 4. 哪些建议应后置

### 4.1 optimize / simulate

后置原因：

- 当前已签收主线是页面迁移与运行态治理
- 当前一期已进入维护态封版
- Phase 2 新能力当前缺少明确业务批准与实施窗口

结论：

- 先治理，不马上做 optimize/simulate 实现

### 4.2 assistant/query

后置原因：

- 当前字段和接口边界虽已稳定，但还处于“可治理扩展”阶段
- 若现在直接上 AI，会把当前页面语义和规则层的不确定性提前固化

结论：

- 等字段、接口、线程规则运行一段时间稳定后再接

### 4.3 3D 原生重建

后置原因：

- 当前 3D 资源仍主要挂在 legacy/Nginx 承接路径
- 与页面迁移主线相比，3D 原生重建更重、更分散节奏

结论：

- 当前只保留外壳承接，不进入重写阶段

## 5. 哪些建议不适合当前项目

以下做法当前不适合：

- 新建一个 Python/FastAPI 平行主系统
- 把 `apps/chiller-bff` 与 `apps/chiller-shell-v1` 推倒重组
- 批量移动目录，制造大面积路径漂移
- 把 legacy 整体搬进一个新目录再二次适配
- 为了“看起来更标准”而让多个线程同时改同一批核心文件

## 6. 未来能力应落在哪里

### 6.1 `/optimize`

推荐落点：

- BFF route：
  - `apps/chiller-bff/src/routes/v1.js`
- BFF service：
  - 新增 `apps/chiller-bff/src/services/optimizeService.js`
- 如需 legacy 或计算内核适配：
  - 优先新增 adapter 或 service 内封装，不新建平行后端
- OpenAPI：
  - `apps/chiller-bff/openapi/bff-v1.yaml`
- 页面：
  - `apps/chiller-shell-v1/src/pages/OptimizeDemoPage.tsx` 或类似演示页

### 6.2 `/simulate`

推荐落点：

- BFF route：
  - `apps/chiller-bff/src/routes/v1.js`
- BFF service：
  - 新增 `apps/chiller-bff/src/services/simulateService.js`
- 页面：
  - 继续在 `apps/chiller-shell-v1/src/pages` 内新增仿真演示页

### 6.3 `/assistant/query`

推荐落点：

- BFF route：
  - `apps/chiller-bff/src/routes/v1.js`
- BFF service：
  - 新增 `apps/chiller-bff/src/services/assistantService.js`
- 其输入必须复用现有站点作用域：
  - `siteId`
- 其输出必须继承现有语义层：
  - `freshness`
  - `sourceStatus`
  - 已稳定字段命名

## 7. 最小 7 步实施顺序

### 第 1 步

冻结当前主结构，不做大目录重组。

### 第 2 步

继续维护治理文档：

- `ARCHITECTURE_CURRENT.md`
- `FIELD_MAPPING_CURRENT.md`
- `API_SURFACE_CURRENT.md`
- `THREAD_RULES_CURRENT.md`

### 第 3 步

把当前已签收和可演示状态持续记入：

- `docs/v19.2-master-status.md`

### 第 4 步

继续在现有 BFF service 内做维护态语义收口与必要修正：

- device
- anomaly
- trend
- freshness/sourceStatus

### 第 5 步

把未来能力只先定接口位，不立刻做实现：

- `/optimize`
- `/simulate`
- `/assistant/query`

### 第 6 步

若需要演示新能力，只在现有 shell 里增加新页面，不替换旧页面：

- `/station-demo`
- `/optimize-demo`

### 第 7 步

若进入下一阶段，必须先满足：

- 当前已签收页面稳定运行
- 治理文档已同步到最新事实
- Phase 2 获得明确批准

## 8. 当前维护态补充结论

当前更适合执行的是：

- `maintain`
- `monitor`

而不是：

- 重新扩一期页面范围
- 提前启动 `simulate / assistant / optimize engine`

等现有治理层稳定且业务明确批准后，再决定是否进入：

- optimize/simulate 实装
- assistant/query 实装
- 3D 外壳增强

## 8. 下一阶段最先做的 2 件事

1. 持续维护治理文档与主账本一致，不再让字段、接口、线程边界回到口头维护。
2. 等 legacy 趋势修复结果返回后，按既有回归清单推进趋势页正式签收。
