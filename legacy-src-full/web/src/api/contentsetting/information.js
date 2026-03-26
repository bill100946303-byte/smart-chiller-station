import request from '@/utils/request'

// 新增设备信息
export function drInfoSetting(path, data) {
    return request({
        url: `zsqy/drInfoSetting/${path}/save`,
        method: 'put',
        data,
    })
}

// 弹框查询设备信息
export function findByDrTypeIdAndDrId(path, data) {
    return request({
        url: `zsqy/drInfoSetting/${path}/findByDrTypeIdAndDrId`,
        method: 'get',
        params: {
            ...data
        }
    })
}

// 获取铭牌信息
export function findByDrId(path, drId) {
    return request({
        url: `zsqy/devicestandingbook/${path}/findByDrId/${drId}`,
        method: 'get',
    })
}

// 获取铭牌信息
export function findMainPageByDrTypeIdAndDrId(path, data) {
    return request({
        url: `zsqy/drInfoSetting/${path}/findMainPageByDrTypeIdAndDrId/`,
        method: 'get',
        params: {
            data
        }
    })
}