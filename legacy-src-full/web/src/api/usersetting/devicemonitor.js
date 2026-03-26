import request from '@/utils/request'

// 查询所有导航菜单
export function getMenu(path, userid) {
  return request({
    url: `zsqy/pic/${path}/findAllPicByUserid`,
    method: 'get',
    params: {
      userid
    }
  })
}
