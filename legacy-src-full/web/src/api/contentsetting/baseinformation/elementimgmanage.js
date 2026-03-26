import request from '@/utils/request'

// 查询所有图片
export function findImg(path, pageCurrent, pageSize, imgtype) {
  return request({
    url: `zsqy/images/${path}/findObjectP`,
    method: 'get',
    params: {
      pageCurrent, pageSize, imgtype
    }
  })
}
// 查询所有图片
export function findAllImg(path, imgtype) {
  return request({
    url: `zsqy/images/${path}/findAllP`,
    method: 'get',
    params: {
      imgtype
    }
  })
}
// 新增图片
export function addImg(path, data) {
  return request({
    url: `zsqy/images/${path}/saveP`,
    method: 'post',
    data
  })
}
// 修改图片
export function updateImg(path, data) {
  return request({
    url: `zsqy/images/${path}/updateP`,
    method: 'put',
    data
  })
}
// 删除图片
export function deleteImg(path, id) {
  return request({
    url: `zsqy/images/${path}/deleteP`,
    method: 'delete',
    params: {
      imgid: id
    }
  })
}
