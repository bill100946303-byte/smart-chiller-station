import request from "@/utils/request"

// 查询所有元素类型
export function findEleType(path) {
  return request({
    url: `zsqy/elemttype/${path}/findAll`,
    method: 'get'
  })
}
// 同步模板
export function modelCopy(path) {
  return request({
    url: `zsqy/elemttypemode/${path}/synchroElemt`,
    method: "get"
  })
}
// 查询所有元素模板
export function findEleTempl(path, pageCurrent, pageSize, elemttypeid) {
  return request({
    url: `zsqy/elemttypemode/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize,
      elemttypeid
    }
  })
}
// 新增元素模板
export function addEleTempl(path, data) {
  return request({
    url: `zsqy/elemttypemode/${path}/save`,
    method: 'post',
    data
  })
}
// 修改元素模板
export function modifyEleTempl(path, data) {
  return request({
    url: `zsqy/elemttypemode/${path}/update`,
    method: 'put',
    data
  })
}
// 删除元素模板
export function deleteEleTempl(path, ids) {
  return request({
    url: `zsqy/elemttypemode/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
