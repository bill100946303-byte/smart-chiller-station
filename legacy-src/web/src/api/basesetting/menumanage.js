import request from '@/utils/request'

// 查询所有项目类型
export function findProType() {
  return request({
    url: 'zsqy/apptype/findAll',
    method: 'get'
  })
}
// 查询所有
export function findMenu(apptypeid) {
  return request({
    url: 'zsqy/menu/findmenu',
    method: 'get',
    params: {
      apptypeid
    }
  })
}
// 查询子类
export function findChild(id) {
  return request({
    url: 'zsqy/menu/findmenu',
    method: 'get',
    params: {
      parentId: id
    }
  })
}
// 新增菜单
export function addMenu(data) {
  return request({
    url: 'zsqy/menu/savemenu',
    method: 'post',
    data
  })
}
// 修改菜单
export function updateMenu(data) {
  return request({
    url: 'zsqy/menu/update',
    method: 'put',
    data
  })
}
// 删除菜单
export function deleteMenu(id) {
  return request({
    url: 'zsqy/menu/delete',
    method: 'delete',
    params: {
      id
    }
  })
}


