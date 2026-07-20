import fs from "node:fs";
import path from "node:path";

const adminRoot = path.resolve(process.cwd());
const shellSource = fs.readFileSync(path.join(adminRoot, "src/layout/AdminShell.tsx"), "utf8");
const styleSource = fs.readFileSync(path.join(adminRoot, "src/styles/global.css"), "utf8");
const loginSource = fs.readFileSync(path.join(adminRoot, "src/pages/LoginPage.tsx"), "utf8");
const membersSource = fs.readFileSync(path.join(adminRoot, "src/pages/MembersPage.tsx"), "utf8");
const sectionCardSource = fs.readFileSync(path.join(adminRoot, "src/components/common/SectionCard.tsx"), "utf8");
const sourceConfigSource = fs.readFileSync(path.join(adminRoot, "src/pages/SourceConfigPage.tsx"), "utf8");
const runtimeConfigSource = fs.readFileSync(path.join(adminRoot, "src/pages/RuntimeConfigPage.tsx"), "utf8");
const subsystemConfigSource = fs.readFileSync(path.join(adminRoot, "src/pages/SubsystemConfigPage.tsx"), "utf8");
const adminClientSource = fs.readFileSync(path.join(adminRoot, "src/services/adminClient.ts"), "utf8");
const siteListSource = fs.readFileSync(path.join(adminRoot, "src/pages/SiteListPage.tsx"), "utf8");

function requireText(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message);
  }
}

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

requireText(shellSource, 'aria-label="后台主导航"', "admin shell needs a named primary navigation landmark");
requireText(shellSource, 'className="admin-skip-link"', "admin shell needs a keyboard skip link");
requireText(shellSource, 'href="#admin-main-content"', "admin skip link target is missing");
requireText(shellSource, 'id="admin-main-content"', "admin main-content target is missing");
requireText(shellSource, '<div className="admin-brand-title">多项目后台</div>', "admin brand must not consume the page H1");
requireText(shellSource, "<h1>{resolveTitle(location.pathname)}</h1>", "admin current page title must be the shell H1");
requireText(adminClientSource, "formatAdminApiErrorMessage", "admin API errors need one shared presentation layer");
requireText(adminClientSource, "登录凭证已失效，请重新登录。", "expired admin tokens need localized user-facing copy");
requireText(adminClientSource, "originalMessage", "localized admin errors must retain their original technical message");
requireText(adminClientSource, 'ADMIN_AUTH_EXPIRED_EVENT = "chiller-admin-auth-expired"', "expired-token event contract is missing");
requireText(adminClientSource, "window.dispatchEvent(new CustomEvent(ADMIN_AUTH_EXPIRED_EVENT))", "401 responses must invalidate the mounted admin shell");
requireText(shellSource, "window.addEventListener(ADMIN_AUTH_EXPIRED_EVENT", "admin shell does not listen for expired credentials");
requireText(shellSource, "clearAdminSession();", "admin shell must clear an expired local session");
requireText(shellSource, 'navigate(`/login?reason=expired&redirect=', "admin shell must fail closed to login and retain a safe return path");
requireText(loginSource, 'searchParams.get("reason") === "expired"', "admin login does not explain an expired-session redirect");
requireText(shellSource, 'title={item.label}', "mobile navigation must expose full recent-site labels");
requireText(shellSource, "<span>退出登录</span>", "mobile shell must keep a reachable sign-out label");
requireText(loginSource, 'const [password, setPassword] = useState("")', "admin login must not ship a prefilled password");
requireText(loginSource, "当前连接管理接口但写入总闸保持关闭", "read-only login notice must describe the real API boundary");
requireText(loginSource, "当前使用显式本地 MOCK", "mock login notice must remain visibly separated from real configuration");
requireText(siteListSource, 'aria-labelledby="create-site-dialog-title"', "create-site dialog needs an accessible name");
requireText(siteListSource, 'aria-label="关闭新建站点对话框"', "create-site dialog close action needs an accessible name");
requireText(siteListSource, 'event.key === "Escape"', "create-site dialog must support Escape");
requireText(siteListSource, 'event.key !== "Tab"', "create-site dialog must trap keyboard focus");
for (const label of ["的用户名", "的用户 ID", "的角色", "的权限范围类型", "的范围 ID", "的状态"]) {
  requireText(membersSource, `aria-label={\`成员 \${member.username} ${label}\`}`, `member table control needs accessible name: ${label}`);
}
requireText(sectionCardSource, "headingLevel?: 2 | 3 | 4", "section cards need explicit semantic heading levels");
for (const label of ["平台管理员", "站点管理员", "审计员", "站点范围", "平台范围", "已启用", "已邀请", "已停用"]) {
  requireText(membersSource, `\"${label}\"`, `member administration needs localized visible label: ${label}`);
}
for (const label of ["只读 / 影子", "点位角色", "预留子系统", "不写 PLC", "建议器"]) {
  requireText(subsystemConfigSource, label, `subsystem configuration needs localized boundary label: ${label}`);
}
for (const [label, source] of [
  ["source config", sourceConfigSource],
  ["runtime config", runtimeConfigSource],
  ["subsystem config", subsystemConfigSource],
  ["members", membersSource]
]) {
  requireText(source, "headingLevel={2}", `${label} page needs an h2 section after the shell h1`);
}

