import request from '@/utils/request'

// 查询所有设备类型
export function findDeviceType(path) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findAllDrtypeAndDr`,
    method: 'get'
  })
}

// 条件查询门禁记录
export function searchEntranceGuard(data) {
  return request({
    url: `zsqy/other/querydata/sqserver`,
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
// 根据设备查询变量
export function findReg(path, drid, isenergy) {
  return request({
    url: `zsqy/reg/${path}/findAllByDrid`,
    method: 'get',
    params: {
      drid,
      isenergy
    }
  })
}
// 根据变量名查询寄存器,生成折线图
export function findRegData(path, data) {
  return request({
    url: `zsqy/regdata/${path}/findObjBytag`,
    method: 'post',
    data
  })
}

// 根据变量名查询寄存器,生成折线图New
export function findRegDataNew(path, data) {
  return request({
    url: `zsqy/regdata/${path}/findObjBytagNew`,
    method: 'post',
    data
  })
}

// 根据设备查询寄存器,生成折线图
export function findRegDatas(path, data) {
  return request({
    url: `zsqy/regdata/${path}/findObjByDrid`,
    method: 'post',
    data
  })
}
// 数据导出
export function exportReg(path, data) {
  return request({
    url: `zsqy/regdata/${path}/exportNew`,
    method: 'post',
    responseType: 'blob',
    data
  })
}

// 查询设备报表
export function findDeviceRegDatas(path, data) {
  return request({
    url: `zsqy/regdata/${path}/findDridReport`,
    method: 'post',
    data
  })
}

// 查询设备报表new
export function findDeviceRegDatasNew(path, data) {
  return request({
    url: `zsqy/regdata/${path}/findDridReportNew`,
    method: 'post',
    data
  })
}