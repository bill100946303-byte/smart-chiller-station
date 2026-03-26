import request from '@/utils/request'

// 查询设备维护信息
export function findDeviceDefend(path, pageCurrent, pageSize, drid, iscustomType) {
  return request({
    url: `zsqy/operationtime/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize,
      drid,
      iscustomType
    }
  })
}
// 新增
export function addDeviceDefend(path, data) {
  return request({
    url: `zsqy/operationtime/${path}/save`,
    method: 'post',
    data
  })
}
// 修改
export function updateDeviceDefend(path, data) {
  return request({
    url: `zsqy/operationtime/${path}/update`,
    method: 'put',
    data
  })
}
// 删除
export function deleteDeviceDefend(path, ids) {
  return request({
    url: `zsqy/operationtime/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
