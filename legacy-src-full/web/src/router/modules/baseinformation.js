/** When your routing table is too long, you can split it into small modules**/

import Layout from '@/layout'

const baseinformationRouter = {
  path: '/baseinformation',
  component: Layout,
  redirect: 'baseinformation/BuildingInformation',
  name: 'BaseInformation',
  meta: {
    title: '基本信息',
    icon: 'baseinfo',
    roles: ['edit']
  },
  children: [{
    path: 'ProjectInformation',
    component: () => import('@/views/baseinformation/ProjectInformation'),
    name: 'ProjectInformation',
    meta: {
      title: '项目信息'
    }
  },
  // {
  //   path: 'Configuration',
  //   component: () => import('@/views/baseinformation/Configuration'),
  //   name: 'Configuration',
  //   meta: {
  //     title: '环境工况配置'
    //   }
    // },
    {
      path: 'BuildingInformation',
      component: () => import('@/views/baseinformation/BuildingInformation.vue'),
      name: 'BuildingInformation',
      meta: {
        title: '楼栋信息'
      }
    },
    {
      path: 'FloorInformation',
      component: () => import('@/views/baseinformation/FloorInformation'),
      name: 'FloorInformation',
      meta: {
        title: '楼层信息'
      }
    },
    // {
    //   path: 'AreaInformation',
    //   component: () => import('@/views/baseinformation/area'),
    //   name: 'AreaInformation',
    //   meta: {
    //     title: '区域信息'
    //   }
    // },
    {
      path: 'ImgManage',
    component: () => import('@/views/baseinformation/ImgManage'),
    name: 'ImgManage',
    meta: {
      title: '图片管理'
    }
  },
  {
    path: 'ComponentManage',
    component: () => import('@/views/baseinformation/ComponentManage'),
    name: 'ComponentManage',
    meta: {
      title: '参数阈值管理'
    }
  }, // 阈值管理

  ]
}

export default baseinformationRouter
