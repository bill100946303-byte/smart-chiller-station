import request from '@/utils/request'

// 查询所有项目类型
export function findProType(pageCurrent, pageSize) {
  return request({
    url: 'zsqy/apptype/findObject',
    method: 'get',
    params: {
      pageCurrent,
      pageSize
    }
  })
}
// 新增项目类型
export function addProType(data) {
  return request({
    url: 'zsqy/apptype/save',
    method: 'post',
    data
  })
}
// 修改项目类型
export function updateProType(data) {
  return request({
    url: 'zsqy/apptype/update',
    method: 'put',
    data
  })
}
// 删除项目类型
export function deleteProType(ids) {
  return request({
    url: 'zsqy/apptype/delete',
    method: 'delete',
    params: {
      ids
    }
  })
}
