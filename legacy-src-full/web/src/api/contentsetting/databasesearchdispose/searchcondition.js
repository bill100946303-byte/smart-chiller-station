import request from "@/utils/request"

// 查询所有条件名称
export function findSearchConditionName(path) {
  return request({
    url: `zsqy/querycondition/${path}/findObject`,
    method: 'get'
  })
}

// 新增条件名称
export function addSearchConditionName(path, data) {
  return request({
    url: `zsqy/querycondition/${path}/save`,
    method: 'post',
    data
  })
}

// 修改条件名称
export function updateSearchConditionName(path, data) {
  return request({
    url: `zsqy/querycondition/${path}/update`,
    method: 'put',
    data
  })
}

// 删除条件名称
export function deleteSearchConditionName(path, id) {
  return request({
    url: `zsqy/querycondition/${path}/delete`,
    method: 'delete',
    params: {
      id
    }
  })
}
