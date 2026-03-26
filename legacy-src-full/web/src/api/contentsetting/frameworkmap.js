import request from "@/utils/request"

// 查询所有设备类型
export function findDeviceType(path) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findAllDrtypeJgt`,
    method: 'get'
  })
}
// 根据设备类型查询元素和类型模板
export function findByDeviceType(path, drtypeid) {
  return request({
    url: `zsqy/jgtmode/${path}/findJgtBydrtypeid`,
    method: 'get',
    params: {
      drtypeid
    }
  })
}
// 根据设备类型查询所有类型模板
export function findAllTypeModel(path, drtypeid) {
  return request({
    url: `zsqy/jgtmode/${path}/findModeBydrtypeid`,
    method: 'get',
    params: {
      drtypeid
    }
  })
}
// 根据元素id查询组成基础元素
export function findEleComp(path, jgtmodeid) {
  return request({
    url: `zsqy/jgtmode/${path}/findJgtmodeElements`,
    method: 'get',
    params: {
      jgtmodeid
    }
  })
}
// 新增类型
export function addDeviceType(path, drtypeid) {
  return request({
    url: `zsqy/jgtmode/${path}/saveJgtmodeDrtype`,
    method: 'post',
    params: {
      drtypeid
    }
  })
}
// 新增元素模板
export function addEleByDeviceType(path, data) {
  return request({
    url: `zsqy/jgtmode/${path}/saveJgtmodeElements`,
    method: 'post',
    data
  })
}
// 修改元素模板
export function updateEleByDeviceType(path, data) {
  return request({
    url: `zsqy/jgtmode/${path}/updateJgtmodeElements`,
    method: 'put',
    data
  })
}
// 保存坐标
export function saveXY(path, data) {
  return request({
    url: `zsqy/jgtmode/${path}/updateJgt`,
    method: 'put',
    data
  })
}
// 删除类型模板或元素模板
export function deleteByDeviceType(path, type, id) {
  return request({
    url: `zsqy/jgtmode/${path}/delete`,
    method: 'delete',
    params: {
      type,
      id
    }
  })
}
// 清空设备类型
export function deleteDeviceType(path, drtypeid) {
  return request({
    url: `zsqy/jgtmode/${path}/deleteAll`,
    method: 'delete',
    params: {
      drtypeid
    }
  })
}

// 复制结构图
export function copyJgt(path, drtypeid1, drtypeid2) {
  return request({
    url: `zsqy/jgtmode/${path}/copyJgt`,
    method: 'delete',
    params: {
      drtypeid1,
      drtypeid2
    }
  })
}

// 复制结构图元素
export function copyJgtEle(path, drtypeid1, drtypeid2, ids) {
  return request({
    url: `zsqy/jgtmode/${path}/copyJgtByids`,
    method: 'delete',
    params: {
      drtypeid1,
      drtypeid2,
      ids
    }
  })
}
