import Cookies from 'js-cookie'
import { getLanguage, getUnitSelete } from '@/lang/index'

const state = {
  sidebar: {
    opened: Cookies.get('sidebarStatus') ? !!+Cookies.get('sidebarStatus') : true,
    withoutAnimation: false
  },
  sidebarStatus: Cookies.get('sidebarStatus'),
  device: 'desktop',
  size: Cookies.get('size') || 'medium',
  language: getLanguage(),
  unitSelete: getUnitSelete(),
}

const mutations = {
  TOGGLE_SIDEBAR: state => {
    state.sidebar.opened = !state.sidebar.opened
    state.sidebar.withoutAnimation = false
    if (state.sidebar.opened) {
      Cookies.set('sidebarStatus', 1)
    } else {
      Cookies.set('sidebarStatus', 0)
    }
  },
  CLOSE_SIDEBAR: (state, withoutAnimation) => {
    Cookies.set('sidebarStatus', 0)
    state.sidebar.opened = false
    state.sidebar.withoutAnimation = withoutAnimation
  },
  TOGGLE_DEVICE: (state, device) => {
    state.device = device
  },
  SET_SIZE: (state, size) => {
    state.size = size
    Cookies.set('size', size)
  },
  SET_LANGUAGE: (state, language) => {
    state.language = language
    Cookies.set('language', language, { expires: 365 })
  },
  SET_UNITSELETE: (state, unitSelete) => {
    state.unitSelete = unitSelete
    // Cookies.set('unitSelete', unitSelete)
    Cookies.set('unitSelete', unitSelete, { expires: 365 }) // 设置过期时间为365天
  },
}

const actions = {
  toggleSideBar({ commit }) {
    commit('TOGGLE_SIDEBAR')
  },
  closeSideBar({ commit }, { withoutAnimation }) {
    commit('CLOSE_SIDEBAR', withoutAnimation)
  },
  toggleDevice({ commit }, device) {
    commit('TOGGLE_DEVICE', device)
  },
  setSize({ commit }, size) {
    commit('SET_SIZE', size)
  },
  setLanguage({ commit }, language) {
    commit('SET_LANGUAGE', language)
  },
  setUnitSelete({ commit }, unitSelete) {
    commit('SET_UNITSELETE', unitSelete)
  },
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}
