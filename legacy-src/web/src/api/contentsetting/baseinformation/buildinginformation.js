import request from '@/utils/request'

// 导出excel文件
export function outputExcel(path) {
  return request({
    url: `zsqy/buildinfo/${path}/export`,
    method: 'get',
    responseType: 'blob'
  })
}
// 导入excel文件
export function inputExcel(path, data) {
  return request({
    url: `zsqy/buildinfo/${path}/import`,
    method: 'post',
    data
  })
}

// 查询所有楼栋信息
export function findBuild(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/buildinfo/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent, pageSize
    }
  })
}

// 新增楼栋信息
export function addBuild(path, data) {
  return request({
    url: `zsqy/buildinfo/${path}/saveObject`,
    method: 'post',
    data
  })
}

// 修改楼栋信息
export function updateBuild(path, data) {
  return request({
    url: `zsqy/buildinfo/${path}/updateObject`,
    method: 'put',
    data
  })
}

// 删除楼栋信息
export function deleteBuild(path, ids) {
  return request({
    url: `zsqy/buildinfo/${path}/deleteObject`,
    method: 'delete',
    params: {
      ids
    }
  })
}