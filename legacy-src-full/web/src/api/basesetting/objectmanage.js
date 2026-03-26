import request from '@/utils/request'

// 判断是否重名
export function checkName(appName) {
  return request({
    url: 'zsqy/manager/Check',
    method: 'get',
    params: {
      appName
    }
  })
}
// 查询所有项目类型
export function findProType() {
  return request({
    url: 'zsqy/apptype/findAll',
    method: 'get'
  })
}
// 查询所有正常项目
export function findObject(pageCurrent, pageSize, state, region, city) {
  return request({
    url: 'zsqy/manager/findObject',
    method: 'get',
    params: {
      pageCurrent,
      pageSize,
      state,
      region,
      city
    }
  })
}
// 新增项目
export function addObject(data) {
  return request({
    url: 'zsqy/manager/save',
    method: 'post',
    data
  })
}
// 修改项目
export function updateObject(data) {
  return request({
    url: 'zsqy/manager/update',
    method: 'put',
    data
  })
}
// 恢复项目
export function recoverObject(appid, state) {
  return request({
    url: 'zsqy/manager/update',
    method: 'put',
    params: {
      appid,
      state
    }
  })
}
// 移除项目
export function removeObject(ids, state) {
  return request({
    url: 'zsqy/manager/remove',
    method: 'put',
    params: {
      appids: ids,
      state
    }
  })
}
// 删除项目
export function deleteObject(appid, dBname) {
  return request({
    url: 'zsqy/manager/deleteObject',
    method: 'delete',
    params: {
      appid,
      dBname
    }
  })
}
// 查询项目个数
export function findCount() {
  return request({
    url: 'zsqy/manager/findCount',
    method: 'get'
  })
}
// 创建项目数据库
export function createDB(appid, dBname) {
  return request({
    url: 'zsqy/manager/init',
    method: 'get',
    params: {
      appid,
      dBname
    }
  })
}