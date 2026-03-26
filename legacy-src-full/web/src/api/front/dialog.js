import request from '@/utils/request'

// 查询api
export function getRunParamsCurveByTagName (path,data) {
  return request({
    url: `/zsqy/homepage/${path}/getRunParamsCurveByTagName`,
    method: 'get',
    params:data
  })
}