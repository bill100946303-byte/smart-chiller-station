import Layout from '@/views/front/layout'

const frontRouter = {
  energy: {
    path: '/energy-test',
    component: Layout,
    redirect: '/energy-test/index',
    name: 'energytest',
    meta: {
        title: 'EnergyEfficiencyAnalysis',
        front: true
    },
    children: [
        {
            path: 'index',
            component: () => import('@/views/front/energy-test/index.vue'),
            name: 'energytestindex',
            meta: {title: 'EnergyEfficiencyAnalysis'},
        },
    ]
  },
  // energy: {
  //   path: '/energytest',
  //   component: Layout,
  //   redirect: '/energytest/day',
  //   name: 'energytest',
  //   meta: {
  //     title: 'EnergyEfficiencyAnalysis',
  //     front: true
  //   },
  //   children: [
  //     {
  //       path: 'day',
  //       component: () => import('@/views/front/energy-test/day'),
  //       name: 'energyday',
  //       meta: { title: 'analysis' },
  //     },
  //     {
  //       path: 'search',
  //       name: 'Menu2',
  //       component: () => import('@/views/front/energy-test/search'),
  //       meta: { title: 'search' }
  //     },
  //     {
  //       path: 'compare',
  //       name: 'compare',
  //       component: () => import('@/views/front/energy-test/compare'),
  //       meta: { title: 'compare' }
  //     },
  //     {
  //       path: 'proportion',
  //       name: 'proportion',
  //       component: () => import('@/views/front/energy-test/proportion'),
  //       meta: { title: 'proportion' }
  //     },
  //     {
  //       path: 'hotbalance',
  //       name: 'hotbalance',
  //       component: () => import('@/views/front/energy-test/hotbalance'),
  //       meta: { title: 'thermalImbalanceRate' }
  //     }
  //   ]
  // },
  consumption: {
    path: '/consumption',
    component: Layout,
    redirect: '/consumption/index',
    name: 'consumption',
    meta: {
      title: '能耗分析',
      front: true
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/front/consumption/newin.vue'),
        name: 'consumptionindex',
        meta: { title: 'consumptionindex' },
      },
    ]
  },
  alertrun: {
    path: '/alertrun',
    component: Layout,
    redirect: '/alertrun/index',
    name: 'alertrun',
    meta: {
        title: 'alertrun',
        front: true
    },
    children: [
        {
            path: 'index',
            component: () => import('@/views/front/alertrun/index.vue'),
            name: 'alertrunindex',
            meta: {title: 'alertrun'},
        },
    ]
  },
  // alertrun: {
  //   path: '/alertrun',
  //   component: Layout,
  //   redirect: '/alertrun/record',
  //   name: 'alertrun',
  //   meta: {
  //     title: 'alertrun',
  //     front: true
  //   },
  //   children: [
  //     {
  //       path: 'realtime',
  //       component: () => import('@/views/front/alertrun/realtime'),
  //       name: 'realtime',
  //       meta: { title: 'realtime' },
  //     },
  //     {
  //       path: 'record',
  //       component: () => import('@/views/front/alertrun/record'),
  //       name: 'alertrecord',
  //       meta: { title: 'alertrecord' },
  //     },
  //     {
  //       path: 'bill',
  //       component: () => import('@/views/front/alertrun/bill'),
  //       name: 'alertbill',
  //       meta: { title: 'alertbill' },
  //     },
  //     {
  //       path: 'settings',
  //       component: () => import('@/views/front/alertrun/settings'),
  //       name: 'alarmSettings',
  //       meta: { title: 'alarmSettings' },
  //     }
  //   ]
  // },
  log: {
    path: '/logrizi',
    component: Layout,
    redirect: '/logrizi/index',
    name: 'logrizi',
    meta: {
      title: '冷站日志',
      front: true
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/front/log/index.vue'),
        name: 'logindex',
        meta: { title: 'coldStationLog' },
      },
    ]
  },
  params: {
    path: '/params',
    component: Layout,
    redirect: '/params/index',
    name: 'params',
    meta: {
      title: '能源参数',
      front: true
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/front/params/index'),
        name: 'paramsindex',
        meta: { title: 'energyParameters' },
      },
    ]
  },
  work: {
    path: '/work',
    component: Layout,
    redirect: '/work/index',
    name: 'work',
    meta: {
      title: '工单管理',
      front: false
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/front/work/index'),
        name: 'workindex',
        meta: { title: '工单管理' },
      },
    ]
  },
  report: {
    path: '/report',
    component: Layout,
    redirect: '/report/index',
    name: 'report',
    meta: {
      title: '报表记录',
      front: true
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/front/report/index'),
        name: 'reportindex',
        meta: { title: 'reportForms' },
      },
    ]
  },
  dataDetails: {
    path: '/dataDetails',
    component: Layout,
    redirect: '/dataDetails/index',
    name: 'dataDetails',
    meta: {
      title: '数据曲线',
      front: true
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/front/dataDetails/index'),
        name: 'dataDetailsindex',
        meta: { title: 'dataDetails' },
      },
    ]
  },

  operationRecords: {
    path: '/operationRecords',
    component: Layout,
    redirect: '/operationRecords/index',
    name: 'operationRecords',
    meta: {
      title: '操作记录',
      front: true
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/front/operationRecords/index'),
        name: 'operationRecordsindex',
        meta: { title: 'operationRecords' },
      },
    ]
  },

  meteringInstrument: {
    path: '/meteringInstrument',
    component: Layout,
    redirect: '/meteringInstrument/index',
    name: 'meteringInstrument',
    meta: {
      title: '能耗抄表',
      front: true
    },
    children: [
        {
            path: 'index',
            // component: () => import('@/views/front/meteringInstrument/index.vue'),
            component: () => import('@/views/front/meteringInstrument/meterReading.vue'),
            name: 'meteringInstrumentindex',
            meta: {title: 'meterReading'},
        },
    ]
  },
  // meteringInstrument : {
  //   path: '/meteringInstrument',
  //   component: Layout,
  //   redirect: '/meteringInstrument/index',
  //   name: 'meterReading',
  //   meta: {
  //     // title: '计量仪表',
  //     title: 'meterReading',
  //     front: true
  //   },
  //   children: [
  //     {
  //       path: 'meteringInstrument',
  //       component: () => import('@/views/front/meteringInstrument/index'),
  //       name: 'meteringInstrumentindex',
  //       meta: {title: 'meteringInstrument'},
  //     },
  //     {
  //       path: 'meterReading',// 能耗抄表
  //       component: () => import('@/views/front/meterReading/index'),
  //       name: 'meterReadingindex',
  //       meta: {title: 'meterReading'},
  //     },
  //   ]
  // },

  environment: {
    path: '/environment',
    component: Layout,
    redirect: '/environment/index',
    name: 'environment',
    meta: {
      title: '环境工况',
      front: true
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/front/environment/index'),
        name: 'environmentindex',
        meta: { title: '环境工况' },
      },
    ]
  },


  // operation: {
  //   path: '/operation',
  //   component: Layout,
  //   redirect: '/operation/index',
  //   name: 'operation',
  //   meta: {
  //     title: '操控记录',
  //     front: true
  //   },
  //   children: [
  //     {
  //       path: 'index',
  //       component: () => import('@/views/front/operation/index'),
  //       name: 'operationindex',
  //       meta: { title: '运行记录' },
  //     },
  //   ]
  // },
  knowlege: {
    path: '/knowlege',
    component: Layout,
    redirect: '/knowlege/index',
    name: 'knowlege',
    meta: {
      title: '知识库',
      front: true
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/front/knowlege/index'),
        name: 'knowlegeindex',
        meta: { title: 'knowlege' },
      },
    ]
  },
  dialog: {
    path: '/front/dialog',
    component: () => import('@/views/front/dialog/index'),
    name: 'dialog',
    meta: {
      title: '运行参数',
      front: true,
      hidden: true
    }
  },
  online: {
    path: '/front/online',
    component: () => import('@/views/front/online/index'),
    name: 'online',
    meta: {
      title: '在线情况',
      front: true,
      hidden: true
    }
  },
  // meterReading: {
  //   path: '/meterReading',
  //   component: Layout,
  //   redirect: '/meterReading/index',
  //   name: 'meterReading',
  //   meta: {
  //     title: '能耗抄表',
  //     front: true
  //   },
  //   children: [
  //     {
  //       path: 'index',
  //       component: () => import('@/views/front/meterReading/index'),
  //       name: 'meterReadingindex',
  //       meta: { title: 'meterReading' },
  //     },
  //   ]
  // },
  PerformanceReport: {
    path: '/PerformanceReport',
    component: Layout,
    redirect: '/PerformanceReport/index',
    name: 'PerformanceReport',
    meta: {
      title: '冰机性能报告',
      front: true
    },
    children: [
      {
        path: 'index',
        component: () => import('@/views/front/PerformanceReport/index'),
        name: 'PerformanceReportindex',
        meta: {title: 'PerformanceReport'},
      },
    ]
  },
}

export default frontRouter
