import request from '@/utils/request'

// 导出excel文件
export function outputExcel(path) {
  return request({
    url: `zsqy/floor/${path}/export`,
    method: 'get',
    responseType: 'blob'
  })
}
// 导入excel文件
export function inputExcel(path, data) {
  return request({
    url: `zsqy/floor/${path}/import`,
    method: 'post',
    data
  })
}

export function findBuild(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/floor/${path}/findFloorByPage`,
    method: 'get',
    params: {
      currentPage:pageCurrent, pageSize
    }
  })
}

export function findAllbuild(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/buildinfo/${path}/findAll`,
    method: 'get'
  })
}
// 新增楼栋信息
export function addBuild(path, data) {
  return request({
    url: `zsqy/floor/${path}/insertFloor`,
    method: 'post',
    data
  })
}

// 修改楼栋信息
export function updateBuild(path, data) {
  return request({
    url: `zsqy/floor/${path}/updateFloor`,
    method: 'put',
    data
  })
}

// 删除楼栋信息
export function deleteBuild(path, ids) {
  return request({
    url: `zsqy/floor/${path}/deleteFloor`,
    method: 'delete',
    params: {
      ids
    }
  })
}