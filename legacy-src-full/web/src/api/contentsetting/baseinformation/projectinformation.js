import request from '@/utils/request'

// 查询所有项目信息
export function findProject(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/appinfo/${path}/find`,
    method: 'get',
    params: {
      pageCurrent, pageSize
    }
  })
}
// 新增项目信息
export function addProject(path, data) {
  return request({
    url: `zsqy/appinfo/${path}/save`,
    method: 'post',
    data
  })
}
// 修改项目信息
export function updateProject(path, data) {
  return request({
    url: `zsqy/appinfo/${path}/update`,
    method: 'put',
    data
  })
}

// 删除项目信息
export function deleteProject(path, appid) {
  return request({
    url: `zsqy/appinfo/${path}/delete`,
    method: 'delete',
    params: {
      appid
    }
  })
}