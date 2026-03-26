import request from '@/utils/request'

// 获取用户的UUID
export function getUserUUID(token, data) {
  return request({
    url: 'hkhttp/getDefaultUserUuid?token='+token,
    method: 'post',
    data
  })
}

// 获取停车场信息
export function getParkingInfo(token, data) {
  return request({
    url: '/hkhttp/getParkingInfos?token='+token,
    method: 'post',
    data
  })
}

// 获取停车场临时缴费信息
export function getParkingCostInfo(data) {
  return request({
    url: '/hkhttp/getTempCarChargeRecords',
    method: 'post',
    data
  })
}

// 获取停车场过车记录
export function getParkingRecords(data) {
  return request({
    url: '/hkhttp/getVehicleRecords',
    method: 'post',
    data
  })
}

// 根据车牌号模糊获取车辆停车记录
export function getParkingStopRecords(data) {
  return request({
    url: '/hkhttp/fetchParkingRecordFuzzyByPlateNo',
    method: 'post',
    data
  })
}

// 获取车位状态
export function getParkingStatus(data) {
  return request({
    url: '/hkhttp/getPlotStatus',
    method: 'post',
    data
  })
}