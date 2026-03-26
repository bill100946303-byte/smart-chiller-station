import request from '@/utils/request'

// 查询api
export function getEnergyStatisticsCurve(path) {
  return request({
    url: `/zsqy/homepage/${path}/getEnergyStatisticsCurve`,
    method: 'get',
  })
}

export function findByUserId(path) {
  return request({
    url: `/zsqy/energyStatistics/findByUserId`,
    method: 'get',
  })
}


export function findAllByCondition(data) {
  return request({
    url: `/zsqy/manager/findAllByCondition`,
    method: 'get',
    params: data
  })
}
export function findCOPRank(path) {
  return request({
    url: `/zsqy/energyStatistics/findCOPRank?userId=${path}`,
    method: 'get',
  })
}

export function getRunParamsCurve(path) {
  return request({
    url: `/zsqy/homepage/${path}/getRunParamsCurve`,
    method: 'get',
  })
}

export function userfindAll(data) {
  return request({
    url: `/zsqy/user/findAllUser`,
    method: 'get',
    params: data
  })
}

export function exportwork(path) {
  return request({
    url: `/zsqy/qsworkorder/${path}/export`,
    method: 'get',
    responseType: 'blob'
  })
}
export function getPopupEnergyStatisticsCurve(path, data) {
  return request({
    url: `/zsqy/homepage/${path}/getPopupEnergyStatisticsCurve`,
    method: 'get',
    params: data
  })
}
export function findByDrId(path, data) {
  return request({
    url: `/zsqy/runrecords/${path}/findByDrId`,
    method: 'get',
    params: data
  })
}
export function findDr(path, data) {
  return request({
    url: `/zsqy/drinfo/${path}/findDr`,
    method: 'get',
    params: data
  })
}
export function AlarmlogfindByDrId(path, drId) {
  return request({
    url: `/zsqy/qsAlarmlog/${path}/findByDrId`,
    method: 'get',
    params: {
      drId
    }
  })
}

// 查询弹框中的基本参数
export function findRegBasicParametersByDrid(path, data) {
  return request({
    url: `/zsqy/reg/${path}/findRegBasicParametersByDrid`,
    method: 'get',
    params: data
  })
}

// 点击基本参数某个查看报表数据
export function findRegHistoryByDrid(path, data) {
  return request({
    url: `/zsqy/reg/${path}/findRegHistoryByDrid`,
    method: 'get',
    params: data
  })
}

// 点击基本参数某个查看报表数据导出
export function exportRegHistoryByDrid(path, data) {
  return request({
    url: `/zsqy/reg/${path}/exportRegHistoryByDrid`,
    method: 'get',
    params: data,
    responseType: 'blob'
  })
}

// 查询项目列表
export function findAllFloorModel(data) {
  return request({
    url: `/zsqy/manager/findAllFloorModel`,
    method: 'get',
    params: data,
  })
}

// 查询CH的2D图例
export function setAiSetting(path, data) {
  return request({
    url: `/zsqy/manager/${path}/setAiSetting`,
    method: 'post',
    data,
  })
}

// AI算法开关
export function findDevice2DModelUrlByDrId(path, data) {
  return request({
    url: `/zsqy/reg/${path}/findDevice2DModelUrlByDrId`,
    method: 'get',
    params: data,
  })
}