import request from "@/utils/request"

// 查询所有报警类型
export function findAlarm(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/alarmtype/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize
    }
  })
}
// 增加报警类型
export function addAlarm(path, data) {
  return request({
    url: `zsqy/alarmtype/${path}/save`,
    method: 'post',
    data
  })
}
// 修改报警类型
export function updateAlarm(path, data) {
  return request({
    url: `zsqy/alarmtype/${path}/update`,
    method: 'put',
    data
  })
}
// 删除报警类型
export function deleteAlarm(path, ids) {
  return request({
    url: `zsqy/alarmtype/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
