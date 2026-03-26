import request from '@/utils/request'

// 查询所有联动任务
export function findLinkage(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/QsLdRw/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize
    }
  })
}
// 联动任务导入
export function inputExcel(path, data) {
  return request({
    url: `zsqy/QsLdRw/${path}/import`,
    method: 'post',
    data
  })
}
// 联动任务导出
export function outputExcel(path) {
  return request({
    url: `zsqy/QsLdRw/${path}/export`,
    method: 'get',
    responseType: 'blob'
  })
}
// 启动联动任务
export function startLinkage(path, ldRwId, appid) {
  return request({
    url: `zsqy/QsLdRw/${path}/startJobByLdRwId`,
    method: 'get',
    params: {
      ldRwId, 
      appid 
    }
  })
}
// 批量启动联动任务
export function startLinkages(path, ids, appid) {
  return request({
    url: `zsqy/QsLdRw/${path}/startRegJobsByIds`,
    method: 'get',
    params: {
      ids, 
      appid 
    }
  })
}
// 暂停联动任务
export function stopLinkage(path, ldRwId, appid) {
  return request({
    url: `zsqy/QsLdRw/${path}/deleteJobByLdRwId`,
    method: 'get',
    params: {
      ldRwId, 
      appid 
    }
  })
}
// 批量暂停联动任务
export function stopLinkages(path, ids, appid) {
  return request({
    url: `zsqy/QsLdRw/${path}/deleteRegJobsByIds`,
    method: 'get',
    params: {
      ids, 
      appid 
    }
  })
}
// 新增联动任务
export function addLinkage(path, data) {
  return request({
    url: `zsqy/QsLdRw/${path}/save`,
    method: 'post',
    data
  })
}
// 修改联动任务
export function updateLinkage(path, data) {
  return request({
    url: `zsqy/QsLdRw/${path}/update`,
    method: 'put',
    data
  })
}
// 删除联动任务
export function deleteLinkage(path, ids) {
  return request({
    url: `zsqy/QsLdRw/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
