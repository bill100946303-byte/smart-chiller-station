import request from '@/utils/request'

// 查询所有楼栋
export function findBuildings(path) {
  return request({
    url: `zsqy/buildinfo/${path}/findAll`,
    method: 'get'
  })
}
// 获取设备类型
export function findDeviceType(path) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findAllByIscustom`,
    method: 'get',
    params: {
      iscustomType: 1
    }
  })
}
// 查询所有仓库信息
export function findStore(path) {
  return request({
    url: `zsqy/storeroom/${path}/findAll`,
    method: 'get'
  })
}
// 查询所有说明书信息
export function findDoc(path, instructionsTypeid) {
  return request({
    url: `zsqy/instructions/${path}/findAll`,
    method: 'get',
    params: {
      instructionsTypeid
    }
  })
}
// 查询设备资产
export function findDeviceProperty(path, pageCurrent, pageSize, mdcode) {
  return request({
    url: `zsqy/drinfo/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize,
      mdcode
    }
  })
}
// 新增设备资产
export function addDeviceProperty(path, data) {
  return request({
    url: `zsqy/drinfo/${path}/save`,
    method: 'post',
    data
  })
}
// 修改设备资产
export function updateDeviceProperty(path, data) {
  return request({
    url: `zsqy/drinfo/${path}/update`,
    method: 'put',
    data
  })
}
// 删除设备资产
export function deleteDeviceProperty(path, ids) {
  return request({
    url: `zsqy/drinfo/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
