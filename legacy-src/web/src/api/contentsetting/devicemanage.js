import request from "@/utils/request"

// 导出excel文件
export function outputExcel(path, ids) {
  return request({
    url: `zsqy/drinfo/${path}/export`,
    method: 'get',
    responseType: 'blob',
    params: {
      ids
    }
  })
}
// 导入excel文件
export function inputExcel(path, data) {
  return request({
    url: `zsqy/drinfo/${path}/import`,
    method: 'post',
    data
  })
}
// 导入设备清单excel文件
export function inputEquipmentList(path, data) {
  return request({
    url: `zsqy/drinfo/${path}/importEquipmentList`,
    method: 'post',
    data
  })
}
// 查询所有楼栋名
export function findBuild(path) {
  return request({
    url: `zsqy/buildinfo/${path}/findAll`,
    method: 'get'
  })
}
// 条件查询设备
export function findDevice(path, pageCurrent, pageSize, drtypeid) {
  return request({
    url: `zsqy/drinfo/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize,
      drtypeid
    }
  })
}
// 新增设备
export function addDevice(path, data) {
  return request({
    url: `zsqy/drinfo/${path}/save`,
    method: 'post',
    data
  })
}
// 修改设备
export function updateDevice(path, data) {
  return request({
    url: `zsqy/drinfo/${path}/update`,
    method: 'put',
    data
  })
}
// 删除设备
export function deleteDevice(path, ids) {
  return request({
    url: `zsqy/drinfo/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
