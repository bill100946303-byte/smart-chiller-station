import request from '@/utils/request'

// 查询所有模式任务
export function findAllModelTask(path) {
  return request({
    url: `zsqy/ms/rw/${path}/findAllMsRw`,
    method: 'get'
  })
}

// 查询绑定的时间模式
export function findBindTimeModel(path) {
  return request({
    url: `zsqy/ms/jb/${path}/findAllMsJb`,
    method: 'get'
  })
}

// 新增时间模式
export function addTimeModel(path,data) {
  return request({
    url: `zsqy/ms/jb/${path}/insertMsJb`,
    method: 'post',
    data
  })
}