import request from '@/utils/request'

// 查询api
export function runrecords (path,data) {
  return request({
    url: `/zsqy/runrecords/${path}/findByPage`,
    method: 'get',
    params:data
  })
}