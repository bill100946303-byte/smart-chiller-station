import request from '@/utils/request'

// 查询部门分页
export function findDepartment(path) {
    return request({
        url: `zsqy/department/${path}/findAll`,
        method: 'get'
    })
}
// 查询部门分页
export function findDepartmentTable(path, pageCurrent, pageSize) {
    return request({
        url: `zsqy/department/${path}/findObject`,
        method: 'get',
        params: {
            pageCurrent, pageSize
        }
    })
}
// 新增部门
export function addDepartment(path, data) {
    return request({
        url: `zsqy/department/${path}/save`,
        method: 'post',
        data
    })
}
// 修改部门
export function updateDepartment(path, data) {
    return request({
        url: `zsqy/department/${path}/update`,
        method: 'put',
        data
    })
}
// 删除部门
export function deleteDepartment(path, departmentid) {
    return request({
        url: `zsqy/department/${path}/delete`,
        method: 'delete',
        params: {
            departmentid
        }
    })
}