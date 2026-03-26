import request from '@/utils/request'


// 获取设备类型
export function findDeviceType(path) {
    return request({
        url: `zsqy/Drtypeinfo/${path}/findAllDrtypeAndDr`,
        method: 'get'
    })
}
// 根据设备类型查询设备
export function findDevice(path, drtypeid) {
    return request({
        url: `zsqy/drinfo/${path}/findAll`,
        method: 'get',
        params: {
            drtypeid
        }
    })
}
// 查询所有接单人
export function findAcceptMan(path) {
    return request({
        url: `zsqy/appuser/${path}/findAll`,
        method: 'get'
    })
}
// 查询所有工单
export function findOrder(path, data) {
    return request({
        url: `zsqy/qsworkorder/${path}/findObject`,
        method: 'get',
        params: data
    })
}
// 新增工单
export function addOrder(path, data) {
    return request({
        url: `zsqy/qsworkorder/${path}/save`,
        method: 'post',
        data
    })
}
// 修改工单
export function updateOrder(path, data) {
    return request({
        url: `zsqy/qsworkorder/${path}/update`,
        method: 'put',
        data
    })
}
// 删除工单
export function deleteOrder(path, ids) {
    return request({
        url: `zsqy/qsworkorder/${path}/delete`,
        method: 'delete',
        params: {
            ids
        }
    })
}

// 查询巡检日志
export function findCheckLog(path, data) {
    return request({
        url: `zsqy/qsworkorder/${path}/finddrcehcklog`,
        method: 'post',
        data
    })
}
