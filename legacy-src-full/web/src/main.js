import Vue from 'vue'

import Cookies from 'js-cookie'

import 'normalize.css/normalize.css' // a modern alternative to CSS resets
import locale from 'element-ui/lib/locale'
import Alert from 'element-ui/lib/alert'
import Badge from 'element-ui/lib/badge'
import Button from 'element-ui/lib/button'
import Calendar from 'element-ui/lib/calendar'
import Card from 'element-ui/lib/card'
import Cascader from 'element-ui/lib/cascader'
import Checkbox from 'element-ui/lib/checkbox'
import CheckboxGroup from 'element-ui/lib/checkbox-group'
import Col from 'element-ui/lib/col'
import ColorPicker from 'element-ui/lib/color-picker'
import DatePicker from 'element-ui/lib/date-picker'
import Descriptions from 'element-ui/lib/descriptions'
import DescriptionsItem from 'element-ui/lib/descriptions-item'
import Dialog from 'element-ui/lib/dialog'
import Drawer from 'element-ui/lib/drawer'
import Dropdown from 'element-ui/lib/dropdown'
import DropdownItem from 'element-ui/lib/dropdown-item'
import DropdownMenu from 'element-ui/lib/dropdown-menu'
import Empty from 'element-ui/lib/empty'
import Form from 'element-ui/lib/form'
import FormItem from 'element-ui/lib/form-item'
import Image from 'element-ui/lib/image'
import Input from 'element-ui/lib/input'
import Menu from 'element-ui/lib/menu'
import MenuItem from 'element-ui/lib/menu-item'
import Option from 'element-ui/lib/option'
import Pagination from 'element-ui/lib/pagination'
import Popover from 'element-ui/lib/popover'
import Progress from 'element-ui/lib/progress'
import Radio from 'element-ui/lib/radio'
import RadioButton from 'element-ui/lib/radio-button'
import RadioGroup from 'element-ui/lib/radio-group'
import Row from 'element-ui/lib/row'
import Scrollbar from 'element-ui/lib/scrollbar'
import Select from 'element-ui/lib/select'
import Slider from 'element-ui/lib/slider'
import Step from 'element-ui/lib/step'
import Steps from 'element-ui/lib/steps'
import Submenu from 'element-ui/lib/submenu'
import Switch from 'element-ui/lib/switch'
import Table from 'element-ui/lib/table'
import TableColumn from 'element-ui/lib/table-column'
import TabPane from 'element-ui/lib/tab-pane'
import Tabs from 'element-ui/lib/tabs'
import Tooltip from 'element-ui/lib/tooltip'
import Tree from 'element-ui/lib/tree'
import Upload from 'element-ui/lib/upload'
import Loading from 'element-ui/lib/loading'
import Message from 'element-ui/lib/message'
import MessageBox from 'element-ui/lib/message-box'
import Notification from 'element-ui/lib/notification'
import './styles/element-variables.scss'
import './styles/iconfont.css'
import AFTableColumn from 'af-table-column'
import '@/icons/icon/iconfont.css'
import '@/icons/icon2/iconfont.css'

// 定义字体比例
const fontRate = {
  CHAR_RATE: 1.1, // 汉字比率
  NUM_RATE: 0.65, // 数字
  OTHER_RATE: 0.8 // 除汉字和数字以外的字符的比率
}
const fontSize = 16
// 注册组件
Vue.use(AFTableColumn, {fontRate, fontSize})
import("@/styles/index.scss")

import '@/styles/common/font.css'


import App from './App'
import store from './store'
import router from './router'
import './icons' // icon
import './permission' // permission control
import './utils/error-log' // error log

import i18n from './lang'

import echarts from 'echarts'

Vue.prototype.$echarts = echarts

import global from './utils/global'

Vue.prototype.global = global
const elementSize = Cookies.get('size') || 'medium'
const elementComponents = [
  Alert,
  Badge,
  Button,
  Calendar,
  Card,
  Cascader,
  Checkbox,
  CheckboxGroup,
  Col,
  ColorPicker,
  DatePicker,
  Descriptions,
  DescriptionsItem,
  Dialog,
  Drawer,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  Empty,
  Form,
  FormItem,
  Image,
  Input,
  Menu,
  MenuItem,
  Option,
  Pagination,
  Popover,
  Progress,
  Radio,
  RadioButton,
  RadioGroup,
  Row,
  Scrollbar,
  Select,
  Slider,
  Step,
  Steps,
  Submenu,
  Switch,
  Table,
  TableColumn,
  TabPane,
  Tabs,
  Tooltip,
  Tree,
  Upload
]

locale.i18n((key, value) => i18n.t(key, value))
elementComponents.forEach(component => {
  Vue.use(component)
})
Vue.use(Loading.directive)
Vue.prototype.$ELEMENT = { size: elementSize }
Vue.prototype.$loading = Loading.service
Vue.prototype.$msgbox = MessageBox
Vue.prototype.$alert = MessageBox.alert
Vue.prototype.$confirm = MessageBox.confirm
Vue.prototype.$prompt = MessageBox.prompt
Vue.prototype.$message = Message
Vue.prototype.$notify = Notification

Vue.prototype.MP3 = new Audio()// 将播放音乐放置全局

// if (process.env.NODE_ENV === 'production') {
//   if (window) {
//     window.console.log = function () {};
//   }
// }

// 设置内存阈值，单位为MB
// const memoryThreshold = 1000;
// // 监听内存使用情况
// setInterval(() => {
//   const memoryUsage = window.performance.memory.usedJSHeapSize / (1024 * 1024);
//   console.log('内存使用情况:', memoryUsage, 'MB');
//   // console.log('阈值', window.performance.memory.usedJSHeapSize / (1024 * 1024))
//   // 如果内存使用超过阈值，则刷新页面
//   if (memoryUsage > memoryThreshold) {
//     console.log('内存超标，刷新页面');
//     // location.reload();
//   }
// }, 10000); // 每5秒检测一次内存使用情况

Vue.config.productionTip = false

new Vue({
  el: '#app',
  router,
  store,
  i18n,
  render: h => h(App)
})
