import request from '@/utils/request'

// 导出excel文件
export function outputExcel(path) {
  return request({
    url: `zsqy/area/${path}/export`,
    method: 'get',
    responseType: 'blob'
  })
}
// 导入excel文件
export function inputExcel(path, data) {
  return request({
    url: `zsqy/area/${path}/import`,
    method: 'post',
    data
  })
}

export function findBuild(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/area/${path}/findAreaByPage`,
    method: 'get',
    params: {
      currentPage:pageCurrent, pageSize
    }
  })
}


// 新增楼栋信息
export function addBuild(path, data) {
  return request({
    url: `zsqy/area/${path}/insertArea`,
    method: 'post',
    data
  })
}

// 修改楼栋信息
export function updateBuild(path, data) {
  return request({
    url: `zsqy/area/${path}/updateArea`,
    method: 'put',
    data
  })
}

// 删除楼栋信息
export function deleteBuild(path, ids) {
  return request({
    url: `zsqy/area/${path}/deleteArea`,
    method: 'delete',
    params: {
      ids
    }
  })
}

export function findAllFloor (path,data) {
  return request({
    url: `zsqy/floor/${path}/findAllFloor`,
    method: 'get',
    params: data
  })
}
export function findAllbuild(path) {
  return request({
    url: `zsqy/buildinfo/${path}/findAll`,
    method: 'get'
  })
}
export function findAllArea(path, data) {
  return request({
    url: `zsqy/area/${path}/findAllArea`,
    method: 'get',
    params: data
  })
}