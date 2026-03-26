import request from '@/utils/request'

// 绑定点位
export function findAllByDrTypeId(path) {
    return request({
        url: `/zsqy/reg/${path}/findAllByDrTypeId`,
        method: 'get',
    })
}