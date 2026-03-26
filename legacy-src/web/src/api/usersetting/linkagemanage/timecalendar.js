import request from '@/utils/request'

// 查询30天的时间
export function findDate(path, year, month) {
  return request({
    url: `zsqy/qsLdTgr/${path}/findDate`,
    method: 'get',
    params: {
      year,
      month
    }
  })
}

// 查询当月所有计划
export function findPlain(path, yearMonth) {
  return request({
    url: `zsqy/timemode/${path}/findTimemodejob`,
    method: 'get',
    params: {
      yearMonth
    }
  })
}

// 保存计划
export function addPlain(path, data) {
  return request({
    url: `zsqy/timemode/${path}/saveTimemodejob`,
    method: 'post',
    data
  })
}
