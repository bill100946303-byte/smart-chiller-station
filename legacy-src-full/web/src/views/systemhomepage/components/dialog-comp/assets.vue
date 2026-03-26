<template >
  <div class="info">
    <div class="detail" v-for="(item, index) in infolist" :key="index">
      <div class="title">{{ item.title }}</div>
      <div class="num">{{ item.value }}</div>
    </div>
    <div id="qrcode" ref="qrcode" />
  </div>
</template>
<script>
import QRCode from "qrcodejs2";
import { mapGetters } from 'vuex';
import {findDr} from '@/api/front/home'
export default {
  props:['drId'],
  data () {
    return {
      propertyInfo: {}, // 资产信息

      infolist: [
        {
          title: '产品型号:',
          name: 'drManufactureStyle',
          value: ' '
        },
        {
          title: '生产厂家:',
          name: 'drManufactureFactory',
          value: ' '
        },
        {
          title: '厂家电话:',
          name: 'drFactoryphone',
          value: ' '
        },
        {
          title: '安装时间:',
          name: 'drInstallTime',
          value: ' '
        },
        {
          title: '安装厂家:',
          name: 'drInstallFactory',
          value: ' '
        },
        {
          title: '联系人:',
          name: 'drInstallPhone',
          value: ' '
        },
        {
          title: '使用情况:',
          name: 'drUseState',
          value: ' '
        },
        {
          title: '使用说明:',
          name: 'drUseExplain',
          value: ' '
        }
      ],
    }
  },
  created () {
    this.initData()
  },
  computed:{
    ...mapGetters(['path'])
  },
  mounted () {
    this.$nextTick(() => {
      let qrcode = document.querySelector('#qrcode');
      qrcode.innerHTML = ''
      this.qrcode();
    })
  },
  methods: {
    initData(){
      findDr(this.path,{
        drid:this.drId
      }).then(res=>{
        this.infolist.forEach(item => {
        item.value = res.data[item.name] || '--'
        if (item.name == 'drInstallTime') {
          let data = new Date(res.data.drInstallTime)
          item.value = data.getFullYear() + '-' + (data.getMonth() + 1) + "-" + data.getDate()
        }
      })
      this.propertyInfo = res.data;
      })
    },
    qrcode () {
      let mdcode =
        this.propertyInfo.mdcode == null ? "" : this.propertyInfo.mdcode;
      let reg = /[0-9]+/g;
      let projectId = parseInt(this.path);
      let name = this.path.replace(reg, "");
      let drid = this.propertyInfo.drid;
      let drname = this.propertyInfo.drname;
      let drtypename = this.propertyInfo.drtypename;
      let qrcode = new QRCode("qrcode", {
        width: 100, // 设置宽度
        height: 100, // 设置高度
        text: `设备编号: ${mdcode},项目ID: ${projectId},项目名: ${name},设备ID: ${drid},设备名称: ${drname},设备类型: ${drtypename}`,
      });
    },
  },
}
</script>
<style lang="scss" scoped>
.info {
  margin-top: 86px;
  display: grid;
  padding: 0 57px;
  grid-template-columns: repeat(4, 210px);
  .detail {
    display: flex;
    align-items: flex-start;
    padding: 0 10px 0 30px;
    margin-bottom: 87px;
    justify-content: space-between;
    .title {
      white-space: nowrap;
      margin-right: 5px;
      font-size: 14px;

      color: #06a4f8;
      text-shadow: 0px 6px 8px rgba(0, 0, 0, 0.75);
    }
    .num {
      font-size: 14px;
    }
  }
  img {
    width: 80px;
    margin-left: 38px;
  }
}
</style>