import request from '@/utils/request'

// 分页查询用户
export function findUser(pageCurrent, pageSize) {
  return request({
    url: 'zsqy/user/findUser',
    method: 'get',
    params: {
      pageCurrent, pageSize
    }
  })
}
// 验证用户重名
export function testUserName(username) {
  return request({
    url: 'zsqy/user/findUserByName',
    method: 'get',
    params: {
      username
    }
  })
}
// 查询所有用户
export function findAllUser() {
  return request({
    url: 'zsqy/user/findAll',
    method: 'get'
  })
}
// 条件查询项目
export function findProject(userid) {
  return request({
    url: 'zsqy/manager/findObjectByUser',
    method: 'get',
    params: {
      userid
    }
  })
}
// 条件查询用户权限
export function findUserRole(pageCurrent, pageSize, userid) {
  return request({
    url: 'zsqy/appusergroup/findObject',
    method: 'get',
    params: {
      pageCurrent, pageSize, userid
    }
  })
}
// 根据项目id查询项目权限
export function findProjectPermission(path) {
  return request({
    url: `zsqy/usergroup/${path}/findAll`,
    method: 'get'
  })
}
// 新增用户
export function addUser(data) {
  return request({
    url: 'zsqy/user/saveUser',
    method: 'post',
    data
  })
}
// 新增角色
export function addUserRole(data) {
  return request({
    url: 'zsqy/appusergroup/save',
    method: 'post',
    data
  })
}
// 修改用户
export function updateUser(data) {
  return request({
    url: 'zsqy/user/updateUser',
    method: 'put',
    data
  })
}
// 修改角色
export function updateUserRole(data) {
  return request({
    url: 'zsqy/appusergroup/update',
    method: 'put',
    data
  })
}
// 删除用户
export function deleteUser(id) {
  return request({
    url: 'zsqy/user/deleteUser',
    method: 'delete',
    params: {
      ids: id + ','
    }
  })
}
// 删除角色
export function deleteUserRole(id, appid, appName, userid) {
  return request({
    url: 'zsqy/appusergroup/delete',
    method: 'delete',
    params: {
      id,
      appid,
      appName,
      userid
    }
  })
}
