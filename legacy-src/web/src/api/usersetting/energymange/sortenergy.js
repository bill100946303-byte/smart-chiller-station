import request from '@/utils/request'

// 查询能耗
export function findSortEnergy(path) {
    return request({
        url: `zsqy/queryAllenergy/${path}/findSortenergy`,
        method: 'get'
    })
}
// 查询图表数据
export function findChartsData(path, data) {
    return request({
        url: `zsqy/queryAllenergy/${path}/findSortenergyBytype`,
        method: 'post',
        data
    })
}
