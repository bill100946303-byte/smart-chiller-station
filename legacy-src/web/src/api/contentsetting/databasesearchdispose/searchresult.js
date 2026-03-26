import request from "@/utils/request"

// 查询所有结果名称
export function findResultName(path) {
  return request({
    url: `zsqy/queryresult/${path}/findObject`,
    method: 'get'
  })
}

// 新增结果名称
export function addResultName(path, data) {
  return request({
    url: `zsqy/queryresult/${path}/save`,
    method: 'post',
    data
  })
}

// 修改结果名称
export function updateResultName(path, data) {
  return request({
    url: `zsqy/queryresult/${path}/update`,
    method: 'put',
    data
  })
}

// 删除结果名称
export function deleteResultName(path, id) {
  return request({
    url: `zsqy/queryresult/${path}/delete`,
    method: 'delete',
    params: {
      id
    }
  })
}
