import request from '@/utils/request'

// 查询模式日志
export function findLinkageLog(path, data) {
  return request({
    url: `zsqy/ms/jb/${path}/findMsJbLog`,
    method: 'post',
    data
  })
}

// 查询联动日志
export function findLog(path, data) {
  return request({
    url: `zsqy/link/rw/${path}/findLog`,
    method: 'post',
    data
  })
}