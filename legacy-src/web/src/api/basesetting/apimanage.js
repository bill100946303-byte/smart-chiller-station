import request from '@/utils/request'

// 查询api
export function findApiInfo(pageCurrent, pageSize) {
  return request({
    url: 'zsqy/interfaceConfig/findObject',
    method: 'get',
    params: {
      pageCurrent, 
      pageSize
    }
  })
}

// 新增api
export function addApiInfo(data) {
  return request({
    url: 'zsqy/interfaceConfig/save',
    method: 'post',
    data
  })
}

// 修改api
export function updateApiInfo(data) {
  return request({
    url: 'zsqy/interfaceConfig/update',
    method: 'put',
    data
  })
}

// 删除api
export function deleteApiInfo(ids) {
  return request({
    url: 'zsqy/interfaceConfig/delete',
    method: 'delete',
    params: {
      ids
    }
  })
}


