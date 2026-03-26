import request from '@/utils/request'

// 查询自定义设备类型
export function findDeviceType(path, pageCurrent, pageSize) {
    return request({
        url: `zsqy/Drtypeinfo/${path}/iscustom`,
        method: 'get',
        params: {
            pageCurrent,
            pageSize,
            iscustomType: 1
        }
    })
}
// 新增自定义设备类型
export function addDeviceType(path, data) {
    return request({
        url: `zsqy/Drtypeinfo/${path}/save`,
        method: 'post',
        data
    })
}

// 修改自定义设备类型
export function updateDeviceType(path, data) {
    return request({
        url: `zsqy/Drtypeinfo/${path}/update`,
        method: 'put',
        data
    })
}

// 删除自定义设备类型
export function deleteDeviceType(path, drtypeid) {
    return request({
        url: `zsqy/Drtypeinfo/${path}/delete`,
        method: 'delete',
        params: {
            drtypeid
        }
    })
}