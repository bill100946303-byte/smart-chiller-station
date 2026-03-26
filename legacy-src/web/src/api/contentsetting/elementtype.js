import request from "@/utils/request"

// 根据类型查询所有图片
export function findAllImg(path, imgtype) {
  return request({
    url: `zsqy/images/${path}/findAll`,
    method: 'get',
    params: {
      imgtype
    }
  })
}

// 查询所有元素分类
export function findAllEleSort(path) {
  return request({
    url: `zsqy/elemtmodle/${path}/findAll`,
    method: 'get'
  })
}

// 根据id查询元素类型
export function findEleTypeById(path, elemttypeid) {
  return request({
    url: `zsqy/elemttype/${path}/findObjectById`,
    method: 'get',
    params: {
      elemttypeid
    }
  })
}

// 查询所有元素类型
export function findEleType(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/elemttype/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent, pageSize
    }
  })
}
// 新增元素类型
export function addEleType(path, data) {
  return request({
    url: `zsqy/elemttype/${path}/save`,
    method: 'post',
    data
  })
}
// 修改元素类型
export function updateEleType(path, data) {
  return request({
    url: `zsqy/elemttype/${path}/update`,
    method: 'put',
    data
  })
}
// 删除元素类型
export function deleteEleType(path, ids) {
  return request({
    url: `zsqy/elemttype/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
