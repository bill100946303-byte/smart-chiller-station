/** When your routing table is too long, you can split it into small modules**/
import UserLayout from '@/userlayout'
import AppMain from '@/userlayout/components/AppMain'

const deviceOperationRouter = {
  path: '/deviceoperation',
  component: UserLayout,
  alwaysShow: true,
  hidden: true,
  meta: {
    id: 8,
    title: '设备运维',
    icon: 'deviceoperation',
    roles: ['user']
  },
  children: [{
      path: 'devicemanage',
      component: AppMain,
      alwaysShow: true,
      hidden: true,
      meta: {
        id: 52,
        title: '设备管理'
      },
      children: [{
          path: 'deviceproperty',
          component: () => import('@/views/deviceoperation/devicemanage/deviceproperty'),
          hidden: true,
          meta: {
            id: 54,
            title: '设备资产'
          }
        },
        // {
        //   path: 'fixdefend',
        //   component: () => import('@/views/deviceoperation/devicemanage/fixdefend'),
        //   hidden: true,
        //   meta: {
        //     id: 55,
        //     title: '定期维护'
        //   }
        // },
        // {
        //   path: 'propertyclass',
        //   component: () => import('@/views/deviceoperation/devicemanage/propertyclass'),
        //   hidden: true,
        //   meta: {
        //     id: 56,
        //     title: '自定义设备类型'
        //   }
        // },
        // {
        //   path: 'storemanage',
        //   component: () => import('@/views/deviceoperation/devicemanage/storemanage'),
        //   hidden: true,
        //   meta: {
        //     id: 57,
        //     title: '库房管理'
        //   }
        // },
        // {
        //   path: 'docmanage',
        //   component: () => import('@/views/deviceoperation/devicemanage/docmanage'),
        //   hidden: true,
        //   meta: {
        //     id: 58,
        //     title: '知识库管理'
        //   }
        // },
        // {
        //   path: 'devicedistribute',
        //   component: () => import('@/views/deviceoperation/devicemanage/devicedistribute'),
        //   hidden: true,
        //   meta: {
        //     id: 59,
        //     title: '设备分配'
        //   }
        // },
        // {
        //   path: 'useralarmtypedistribute',
        //   component: () => import('@/views/deviceoperation/devicemanage/useralarmtypedistribute'),
        //   hidden: true,
        //   meta: {
        //     id: 60,
        //     title: '用户报警级别分配'
        //   }
        // }
      ]
    },
    {
      path: 'defendmanage',
      component: AppMain,
      alwaysShow: true,
      hidden: true,
      meta: {
        id: 53,
        title: '维护管理'
      },
      children: [
        {
          path: 'ordermanage',
          component: () => import('@/views/deviceoperation/defendmanage/ordermanage.vue'),
          hidden: true,
          meta: {
            id: 61,
            title: '工单管理'
          }
        },
        // {
        //   path: 'checklog',
        //   component: () => import('@/views/deviceoperation/defendmanage/checklog.vue'),
        //   hidden: true,
        //   meta: {
        //     id: 61,
        //     title: '巡检日志'
        //   }
        // }
      ]
    }
  ]
}

export default deviceOperationRouter
