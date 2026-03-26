import request from '@/utils/request'

export function getMenuId(path, groupid) {
  return request({
    url: `zsqy/sysmenuinfo/${path}/findMenuIdByGroupid`,
    method: 'get',
    params: {
      groupid
    }
  })
}
// 进入项目记录用户信息
export function saveUserInfo(path, data) {
  return request({
    url: `user/appmanager/${path}/login`,
    method: 'post',
    data
  })
}

// 查询项目信息
export function findProjects(userid, region, city) {
  return request({
    url: '/zsqy/appusergroup/findObjectByProvinces',
    method: 'get',
    params: {
      userid,
      region,
      city
    }
  })
}

// 查询项目能耗
export function findProjectsEnergy(appids) {
  return request({
    url: `/zsqy/appenergy/queryAppenergyData`,
    method: 'get',
    params: {
      appids
    }
  })
}

// 查询用户所有项目历史报警
export function findUserHistoryAlarm(data) {
  return request({
    url: `/zsqy/qsAlarmlog/findObjectHome`,
    method: 'post',
    data
  })
}

// 查询用户所有项目实时报警
export function findUserTimeAlarm(data) {
  return request({
    url: `/zsqy/qsAlarmlog/findAlarmHome`,
    method: 'post',
    data
  })
}

// 根据项目id查询项目信息
export function findProjectByIds(appids) {
  return request({
    url: `/zsqy/manager/findAllByAppids`,
    method: 'get',
    params: {
      appids
    }
  })
}

// 进入2D调用此接口
export function notify(path) {
  return request({
    url: `/api/device/${path}/data/notify`,
    method: 'get',
  })
}