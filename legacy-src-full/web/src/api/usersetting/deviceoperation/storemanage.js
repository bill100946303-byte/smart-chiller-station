import request from '@/utils/request'

// 查询库房
export function findStore(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/storeroom/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize
    }
  })
}
// 新增库房
export function addStore(path, data) {
  return request({
    url: `zsqy/storeroom/${path}/save`,
    method: 'post',
    data
  })
}
// 修改库房
export function updateStore(path, data) {
  return request({
    url: `zsqy/storeroom/${path}/update`,
    method: 'put',
    data
  })
}
// 删除库房
export function deleteStore(path, ids) {
  return request({
    url: `zsqy/storeroom/${path}/delete`,
    method: 'get',
    params: {
      ids
    }
  })
}
