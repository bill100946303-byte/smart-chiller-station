import request from "@/utils/request"

// 查询所有数据库配置信息
export function findDBInfo(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/Otherdb/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent, 
      pageSize
    }
  })
}

// 新增数据库配置信息
export function addDBInfo(path, data) {
  return request({
    url: `zsqy/Otherdb/${path}/save`,
    method: 'post',
    data
  })
}

// 修改数据库配置信息
export function updateDBInfo(path, data) {
  return request({
    url: `zsqy/Otherdb/${path}/update`,
    method: 'put',
    data
  })
}

// 删除数据库配置信息
export function deleteDBInfo(path, id) {
  return request({
    url: `zsqy/Otherdb/${path}/delete`,
    method: 'delete',
    params: {
      id
    }
  })
}