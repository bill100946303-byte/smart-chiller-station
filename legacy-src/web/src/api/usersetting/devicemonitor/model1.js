import request from '@/utils/request'

// 获取项目运行时间
export function getRunTime (path) {
  return request({
    url: `zsqy/appinfo/${path}/findsumday`,
    method: 'get'
  })
}

// 查询背景图片
export function findBGImg (path, picid) {
  return request({
    url: `zsqy/picedit/${path}/findImagesByPicid`,
    method: 'get',
    params: {
      picid
    }
  })
}
// 根据页面id查询所有设备状态
export function findDeviceStateByPage (path, picid) {
  return request({
    url: `zsqy/picedit/${path}/findDrStateByPicid`,
    method: 'get',
    params: {
      picid
    }
  })
}
// 点击设备查询设备列表
export function findDeviceTableByPage (path, drtypeid, drinfoArry) {
  return request({
    url: `zsqy/picedit/${path}/findDrinfoRegValue`,
    method: 'get',
    params: {
      drtypeid,
      drinfoArry
    }
  })
}
// 查询门禁记录
export function findMJRecords (data) {
  return request({
    url: 'zsqy/other/querydata/sqserverByRdid',
    method: 'post',
    data
  })
}
// 点击门禁获取视频参数
export function findMJSpId (dBname, rdid, etime) {
  return request({
    url: 'zsqy/other/querydata/querySpid',
    method: 'get',
    params: {
      dBname,
      rdid,
      etime
    }
  })
}
// 查询门禁绑定的视频id
export function searchMJSpId (path, mjid) {
  return request({
    url: `zsqy/mjsp/${path}/findsp`,
    method: 'get',
    params: {
      mjid
    }
  })
}
// 修改门禁绑定的视频id
export function updateMJSpId (path, mjid, spid) {
  return request({
    url: `zsqy/mjsp/${path}/zjxg`,
    method: 'get',
    params: {
      mjid,
      spid
    }
  })
}
// 删除门禁绑定的视频id
export function deleteMJSpId (path, mjid) {
  return request({
    url: `zsqy/mjsp/${path}/zjxg`,
    method: 'get',
    params: {
      mjid
    }
  })
}
// 查询所有阈值
export function findSub (path) {
  return request({
    url: `zsqy/subinfo/${path}/findAll`,
    method: 'get'
  })
}
// 是否显示结构图
export function showPic (path, drid) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findDrtypeinfo`,
    method: 'get',
    params: {
      drid
    }
  })
}
// 查询设备信息（采集参数）
export function getDeviceInfo (path, drid) {
  return request({
    url: `zsqy/reg/${path}/findAllByDrid`,
    method: 'get',
    params: {
      drid
    }
  })
}
// 查询设备信息（资产信息）
export function getPropertyInfo (path, drid) {
  return request({
    url: `zsqy/drinfo/${path}/findDr`,
    method: 'get',
    params: {
      drid
    }
  })
}
// 查询设备信息（历史数据）
export function getHistoryData (path, data) {
  return request({
    url: `zsqy/regdata/${path}/findObjByDrid`,
    method: 'post',
    data
  })
}
// 查询设备信息（报警记录）
export function getAlarmRecords (path, data) {
  return request({
    url: `zsqy/qsAlarmlog/${path}/findObjectByDrid`,
    method: 'post',
    data
  })
}
// 查询结构图变量参数
export function getRegParams (path, drid, regListShowLevels) {
  return request({
    url: `zsqy/reg/${path}/findRegByDrListShow`,
    method: 'get',
    params: {
      drid,
      regListShowLevels
    }
  })
}
// 根据变量id查询变量值
export function getRegValue (path, ids) {
  return request({
    url: `zsqy/reg/${path}/findRegById`,
    method: 'get',
    params: {
      ids
    }
  })
}
// 根据变量id查询折线图数据
export function getRegData (path, ids) {
  return request({
    url: `zsqy/regdata/${path}/findRegdataById`,
    method: 'get',
    params: {
      ids
    }
  })
}
// 根据设备类型和设备id查询变量
export function getRegByDevice (path, picid, drtypeid) {
  return request({
    url: `zsqy/picedit/${path}/queryDrinfoReg`,
    method: 'get',
    params: {
      picid,
      drtypeid
    }
  })
}

// 查询设备类型饼图（新）
export function findDrStateByDrtype (path, drtypeid) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findDrStateByDrtype`,
    method: 'get',
    params: {
      drtypeid
    }
  })
}

// 查询设备类型（环图饼图）
export function getDeviceTypeData (path, drtypeid) {
  return request({
    url: `zsqy/Drtypeinfo/${path}/findAllDrtypevo`,
    method: 'get',
    params: {
      drtypeid
    }
  })
}
// 查询能耗信息(柱状图，曲线)
export function getEnergyData (path, id) {
  return request({
    url: `zsqy/queryAllenergy/${path}/findSumenergyByidtype`,
    method: 'get',
    params: {
      id,
      type: 3
    }
  })
}

