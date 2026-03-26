import request from '@/utils/request'

// 查询用户编辑信息
export function findUserInfo(path, pageCurrent, pageSize) {
    return request({
        url: `zsqy/appuser/${path}/findObject`,
        method: 'get',
        params: {
            pageCurrent, pageSize
        }
    })
}
// 查询用户权限
export function findAllMenu(path) {
    return request({
        url: `zsqy/sysmenuinfo/${path}/findAllMenu`,
        method: 'get'
    })
}
// 根据项目查询用户组
export function findUserGroup(path, appid) {
    return request({
        url: `zsqy/usergroup/${path}/findAll`,
        method: 'get',
        params: {
            appid
        }
    })
}
// 根据项目查询部门
export function findDepartment(path, appid) {
    return request({
        url: `zsqy/department/${path}/findAll`,
        method: 'get',
        params: {
            appid
        }
    })
}
// 新增用户编辑信息
export function addUserInfo(path, data) {
    return request({
        url: `zsqy/appuser/${path}/saveAppuser`,
        method: 'post',
        data
    })
}
// 修改用户编辑信息
export function updateUserInfo(path, data) {
    return request({
        url: `zsqy/appuser/${path}/update`,
        method: 'put',
        data
    })
}
// 删除用户编辑信息
export function deleteUserInfo(path, appid, ids) {
    return request({
        url: `zsqy/appuser/${path}/delete`,
        method: 'delete',
        params: {
            appid,
            ids
        }
    })
}