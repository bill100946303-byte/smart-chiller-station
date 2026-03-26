import request from '@/utils/request'

// 查询api
export function getEnergyAnalysisCurve (data) {
  return request({
    url: `/zsqy/energyanalysis/getEnergyAnalysisCurve`,
    method: 'get',
    params:data
  })
}
export function getEnergyAnalysisPie (data) {
    return request({
      url: `/zsqy/energyanalysis/getEnergyAnalysisPie`,
      method: 'get',
      params:data
    })
  }
  export function getEnergyAnalysisDeviceList (path,data) {
    return request({
      url: `/zsqy/energyanalysis/${path}/getEnergyAnalysisDeviceList`,
      method: 'get',
      params:data
    })
  }