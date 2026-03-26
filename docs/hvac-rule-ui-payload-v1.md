# HVAC Rule UI Payload v1

目标：把规则文案整理为前端可直接渲染模型，不改阈值、不改触发逻辑、不改 evaluator。

产出文件：
- `docs/hvac-rule-ui-payload-v1.json`

## 1) 数据模型（前端直用）

每条规则节点结构：

```json
{
  "ruleId": "low-delta-t-chilled-loop",
  "display": {
    "zh": { "title": "...", "reason": "...", "action": "..." },
    "en": { "title": "...", "reason": "...", "action": "..." },
    "vi": { "title": "...", "reason": "...", "action": "..." }
  },
  "displayShort": {
    "zh": { "title": "...", "reason": "...", "action": "..." },
    "en": { "title": "...", "reason": "...", "action": "..." },
    "vi": { "title": "...", "reason": "...", "action": "..." }
  },
  "severityMapping": {
    "value": "major",
    "label": { "zh": "重要", "en": "Major", "vi": "Quan trong" }
  },
  "riskMapping": {
    "value": "medium",
    "label": { "zh": "中风险", "en": "Medium risk", "vi": "Rui ro trung binh" }
  },
  "skippedTemplates": {
    "upstream_unreachable": {
      "display": { "...": "..." },
      "displayShort": { "...": "..." }
    },
    "field_missing_or_invalid": {
      "display": { "...": "..." },
      "displayShort": { "...": "..." }
    },
    "unknown": {
      "display": { "...": "..." },
      "displayShort": { "...": "..." }
    }
  }
}
```

渲染建议：
- Desktop：优先 `display.*`
- Mobile：优先 `displayShort.*`
- 语言回退：`activeLocale -> zh`

## 2) 文案长度预算建议

Desktop 建议上限：
- 标题：`zh<=16`，`en<=36`，`vi<=34`
- 原因：`zh<=48`，`en<=120`，`vi<=110`
- 动作：`zh<=42`，`en<=110`，`vi<=100`

Mobile 建议上限：
- 标题：`zh<=8`，`en<=18`，`vi<=16`
- 原因：`zh<=18`，`en<=40`，`vi<=36`
- 动作：`zh<=18`，`en<=38`，`vi<=34`

溢出策略：
- 标题：`ellipsis`
- 原因：`single-line-ellipsis`
- 动作：`single-line-ellipsis`
- 点击展开后显示完整 `display`。

## 3) 冲突词黑名单（避免误导操作）

策略：拦截“无审批直接高风险动作”措辞，替换为“受控+分步+可回退”表达。

中文：
- `立即停机` -> `先进入受控降载并按值班审批执行`
- `马上断电` -> `先隔离风险回路并执行标准停机流程`
- `强制全关阀` -> `按步进策略逐步关小阀位并观察反馈`
- `立刻大幅调参` -> `按小步长调参并保留观察窗口`

英文：
- `shut down immediately` -> `enter controlled derating and follow approved shutdown procedure`
- `cut power now` -> `isolate risk path first, then execute standard power-off procedure`
- `force close all valves` -> `close valves stepwise with feedback monitoring`
- `urgent drastic retune` -> `retune in small steps with an observation window`

越南语（ASCII 兼容写法）：
- `dung may ngay` -> `giam tai co kiem soat va lam theo quy trinh da phe duyet`
- `cat dien ngay` -> `co lap rui ro truoc roi thuc hien quy trinh ngat dien chuan`
- `dong het van ngay` -> `dong van theo tung buoc va theo doi phan hoi`
- `chinh manh ngay lap tuc` -> `dieu chinh tung buoc nho va giu cua so quan sat`

## 4) 边界确认

- 未改 `ruleId`
- 未改阈值与触发条件
- 未改 evaluator 逻辑
- 仅整理文案与呈现层结构
