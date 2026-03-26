import router from './router'
import store from './store'
import Message from 'element-ui/lib/message'
import NProgress from 'nprogress' // progress bar
import 'nprogress/nprogress.css' // progress bar style
import {
  getToken
} from '@/utils/auth' // get token from cookie
import getPageTitle from '@/utils/get-page-title'

NProgress.configure({
  showSpinner: false
}) // NProgress Configuration

const whiteList = ['/login', '/auth-redirect'] // no redirect whitelist

router.beforeEach(async (to, from, next) => {
  // start progress bar
  NProgress.start()

  // 设置页面标题
  document.title = getPageTitle(to.meta.title)

  // 判断是否登录
  const hasToken = getToken()

  if (hasToken) {
    // 已经得到token，判断权限为0还是1
    const permission = store.getters.permission
    if (permission == 1) {
      // 权限为工程师
      if (to.path === '/login') {
        // 如果已经登录，跳转项目配置界面
        next({
          path: '/basesetting/objectmanage'
        })
        NProgress.done()
      } else {
        // 检测用户是否已经通过getInfo方法获得权限,roles.length>0 证明已获得权限
        const hasRoles = store.getters.roles && store.getters.roles.length > 0
        if (hasRoles) {
          next()
        } else {
          try {
            // 获取用户信息
            // 角色必须是个数组
            //这里，和下面的87行的，2选一，这里应该是第一次,userhomepage/index里面有一次，map里面有一次
            const {
              roles
            } = await store.dispatch('user/getInfo')
            // generate accessible routes map based on roles
            const accessRoutes = await store.dispatch('permission/generateRoutes', roles)
            // dynamically add accessible routes
            router.addRoutes(accessRoutes)
            // hack method to ensure that addRoutes is complete
            // set the replace: true, so the navigation will not leave a history record
            next({
              ...to,
              replace: true
            })
          } catch (error) {
            // remove token and go to login page to re-login
            await store.dispatch('user/resetToken')
            Message.error(error || 'Has Error')
            next(`/login?redirect=${to.path}`)
            NProgress.done()
          }
        }
      }
    } else {
      // 权限为用户
      if (to.path === '/login') {
        // 如果已经登录，跳转项目选择界面
        next({
          path: '/'
        })
        NProgress.done()
      } else {
        // 检测用户是否已经通过getInfo方法获得权限,roles.length>0 证明已获得权限
        const hasRoles = store.getters.roles && store.getters.roles.length > 0
        if (!hasRoles) {
          try {
            // console.log(777777777)
            const {
              roles
            } = await store.dispatch('user/getInfo') // 第1次调用user/getInfo
            // generate accessible routes map based on roles
            const accessRoutes = await store.dispatch('permission/generateRoutes', roles)
            // dynamically add accessible routes
            router.addRoutes(accessRoutes)
            next({
              ...to,
              replace: true
            })
          } catch (error) {
            // remove token and go to login page to re-login
            await store.dispatch('user/resetToken')
            Message.error(error || 'Has Error')
            next(`/login?redirect=${to.path}`)
            NProgress.done()
          }
        } else {
          next()
        }
      }
    }
  } else {
    /* has no token*/
    if (whiteList.indexOf(to.path) !== -1) {
      // in the free login whitelist, go directly
      next()
    } else {
      // other pages that do not have permission to access are redirected to the login page.
      next(`/login?redirect=${to.path}`)
      NProgress.done()
    }
  }
})

router.afterEach(() => {
  // finish progress bar
  NProgress.done()
})
