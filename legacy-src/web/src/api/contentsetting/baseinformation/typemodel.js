import request from '@/utils/request'

// 查询所有设备类型
export function findDeviceType(path) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findAllDrtypeAndDr`,
    method: "get"
  })
}

// 导出excel文件
export function outputExcel(path, drtypeid) {
  return request({
    url: `zsqy/Drtypemode/${path}/export`,
    method: 'get',
    responseType: 'blob',
    params: {
      drtypeid
    }
  })
}
// 导入excel文件
export function inputExcel(path, data) {
  return request({
    url: `zsqy/Drtypemode/${path}/import`,
    method: 'post',
    data
  })
}
// 查询所有组件属性
export function findComponent(path) {
  return request({
    url: `zsqy/sub/${path}/findAll`,
    method: "get"
  })
}
// 查询所有报警类型
export function findAlarmType(path) {
  return request({
    url: `zsqy/alarmtype/${path}/findAll`,
    method: "get"
  })
}
// 查询所有类型模板
export function findModel(path, pageCurrent, pageSize, drtypeid) {
  return request({
    url: `zsqy/Drtypemode/${path}/findObject`,
    method: "get",
    params: {
      pageCurrent,
      pageSize,
      drtypeid,
    }
  })
}
// 增加类型模板
export function addModel(path, data) {
  return request({
    url: `zsqy/Drtypemode/${path}/save`,
    method: "post",
    data
  })
}
// 修改类型模板
export function updateModel(path, data) {
  return request({
    url: `zsqy/Drtypemode/${path}/update`,
    method: "put",
    data
  })
}
// 删除类型模板
export function deleteModel(path, ids) {
  return request({
    url: `zsqy/Drtypemode/${path}/delete`,
    method: "delete",
    params: {
      ids
    }
  })
}
