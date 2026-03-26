import request from '@/utils/request'

// 冷冻水温度报表数据 图3
export function findChwTemperature(path, data) {
    return request({
        url: `/zsqy/chillerperformancecure/${path}/findChwTemperature`,
        method: 'get',
        params: data
    })
}

// 条件查询报表数据 图4
export function findChwTemperatureDiffByTimeSpace(path, data) {
    return request({
        url: `/zsqy/chillerperformancecure/${path}/findChwTemperatureDiffByTimeSpace`,
        method: 'get',
        params: data
    })
}

// 冷却水温度报表数据 图5
export function findCwpTemperatureByTimeSpace(path, data) {
    return request({
        url: `/zsqy/chillerperformancecure/${path}/findCwpTemperatureByTimeSpace`,
        method: 'get',
        params: data
    })
}

// 冰机冷却温差参数参数记录 图6
export function findCwpTemperatureDiffByTimeSpace(path, data) {
    return request({
        url: `/zsqy/chillerperformancecure/${path}/findCwpTemperatureDiffByTimeSpace`,
        method: 'get',
        params: data
    })
}

// 冷冻侧流量和冷量的比值 图7
export function findChilledWaterGpmRtByTimeSpace(path, data) {
    return request({
        url: `/zsqy/chillerperformancecure/${path}/findChilledWaterGpmRtByTimeSpace`,
        method: 'get',
        params: data
    })
}

// 冷却侧流量和冷量的比值 图8
export function findCondenserWaterGpmRtByTimeSpace(path, data) {
    return request({
        url: `/zsqy/chillerperformancecure/${path}/findCondenserWaterGpmRtByTimeSpace`,
        method: 'get',
        params: data
    })
}

// 冷却侧趋近温度 图9
export function findTowerApproachTemperatureByTimeSpace(path, data) {
    return request({
        url: `/zsqy/chillerperformancecure/${path}/findTowerApproachTemperatureByTimeSpace`,
        method: 'get',
        params: data
    })
}

// 系统能效 图10
export function findSystemEfficiencyByTimeSpace(path, data) {
    return request({
        url: `/zsqy/chillerperformancecure/${path}/findSystemEfficiencyByTimeSpace`,
        method: 'get',
        params: data
    })
}

// 冷冻泵输送系数 图11
export function findCHPEfficiencyByTimeSpace(path, data) {
    return request({
        url: `/zsqy/chillerperformancecure/${path}/findCHPEfficiencyByTimeSpace`,
        method: 'get',
        params: data
    })
}

// 冷却泵输送系数 图12
export function findCWPEfficiencyByTimeSpace(path, data) {
    return request({
        url: `/zsqy/chillerperformancecure/${path}/findCWPEfficiencyByTimeSpace`,
        method: 'get',
        params: data
    })
}

// 冷却塔输送系数 图13
export function findCoolingTowerEfficiencyByTimeSpace(path, data) {
    return request({
        url: `/zsqy/chillerperformancecure/${path}/findCoolingTowerEfficiencyByTimeSpace`,
        method: 'get',
        params: data
    })
}

// 冰机能效 图14
export function findChillerEfficiencyByTimeSpace(path, data) {
    return request({
        url: `/zsqy/chillerperformancecure/${path}/findChillerEfficiencyByTimeSpace`,
        method: 'get',
        params: data
    })
}