import request from "@/utils/request"

// 分页查询条件信息
export function findSearchConditionInfo(path, pageCurrent, pageSize, conditionId) {
  return request({
    url: `zsqy/queryconditioninfo/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent, 
      pageSize, 
      conditionId
    }
  })
}

// 新增条件信息
export function addSearchConditionInfo(path, data) {
  return request({
    url: `zsqy/queryconditioninfo/${path}/save`,
    method: 'post',
    data
  })
}

// 修改条件信息
export function updateSearchConditionInfo(path, data) {
  return request({
    url: `zsqy/queryconditioninfo/${path}/update`,
    method: 'put',
    data
  })
}

export function deleteSearchConditionInfo(path, id) {
  return request({
    url: `zsqy/queryconditioninfo/${path}/delete`,
    method: 'delete',
    params: {
      id
    }
  })
}