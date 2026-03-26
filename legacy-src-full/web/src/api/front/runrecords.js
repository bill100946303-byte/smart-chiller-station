import request from '@/utils/request'

// 操作记录
export function runrecords(path,data) {
    return request({
        url: `/zsqy/runrecords/${path}/findAll`,
        method: 'get',
        params: data,
    })
}

// 在线情况
export function monitor(path) {
    return request({
        url: `/zsqy/monitor/${path}/getData`,
        method: 'get',
    })
}

//能量表数据和电表数据：
export function reportmanage(path,data) {
    return request({
        url: `/zsqy/reportmanage/${path}/findEnergyInstrument`,
        method: 'get',
        params: data,
    })
}