requirePattern(
  styleSource,
  /@media \(max-width: 860px\)[\s\S]+?grid-template-areas:[\s\S]+?"brand footer"[\s\S]+?"nav nav"/,
  "mobile admin shell must use a compact two-row header layout"
);
requirePattern(
  styleSource,
  /@media \(max-width: 860px\)[\s\S]+?\.admin-login-card \{[\s\S]+?order: -1;/,
  "mobile admin login must place the authentication task before the product overview"
);
requirePattern(
  styleSource,
  /@media \(max-width: 860px\)[\s\S]+?\.admin-login-visual \{[\s\S]+?min-height: 0;[\s\S]+?order: 0;/,
  "mobile admin login overview must not reserve the desktop hero height"
);
requirePattern(
  styleSource,
  /\.admin-nav \{[\s\S]+?overflow-x: auto;[\s\S]+?overscroll-behavior-x: contain;/,
  "mobile admin navigation must scroll locally without widening the page"
);
requirePattern(
  styleSource,
  /\.admin-nav-links a \{[\s\S]+?min-height: 44px;/,
  "mobile navigation targets must be at least 44px tall"
);
requirePattern(
  styleSource,
  /\.admin-signout \{[\s\S]+?min-height: 44px;/,
  "mobile sign-out target must be at least 44px tall"
);
requirePattern(
  styleSource,
  /\.admin-main \{[\s\S]+?max-width: 100%;/,
  "mobile main content must stay within the viewport"
);
requirePattern(
  styleSource,
  /\.admin-topbar \{[\s\S]+?position: relative;/,
  "mobile page title bar must not overlap the sticky navigation"
);
requirePattern(
  styleSource,
  /\.admin-table input:focus-visible,[\s\S]+?\.admin-table select:focus-visible \{[\s\S]+?outline: 2px solid/,
  "admin table controls need a visible keyboard focus ring"
);
requirePattern(
  styleSource,
  /\.admin-skip-link:focus-visible \{[\s\S]+?transform: translateY\(0\);/,
  "admin skip link needs a visible keyboard state"
);

console.log("admin shell responsive contract: OK");
console.log("- authentication-first mobile login + compact brand navigation: OK");
console.log("- 44px navigation and sign-out targets: OK");
console.log("- viewport-contained main content and non-overlapping title: OK");
console.log("- member control names, focus visibility and page heading hierarchy: OK");
console.log("- localized member roles, scopes, states and subsystem boundaries: OK");
console.log("- keyboard skip-to-content path: OK");
console.log("- localized API error presentation with retained technical message: OK");
