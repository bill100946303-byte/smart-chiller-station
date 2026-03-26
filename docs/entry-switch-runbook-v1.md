# 3001 入口切换手册（v1）

脚本路径：`/Users/billchow/Documents/智慧冷冻站/scripts/manage_3001_entry.sh`

## 目标
- 在 `3001` 端口下，快速切换入口到：
  - `shell`：`apps/chiller-shell-v1/dist`
  - `legacy`：`126lnoffice/web/vue_dist`
- 提供可回滚备份与 `nginx` 自动校验/重载。

## 命令
```bash
# 查看当前入口状态
/Users/billchow/Documents/智慧冷冻站/scripts/manage_3001_entry.sh status

# 切到新壳
/Users/billchow/Documents/智慧冷冻站/scripts/manage_3001_entry.sh switch shell

# 回滚到旧前端
/Users/billchow/Documents/智慧冷冻站/scripts/manage_3001_entry.sh switch legacy
```

## 默认路径
- `CONFIG_PATH=/Users/billchow/Documents/chiller-station-legacy/config/nginx.local.conf`
- `SHELL_ROOT=/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/dist`
- `LEGACY_ROOT=/Users/billchow/Documents/126lnoffice/web/vue_dist`

## 产物与安全性
- 每次切换会自动生成备份：`nginx.local.conf.bak.<timestamp>`
- 切换后自动执行：
  - `nginx -t -c ...`
  - `nginx -s reload -c ...`

## 验收
1. `status` 输出 `ENTRY_MODE=shell` 或 `ENTRY_MODE=legacy`。
2. `curl -I http://127.0.0.1:3001/` 返回 `200`。
3. `shell` 模式应出现新壳页面结构；`legacy` 模式应出现旧登录大图。

