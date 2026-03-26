import request from '@/utils/request'

// 查询api
export function findAll(project) {
  return request({
    url: `zsqy/energyparameters/${project}/findAll`,
    method: 'get'
  })
}
export function update(project,data) {
  return request({
    url: `zsqy/energyparameters/${project}/update`,
    method: 'put',
    data:data
  })
}