export function getTotalEnergyData (path, type) {
  return request({
    url: `zsqy/queryAllenergy/${path}/findAppTotalEnergyBytype`,
    method: 'get',
    params: {
      type
    }
  })
}

export function getTotalEnergyDataNew (path, type) {
  return request({
    url: `zsqy/queryAllenergy/${path}/findAppTotalEnergyBytypeNew`,
    method: 'get',
    params: {
      type
    }
  })
}

export function getSortEnergyPie (path) {
  return request({
    url: `zsqy/queryAllenergy/${path}/findSortenergy`,
    method: 'get'
  })
}

export function getSortEnergyBar (path, type) {
  return request({
    url: `zsqy/queryAllenergy/${path}/findSortenergyBytype`,
    method: 'get',
    params: {
      type
    }
  })
}

// 查询报警信息（环图饼图）
export function getAlarmData (path) {
  return request({
    url: `zsqy/qsAlarmlog/${path}/findEcharsByAlarm`,
    method: 'get'
  })
}
export function getAlarmLineData (path, type) {
  return request({
    url: `zsqy/qsAlarmlog/${path}/findSumAlarmBytype`,
    method: 'get',
    params: {
      type
    }
  })
}
// 查询报警信息（表格）
export function getAlarmTableData (path) {
  return request({
    url: `zsqy/qsAlarmlog/${path}/findAlarmListHome`,
    method: 'get'
  })
}

// 查询工单信息（环图饼图）
export function getOrderData (path) {
  return request({
    url: `zsqy/qsworkorder/${path}/findEC`,
    method: 'get'
  })
}
// 查询工单信息（表格）
export function getOrderTableData (path) {
  return request({
    url: `zsqy/qsworkorder/${path}/findWorkOrderList`,
    method: 'get'
  })
}

// 查询总能耗
export function getTotalEnergy (path, id) {
  return request({
    url: `zsqy/queryAllenergy/${path}/findSumenergyByid`,
    method: 'get',
    params: {
      id,
      type: 3
    }
  })
}
// 修改阈值
export function updateRegValue (path, appid, tagname, tagvalue) {
  return request({
    url: `zsqy/qsLdJgr/${path}/implement`,
    method: 'get',
    params: {
      appid,
      tagname,
      tagvalue
    }
  })
}
// 按钮点击事件（操作变量）
export function operationRegs (path,data) {
  return request({
    url: `zsqy/qstag/${path}/doimplements`,
    method: 'get',
    params: data
  })
}
// 改变变量默认值
export function changeReg (path, data) {
  return request({
    url: `zsqy/reg/${path}/updateRegValue`,
    method: 'put',
    data
  })
}
// 查询所有巡更记录
export function findAllXungeng (data) {
  return request({
    url: 'zsqy/access/findMainDB',
    method: 'post',
    data
  })
}
// 查询所有巡更地点
export function findAllXungengPlace () {
  return request({
    url: 'zsqy/access/findTcard',
    method: 'get'
  })
}
// 查询所有巡更设备
export function findAllXungengDevice () {
  return request({
    url: 'zsqy/access/findTreader',
    method: 'get'
  })
}

// 查询所有门禁记录
export function findAllMenjin (data) {
  return request({
    url: 'zsqy/access/findSqlServerDB',
    method: 'post',
    data
  })
}

// 查询动态数据库
export function findTrendsDB (path, id) {
  return request({
    url: `zsqy/Otherdb/${path}/findObjectById`,
    method: 'get',
    params: {
      id
    }
  })
}

// 查询动态数据库
export function findTrendsDBData (path, data) {
  return request({
    url: `zsqy/Otherdb/${path}/findObjectByOtherdb`,
    method: 'post',
    data
  })
}

// 根据设备类型id查询设备类型读写参数
export function findDeviceInfoById (path, drtypeid) {
  return request({
    url: `zsqy/Drtypemode/${path}/findAllWrite`,
    method: 'get',
    params: {
      drtypeid
    }
  })
}

// 批量修改设备类型模板参数
export function updateDeviceTypeReg (path, drtypeid, appid, msg) {
  return request({
    url: `zsqy/Drtypemode/${path}/writeDrtypeMode`,
    method: 'get',
    params: {
      drtypeid,
      appid,
      msg
    }
  })
}

// 根据联动任务id触发联动结果
export function getLinkageResultByTask (path, ldRwId, appid) {
  return request({
    url: `zsqy/qsLdJgr/${path}/doQsLdJg`,
    method: 'get',
    params: {
      ldRwId,
      appid
    }
  })
}
