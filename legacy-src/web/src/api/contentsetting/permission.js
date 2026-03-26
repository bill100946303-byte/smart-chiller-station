import request from "@/utils/request"

// 查询所有菜单
export function findAllMenu() {
  return request({
    url: `zsqy/menu/findAllMenu`,
    method: 'get'
  })
}
// 查询所有用户权限
export function findPermission(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/usergroup/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize
    }
  })
}
// 新增用户权限
export function addPermission(path, data) {
  return request({
    url: `zsqy/usergroup/${path}/save`,
    method: 'post',
    data
  })
}
// 修改用户权限
export function updatePermission(path, data) {
  return request({
    url: `zsqy/usergroup/${path}/update`,
    method: 'put',
    data
  })
}
// 删除用户权限
export function deletePermission(path, ids) {
  return request({
    url: `zsqy/usergroup/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
