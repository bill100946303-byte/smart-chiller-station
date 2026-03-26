import {
  login,
  getInfo
} from '@/api/user'
import Storage from '@/utils/localstorage'
import {
  getToken,
  setToken,
  removeToken,
  getPermission,
  setPermission,
  removeMenuids,
  removePermission,
  removePath,
  removeProjectTypeId,
  removeProject,
  removeProjectId,
  removeCity,
  removeIP,
  removeControl
} from '@/utils/auth'
import CryptoJS from "crypto-js";
import Cookies from "js-cookie";
import {number} from "echarts/lib/export";
const state = {
  token: getToken(),
  userid: '',
  name: '',
  appusergroup: [],
  roles: [],
  colortheme: 'dark',
  matureTime: '', // 授权到期时间
  permission: getPermission(),
  modelKey: Cookies.get('SET_MODELKEY'),
  template: '1',
}
// 设置用户信息
const mutations = {
  // 记录楼层信息
  SET_MODELKEY: (state, modelKey) => {
    state.modelKey = modelKey;
    console.log('SET_MODELKEY', modelKey)
    Cookies.set('SET_MODELKEY', modelKey)
  },
  SET_TEMPLATE: (state, template) => {
    state.template = template;
    console.log('SET_TEMPLATE', template)
    // Cookies.set('SET_TEMPLATE', template)
  },
  SET_TOKEN: (state, token) => {
    state.token = token
  },
  SET_USERID: (state, userid) => {
    state.userid = userid
  },
  SET_NAME: (state, name) => {
    state.name = name
  },
  SET_APPUSERGROUP: (state, appusergroup) => {
    state.appusergroup = appusergroup
  },
  SET_ROLES: (state, roles) => {
    state.roles = roles
  },
  SET_MATURETIME: (state, matureTime) => {
    state.matureTime = matureTime
  },
  SET_PERMISSION: (state, permission) => {
    state.permission = permission
  },
  SET_THEME: (state, info) => {
    state.colortheme = info ? info : 'dark'
  }
}
// 用户登录，获取信息，用户退出，更新token，变更权限
const actions = {
  // user login 用户登录
  login({
    commit
  }, userInfo) {
    const {
      username,
      password,
      checked
    } = userInfo
    return new Promise((resolve, reject) => {
      login(username.trim(), password).then(res => {
        commit('SET_TOKEN', res.data.token)
        commit('SET_PERMISSION', res.data.user.role)
        setToken(res.data.token)
        setPermission(res.data.user.role)
        if (checked) {
          let pasvalue = CryptoJS.AES.encrypt(password, 'zs_qy')// 记住密码加密
          Storage.set('username', username)
          Storage.set('password', pasvalue)
        } else {
          Storage.clear()
        }
        resolve()
      }).catch(error => {
        reject(error)
      })
    })
  },

  // get user info 获取用户信息
  getInfo({
    commit,
    state
  }) {
    return new Promise((resolve, reject) => {
      getInfo(state.token).then(res => {

        const data = {
          appusergroup: res.data.appusergroup,
          roles: res.data.role == 1 ? ['edit'] : ['user'],
          userid: res.data.id,
          name: res.data.username,
          matureTime: res.data.xmsqtime,
          permission: res.data.role,
          // colortheme:res.data.skinColor
        }
        if (!data || !data.roles || data.roles.length <= 0) {
          reject('验证失败，请重新登录！')
        }
        // console.log('getInfo', data.appusergroup)
        commit('SET_APPUSERGROUP', data.appusergroup)
        commit('SET_USERID', data.userid)
        commit('SET_NAME', data.name)
        commit('SET_ROLES', data.roles)
        commit('SET_MATURETIME', data.matureTime)
        // commit('SET_THEME', data.colortheme)
        resolve(data)
      }).catch(error => {
        reject(error)
      })
    })
  },

  // user logout 用户退出
  logout({
    commit
  }) {
    return new Promise(resolve => {
      commit('SET_TOKEN', '')
      commit('SET_ROLES', [])
      commit('SET_MODELKEY', '')
      removeToken()
      removeProject()
      removeProjectId()
      removePath()
      removeProjectTypeId()
      removePermission()
      removeMenuids()
      removeCity()
      removeIP()
      resolve()
      removeControl()
    })
  },

  // remove token
  resetToken({
    commit
  }) {
    return new Promise(resolve => {
      commit('SET_TOKEN', '')
      commit('SET_ROLES', [])
      removeToken()
      resolve()
    })
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}
