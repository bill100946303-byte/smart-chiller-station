# HANDOFF_NEXT_ACTIONS_CURRENT

## 1. 给项目管理/协作方的当前动作建议

### 立即动作

1. 确认当前已签收页面作为阶段成果对外使用：
   - `/dashboard`
   - `/login`
   - `/alarms`
   - `/devices`
   - `/system-overview`
   - `/scene-control`
   - `/trend-analysis`
2. 将 optimize 明确标记为：
   - `治理态草案`
   - `可演示`
   - `未进入真实实现`

## 2. 给 legacy 负责人的动作建议

当前建议：

1. 将已形成的趋势排查材料保留为历史复盘依据
2. 如后续同类问题回退，再优先复核：
   - `EnergyStatisticsServiceImpl.executeTaskTenMin(...)`
   - `getRunParamsCurve`
   - `getRunParamsCurveByTagName`
3. 当前不再把该项作为页面签收阻塞

## 3. 给主仓库负责人的动作建议

当前不建议：

- 继续改趋势页前端
- 在 BFF 伪造多序列趋势
- 再开新的大页面迁移线

当前建议：

- 保持当前已签收页面稳定
- 保持治理层文档作为唯一边界
- Phase 2 能力继续冻结，待明确批准后再开

## 4. 当前一句话总结

主仓库当前已经把“能迁的核心页”基本迁完了，下一步最值的不是再铺新页，而是稳定维护当前已签收盘面。
