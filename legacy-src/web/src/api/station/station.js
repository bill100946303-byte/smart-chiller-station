import request from '@/utils/request'

export function MJForHagtqczApi(data) {
  return request({
    url: '/zsqyapi/getMJForHagtqcz',
    method: 'post',
    data
  })
}


