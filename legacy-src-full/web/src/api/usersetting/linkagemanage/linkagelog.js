import request from '@/utils/request'

// 分页查询联动日志
export function findLinkageLog(path, data) {
  return request({
    url: `zsqy/qsLdLog/${path}/findObject`,
    method: 'post',
    data
  })
}
// 导出
export function exportTable(path) {
  return request({
    url: `zsqy/qsLdLog/${path}/export`,
    method: 'get',
    responseType: 'blob'
  })
}
export function handleLinkageLog(path, appid, ldJgId) {
  return request({
    url: `zsqy/qsLdJgr/${path}/doQsLdJgByJgId`,
    method: 'get',
    params: {
      appid,
      ldJgId
    }
  })
}
