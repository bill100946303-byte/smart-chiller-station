import request from '@/utils/request'

// 查询联动配置
export function findLinkageDispose(path, pageCurrent,  pageSize, tjId, jgId) {
  return request({
    url: `zsqy/link/rw/${path}/findLinkRw`,
    method: 'get',
    params: {
      pageCurrent, 
      pageSize, 
      tjId, 
      jgId
    }
  })
}

// 新增联动配置
export function addLinkageDispose(path, data) {
  return request({
    url: `zsqy/link/rw/${path}/insertLinkRw`,
    method: 'post',
    data
  })
}

// 修改联动配置
export function updateLinkageDispose(path, data) {
  return request({
    url: `zsqy/link/rw/${path}/updateLinkRw`,
    method: 'put',
    data
  })
}

// 删除联动配置
export function deleteLinkageDispose(path, ids) {
  return request({
    url: `zsqy/link/rw/${path}/deleteLinkRw`,
    method: 'delete',
    params: {
      ids
    }
  })
}

// 模式配置导入
export function inputLinkageDispose(path, data) {
  return request({
    url: `zsqy/link/rw/${path}/importRw`,
    method: 'post',
    data
  })
}
// 模式变配置导出
export function outputLinkageDispose(path, tjId, jgId) {
  return request({
    url: `zsqy/link/rw/${path}/exportRw`,
    method: 'get',
    responseType: 'blob',
    params: {
      tjId, 
      jgId
    }
  })
}