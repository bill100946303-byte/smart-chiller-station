import request from '@/utils/request'
export function exportTable (path, id) {
  return request({
    url: `zsqy/pic/${path}/exportExcel?parentId=` + id,
    method: 'get',
    responseType: 'blob'
  })
}
export function importExcel (path, id) {
  return request({
    url: `zsqy/pic/${path}/importExcel?parentId=` + id,
    method: 'get',
    responseType: 'blob'
  })
}
export function deleteByIds (path, data) {
  return request({
    url: `zsqy/pic/${path}/deleteByIds`,
    method: 'post',
    data
  })
}