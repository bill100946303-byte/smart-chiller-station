/*
 * @Author: davi 
 * @Date: 2022-11-04 14:15:14 
 * @Last Modified by: davi
 * @Last Modified time: 2022-11-04 14:16:14
 */
// const baseUrl =
//   process.env.NODE_ENV === 'production'
//     ? 'http://' + window.location.host + '/'
//     : 'http://' + process.env.VUE_APP_BASE_URL; //本地服务
const baseUrl = process.env.VUE_APP_BASE_URL; //本地服务
// console.log('baseUrl',baseUrl)
export default {
  baseUrl,
};

