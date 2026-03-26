import Cookies from 'js-cookie'

const zsqy_TEST = 'zsqy_TEST'
const projectId = 'projectId'
const projectName = 'projectName'
const path = 'path'
const projectTypeId = 'projectTypeId'
const permission = 'permission'
const menu = 'menu'
const city = 'city'
const IP = 'IP'
const logo = 'logo'
const control = 'control' //操作权限
const appexplain = 'appexplain'

// 操作项目名字 暂时不用
export function getAppexplain() {
  return Cookies.get(appexplain)
}

export function setAppexplain(appexplainName) {
  Cookies.set(appexplain,appexplainName)
}

export function removeAppexplain() {
  return Cookies.remove(appexplain)
}
// 操作cookie的token
export function getToken() {
  return Cookies.get(zsqy_TEST)
}

export function setToken(token) {
  return Cookies.set(zsqy_TEST, token)
}

export function removeToken() {
  return Cookies.remove(zsqy_TEST)
}
// 操作cookie的id
export function getProjectId() {
  return Cookies.get(projectId)
}

export function setProjectId(id) {
  return Cookies.set(projectId, id)
}

export function removeProjectId() {
  return Cookies.remove(projectId)
}
// 操作cookie的project
export function getProject() {
  return Cookies.get(projectName)
}

export function setProject(project) {
  return Cookies.set(projectName, project)
}

export function removeProject() {
  return Cookies.remove(projectName)
}
// 操作cookie的path
export function getPath() {
  return Cookies.get(path)
}

export function setPath(projectPath) {
  return Cookies.set(path, projectPath)
}

export function removePath() {
  return Cookies.remove(path)
}
// 操作cookie的projectTypeId
export function getProjectTypeId() {
  return Cookies.get(projectTypeId)
}

export function setProjectTypeId(id) {
  return Cookies.set(projectTypeId, id)
}

export function removeProjectTypeId() {
  return Cookies.remove(projectTypeId)
}
// 权限
export function getPermission() {
  return Cookies.get(permission)
}

export function setPermission(role) {
  return Cookies.set(permission, role)
}

export function removePermission() {
  return Cookies.remove(permission)
}
// 菜单id
export function getMenuids() {
  return Cookies.get(menu)
}

export function setMenuids(data) {
  return Cookies.set(menu, data)
}

export function removeMenuids() {
  return Cookies.remove(menu)
}
// 城市
export function getCity() {
  return Cookies.get(city)
}

export function setCity(data) {
  return Cookies.set(city, data)
}


export function removeCity() {
  return Cookies.remove(city)
}

export function getControl() {
  return Cookies.get(control)
}

export function setControl(data) {
  return Cookies.set(control, data)
}

export function removeControl() {
  return Cookies.remove(control)
}
// 项目ip
export function getIP() {
  return Cookies.get(IP)
}

export function setIP(data) {
  return Cookies.set(IP, data)
}

export function removeIP() {
  return Cookies.remove(IP)
}
// 项目logo
export function getLogo() {
  return Cookies.get(logo)
}

export function setLogo(data) {
  return Cookies.set(logo, data)
}

export function removeLogo() {
  return Cookies.remove(logo)
}

export function getWebsocket() {
  return Cookies.get('websocket')
}
export function setWebsocket(data) {
  return Cookies.set('websocket', data)
}
