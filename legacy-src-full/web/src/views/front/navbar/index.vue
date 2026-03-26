<template>
  <div class="frontnav-box">
    <div class="goBackBox" style="cursor: pointer;" @click="goBack">
      <i class="al_element-icons al_iconfanhui2"></i>
    </div>
    <div class="time">
      <!--      <span>{{ nowDate }}</span>-->
      <!--      <span>{{ nowWeek }}</span>-->
      <!--      <span>{{ nowTime }}</span>-->
      <span>{{ nowTimes }}</span>

    </div>
    <div class="pro-name">{{ $t('public.ColdStationCentralManagementMenu') }}</div>
    <!--  在菜单栏中的选项  -->
    <div class="right">
      <!--      <el-select v-model="value" placeholder="请选择" @change="handlechange" class="select-box">-->
      <!--        <el-option-->
      <!--            v-for="item in options"-->
      <!--            :key="item.appid"-->
      <!--            :label="item.appexplainCNEN"-->
      <!--            :value="item.appid"-->
      <!--        >-->
      <!--        </el-option>-->
      <!--      </el-select>-->
      <el-cascader
          ref="cascader"
          :options="deviceTypeData"
          :placeholder="placeholder"
          :props="{
                emitPath:false,
                expandTrigger: 'hover',
                label: 'appexplainCNEN',
                value: 'key',
                children: 'appmanagerList',
              }"
          :value="deviceType"
          popper-class="myCascader"
          @change="chooseDeviceType"
      ></el-cascader>
      <LangSelect v-if="ifLangSelect"/>
      <unitSelete style="margin: 0 20px"/>
      <!--      <div class="" style="padding-left: 20px"></div>-->
      <!--      <user-avater/>-->
    </div>
  </div>
</template>
<script>
import userAvater from "@/views/userhomepage/components/user-avater";
import {mapGetters} from 'vuex';
import {findAllFloorModel} from "@/api/front/home";
import LangSelect from '@/components/LangSelect'
import unitSelete from '@/components/unitSelete'
import dayjs from "dayjs";
import 'dayjs/locale/zh-cn'; // 导入中文语言包
import 'dayjs/locale/en';

