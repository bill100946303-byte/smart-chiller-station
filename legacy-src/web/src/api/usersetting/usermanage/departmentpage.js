import request from '@/utils/request'

// 查询所有页面
export function findPage(path, departmentid) {
    return request({
        url: `zsqy/departmentpic/${path}/findPic`,
        method: 'get',
        params: {
            departmentid
        }
    })
}
// 给部门分配页面
export function addPage(path, data) {
    return request({
        url: `zsqy/departmentpic/${path}/save`,
        method: 'put',
        data
    })
}
// 给部门移除页面
export function removePage(path, ids) {
    return request({
        url: `zsqy/departmentpic/${path}/delete`,
        method: 'delete',
        params: {
            ids
        }
    })
}
// 查询部门对应的页面
export function searchPage(path, departmentid) {
    return request({
        url: `zsqy/departmentpic/${path}/findObject`,
        method: 'get',
        params: {
            departmentid
        }
    })
}