import request from "@/utils/request"

// 查询所有菜单
export function findAllMenu(apptypeid) {
  return request({
    url: `zsqy/menu/findAllMenu`,
    method: 'get',
    params: {
      apptypeid
    }
  })
}
// 查询菜单
export function findObjMenu(path) {
  return request({
    url: `zsqy/sysmenuinfo/${path}/findAllMenu`,
    method: 'get'
  })
}
// 查询所有菜单目录
export function findMenu(apptypeid) {
  return request({
    url: `zsqy/menu/findAll`,
    method: 'get',
    params: {
      apptypeid
    }
  })
}
// 查询所有平面图
export function findPages(path) {
  return request({
    url: `zsqy/pic/${path}/findObjectInPicmodeid`,
    method: 'get'
  })
}
// 保存选择菜单
export function saveMenu(path, data) {
  return request({
    url: `zsqy/sysmenuinfo/${path}/save`,
    method: 'post',
    data
  })
}
// 修改菜单
export function updateMenu(path, data) {
  return request({
    url: `zsqy/sysmenuinfo/${path}/update`,
    method: 'put',
    data
  })
}