import request from "@/utils/request"

// 导出excel文件
export function outputVarModel(path) {
  return request({
    url: `zsqy/reg/${path}/exportQstag`,
    method: 'get',
    responseType: 'blob'
  })
}
// 导出报警信息
export function outputAlarmExcel(path) {
  return request({
    url: `zsqy/regalarminfo/${path}/export`,
    method: 'get',
    responseType: 'blob'
  })
}

// 导出excel文件
export function outputExcel(path, drtypeid) {
  return request({
    url: `zsqy/reg/${path}/export`,
    method: 'get',
    responseType: 'blob',
    params: {
      drtypeid
    }
  })
}

// 导入报警信息
export function inputAlarmExcel(path, data) {
  return request({
    url: `zsqy/regalarminfo/${path}/import`,
    method: 'post',
    data
  })
}

// 导入excel文件
export function inputExcel(path, data) {
  return request({
    url: `zsqy/reg/${path}/import`,
    method: 'post',
    data
  })
}
// 根据设备类型查询设备
export function findDevice(path, drtypeid) {
  return request({
    url: `zsqy/drinfo/${path}/findAll`,
    method: 'get',
    params: {
      drtypeid
    }
  })
}
// 查询所有变量
export function findVar(path, pageCurrent, pageSize, drId) {
  return request({
    url: `zsqy/reg/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize,
      drId
    }
  })
}
// 查询所有寄存器
export function findQstag(path) {
  return request({
    url: `zsqy/reg/${path}/findQstag`,
    method: 'get'
  })
}
// 查询所有阈值
export function findSub(path) {
  return request({
    url: `zsqy/sub/${path}/findAll`,
    method: 'get'
  })
}
// 新增变量
export function addVar(path, data) {
  return request({
    url: `zsqy/reg/${path}/save`,
    method: 'post',
    data
  })
}
// 修改变量
export function updateVar(path, data) {
  return request({
    url: `zsqy/reg/${path}/update`,
    method: 'put',
    data
  })
}
// 删除变量
export function deleteVar(path, ids) {
  return request({
    url: `zsqy/reg/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
// 查找详细运行设备
export function findAllByDrTypeId(path, data) {
  return request({
    url: `zsqy/Drtypemode/${path}/findAllDrTypeModeByDrTypeId`,
    method: 'get',
    params:data
  })
}
