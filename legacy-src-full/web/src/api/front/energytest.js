import request from '@/utils/request'

// 查询api
export function findEnergyCalendar (data) {
  return request({
    url: `/zsqy/energycalendar/findEnergyCalendar`,
    method: 'get',
    params:data
  })
}
export function findTodayEnergy (path,data) {
  return request({
    url: `/zsqy/energycalendar/${path}/findTodayEnergy`,
    method: 'get',
    params:data
  })
}
export function findMonthEnergy (path,data) {
  return request({
    url: `/zsqy/energycalendar/${path}/findMonthEnergy`,
    method: 'get',
    params:data
  })
}


export function findEnergyContrast (path,data) {
  return request({
    url: `/zsqy/energycalendar/${path}/findEnergyContrast`,
    method: 'get',
    params:data
  })
}

export function findEnergySearch (path,data) {
  return request({
    url: `/zsqy/energycalendar/${path}/findEnergySearch`,
    method: 'get',
    params:data
  })
}

export function findLoadSpecificGravity (path,data) {
  return request({
    url: `/zsqy/energycalendar/${path}/findLoadSpecificGravity`,
    method: 'get',
    params:data
  })
}

export function findDrstructur (path,data) {
  return request({
    // url: `/zsqy/Drtypeinfo/${path}/findAllDrtypeAndDr`,
    url: `/zsqy/Drtypeinfo/${path}/findAllDrTypeAndDrEnergy`,
    method: 'get',
    params: data
  })
}
export function finddrlist(path,data){
  return request({
    url: `/zsqy/drinfo/${path}/findAll`,
    method: 'get',
    params:data
  })
}

export function getEnergyAnalysisCurveByDr (path,data) {
  return request({
    url: `/zsqy/energyanalysis/${path}/getEnergyAnalysisCurveByDr`,
    method: 'get',
    params:data
  })
}

// 数据曲线报表
export function getDetailedReportCurve(path, data) {
  return request({
    url: `/zsqy/reportmanage/${path}/getDetailedReportCurve`,
    method: 'post',
    data
  })
}

// 能耗抄表
export function findEnergyCoolingCapacity(path, data) {
  return request({
    url: `/zsqy/reportmanage/${path}/findEnergyCoolingCapacity`,
    method: 'get',
    params: data
  })
}

// 能耗抄表导出
export function exportCoolingCapacity(path, data) {
  return request({
    url: `/zsqy/reportmanage/${path}/exportCoolingCapacity`,
    method: 'get',
    params: data,
    responseType: 'blob'
  })
}

// 保存用户勾选
export function setReportItem(path, data) {
  return request({
    url: `/zsqy/reportmanage/${path}/setReportItem`,
    method: 'post',
    data
  })
}

// 获取用户保存勾选
export function getAllReportItem(path, data) {
  return request({
    url: `/zsqy/reportmanage/${path}/getAllReportItem`,
    method: 'get',
    params: data
  })
}

// 删除用户勾选
export function deleteReportItem(path, data) {
  return request({
    url: `zsqy/reportmanage/${path}/deleteReportItem`,
    method: 'delete',
    params: data
  })
}