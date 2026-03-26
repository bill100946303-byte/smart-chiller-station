import request from '@/utils/request'

// 查询所有历史报警信息
export function findAllHisAlarm(path, data) {
  return request({
    url: `zsqy/qsAlarmlog/${path}/findObject`,
    method: 'get',
    params:data
  })
}
// 查询所有报警级别
export function findAlarmLevel(path) {
  return request({
    url: `zsqy/alarmtype/${path}/findAll`,
    method: 'get'
  })
}
// 导出
export function exportTable(path) {
  return request({
    url: `zsqy/qsAlarmlog/${path}/export`,
    method: 'get',
    responseType: 'blob'
  })
}
// 查询饼图数据
export function pieChart(path) {
  return request({
    url: `zsqy/qsAlarmlog/${path}/findEchars`,
    method: 'get'
  })
}
// 修改历史报警应答
export function updateRespond(path, data) {
  return request({
    url: `zsqy/qsAlarmlog/${path}/update`,
    method: 'post',
    data
  })
}
// 根据设备id查询对应页面
export function findPageByDeviceId(path, drid) {
  return request({
    url: `zsqy/qsAlarmlog/${path}/queryPicByDrid`,
    method: 'get',
    params: {
      drid
    }
  })
}

// 导出
export function exportTablebyAlarm(path,data) {
  return request({
    url: `zsqy/qsAlarmlog/${path}/export`,
    method: 'get',
    responseType: 'blob',
    params: data
  })
}