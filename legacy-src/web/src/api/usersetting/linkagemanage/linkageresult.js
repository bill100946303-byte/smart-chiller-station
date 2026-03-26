import request from '@/utils/request'

// 查询联动任务树图
export function findLinkageTask(path, rwType) {
    return request({
        url: `zsqy/QsLdRw/${path}/findAll`,
        method: 'get',
        params: {
            rwType
        }
    })
}
// 查询所有页面
export function findPage(path) {
    return request({
        url: `zsqy/pic/${path}/findAllPic`,
        method: 'get'
    })
}
// 查询所有视频id
export function findVideoID(path) {
    return request({
        url: `zsqy/spinfo/${path}/findAll`,
        method: 'get'
    })
}
// 查询所有联动结果
export function findLinkageResult(path, pageCurrent, pageSize, ldLxId) {
    return request({
        url: `zsqy/qsLdJgr/${path}/findObject`,
        method: 'get',
        params: {
            pageCurrent,
            pageSize,
            ldLxId
        }
    })
}
// 联动结果导入
export function inputExcel(path, data) {
    return request({
        url: `zsqy//qsLdJgr/${path}/import`,
        method: 'post',
        data
    })
}
// 联动结果导出
export function outputExcel(path) {
    return request({
        url: `zsqy//qsLdJgr/${path}/export`,
        method: 'get',
        responseType: 'blob'
    })
}
// 新增联动结果
export function addLinkageResult(path, data) {
    return request({
        url: `zsqy//qsLdJgr/${path}/save`,
        method: 'post',
        data
    })
}
// 修改联动结果
export function updateLinkageResult(path, data) {
    return request({
        url: `zsqy//qsLdJgr/${path}/update`,
        method: 'put',
        data
    })
}
// 删除联动结果
export function deleteLinkageResult(path, ids) {
    return request({
        url: `zsqy/qsLdJgr/${path}/delete`,
        method: 'delete',
        params: {
            ids
        }
    })
}