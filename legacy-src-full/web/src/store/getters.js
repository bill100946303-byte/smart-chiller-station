const getters = {
  appexplain: state => state.project.appexplain,// 暂时不用
  sidebar: state => state.app.sidebar,
  sidebarStatus: state => state.app.sidebarStatus,
  size: state => state.app.size,
  device: state => state.app.device,
  visitedViews: state => state.tagsView.visitedViews,
  cachedViews: state => state.tagsView.cachedViews,
  token: state => state.user.token,
  avatar: state => state.user.avatar,
  userid: state => state.user.userid,
  name: state => state.user.name,
  appusergroup: state => state.user.appusergroup,
  roles: state => state.user.roles,
  matureTime: state => state.user.matureTime,
  menuids: state => state.project.menuids,
  permission_routes: state => state.permission.routes,
  errorLogs: state => state.errorLog.logs,
  project: state => state.project.project,
  city: state => state.project.city,
  leave: state => state.project.leave,
  IP: state => state.project.IP,
  control: state => state.project.control,
  logo: state => {
    return state.project.logo&&state.project.logo!== 'undefined'?JSON.parse(state.project.logo):{}
  },
  id: state => state.project.id,
  path: state => state.project.path,
  sidelist: state => state.project.sidelist,
  projectTypeId: state => state.project.projectTypeId,
  permission: state => state.user.permission,
  colortheme: state => state.user.colortheme,
  websocket: state => state.websocket.websocket,
  runlist: state => state.front.runlist.map((item, index) => {
    item.id = 'run' + index
    return item
  }),
  runlist2: state => state.front.runlist2.map((item, index) => {
    item.id = 'run2' + index
    // console.log('index','run2'+index)
    return item
  }),
  runleft: state => state.front.runleft,
  runleft2: state => state.front.runleft2,
  subs: state => state.front.subs,
  navtop: state => state.front.navtop,
  totalPower: state => state.front.totalPower,
  HotStationTotalPower: state => state.front.HotStationTotalPower,
  ontime: state => state.front.ontime,
  coldStationCop: state => state.front.coldStationCop,
  thermalUnbalanceRate: state => state.front.thermalUnbalanceRate,
  chillerCop: state => state.front.chillerCop,
  chilledWaterPumpCop: state => state.front.chilledWaterPumpCop,
  coolingTowerCop: state => state.front.coolingTowerCop,
  coolingWaterPumpCop: state => state.front.coolingWaterPumpCop,
  baseInfo: state => state.front.baseInfo,
  baseInfo2: state => state.front.baseInfo2,
  dianInfo: state => state.front.dianInfo,
  alarmData: state => state.front.alarmData,
  clearAlarmSound: state => state.front.clearAlarmSound,
  iframeSelection: state => state.front.iframeSelection,
  modelKey: state => state.user.modelKey,
  template: state => state.user.template,
  language: state => state.app.language,
  unitSelete: state => state.app.unitSelete,

  ontimeRT: state => state.front.ontimeRT,
  ontimeHot: state => state.front.ontimeHot,
  coldStationCopRT: state => state.front.coldStationCopRT,
  chillerCopRT: state => state.front.chillerCopRT,
  chilledWaterPumpCopRT: state => state.front.chilledWaterPumpCopRT,
  coolingWaterPumpCopRT: state => state.front.coolingWaterPumpCopRT,
  coolingTowerCopRT: state => state.front.coolingTowerCopRT,

  coldStationCopHot: state => state.front.coldStationCopHot,
  chillerCopHot: state => state.front.chillerCopHot,
  chilledWaterPumpCopHot: state => state.front.chilledWaterPumpCopHot,
}
export default getters