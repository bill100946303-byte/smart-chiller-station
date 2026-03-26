# Release Snapshot Index Contract v1

## 1. 目标与边界
- 目标：为 `release-snapshot-index` 输出提供独立结构校验门禁。
- 边界：
  - 不改 OpenAPI 主 schema。
  - 不影响 `npm run check:contract` 现有门禁。
  - 仅校验 `summary` 与 `entries` 结构及基础类型。

## 2. 校验命令
```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:release-snapshot-index
```

可选：覆盖默认输入文件
```bash
RELEASE_SNAPSHOT_INDEX_PATH=/abs/path/to/release-snapshot-index.json npm run check:release-snapshot-index
```

默认路径：
- `/Users/billchow/Documents/智慧冷冻站/docs/release-snapshot-index-latest.json`

## 3. 最小契约
- `/summary`：object
  - `/summary/total` integer >= 0
  - `/summary/shown` integer >= 0
  - `/summary/go` integer >= 0
  - `/summary/noGo` integer >= 0
  - `/summary/unknown` integer >= 0
- `/entries`：array
  - item 为 object，最小字段：
    - `/entries[i]/file` non-empty string
    - `/entries[i]/fileName` non-empty string
    - `/entries[i]/decision` (`GO | NO-GO | UNKNOWN`)
    - `/entries[i]/exitCode` (integer | null)
    - `/entries[i]/reasons` (array of string)
    - `/entries[i]/advisories` (array of string)
    - `/entries[i]/mtime` (string | null)
    - `/entries[i]/generatedAt` (string | null)
    - `/entries[i]/strictFreshness` (boolean | null)
    - `/entries[i]/runtimeRequired` (boolean | null)

补充一致性校验：
- `/summary/shown` 必须等于 `entries.length`

## 4. 报错格式
统一为：
```text
<json_path>: <error_message>
```

示例：
```text
/entries[0]/decision: must be one of "GO" | "NO-GO" | "UNKNOWN"
```

## 5. 负例自检
```bash
RELEASE_SNAPSHOT_INDEX_SELFTEST=1 npm run check:release-snapshot-index
```

当前覆盖 3 条负例：
1. 缺少 `summary.total`
2. `entries[0].decision` 非法枚举值
3. `entries[0].reasons` 非数组
