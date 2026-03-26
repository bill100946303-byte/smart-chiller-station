# LOGIN_SIGNOFF_DECISION_CURRENT

## 1. 当前结论

- `/login`：已正式签收

## 2. 签收范围

当前签收的是：

- 新壳真实登录入口页
- 受保护路由守卫
- legacy `/user/login` 认证承接
- 登录成功后的重定向恢复
- 本地 session 持久化与退出清理

当前不纳入签收范围的是：

- 多角色权限体系
- token 刷新
- SSO / 企业身份集成

## 3. 主控复核事实

- 未登录直接访问 `/dashboard` 会跳转到 `/login?redirect=%2Fdashboard`
- 使用 `admin / 123456` 可通过 legacy `/user/login` 成功登录
- 登录成功后会回到原始受保护路由
- 顶栏已显示当前用户
- 退出登录会清除 `chiller-shell-auth-v1` 并回到 `/login`

## 4. 当前口径

`/login` 当前已经不再是壳层占位页，而是正式认证入口页。
