import request from "@/utils/request"

// 查询所有元素分类
export function findEleSort(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/elemtmodle/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize
    }
  })
}

// 新增元素分类
export function addEleSort(path, data) {
  return request({
    url: `zsqy/elemtmodle/${path}/save`,
    method: 'post',
    data
  })
}

// 修改元素分类
export function updateEleSort(path, data) {
  return request({
    url: `zsqy/elemtmodle/${path}/update`,
    method: 'put',
    data
  })
}

// 删除元素分类
export function deleteEleSort(path, ids) {
  return request({
    url: `zsqy/elemtmodle/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
