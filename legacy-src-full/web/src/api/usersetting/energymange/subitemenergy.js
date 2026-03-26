import request from '@/utils/request'

// 起始结束时间查询能耗
export function findSubitemEnergy(path, data) {
    return request({
        url: `zsqy/queryAllenergy/${path}/findOneEnergyInfo`,
        method: 'post',
        data
    })
}
// 不同时间段查询能耗
export function searchSubitemEnergy(path, data) {
    return request({
        url: `zsqy/queryAllenergy/${path}/findSubEnergyInfoByType`,
        method: 'post',
        data
    })
}

// 查询分项能耗信息
export function searchSubitemEnergyInfo(path, data) {
    return request({
        url: `zsqy/queryAllenergy/${path}/findRegEnergyInfoByType`,
        method: 'post',
        data
    })
}

// 查询配置分项能耗的变量
export function findEnergyReg(path, drid) {
    return request({
        url: `zsqy/reg/${path}/findAllByDrid`,
        method: 'get',
        params: {
            drid,
            isenergy: 1
        }
    })
}

// 查询设备类型树图
export function findDeviceTypeTree(path) {
    return request({
        url: `zsqy/Drtypeinfo/${path}/findIdtree`,
        method: 'get'
    })
}

// 查询设备
export function findDeviceTree(path, drtypeid) {
    return request({
        url: `zsqy/drinfo/${path}/findIdtreeByDrtypeid`,
        method: 'get',
        params: {
            drtypeid
        }
    })
}

// 查询变量
export function findRegTree(path, drid) {
    return request({
        url: `zsqy/reg/${path}/findIdtreeByDrid`,
        method: 'get',
        params: {
            drid
        }
    })
}