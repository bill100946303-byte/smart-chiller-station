import request from '@/utils/request'

// 条件查询用户操作记录
export function findUserHandle(path, data) {
  return request({
    url: `zsqy/qsActivelog/${path}/findObject`,
    method: 'post',
    data
  })
}
// 条件查询用户登录记录
export function findUserLogin(path, data) {
  return request({
    url: `zsqy/qsUserloginlog/${path}/findObject`,
    method: 'post',
    data
  })
}
