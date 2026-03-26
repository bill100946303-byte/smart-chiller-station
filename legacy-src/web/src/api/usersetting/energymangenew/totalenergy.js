import request from '@/utils/request'

// 查询能耗
export function findTotalEnergy(path) {
    return request({
        url: `zsqy/queryAllenergy/${path}/findSumenergyNew`,
        method: 'get'
    })
}
// 查询图表数据
export function findChartsData(path, data) {
    return request({
        url: `zsqy/queryAllenergy/${path}/findSumenergyBytypeNew`,
        method: 'post',
        data
    })
}

// 能耗追溯
export function findzsEnergy(path, data) {
    return request({
        url: `zsqy/queryAllenergy/${path}/findzsEnergyNew`,
        method: 'post',
        data
    })
}