# Release Snapshot Contract v1

## 1. 目标与边界
- 目标：为主控输出的 release snapshot JSON 提供独立结构校验门禁。
- 边界：
  - 不修改 OpenAPI 主 schema。
  - 不影响 `npm run check:contract` 现有门禁。
  - 仅校验快照结构与字段类型，不改业务判定逻辑。

## 2. 校验命令
```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:release-snapshot
```

可选：覆盖默认文件路径
```bash
RELEASE_SNAPSHOT_PATH=/abs/path/to/release-snapshot.json npm run check:release-snapshot
```

默认校验文件：
- `/Users/billchow/Documents/智慧冷冻站/docs/release-snapshot-latest.json`
- 兼容：若该文件不存在，脚本会回退校验 legacy `v1.8-release-preflight.json`

## 3. 最小字段集（必填）
release snapshot v1：
- `/decision` (string, `GO | NO-GO`)
- `/exitCode` (integer, `0 | 1`)
- `/reasons` (array of string)
- `/advisories` (array of string)
- `/checks/verifyGatesOk` (boolean)
- `/checks/preflightPass` (boolean)
- `/artifacts/latestJson` (string, optional)
- `/artifacts/latestMd` (string, optional)
- `/artifacts/archiveJson` (string, optional)
- `/artifacts/archiveMd` (string, optional)

legacy preflight（兼容）：
- `/preflightPass` (boolean)
- `/gates/contractOk` (boolean)
- `/gates/statusJsonOk` (boolean)
- `/gates/shellOk` (boolean)
- `/gates/releaseGateOk` (boolean)
- `/releaseGate/decision` (string, `GO | NO-GO`)
- `/releaseGate/reasons` (array of string)
- `/releaseGate/advisories` (array of string)

## 4. 报错格式
统一为：
```text
<json_path>: <error_message>
```

示例：
```text
/gates/statusJsonOk: must be boolean
```

## 5. 负例自检（v1）
自检模式：
```bash
RELEASE_SNAPSHOT_SELFTEST=1 npm run check:release-snapshot
```

当前覆盖 3 条负例：
1. `decision` 非 string（release snapshot v1）
2. `checks.verifyGatesOk` 非 boolean（release snapshot v1）
3. `reasons` 非 array（release snapshot v1）
