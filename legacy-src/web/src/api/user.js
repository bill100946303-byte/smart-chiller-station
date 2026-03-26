import request from '@/utils/request'

// 用户登录的function
export function login(username, password) {
  return request({
    url: 'user/login',
    method: 'get',
    params: {
      username, password
    }
  })
}

export function getInfo(token) {
  return request({
    url: 'user/dologin',
    method: 'get',
    params: {
      token
    }
  })
}
// 获取申请码
export function getCode() {
  return request({
    url: 'zsqy/license',
    method: 'get'
  })
}
// 根据输入的申请码授权
export function sendCode(code) {
  return request({
    url: 'zsqy/importlicense',
    method: 'get',
    params: {
      code
    }
  })
}
// 修改密码
export function changePass(username, password, newpassword) {
  return request({
    url: 'zsqy/user/updatePassword',
    method: 'put',
    params: {
      username, 
      password, 
      newpassword
    }
  })
}

// 登录进去修改授权
export function getRequestCode() {
  return request({
    url: 'zsqy/licenseByUser',
    method: 'get'
  })
}

// 退出
export function logout() {
  return request({
    url: 'user/clearsession',
    method: 'get'
  })
}
export function updateUser(data) {
  return request({
    url: 'zsqy/user/updateUser',
    method: 'GET',
    params:data
  })
}
//首页工单
export function findAllOrderSort(id) {
  return request({
    url: `zsqy/qsworkorder/findAllOrderSort?userId=${id}`,
    method: 'GET'
  })
}

//首页报警
export function findTopFiveAlarmLog(id) {
  return request({
    url: `zsqy/qsAlarmlog/findTopFiveAlarmLog?userId=${id}`,
    method: 'GET'
  })
}

// 获取报警推送二维码
export function alarmPush(code) {
  return request({
    url: 'wxservice/mp/show/qrcode',
    method: 'get',
    params: code
  })
}

export function deepseek(path, data) {
  return request({
    url: `api/ai/deepseek/${path}/`,
    method: 'get',
    params: {
      ...data
    }
  })
}