import request from "@/utils/request"

// 导出excel文件
export function outputExcel(path) {
  return request({
    url: `zsqy/dlldrinfo/${path}/export`,
    method: 'get',
    responseType: 'blob'
  })
}
// 导入excel文件
export function inputExcel(path, data) {
  return request({
    url: `zsqy/dlldrinfo/${path}/import`,
    method: 'post',
    data
  })
}

// 查询设备数据采集信息
export function findDllDrinfo(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/dlldrinfo/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize
    }
  })
}

export function findAllDllDrinfo(path) {
  return request({
    url: `zsqy/dlldrinfo/${path}//findDrllinfo`,
    method: 'get'
  })
}

// 新增设备数据采集信息
export function addDllDrinfo(path, data) {
  return request({
    url: `zsqy/dlldrinfo/${path}/save`,
    method: 'post',
    data
  })
}

// 修改设备数据采集信息
export function updateDllDrinfo(path, data) {
  return request({
    url: `zsqy/dlldrinfo/${path}/update`,
    method: 'put',
    data
  })
}

// 删除设备数据采集信息
export function deleteDllDrinfo(path, ids) {
  return request({
    url: `zsqy/dlldrinfo/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}