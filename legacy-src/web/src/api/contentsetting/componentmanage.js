import request from "@/utils/request"

// 查询所有组件类型
export function findComp(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/sub/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent, pageSize
    }
  })
}
// 新增组件类型
export function addComp(path, data) {
  return request({
    url: `zsqy/sub/${path}/save`,
    method: 'post',
    data
  })
}
// 修改组件类型
export function updateComp(path, data) {
  return request({
    url: `zsqy/sub/${path}/update`,
    method: 'put',
    data
  })
}
// 删除组件类型
export function deleteComp(path, ids) {
  return request({
    url: `zsqy/sub/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
