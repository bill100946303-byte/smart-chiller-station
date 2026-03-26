import request from '@/utils/request'

// 查询能耗
export function findTotalEnergy(path) {
    return request({
        url: `zsqy/queryAllenergy/${path}/findSumenergy`,
        method: 'get'
    })
}
// 查询图表数据
export function findChartsData(path, data) {
    return request({
        url: `zsqy/queryAllenergy/${path}/findSumenergyBytype`,
        method: 'post',
        data
    })
}

// 能耗追溯
export function findzsEnergy(path, data) {
    return request({
        url: `zsqy/queryAllenergy/${path}/findzsEnergy`,
        method: 'post',
        data
    })
}