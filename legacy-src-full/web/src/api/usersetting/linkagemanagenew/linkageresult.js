import request from '@/utils/request'

// 查询联动结果
export function findLinkageResult(path) {
  return request({
    url: `zsqy/link/jg/${path}/findLinkJg`,
    method: 'get'
  })
}

// 新增联动结果
export function addLinkageResult(path, data) {
  return request({
    url: `zsqy/link/jg/${path}/insertLinkJg`,
    method: 'post',
    data
  })
}

// 修改联动结果
export function updateLinkageResult(path, data) {
  return request({
    url: `zsqy/link/jg/${path}/updateLinkJg`,
    method: 'put',
    data
  })
}

// 删除联动结果
export function deleteLinkageResult(path, id) {
  return request({
    url: `zsqy/link/jg/${path}/deleteLinkJg`,
    method: 'delete',
    params: {
      id
    }
  })
}

// 查询联动结果变量
export function findLinkageResultReg(path, pageCurrent, pageSize, jgId) {
  return request({
    url: `zsqy/link/jg/${path}/findLinkJginfo`,
    method: 'get',
    params: {
      pageCurrent, 
      pageSize, 
      jgId
    }
  })
}

// 联动结果变量导入
export function inputLinkageResultReg(path, data) {
  return request({
    url: `zsqy/link/jg/${path}/importJginfo`,
    method: 'post',
    data
  })
}
// 联动结果变量导出
export function outputLinkageResultReg(path, jgId) {
  return request({
    url: `zsqy/link/jg/${path}/exportJginfo`,
    method: 'get',
    responseType: 'blob',
    params: {
      jgId
    }
  })
}

// 新增条件结果变量
export function addLinkageResultReg(path, data) {
  return request({
    url: `zsqy/link/jg/${path}/insertLinkJginfo`,
    method: 'post',
    data
  })
}

// 修改条件结果变量
export function updateLinkageResultReg(path, data) {
  return request({
    url: `zsqy/link/jg/${path}/updateLinkJginfo`,
    method: 'put',
    data
  })
}

// 删除条件结果变量
export function deleteLinkageResultReg(path, ids) {
  return request({
    url: `zsqy/link/jg/${path}/deleteLinkJginfo`,
    method: 'delete',
    params: {
      ids
    }
  })
}