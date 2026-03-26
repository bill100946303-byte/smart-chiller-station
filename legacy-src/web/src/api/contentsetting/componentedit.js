import request from "@/utils/request"

// 查询所有图片
export function findAllImg(path) {
  return request({
    url: `zsqy/images/${path}/findAll`,
    method: 'get'
  })
}
// 查询所有组件类型
export function findAllComp(path) {
  return request({
    url: `zsqy/sub/${path}/findAll`,
    method: 'get'
  })
}
// 条件查询组件
export function findCom(path, pageCurrent, pageSize, subid) {
  return request({
    url: `zsqy/subinfo/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent, pageSize, subid
    }
  })
}
// 新增组件
export function addCom(path, data) {
  return request({
    url: `zsqy/subinfo/${path}/save`,
    method: 'post',
    data
  })
}
// 修改组件
export function updateCom(path, data) {
  return request({
    url: `zsqy/subinfo/${path}/update`,
    method: 'put',
    data
  })
}
// 删除组件
export function deleteCom(path, ids) {
  return request({
    url: `zsqy/subinfo/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
