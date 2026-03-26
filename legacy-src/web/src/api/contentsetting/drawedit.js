import request from "@/utils/request"

// 修改经纬度
export function updateLngLat(path, id, lng, lat) {
  return request({
    url: `zsqy/picedit/${path}/updatePicEditLngAndLat`,
    method: 'get',
    params: {
      id, 
      lng, 
      lat
    }
  })
}

// 查询最后一级设备类型
export function findLastDeviceType(path) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findBasisDrtype`,
    method: 'get'
  })
}

// 根据设备类型id查设备信息
export function findDeviceInfo(path, drtypeid, drname) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findDrinfoByType`,
    method: 'get',
    params: {
      drtypeid,
      drname
    }
  })
}

// 查询背景图片
export function findBGImg(path, picid) {
  return request({
    url: `zsqy/picedit/${path}/findImagesByPicid`,
    method: 'get',
    params: {
      picid
    }
  })
}

// 查询所有有模板的页面
export function findPages(path) {
  return request({
    url: `zsqy/pic/${path}/findAllPicNameid`,
    method: 'get'
  })
}

// 根据类型模板id查询所属模板
export function findEleModels(path, typeid) {
  return request({
    url: `zsqy/elemttype/${path}/findObjectByTypeid`,
    method: 'get',
    params: {
      typeid
    }
  })
}

// 根据页面id查询元素
export function findEleByPage(path, picid, drtypeid) {
  return request({
    url: `zsqy/picedit/${path}/findByPicid`,
    method: 'get',
    params: {
      picid,
      drtypeid
    }
  })
}
// 根据元素id查询模板元素
export function findEleById(path, ids) {
  return request({
    url: `zsqy/elemttypemode/${path}/findByIds`,
    method: 'get',
    params: {
      ids
    }
  })
}
// 根据元素id查询组成基础元素
export function findEleComp(path, id) {
  return request({
    url: `zsqy/picedit/${path}/selectElements`,
    method: 'get',
    params: {
      id
    }
  })
}
// 查询所有页面
export function findAllPage(path) {
  return request({
    url: `zsqy/pic/${path}/findAllPic`,
    method: 'get'
  })
}
// 根据页面id查询页面
export function findPageById(path, picid) {
  return request({
    url: `zsqy/pic/${path}/findObjectById`,
    method: 'get',
    params: {
      picid
    }
  })
}
// 修改页面背景色
export function updatePageColor(path, picid, color) {
  return request({
    url: `zsqy/pic/${path}/updateColor`,
    method: 'get',
    params: {
      picid,
      color
    }
  })
}
// 查询所有设备类型
export function findDeviceType(path) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findAllDrtypeAndDr`,
    method: 'get',
    params: {
      iscustomType: 0
    }
  })
}
// 根据设备类型id查询设备类型
export function findDeviceTypeById(path, drtypeid) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findDrtypeinfoBytypeid`,
    method: 'get',
    params: {
      drtypeid,
      iscustomType: 0
    }
  })
}
// 根据设备类型查询设备
export function findAllDevice(path, drtypeid, drname) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findDrinfoByType`,
    method: 'get',
    params: {
      drtypeid,
      drname
    }
  })
}
// 根据设备查询变量
export function findAllReg(path, drid) {
  return request({
    url: `zsqy/reg/${path}/findAllByDrid`,
    method: 'get',
    params: {
      drid
    }
  })
}
// 根据变量id查询变量
export function findRegById(path, ids) {
  return request({
    url: `zsqy/reg/${path}/findRegById`,
    method: 'get',
    params: {
      ids
    }
  })
}
// 查询所有能耗
export function findAllEnergy(path) {
  return request({
    url: `zsqy/energyinfo/${path}/findAllEnergyinfo`,
    method: 'get'
  })
}
// 根据id查询能耗
export function findEnergyById(path, id) {
  return request({
    url: `zsqy/energyinfo/${path}/findEnergyinfoByid`,
    method: 'get',
    params: {
      id
    }
  })
}
// 查询所有联动
export function findAllLinkage(path) {
  return request({
    url: `zsqy/QsLdRw/${path}/findAll`,
    method: 'get'
  })
}
// 根据id查询联动
export function findLinkageBuId(path, ldRwId) {
  return request({
    url: `zsqy/QsLdRw/${path}/findldRwByrwid`,
    method: 'get',
    params: {
      ldRwId
    }
  })
}
// 新增设备
export function saveDeviceByPage(path, data) {
  return request({
    url: `zsqy/picedit/${path}/savePicEditDr`,
    method: 'post',
    data
  })
}
// 新增元素模板
export function saveEleByPage(path, data) {
  return request({
    url: `zsqy/picedit/${path}/save`,
    method: 'post',
    data
  })
}
// 修改页面元素设备坐标
export function updateEleByPage(path, data) {
  return request({
    url: `zsqy/picedit/${path}/updatePicEdit`,
    method: 'put',
    data
  })
}
// 修改元素模板具体配置
export function modifyEleByPage(path, data) {
  return request({
    url: `zsqy/picedit/${path}/updateElements`,
    method: 'put',
    data
  })
}
// 修改设备具体配置
export function modifyDeviceByPage(path, data) {
  return request({
    url: `zsqy/picedit/${path}/updatePicEditAndDrinfo`,
    method: 'put',
    data
  })
}
// 删除元素模板
export function deleteEleByPage(path, ids) {
  return request({
    url: `zsqy/picedit/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}

// 导出excel文件
export function outputExcel(path, picid) {
  return request({
    url: `zsqy/picedit/${path}/export`,
    method: 'get',
    responseType: 'blob',
    params: {
      picid
    }
  })
}

// 导入excel文件
export function inputExcel(path, data) {
  return request({
    url: `zsqy/picedit/${path}/import`,
    method: 'post',
    data
  })
}

// 复制粘贴页面
export function copyPage(path, picid1, picid2) {
  return request({
    url: `zsqy/picedit/${path}/copyPicedit`,
    method: 'get',
    params: {
      picid1, 
      picid2
    }
  })
}

// 复制粘贴元素
export function copyEle(path, picid1, picid2, ids) {
  return request({
    url: `zsqy/picedit/${path}/copyPiceditByids`,
    method: 'get',
    params: {
      picid1, 
      picid2,
      ids
    }
  })
}

// 查询元素模板
export function findAllEleModel(path) {
  return request({
    url: `zsqy/elemtmodle/${path}/findAllTypeMode`,
    method: 'get'
  })
}