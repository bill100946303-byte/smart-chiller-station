import request from '@/utils/request'

// 查询楼栋物
export function findBuild(path) {
  return request({
    url: `zsqy/buildinfo/${path}/findAll`,
    method: 'get'
  })
}
// 查询平面图片
export function findImg(path, imgtype) {
  return request({
    url: `zsqy/images/${path}/findAll`,
    method: 'get',
    params: {
      imgtype
    }
  })
}
// 查询所有页面
export function findPage(path, parentid) {
  return request({
    url: `zsqy/pic/${path}/findObject`,
    method: 'get',
    params: {
      parentid
    }
  })
}
// 根据id查询页面信息
export function findPageById(path, picid) {
  return request({
    url: `zsqy/pic/${path}/findObjectById`,
    method: 'get',
    params: {
      picid
    }
  })
}

// 新增页面
export function addPage(path, data) {
  return request({
    url: `zsqy/pic/${path}/save`,
    method: 'post',
    data
  })
}
// 修改页面
export function updatePage(path, data) {
  return request({
    url: `zsqy/pic/${path}/update`,
    method: 'put',
    data
  })
}

// 删除页面
export function deletePage(path, picid) {
  return request({
    url: `zsqy/pic/${path}/delete`,
    method: 'delete',
    params: {
      picid
    }
  })
}
