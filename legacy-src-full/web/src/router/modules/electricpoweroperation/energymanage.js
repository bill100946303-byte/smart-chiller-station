/** When your routing table is too long, you can split it into small modules**/
import UserLayout from '@/userlayout'
import AppMain from '@/userlayout/components/AppMain'

const energyManageRouter = {
  path: '/energymanage',
  component: UserLayout,
  alwaysShow: true,
  hidden: true,
  meta: {
    id: 6,
    title: '能耗管理old',
    icon: 'energymanage',
    roles: ['user']
  },
  children: [{
      path: 'energymonitor',
      component: AppMain,
      alwaysShow: true,
      hidden: true,
      meta: {
        id: 25,
        title: '能耗监测'
      },
      children: [{
          path: 'totalenergy',
          component: () => import('@/views/energymanage/energymonitor/totalenergy'),
          hidden: true,
          meta: {
            id: 28,
            title: '总电能耗'
          }
        },
        {
          path: 'sortenergy',
          component: () => import('@/views/energymanage/energymonitor/sortenergy'),
          hidden: true,
          meta: {
            id: 29,
            title: '分类能耗'
          }
        },
        // {
        //   path: 'subitemenergy',
        //   component: () => import('@/views/energymanage/energymonitor/subitemenergy'),
        //   hidden: true,
        //   meta: {
        //     id: 97,
        //     title: '分项能耗'
        //   }
        // },
        {
          path: 'energyrecords',
          component: () => import('@/views/energymanage/energymonitor/energyrecords'),
          hidden: true,
          meta: {
            id: 30,
            title: '能耗记录'
          }
        },
        {
          path: 'energysort',
          component: () => import('@/views/energymanage/energymonitor/energysort'),
          hidden: true,
          meta: {
            id: 31,
            title: '能耗配置'
          }
        },
        {
          path: 'energyparams',
          component: () => import('@/views/energymanage/energymonitor/energyparams'),
          hidden: true,
          meta: {
            id: 32,
            title: '能耗参数配置'
          }
        }
      ]
    },
    {
      path: 'energyanalyse',
      component: AppMain,
      alwaysShow: true,
      hidden: true,
      meta: {
        id: 26,
        title: '能耗分析'
      },
      children: [{
          path: 'totalenergyanalyse',
          component: () => import('@/views/energymanage/energyanalyse/totalenergyanalyse'),
          hidden: true,
          meta: {
            id: 33,
            title: '总能耗分析'
          }
        },
        {
          path: 'sortenergyanalyse',
          component: () => import('@/views/energymanage/energyanalyse/sortenergyanalyse'),
          hidden: true,
          meta: {
            id: 34,
            title: '分类能耗分析'
          }
        },
        {
          path: 'subitemenergyanalyse',
          component: () => import('@/views/energymanage/energyanalyse/subitemenergyanalyse'),
          hidden: true,
          meta: {
            id: 35,
            title: '分项能耗分析'
          }
        },
        {
          path: 'energycompare',
          component: () => import('@/views/energymanage/energyanalyse/energycompare'),
          hidden: true,
          meta: {
            id: 36,
            title: '分项能耗同比'
          }
        }
      ]
    },
    {
      path: 'energyreview',
      component: AppMain,
      alwaysShow: true,
      hidden: true,
      meta: {
        id: 27,
        title: '能耗追溯'
      },
      children: [{
        path: 'powerreview',
        component: () => import('@/views/energymanage/energyreview'),
        hidden: true,
        meta: {
          id: 37,
          title: '用电追溯'
        }
      }]
    },
  ]
}

export default energyManageRouter