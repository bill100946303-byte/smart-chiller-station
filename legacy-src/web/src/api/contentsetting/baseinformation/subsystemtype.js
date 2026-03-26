import request from '@/utils/request'

// 查询图标
export function findIcon() {
  return request({
    url: `zsqy/icon/findAll`,
    method: 'get'
  })
}
// 查询所有页面
export function findPages(path) {
  return request({
    url: `zsqy/pic/${path}/findObjectInPicmodeid`,
    method: 'get'
  })
}

// 从模板保存子系统
export function saveSubsystem(path, data) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/moveDrtypeAndModle`,
    method: 'post',
    data
  })
}

// 查询所有子类型
export function findAllSubsystem(path) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findAllByIscustom`,
    method: 'get',
    params: {
      iscustomType: 0
    }
  })
}

// 根据父id查询子系统信息
export function findSubsystem(path, parentid) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findObject`,
    method: 'get',
    params: {
      parentid,
      iscustomType: 0
    }
  })
}
// 查询子类
export function findChild(path, parentid) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findObject`,
    method: 'get',
    params: {
      parentid
    }
  })
}
// 新增子系统
export function addSubsystem(path, data) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/save`,
    method: 'post',
    data
  })
}
// 修改子系统
export function updateSubsystem(path, data) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/update`,
    method: 'put',
    data
  })
}

// 删除子系统
export function deleteSubsystem(path, drtypeid) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/delete`,
    method: 'delete',
    params: {
      drtypeid
    }
  })
}
