import request from '@/utils/request'

// 查询所有设备监控信息
export function findDeviceTypeInfo(path) {
    return request({
        url: `zsqy/Drtypeinfo/${path}/findAllDrtypevo`,
        method: 'get'
    })
}
// 是否有连接页面
export function findPicByMenuId(path, id) {
    return request({
        url: `zsqy/sysmenuinfo/${path}/findPicByMenuId`,
        method: 'get',
        params: {
            id
        }
    })
}