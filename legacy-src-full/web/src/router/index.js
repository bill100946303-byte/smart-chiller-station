import Vue from 'vue'
import Router from 'vue-router'
/* Layout */
import Layout from '@/layout'
import frontRouter from './modules/front'
/* Router Modules */
import baseinformationRouter from './modules/baseinformation'
import runLogRouter from './modules/electricpoweroperation/runlog'
import energyManageRouter from './modules/electricpoweroperation/energymanage'
import deviceOperationRouter from './modules/electricpoweroperation/deviceoperation'
import userManageRouter from './modules/electricpoweroperation/usermanage'

Vue.use(Router)

// 全局通用路由
export const constantRoutes = [
  {
    path: '/login',
    component: () => import('@/views/login/index'),
    hidden: false,
  },
  {
    path: '/404',
    component: () => import('@/views/error-page/404'),
    hidden: false,
  },
  {
    path: '/401',
    component: () => import('@/views/error-page/401'),
    hidden: false,
  },
  {
    path: "/test",
    component: () => import("@/views/test"),
    hidden: false,
  },
]


// 根据角色来判断路由
export const asyncRoutes = [
  // 工程师模块
  {
    path: '/basesetting',
    component: Layout,
    redirect: '/basesetting/objectmanage/index',
    alwaysShow: true, // will always show the root menu
    name: 'BaseSetting',
    meta: {
      title: '云项目设置',
      icon: 'element',
      roles: ['edit'], // you can set roles in root nav
    },
    children: [
      {
        path: 'objectmanage',
        component: () => import('@/views/basesetting/objectmanage/index'),
        name: 'ObjectManage',
        meta: {
          title: '项目管理',
        },
      },
      {
        path: 'usermanage',
        component: () => import('@/views/basesetting/usermanage/index'),
        name: 'UserManage',
        meta: {
          title: '用户管理',
        },
      },

    ],
  }, // 基本设置

  {
    path: '/projectrecover',
    component: Layout,
    meta: {
      roles: ['edit'],
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/projectrecover/index'),
        name: 'ProjectRecover',
        meta: {
          title: '项目回收站',
          icon: 'refusebin',
          affix: true,
        },
      },
    ],
  }, // 项目回收站

  baseinformationRouter, // 基本信息
  // frontRouter.environment, //环境工况
  // frontRouter.operation,
  frontRouter.consumption, // 能耗分析
  frontRouter.energy, // 能效分析
  frontRouter.PerformanceReport, // 能效报告
  frontRouter.alertrun, // 报警运维
  frontRouter.log,// 冷站日志
  frontRouter.params,// 能源参数
  // frontRouter.work, // 工单管理
    // frontRouter.report,// 报表记录
  frontRouter.dataDetails, // 数据曲线
  frontRouter.operationRecords, // 操作记录
  frontRouter.meteringInstrument,// 计量仪表、能耗抄表
  frontRouter.knowlege, // 知识库管理
  frontRouter.dialog, // 运行参数
  frontRouter.online,// 在线情况
  {
    path: '/systemhomepage/components/side/video',
    component: () => import('@/views/systemhomepage/components/side/video'),
    name: 'homepageVideo',
    meta: {
      title: '监控',
      front: true,
      hidden: true
    }
  },
  // {
  //   path: '/menumanage',
  //   component: Layout,
  //   meta: {
  //     roles: ['edit'],
  //   },
  //   children: [
  //     {
  //       path: 'index',
  //       component: () => import('@/views/menumanage/index'),
  //       name: 'menumanage',
  //       meta: {
  //         title: '菜单管理',
  //         icon: 'device',
  //         affix: true,
  //       },
  //     },
  //   ],
  // }, // 菜单管理
  {
    path: '/drdllmanage',
    component: Layout,
    meta: {
      title: '设备采集管理',
      icon: 'device',
      roles: ['edit'],
    },
    children: [
        {
            path: 'DeviceCollection',
            component: () => import('@/views/drdllmanage/DeviceCollection'),
            meta: {
                title: '设备采集配置',
                affix: true,
            },
        },
        {
            path: 'QsTag',
            component: () => import('@/views/drdllmanage/QsTag'),
            meta: {
              title: '变量寄存器配置',
              affix: true,
            },
        },
        // {
        //   path: 'EnergyConsumption',
        //   component: () => import('@/views/drdllmanage/EnergyConsumption'),
        //   meta: {
        //     title: '能耗类型配置',
        //     affix: true,
        //   },
        // },
    ],
  }, // 设备采集
  {
    path: '/subsystemmanage',
    component: Layout,
    meta: {
      roles: ['edit'],
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/subsystemmanage/index'),
        name: 'subsystemmanage',
        meta: {
          title: '子系统管理',
          icon: 'device',
          affix: true,
        },
      },
    ],
  }, // 子系统类型管理
  {
    path: '/devicemanage',
    component: Layout,
    meta: {
      title: '设备管理',
      icon: 'device',
      roles: ['edit'],
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/devicemanage/index'),
        name: 'DeviceManage',
        meta: {
          title: '设备管理',
          // icon: 'device',
          affix: true,
        },
      },
      // {
      //   path: 'deviceinformation',
      //   component: () => import('@/views/deviceinformation/index'),
      //   name: 'DeviceInformation',
      //   meta: {
      //     title: '设备信息',
      //     affix: true,
      //   },
      // },
    ],
  }, // 设备管理
  {
    path: '/variablemanage',
    component: Layout,
    meta: {
      roles: ['edit'],
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/variablemanage/index'),
        name: 'variablemanage',
        meta: {
          title: '变量管理',
          icon: 'example',
          affix: true,
        },
      },
    ],
  }, // 变量管理
  // {
  //   path: '/operation',
  //   component: Layout,
  //   meta: {
  //     roles: ['edit'],
  //   },
  //   children: [
  //     {
  //       path: 'index',
  //       component: () => import('@/views/front/operation/index'),
  //       name: 'operationindex',
  //       meta: {
  //         icon: 'baseinfo',
  //         title: '运行记录',
  //         affix: true,
  //       },
  //     },
  //   ],
  // },
  runLogRouter,

  // 用户模块
  {
    path: '/',
    alias: '/userhomepage',
    name: 'userhomepage',
    component: () => import('@/views/userhomepage'),
    hidden: false,
    meta: {
      roles: ['user'],
    },
  }, // 项目管理页面

  {
    path: '/totalalarm',
    component: () => import('@/views/userhomepage/TotalAlarm'),
    name: 'totalalarm',
    hidden: false,
    meta: {
      roles: ['user'],
    },
  }, // 总报警页
  {
    path: '/systemhomepage',
    name: 'systemhomepage',
    hidden: false,
    component: () => import('@/views/systemhomepage/index'),
    meta: {
      title: '系统首页',
      icon: 'homepage',
      affix: true,
    },
  }, // 系统首页

  {
    path: '/defaultpage',
    name: 'defaultpage',
    component: () => import('@/views/systemhomepage/defaultpage'),
    hidden: true, // 隐藏
    meta: {
      title: 'homepage',
      front: true,
      sort: 1,
      roles: ['user'],
    },
  },
  energyManageRouter,
  deviceOperationRouter, // 设备运维
  userManageRouter, // 用户管理
  {
    // *指的是匹配所有没有匹配到的页面
    path: '*',
    // 重定向，重定向到404的路由
    redirect: '/404',
    hidden: false,
  },
]

const createRouter = () =>
  new Router({
    // mode: 'history', // require service support
    scrollBehavior: () => ({
      y: 0,
    }),
    routes: constantRoutes,
  })

const router = createRouter()

export function resetRouter() {
  const newRouter = createRouter()
  router.matcher = newRouter.matcher // reset router
}

export default router
