import {
  getProject,
  setProject,
  getProjectId,
  setProjectId,
  setPath,
  getPath,
  getProjectTypeId,
  setProjectTypeId,
  getMenuids,
  setMenuids,
  setCity,
  getCity,
  setIP,
  getIP,
  setLogo,
  getLogo,
  setControl,
  getAppexplain,
  setAppexplain
} from '@/utils/auth'
import {
  getMenuId
} from '@/api/usersetting/userpagehome'
import {saveUserInfo} from "@/api/usersetting/userpagehome";

function resolveProjectGroupId(projectInfo = {}) {
  const rawAppInfo = projectInfo.appinfo || projectInfo.appInfo || projectInfo.logo || null
  let nestedProjectInfo = {}
  if (rawAppInfo && typeof rawAppInfo === 'string') {
    try {
      nestedProjectInfo = JSON.parse(rawAppInfo)
    } catch (error) {
      nestedProjectInfo = {}
    }
  } else if (rawAppInfo && typeof rawAppInfo === 'object') {
    nestedProjectInfo = rawAppInfo
  }
  return (
    projectInfo.appuserground ||
    projectInfo.appusergroup ||
    projectInfo.appusergroupid ||
    projectInfo.appUserGroupId ||
    projectInfo.appgroupid ||
    projectInfo.appGroupId ||
    projectInfo.groupid ||
    projectInfo.groupId ||
    projectInfo.usergroupid ||
    projectInfo.userGroupId ||
    nestedProjectInfo.appuserground ||
    nestedProjectInfo.appusergroup ||
    nestedProjectInfo.appusergroupid ||
    nestedProjectInfo.appUserGroupId ||
    nestedProjectInfo.appgroupid ||
    nestedProjectInfo.appGroupId ||
    nestedProjectInfo.groupid ||
    nestedProjectInfo.groupId ||
    nestedProjectInfo.usergroupid ||
    nestedProjectInfo.userGroupId ||
    ''
  )
}

const state = {
  id: getProjectId(),
  project: getProject(),
  path: getPath(),
  projectTypeId: getProjectTypeId(),
  city: getCity(),
  IP: getIP(),
  logo: getLogo(),
  menuids: getMenuids(),
  sidelist: [],
  leave: false,
  control: "",
  appexplain: getAppexplain()
}

const mutations = {
  SET_APPEXPLAIN: (state, appexplain) => {
    state.appexplain = appexplain
  },
  SET_PROJECTID: (state, appid) => {
    state.id = appid
  },
  SET_PROJECT: (state, project) => {
    state.project = project
  },
  SET_PATH: (state, path) => {
    state.path = path
  },
  SET_PROJECTTYPEID: (state, projectTypeId) => {
    state.projectTypeId = projectTypeId
  },
  SET_MENUIDS: (state, menuids) => {
    state.menuids = menuids
  },
  SET_CITY: (state, city) => {
    state.city = city
  },
  SET_IP: (state, IP) => {
    state.IP = IP
  },
  SET_LOGO: (state, logo) => {
    state.logo = logo
  },
  close: (state, info) => {
    state.leave = info;
  },
  SET_SIDELIST: (state, info) => {
    state.sidelist = info
  },
  SET_CONTTROL: (state, control) => {
    state.control = control
  },
}

const actions = {
  selectProject({
    commit
  }, selectObj) {
    return new Promise(resolve => {
      let appid = selectObj.appid
      let project = selectObj.appName
      let path = appid + project
      let projectTypeId = selectObj.apptypeid
      let appexplain = selectObj.appexplain

      commit('SET_APPEXPLAIN', appexplain)
      commit('SET_PROJECTID', appid)
      commit('SET_PROJECT', project)
      commit('SET_PATH', path)
      commit('SET_LOGO', JSON.stringify(selectObj))
      commit('SET_PROJECTTYPEID', projectTypeId)
      setAppexplain(appexplain)
      setProjectId(appid)
      setProject(project)
      setPath(path)
      setProjectTypeId(projectTypeId)
      resolve()
    })
  },
  getMenuId({
    commit
  }, projectInfo) {
    const {
      appid,
      appName,
      apptypeid,
      appexplain,
      city,
      ipaddr,
      appport,
      appinfo,
      control,
    } = projectInfo
    const projectGroupId = resolveProjectGroupId(projectInfo)
    // console.log(projectInfo, "projectInfo");
    return new Promise((resolve, reject) => {
      let dBname = appid + appName
      if (!projectGroupId) {
        commit('SET_MENUIDS', [])
        commit('SET_PROJECT', appName)
        commit('SET_PATH', dBname)
        commit('SET_PROJECTID', appid)
        commit('SET_PROJECTTYPEID', apptypeid)
        commit('SET_APPEXPLAIN', appexplain)
        commit('SET_CONTTROL', control)
        commit('SET_CITY', city)
        commit('SET_IP', ipaddr + ":" + appport)
        commit('SET_LOGO', appinfo ? JSON.stringify(appinfo) : JSON.stringify(projectInfo))
        setMenuids(JSON.stringify([]))
        setProject(appName)
        setPath(dBname)
        setProjectTypeId(apptypeid)
        setAppexplain(appexplain)
        setControl(control)
        setProjectId(appid)
        setCity(city)
        setIP(ipaddr + ":" + appport)
        setLogo(appinfo ? JSON.stringify(appinfo) : JSON.stringify(projectInfo))
        resolve({ degraded: true })
        return
      }
      var formData = new FormData();
      formData.append("username", projectInfo.username);
      formData.append("userid", projectInfo.userid);
      formData.append("state", 2);
      // 登录记录，切换项目记录
      saveUserInfo(
          dBname,
          formData)
          .then()
          .catch(console.log);

      getMenuId(dBname, projectGroupId).then(res => {
        commit('SET_MENUIDS', res.data)
        commit('SET_PROJECT', appName)
        commit('SET_PATH', dBname)
        commit('SET_PROJECTID', appid)
        commit('SET_PROJECTTYPEID', apptypeid)
        commit('SET_APPEXPLAIN', appexplain)
        commit('SET_CONTTROL', control)
        commit('SET_CITY', city)
        commit('SET_IP', ipaddr + ":" + appport)
        commit('SET_LOGO', appinfo ? JSON.stringify(appinfo) : null)
        setMenuids(JSON.stringify(res.data))
        setProject(appName)
        setPath(dBname)
        setProjectTypeId(apptypeid)
        setAppexplain(appexplain)
        setControl(control)
        setProjectId(appid)
        setCity(city)
        setIP(ipaddr + ":" + appport)
        setLogo(appinfo ? JSON.stringify(appinfo) : null)
        resolve()
      }).catch(error => {
        reject(error)
      })
    })
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}
