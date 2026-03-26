import request from '@/utils/request'

// 导出excel文件
export function outputExcel(path) {
  return request({
    url: `zsqy/spinfo/${path}/export`,
    method: 'get',
    responseType: 'blob'
  })
}
// 导入excel文件
export function inputExcel(path, data) {
  return request({
    url: `zsqy/spinfo/${path}/import`,
    method: 'post',
    data
  })
}
// 查询所有视频
export function findVideo(path, pageCurrent, pageSize) {
  return request({
    url: `zsqy/spinfo/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent, pageSize
    }
  })
}
// 新增视频
export function addVideo(path, data) {
  return request({
    url: `zsqy/spinfo/${path}/save`,
    method: 'post',
    data
  })
}
// 修改视频
export function updateVideo(path,data) {
  return request({
    url: `zsqy/spinfo/${path}/update`,
    method: 'put',
    data
  })
}

// 删除视频
export function deleteVideo(path, ids) {
  return request({
    url: `zsqy/spinfo/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}

// 启动视频
export function startVideos(path, ids) {
  return request({
    url: `zsqy/spinfo/${path}/startSP`,
    method: 'get',
    params: {
      ids
    }
  })
}

// 停止视频
export function stopVideos(path) {
  return request({
    url: `zsqy/spinfo/${path}/stopSP`,
    method: 'get'
  })
}