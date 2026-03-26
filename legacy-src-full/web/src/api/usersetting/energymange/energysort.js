import request from '@/utils/request'

// 根据设备名查询变量
export function findReg(path, drid) {
    return request({
        url: `zsqy/reg/${path}/findRegByDrid`,
        method: 'get',
        params: {
            drid,
            isenergy: 1
        }
    })
}
// 查询所有能耗配置
export function findEnergy(path, pageCurrent, pageSize) {
    return request({
        url: `zsqy/energyinfo/${path}/findObject`,
        method: 'get',
        params: {
            pageCurrent, pageSize
        }
    })
}
// 判断是否为项目总能耗
export function checkTotalEnergy(path) {
    return request({
        url: `zsqy/energyinfo/${path}/check`,
        method: 'get'
    })
}
// 新增能耗配置
export function addEnergy(path, data) {
    return request({
        url: `zsqy/energyinfo/${path}/save`,
        method: 'post',
        data
    })
}
// 修改能耗配置
export function updateEnergy(path, data) {
    return request({
        url: `zsqy/energyinfo/${path}/update`,
        method: 'put',
        data
    })
}
// 删除能耗配置
export function deleteEnergy(path, ids) {
    return request({
        url: `zsqy/energyinfo/${path}/delete`,
        method: 'delete',
        params: {
            ids
        }
    })
}