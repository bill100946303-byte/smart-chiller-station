import request from '@/utils/request'

// 查询联动条件
export function findLinkageCondition(path) {
  return request({
    url: `zsqy/link/tj/${path}/findLinkTj`,
    method: 'get'
  })
}

// 新增联动条件
export function addLinkageCondition(path, data) {
  return request({
    url: `zsqy/link/tj/${path}/insertLinkTj`,
    method: 'post',
    data
  })
}

// 修改联动条件
export function updateLinkageCondition(path, data) {
  return request({
    url: `zsqy/link/tj/${path}/updateLinkTj`,
    method: 'put',
    data
  })
}

// 删除联动条件
export function deleteLinkageCondition(path, id) {
  return request({
    url: `zsqy/link/tj/${path}/deleteLinkTj`,
    method: 'delete',
    params: {
      id
    }
  })
}

// 查询条件联动变量
export function findLinkageConditionReg(path, pageCurrent, pageSize, tjId) {
  return request({
    url: `zsqy/link/tj/${path}/findLinkTjinfo`,
    method: 'get',
    params: {
      pageCurrent, 
      pageSize, 
      tjId
    }
  })
}

// 联动条件变量导入
export function inputLinkageConditionReg(path, data) {
  return request({
    url: `zsqy/link/tj/${path}/importTjinfo`,
    method: 'post',
    data
  })
}
// 联动条件变量导出
export function outputLinkageConditionReg(path, tjId) {
  return request({
    url: `zsqy/link/tj/${path}/exportTjinfo`,
    method: 'get',
    responseType: 'blob',
    params: {
      tjId
    }
  })
}

// 新增条件联动变量
export function addLinkageConditionReg(path, data) {
  return request({
    url: `zsqy/link/tj/${path}/insertLinkTjinfo`,
    method: 'post',
    data
  })
}

// 修改条件联动变量
export function updateLinkageConditionReg(path, data) {
  return request({
    url: `zsqy/link/tj/${path}/updateLinkTjinfo`,
    method: 'put',
    data
  })
}

// 删除条件联动变量
export function deleteLinkageConditionReg(path, ids) {
  return request({
    url: `zsqy/link/tj/${path}/deleteLinkTjinfo`,
    method: 'delete',
    params: {
      ids
    }
  })
}
