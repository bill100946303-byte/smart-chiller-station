import axios from 'axios'
import MessageBox from 'element-ui/lib/message-box'
import Message from 'element-ui/lib/message'
import store from '@/store'
import router from '@/router'
import {
  getToken
} from '@/utils/auth'
import i18n from '@/lang'

const service = axios.create({
  // baseURL: process.env.NODE_ENV === 'production'
  //   ? 'https://' + window.location.host + '/'
  //   : process.env.VUE_APP_BASE_URL, //本地服务
  baseURL: process.env.VUE_APP_BASE_URL, //本地服务
  withCredentials: true, // send cookies when cross-domain requests
  timeout: 500000 // request timeout
})

// request interceptor
service.interceptors.request.use(
  config => {
    // do something before request is sent
    if (store.getters.token) {
      // let each request carry token
      // ['X-Token'] is a custom headers key
      // please modify it according to the actual situation
      config.headers['ZSQY_TEST'] = getToken()
    }
    let language = null
    if (i18n.locale === 'vi') {
      language = 'vie'
    } else {
      language = i18n.locale
    }
    // console.log('语言', i18n.locale)
    config.params = {
      ...config.params,
      language,
      unit: store.getters.unitSelete,
      modelKey: store.getters.modelKey,
      template: store.getters.template
    }
    return config
  },
  error => {
    // do something with request error
    console.log(error) // for debug
    return Promise.reject(error)
  }
)
// response interceptor
service.interceptors.response.use(
  /**
   * If you want to get http information such as headers or status
   * Please return  response => response
   */

  /**
   * Determine the request status by custom code
   * Here is just an example
   * You can also judge the status by HTTP Status Code
   */
  response => {
    const headers = response.headers
    // if (headers['content-type'] === 'application/vnd.ms-excel;charset=UTF-8') {
    if (headers['content-type'] === 'application/vnd.ms-excel;charset=utf-8' || headers['content-type'] === 'application/vnd.ms-excel;charset=UTF-8') {
      return response.data
    }
    const res = response.data
    // if the custom code is not 20000, it is judged as an error.
    if (res.status !== 20000) {
      Message({
        message: res.message || 'error',
        type: 'error',
        duration: 5 * 1000
      })
      // 50008: Illegal token; 50012: Other clients logged in; 50014: Token expired;
      if (res.status === 50008) {
        // to re-login
        MessageBox.confirm('你的账号可能已在别处登录, 你可以选择取消留在本页面, 或者重新登录', {
          confirmButtonText: '重新登录',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(() => {
          store.dispatch('user/logout').then(() => {
            location.reload()
          })
        })
      }
      // 返回失败结果
      if (res.status === 50009) {
        Message({
          message: res.msg,
          type: 'error',
          duration: 5 * 1000
        })
      }
      // 未授权
      if (res.status === 50000) {
        window.localStorage.setItem('status', res.status)
        window.localStorage.setItem('code', res.msg)
        Message({
          message: '温馨提示：请授权后再登录！',
          type: 'warning',
          duration: 5 * 1000
        })
      }
      return Promise.reject(res.message || 'error')
    } else {
      return res
    }
  },
  error => {
    if (error.response) {
      if (error.response.data.status === 50008) {
        MessageBox.confirm('你的账号可能已在别处登录, 你可以选择取消留在本页面, 或者重新登录', {
          confirmButtonText: '重新登录',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(() => {
          store.dispatch('user/logout').then(() => {
            location.reload()
          })
        })
      } else if (error.response.data.status === 50007) {
        // session失效
        router.push("/")
      } else {
        Message({
          message: error.response.data.message,
          type: 'error',
          duration: 5 * 1000
        })
      }
    } else if (error.request) {
      console.log(error.request);
    } else {
      console.log('Error', error.message);
    }
    return Promise.reject(error)
  }
)

export default service
