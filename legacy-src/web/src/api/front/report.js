import request from '@/utils/request'

// 查询api
export function findAll(path,data) {
  return request({
    url: `/zsqy/reportmanage/${path}/findByTimeSpace`,
    method: 'get',
    params:data
  })
}

export function exporttable(path,data) {
  return request({
    url: `/zsqy/reportmanage/${path}/export`,
    method: 'get',
    params:data,
    responseType: 'blob'
  })
}