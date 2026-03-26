import request from '@/utils/request'

// 查询能耗配置参数
export function findEnergyParams(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/energyparm/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize
    }
  })
}

// 新增能耗配置参数
export function addEnergyParams(path, data) {
  return request({
    url: `zsqy/energyparm/${path}/save`,
    method: 'post',
    data
  })
}

// 修改能耗配置参数
export function updateEnergyParams(path, data) {
  return request({
    url: `zsqy/energyparm/${path}/update`,
    method: 'put',
    data
  })
}

// 删除能耗配置参数
export function deleteEnergyParams(path, id) {
  return request({
    url: `zsqy/energyparm/${path}/delete`,
    method: 'delete',
    params: {
      id
    }
  })
}