/** When your routing table is too long, you can split it into small modules**/
import UserLayout from '@/userlayout'
import AppMain from '@/userlayout/components/AppMain'

const userManageRouter = {
  path: '/usermanage',
  component: UserLayout,
  alwaysShow: true,
  hidden: true,
  meta: {
    id: 11,
    title: '用户管理',
    icon: 'usermanage',
    roles: ['user']
  },
  children: [{
      path: 'userdispose',
      component: AppMain,
      alwaysShow: true,
      hidden: true,
      meta: {
        id: 68,
        title: '用户配置'
      },
      children: [{
          path: 'useredit',
          component: () => import('@/views/usermanage/userdispose/useredit'),
          hidden: true,
          meta: {
            id: 70,
            title: '用户编辑'
          }
        },
        {
          path: 'permissionmanage',
          component: () => import('@/views/usermanage/userdispose/permissionmanage'),
          hidden: true,
          meta: {
            id: 71,
            title: '权限管理'
          }
        }
      ]
    },
    {
      path: 'departmentmanage',
      component: AppMain,
      alwaysShow: true,
      hidden: true,
      meta: {
        id: 69,
        title: '部门管理'
      },
      children: [{
          path: 'departmentdispose',
          component: () => import('@/views/usermanage/departmentmanage/departmentdispose'),
          hidden: true,
          meta: {
            id: 72,
            title: '部门配置'
          }
        },
        {
          path: 'departmentpage',
          component: () => import('@/views/usermanage/departmentmanage/departmentpage'),
          hidden: true,
          meta: {
            id: 73,
            title: '部门页面'
          }
        },
        {
          path: 'departmentdevice',
          component: () => import('@/views/usermanage/departmentmanage/departmentdevice'),
          hidden: true,
          meta: {
            id: 74,
            title: '部门设备'
          }
        }
      ]
    }
  ]
}

export default userManageRouter