export default {
  inject: ["reload"],
  components: {
    userAvater,
    LangSelect,
    unitSelete
  },
  data() {
    return {
      value: '',
      options: [],
      nowWeek: "",
      nowDate: "",
      nowTime: "",
      nowTimes: '',
      ifLangSelect: false,
      deviceType: [],
      deviceTypeData: [],
      placeholder: '请选择',
    }
  },
  computed: {
    ...mapGetters(['path', 'userid', "appusergroup", "modelKey"])
  },
  created() {
    // if (process.env.VUE_APP_BASE_URL === 'https://www.ssge.com.cn:8098' || process.env.VUE_APP_BASE_URL === 'http://10.148.51.1:8098') {
    if (process.env.VUE_APP_IFLANGSELECT === 'true') {
      console.log('2222', process.env.VUE_APP_BASE_URL)
      this.ifLangSelect = true
    } else {
      console.log('else')
    }
    this.value = parseInt(this.path);
    this.initData()
    this.timer = setInterval(() => {
      this.setNowTimes();
    }, 1000);
  },
  beforeDestroy() {
    clearInterval(this.timer);
    this.timer = null;
  },
  methods: {
    goBack() {
      this.$router.push("/systemhomepage");
    },
    initData() {
      // findAllByCondition({userId: this.userid}).then(res => {
      //   // this.options = res.data || []
      //   this.options = res.data
      // })
      findAllFloorModel({userId: this.userid}).then(res => {
        // this.deviceType = []
        console.log('res', res)
        this.deviceTypeData = res.data || [];
        let item = res.data.find((ele) => ele.appid + ele.appName == this.path);
        let temData = []

        // 定义递归函数，处理子级数据，传入当前父级的 key 和直接父级的 key
        function buildParents(items, targetKey, parentKeys = []) {
          for (let item of items) {
            if (item.key === targetKey) {
              // 如果找到了目标项的 key，记录当前父级和直接父级的 key
              temData.push(...parentKeys, item.key);
            }
            if (item.appmanagerList) {
                  // 递归处理更深层级的子项，传入当前项的 key 作为直接父级
                  buildParents(item.appmanagerList, targetKey, [...parentKeys, item.key]);
                }
              }
            }

            // 调用递归函数，查找目标 key 的父级和当前项的 key
            res.data.forEach(tem => {
              if (tem.appid + tem.appName === this.path) {
                buildParents([tem], this.modelKey);
              }
            });
            console.log('temData', temData)
            // this.deviceType = item.appexplainCNEN;
            // this.deviceType = item;
            // console.log(item)
            // this.deviceType = [item.key];
            this.deviceType = temData;
            // this.placeholder = item.appexplainCNEN
            // console.log(item, this.deviceType)
          }
      )
    },
    handlechange() {
      // let item = this.options.find(ele=>ele.appid == this.value)
      let item = this.appusergroup.find((ele) => ele.appid == this.value);
      console.log(item)
      this.$store
          .dispatch("project/getMenuId", item).then(res => {
        this.reload()
      }).catch((error) => {
        this.$message.error(error.message || "切换项目失败");
      })
    }
    ,
    chooseDeviceType() {
      let nodesInfo = this.$refs['cascader'].getCheckedNodes()[0].data
      this.$store.commit("user/SET_MODELKEY", nodesInfo.key);

      this.chooseData = nodesInfo
      this.$notify.closeAll();
      let item = this.appusergroup.find((ele) => ele.appid == nodesInfo.appid);
      // console.log('item', item, this.appusergroup)
      this.placeholder = item.appexplainCNEN
      this.$store.dispatch("project/getMenuId", item).then((res) => {
        this.reload()
      }).catch(error => {
        this.$message.error(error.message || "切换项目失败");
        console.log('Promise失败', error)
      })
    }
    ,
    setNowTimes() {
      let myDate = new Date();
      let wk = myDate.getDay();
      let yy = String(myDate.getFullYear());
      let mm = myDate.getMonth() + 1;
      let dd = String(
          myDate.getDate() < 10 ? "0" + myDate.getDate() : myDate.getDate()
      );
      let hou = String(
          myDate.getHours() < 10 ? "0" + myDate.getHours() : myDate.getHours()
      );
      let min = String(
          myDate.getMinutes() < 10
              ? "0" + myDate.getMinutes()
              : myDate.getMinutes()
      );
      let sec = String(
          myDate.getSeconds() < 10
              ? "0" + myDate.getSeconds()
              : myDate.getSeconds()
      );
      let weeks = [
        "星期日",
        "星期一",
        "星期二",
        "星期三",
        "星期四",
        "星期五",
        "星期六",
      ];
      let week = weeks[wk];
      this.nowDate = yy + "年" + mm + "月" + dd + "日";
      this.nowTime = hou + ":" + min + ":" + sec;
      this.nowWeek = week;

      let formattedTime;
      // 根据当前语言设置配置dayjs
      if (this.$i18n.locale == 'zh') {
        dayjs.locale('zh-cn');
        formattedTime = dayjs().format('YYYY年M月D日 dddd HH:mm:ss');
      } else {
        dayjs.locale('en');
        formattedTime = dayjs().format('YYYY-MM-DD dddd HH:mm:ss');
      }
      //   console.log('2222',this.$i18n.locale,dayjs.locale() )
      //   console.log('2222',this.$i18n.locale, Cookies.get('language'))
      this.nowTimes = formattedTime
      // console.log('输出', formattedTime); // 输出：2024年1月14日 星期日 11.22.33
    }
    ,
  }
}
;
</script>
<style lang="scss" scoped>
.frontnav-box {
  position: relative;
  background:
    linear-gradient(135deg, rgba(10, 26, 42, 0.98) 0%, rgba(12, 45, 66, 0.92) 100%);
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(122, 210, 255, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);

  .goBackBox {
    position: absolute;
    left: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(122, 210, 255, 0.12);

    i {
      font-size: 28px;
      color: rgba(95, 231, 255, 0.9);
    }
  }

  .time {
    position: absolute;
    left: 84px;
    font-size: 16px;
    font-family: inherit;
    font-weight: 600;
    color: rgba(240, 247, 252, 0.92);

    span:nth-last-child(1) {
      position: relative;
      font-size: 16px;
      font-family: inherit;
      font-weight: 600;
      color: inherit;
      letter-spacing: 0.04em;
      margin-left: 0;
    }
  }

  .pro-name {
    color: rgba(245, 251, 255, 0.96);
    font-weight: 700;
    font-size: 20px;
    letter-spacing: 0.06em;
  }

  .right {
    display: flex;
    align-items: center;
    position: absolute;
    right: 18px;
    gap: 10px;

    .select-box {
      margin-right: 0;
    }
  }
}
</style>
<style lang="scss">
.right {
  .el-cascader {
    width: 260px;
    padding-right: 0;

    .el-input__inner {
      height: 42px;
      border: 1px solid rgba(122, 210, 255, 0.14);
      border-radius: 14px;
      text-align: left;
      font-size: 14px;
      color: rgba(245, 251, 255, 0.96);
      background: rgba(255, 255, 255, 0.04);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
      padding-right: 40px;
    }

    .el-input__suffix {
      right: 12px;
    }

    .el-input__suffix-inner {
      color: rgba(191, 220, 236, 0.72);
    }
  }
}

.myCascader {
  margin-top: 10px !important;
  border: 1px solid rgba(116, 211, 255, 0.14) !important;
  border-radius: 22px !important;
  background: linear-gradient(180deg, rgba(6, 19, 31, 0.98) 0%, rgba(11, 30, 48, 0.98) 100%) !important;
  box-shadow: 0 28px 56px rgba(0, 0, 0, 0.34) !important;
  overflow: hidden;

  .popper__arrow,
  .popper__arrow::after {
    display: none !important;
  }

  .el-cascader-menu {
    min-width: 240px;
    border-right: 1px solid rgba(116, 211, 255, 0.08) !important;
    background: transparent !important;
  }

  .el-cascader-menu:last-child {
    border-right: 0 !important;
  }

  .el-cascader-menu__wrap {
    background: transparent !important;
  }

  .el-cascader-node {
    height: 52px;
    padding: 0 20px;
    color: rgba(226, 238, 247, 0.82);
    background: transparent;
  }

  .el-cascader-node__label {
    font-size: 16px;
    font-weight: 600;
  }

  .el-cascader-node.in-active-path,
  .el-cascader-node.is-active,
  .el-cascader-node.is-selectable.in-checked-path {
    color: #f3fbff;
    background: linear-gradient(90deg, rgba(102, 186, 255, 0.2) 0%, rgba(102, 186, 255, 0.06) 100%);
  }

  .el-cascader-node:hover {
    color: #f3fbff;
    font-weight: 700;
    background: rgba(102, 186, 255, 0.12);
  }
}
</style>
