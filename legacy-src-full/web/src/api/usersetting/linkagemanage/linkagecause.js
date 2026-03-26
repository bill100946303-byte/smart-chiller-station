import request from '@/utils/request'

// 查询所有联动任务
export function findAllLinkageTask(path) {
  return request({
    url: `zsqy/QsLdRw/${path}/findAll`,
    method: 'get'
  })
}
// 分页查询联动条件
export function findLinkageCondition(path, pageCurrent, pageSize, tjType) {
  return request({
    url: `zsqy/qsLdTgr/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize,
      tjType
    }
  })
}

// 联动条件导入
export function inputExcel(path, data) {
  return request({
    url: `zsqy/qsLdTgr/${path}/import`,
    method: 'post',
    data
  })
}
// 联动条件导出
export function outputExcel(path, tjType) {
  return request({
    url: `zsqy/qsLdTgr/${path}/export`,
    method: 'get',
    responseType: 'blob',
    params: {
      tjType
    }
  })
}
// 新增联动条件
export function addLinkageCondition(path, data) {
  return request({
    url: `zsqy/qsLdTgr/${path}/save`,
    method: 'post',
    data
  })
}

// 修改联动条件
export function updateLinkageCondition(path, data) {
  return request({
    url: `zsqy/qsLdTgr/${path}/update`,
    method: 'put',
    data
  })
}
// 删除联动条件
export function deleteLinkageCondition(path, ids, tjType) {
  return request({
    url: `zsqy/qsLdTgr/${path}/delete`,
    method: 'delete',
    params: {
      ids,
      tjType
    }
  })
}
