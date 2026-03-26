import request from '@/utils/request'

// 查询所有设备类型
export function findDeviceType(path) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findAllDrtypeByAlarm`,
    method: 'get'
  })
}
// 查询单个设备类型
export function findAllDrtypeOfDevice(path) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findAllDrtypeOfDevice`,
    method: 'get'
  })
}
// 查询所有实时报警信息
export function findAllTimeAlarm(path, data) {
  return request({
    url: `zsqy/qsAlarmlog/${path}/findAlarm`,
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
    url: `zsqy/qsAlarmlog/${path}/findEcharsByAlarm`,
    method: 'get'
  })
}
// 修改实时报警应答
export function updateRespond(path, data) {
  return request({
    url: `zsqy/qsAlarmlog/${path}/update`,
    method: 'post',
    data
  })
}
// 报警设置列表
export function findAllAlarmSetting(path,data){
  return request({
    url: `zsqy/qstag/${path}/findAllAlarmSetting`,
    method: 'get',
    params: data
  })
}
// 修改报警设置
export function editAlarmSetting(path,data){
  return request({
    url: `zsqy/qstag/${path}/alarmSetting`,
    method: 'post',
    data: data
  })
}