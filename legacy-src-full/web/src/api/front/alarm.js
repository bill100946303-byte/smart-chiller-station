import request from '@/utils/request'

// 查询api
export function findByPage ({ path, ...data }) {
  return request({
    url: `zsqy/devicestandingbook/${path}/findByPage`,
    method: 'get',
    params:data
  })
}
export function insert(path,data) {
  return request({
    url: `zsqy/devicestandingbook/${path}/insert`,
    method: 'post',
    data:data
  })
}
export function update(path,data) {
  return request({
    url: `zsqy/devicestandingbook/${path}/update`,
    method: 'put',
    data:data
  })
}
export function deleteinfo(path,data) {
  return request({
    url: `zsqy/devicestandingbook/${path}/delete`,
    method: 'delete',
    data: {
      ids:data
    }
  })
}

export function exportByPage(path) {
  return request({
    url: `zsqy/devicestandingbook/${path}/export`,
    method: 'get',
    responseType: 'blob'
  })
}

export function inputimport(path,file){
  return request({
    url: `zsqy/devicestandingbook/${path}/import`,
    method: 'post',
    data:file
  })
}