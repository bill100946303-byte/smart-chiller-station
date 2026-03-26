import request from '@/utils/request'

// 查询停车场信息
export function getParkInfo() {
  return request({
    url: '/jsst/park/findParkInfo',
    method: 'get'
  })
}

// 查询停车位信息
export function getParkSpaceInfo() {
  return request({
    url: '/jsst/park/findParkSpace',
    method: 'get'
  })
}

// 查询车辆入场信息
export function getParkInInfo(data) {
  return request({
    url: '/jsst/park/findParkIn',
    method: 'post',
    data
  })
}

// 查询车辆出场信息
export function getParkOutInfo(data) {
  return request({
    url: '/jsst/park/findParkOut',
    method: 'post',
    data
  })
}

// 查询门禁信息
export function getDoorInOutInfo(data) {
  return request({
    url: '/jsst/door/findInOut',
    method: 'post',
    data
  })
}

// export function getDoorInOutInfo2(data) {
//   return request({
//     url: '/zsqy/DDCMenJin/findByPage',
//     method: 'post',
//     data
//   })
// }


// export function getDoorInOutInfo3(path,data) {
//   return request({
//     url: `/api/menjin/${path}/findPage`,
//     method: 'post',
//     data
//   })
// }

// /zsqyapi/findNjFireMjPage  // 南京门禁

// export function NJDoorInOut(userName,startTime,endTime,pageCurrent,pageSize) {
//   return request({
//     url: "/zsqyapi/findNjFireMjPage",
//     method: "get",
//     params: {
//       userName,startTime,endTime,pageCurrent,pageSize
//     }
//   })
// }