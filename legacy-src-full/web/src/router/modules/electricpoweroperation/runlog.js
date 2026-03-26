/** When your routing table is too long, you can split it into small modules**/
import UserLayout from '@/userlayout'
import Layout from '@/layout'

const runLogRouter = {
    path: '/runlog',
    // component: UserLayout,
    component: Layout,
    // alwaysShow: true,
    // hidden: true,
    meta: {
        // id: 4,
        title: '用户日志',
        icon: 'runlog',
        roles: ['edit'],
    },
    // children: [
    //   {
    //     path: 'userlog',
    //     component: AppMain,
    //     // alwaysShow: true,
    //     // hidden: true,
    //     meta: {
    //       id: 14,
    //       title: '用户日志'
    //     },
    children: [
        // {
        //     path: 'userhandle',
        //     component: () => import('@/views/runlog/userlog/userhandle'),
        //     // hidden: true,
        //     meta: {
        //         // id: 16,
        //         title: '用户操作',
        //         affix: true,
        //     }
        // },
        {
            path: 'userlogin',
            component: () => import('@/views/runlog/userlog/userlogin'),
            // hidden: true,
            meta: {
                // id: 17,
                title: '用户登录',
                affix: true,
            }
        },
        {
            path: 'index',
            component: () => import('@/views/front/operation/index'),
            name: 'operationindex',
            meta: {
                // icon: 'baseinfo',
                title: '运行记录',
                affix: true,
            },
        },
    ]
    //   }
    // ]
}

export default runLogRouter
