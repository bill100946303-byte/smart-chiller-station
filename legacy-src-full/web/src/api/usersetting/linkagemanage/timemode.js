import request from '@/utils/request'

// 查询所有联动条件
export function findAllLinkageCondition(path) {
  return request({
      url: `zsqy/timemode/${path}/findAllTg`,
      method: 'get'
  })
}

// 查询所有时间模式
export function findAllTimeModel(path) {
  return request({
    url: `zsqy/timemode/${path}/findAllMode`,
    method: 'get'
  })
}

// 分页查询时间模式
export function findTimeModel(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/timemode/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize
    }
  })
}

// 新增时间模式
export function addTimeModel(path, data) {
  return request({
    url: `zsqy/timemode/${path}/save`,
    method: 'post',
    data
  })
}

// 修改时间模式
export function updateTimeModel(path, data) {
  return request({
    url: `zsqy/timemode/${path}/update`,
    method: 'put',
    data
  })
}

// 删除时间模式
export function deleteTimeModel(path, ids) {
  return request({
    url: `zsqy/timemode/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}

// 分页查询模式条件关系
export function findModelCondition(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/timemode/${path}/findObjectinfo`,
    method: 'get',
    params: {
      pageCurrent, 
      pageSize
    }
  })
}

// 新增模式条件关系
export function addModelCondition(path, data) {
  return request({
    url: `zsqy/timemode/${path}/saveinfo`,
    method: 'post',
    data
  })
}

// 修改模式条件关系
export function updateModelCondition(path, data) {
  return request({
    url: `zsqy/timemode/${path}/updateinfo`,
    method: 'put',
    data
  })
}

// 删除模式条件关系
export function deleteModelCondition(path, ids) {
  return request({
    url: `zsqy/timemode/${path}/deleteinfo`,
    method: 'delete',
    params: {
      ids
    }
  })
}
