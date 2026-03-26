import request from '@/utils/request'

// 查询所有图片
export function findImg(path, pageCurrent, pageSize, imgtype,imgname) {
  return request({
    url: `zsqy/images/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent, pageSize, imgtype,imgname
    }
  })
}
// 新增图片
export function addImg(path, data) {
  return request({
    url: `zsqy/images/${path}/save`,
    method: 'post',
    data
  })
}
// 修改图片
export function updateImg(path, data) {
  return request({
    url: `zsqy/images/${path}/update`,
    method: 'put',
    data
  })
}
// 删除图片
export function deleteImg(path, id) {
  return request({
    url: `zsqy/images/${path}/delete`,
    method: 'delete',
    params: {
      imgid: id
    }
  })
}
