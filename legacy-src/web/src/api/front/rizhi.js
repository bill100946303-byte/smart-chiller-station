import request from '@/utils/request'

// 查询api
export function getLengZhanRecords (path,data) {
  return request({
    url: `zsqy/lengzhanrecords/${path}/getLengZhanRecords`,
    method: 'get',
    params:data
  })
}