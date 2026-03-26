import request from "@/utils/request"

// 分页查询结果信息
export function findResultInfo(path, pageCurrent, pageSize, resultId) {
  return request({
    url: `zsqy/queryresultinfo/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent, 
      pageSize, 
      resultId
    }
  })
}

// 新增结果信息
export function addResultInfo(path, data) {
  return request({
    url: `zsqy/queryresultinfo/${path}/save`,
    method: 'post',
    data
  })
}

// 修改结果信息
export function updateResultInfo(path, data) {
  return request({
    url: `zsqy/queryresultinfo/${path}/update`,
    method: 'put',
    data
  })
}

// 删除结果信息
export function deleteResultInfo(path, id) {
  return request({
    url: `zsqy/queryresultinfo/${path}/delete`,
    method: 'delete',
    params: {
      id
    }
  })
}