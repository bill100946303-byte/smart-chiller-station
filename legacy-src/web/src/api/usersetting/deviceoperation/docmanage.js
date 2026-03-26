import request from '@/utils/request'

// 查询库房
export function findDoc(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/instructions/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize
    }
  })
}
// 获取设备类型
export function findDeviceType(path) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findObject`,
    method: 'get'
  })
}
// 新增文档
export function addDoc(path, data) {
  return request({
    url: `zsqy/instructions/${path}/save`,
    method: 'post',
    data
  })
}
// 修改库房
export function updateDoc(path, data) {
  return request({
    url: `zsqy/instructions/${path}/update`,
    method: 'put',
    data
  })
}
// 新增库房
export function deleteDoc(path, id) {
  return request({
    url: `zsqy/instructions/${path}/delete`,
    method: 'delete',
    params: {
      id
    }
  })
}
