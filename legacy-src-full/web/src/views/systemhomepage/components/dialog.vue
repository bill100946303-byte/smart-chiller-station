<template>
  <div class="dialog-shell">
    <button class="dialog-backdrop" type="button" @click="close"></button>
    <div v-if="!monitorShow" class="dialog">
      <div class="dialog-header">
        <div class="title-group">
          <div class="title-eyebrow">{{ $t('defaultpage.energyConsumptionCoefficient') }}</div>
          <el-tooltip :content="drTitleNameAll || drTitleName" placement="top">
            <div class="drName">{{ drTitleName }}</div>
          </el-tooltip>
          <div class="title-meta">
            <span class="meta-chip">{{ structureDrid }}</span>
            <span class="meta-chip meta-chip-active">{{ currentTabLabel }}</span>
          </div>
        </div>
        <button class="close" type="button" @click="close">
          <i class="el-icon-close"></i>
        </button>
      </div>

      <div class="navs-wrapper">
        <div class="navs">
          <button
              v-for="(item, index) in navlist"
              :key="index"
              :class="[nav === index ? 'active' : '', 'nav-item']"
              type="button"
              @click="changenav(item.name, index)"
          >
            {{ $t(`dialog.${item.component}`) }}
          </button>
        </div>
      </div>

      <keep-alive>
        <div class="dialog-main">
          <div class="dialog-main-inner">
            <component
                :is="currentTabComponent"
                :drId="structureDrid"
                :drName="drName"
                :drTitleName="drTitleName"
                :drTypeId="drTypeId"
                :device2Durl="device2Durl"
            />
          </div>
        </div>
      </keep-alive>
    </div>
    <div v-else class="dialog dialog--monitor">
      <monitor :drId="structureDrid" :drName="drName" :drTitleName="drTitleName" :runningid="runningid" @close="close"/>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import Bei from "./dialog-comp/Bei.vue";
import Base from "./dialog-comp/base.vue";
import Police from "./dialog-comp/police.vue";
import Assets from "./dialog-comp/assets.vue";
import Yaokong from "./dialog-comp/yaokong.vue";
import Device from "./dialog-comp/device.vue";
import Chuangan from "./dialog-comp/chuangan.vue";
import Dian from "./dialog-comp/dian.vue";
import info from "./dialog-comp/info.vue";
import {handelNavControl} from "../websocket/deviceControl";
import {findRegBasicParametersByDrid, findDevice2DModelUrlByDrId} from "@/api/front/home";
import store from '@/store'
import monitor from "./monitor";

export default {
  props: ["drTypeId", "structureDrid", 'drName', 'pageNav', 'runningid'],
  data() {
    return {
      drTitleName: '',
      drTitleNameAll: '',
      nav: 0,
      navlist: [
        // {
        //   name: "设备信息",
        //   component: "info",
        // },
        {
          name: "基本参数",
          component: "Base",
        },
        {
          name: "设备控制",
          component: "Bei",
        },


        // {
        //   name: "电表数据",
        //   component: "Dian",
        // },
        {
          name: "设备能耗",
          component: "Device",
        },
        {
          name: "报警记录",
          component: "Police",
        },
        // {
        //   name: "传感器诊断",
        //   component: "Chuangan",
        // },
        // {
        //   name: "资产信息",

        //   component: "Assets",
        // },
        {
          name: "操作记录",
          component: "Yaokong",
        },
      ],

      subs: [],
      monitorShow: false,
      device2Durl: ''
    };
  },
  components: {
    Bei,
    Base,
    Police,
    Assets,
    Yaokong,
    Device,
    // Chuangan,
    Dian,
    monitor,
    info
  },
  computed: {
    ...mapGetters(["path", "userid", "websocket", "dianInfo"]),
    currentTabComponent() {
      return this.navlist[this.nav].component;
    },
    currentTabLabel() {
      const current = this.navlist[this.nav];
      return current ? this.$t(`dialog.${current.component}`) : "";
    }
  },
  watch: {
    structureDrid: {
      handler(val) {
        if (val) {
          if (this.drName.startsWith('SXT')){
            this.monitorShow = true
            console.log('1111111',this.drName,this.structureDrid)
            return
          }
         /* handelNavControl("基本参数", {
            userId: this.userid,
            drId: this.structureDrid,
          });*/
          // 由于使用websocket有时候会断开，所有使用以下get请求
         let data = {
            userId: this.userid,
            drId: this.structureDrid,
            isEnergy: false,
            language: this.$i18n.locale
          }
          findRegBasicParametersByDrid(this.path, data).then((res) => {
            let data = JSON.parse(res.data);
            console.log('data', data)
            if (data.type === "clickBaseParamsPopup") {
              store.commit("front/SET_baseInfo2", data.data2);
            } else {
              this.$message.error("当前参数出现错误");
            }
          });
        }
      },
      immediate: true,
    },
    pageNav: {
      handler(val) {
        if (val) {
          this.nav = this.pageNav
        }
      },
      immediate: true,
    },
  },
  created() {
    const data = {
      userId: this.userid,
      drId: this.structureDrid,
    }

    findDevice2DModelUrlByDrId(this.path, data).then(res => {
      console.log('res', res)
      this.drTitleNameAll = res.data.drcode + ',' + res.data.drnameEN
      console.log(this.drTitleNameAll.length, this.drTitleNameAll)
      this.drTitleName = this.drTitleNameAll || this.drName

      if (res.data.isEnergy === 0) {
        this.navlist = [
          {
            name: "基本参数",
            component: "Base",
          },
          {
            name: "设备控制",
            component: "Bei",
          },
          // {
          //   name: "设备能耗",
          //   component: "Device",
          // },
          {
            name: "报警记录",
            component: "Police",
          },
          {
            name: "操作记录",
            component: "Yaokong",
          },
        ]
      }
      if (res.data.isShowDrInfo > 0) {
        this.navlist.unshift({
          name: "设备信息",
          component: "info",
        })
        this.device2Durl = res.data.model2dIp
        // this.device2Durl = 'http://192.168.110.134:8081/'
      }
    })
  },
  methods: {
    changenav(name, index) {
      this.nav = index;
    },

    close() {
      console.log('close调用')
      this.monitorShow = false
      this.$emit("close");
    },
  },
};
</script>

<style lang="scss" scoped>
.dialog-shell {
  position: fixed;
  inset: 0;
  z-index: 14;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.dialog-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: linear-gradient(180deg, rgba(2, 10, 18, 0.46) 0%, rgba(2, 8, 14, 0.62) 100%);
  backdrop-filter: blur(12px);
  cursor: pointer;
}

.dialog {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: min(1180px, calc(100vw - 88px));
  min-height: 620px;
  max-height: calc(100vh - 88px);
  border: 1px solid rgba(133, 204, 255, 0.14);
  border-radius: 28px;
  overflow: hidden;
  background:
      radial-gradient(circle at top left, rgba(82, 192, 255, 0.18) 0%, transparent 28%),
      linear-gradient(180deg, rgba(12, 24, 38, 0.98) 0%, rgba(6, 15, 26, 0.96) 100%);
  box-shadow:
      0 28px 70px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.dialog--monitor {
  padding: 0;
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 26px 28px 18px;
  background: linear-gradient(180deg, rgba(14, 31, 48, 0.96) 0%, rgba(12, 24, 38, 0.82) 100%);
  border-bottom: 1px solid rgba(125, 198, 248, 0.1);
}

.title-group {
  min-width: 0;
}

.title-eyebrow {
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(150, 208, 245, 0.7);
}

.drName {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.1;
  color: rgba(244, 250, 255, 0.98);
}

.title-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(141, 203, 241, 0.12);
  font-size: 12px;
  letter-spacing: 0.04em;
  color: rgba(205, 228, 244, 0.84);
}

.meta-chip-active {
  color: rgba(245, 251, 255, 0.96);
  background: linear-gradient(135deg, rgba(48, 120, 255, 0.28) 0%, rgba(32, 169, 210, 0.18) 100%);
  border-color: rgba(112, 196, 255, 0.24);
}

.close {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(141, 203, 241, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(233, 246, 255, 0.82);
  font-size: 18px;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(160, 213, 243, 0.24);
    transform: translateY(-1px);
  }
}

.navs-wrapper {
  padding: 0 28px 18px;
  background: linear-gradient(180deg, rgba(12, 24, 38, 0.82) 0%, rgba(8, 20, 31, 0.6) 100%);
}

.navs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.nav-item {
  padding: 10px 16px;
  border: 1px solid rgba(141, 203, 241, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: rgba(211, 230, 244, 0.82);
  transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(160, 213, 243, 0.22);
    color: rgba(247, 251, 255, 0.94);
  }

  &.active {
    color: rgba(248, 252, 255, 0.98);
    background: linear-gradient(135deg, rgba(50, 133, 255, 0.32) 0%, rgba(28, 171, 214, 0.2) 100%);
    border-color: rgba(128, 203, 255, 0.28);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
}

.dialog-main {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 28px 28px;
  color: rgba(223, 237, 247, 0.88);
}

.dialog-main-inner {
  min-height: 100%;
  padding: 24px;
  border-radius: 22px;
  background:
      linear-gradient(180deg, rgba(15, 32, 50, 0.94) 0%, rgba(9, 22, 35, 0.92) 100%);
  border: 1px solid rgba(125, 198, 248, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.dialog-main-inner ::v-deep .device-box,
.dialog-main-inner ::v-deep .baseCan,
.dialog-main-inner ::v-deep .police-box,
.dialog-main-inner ::v-deep .yaokong-box {
  margin: 0;
  padding: 0;
}

.dialog-main-inner ::v-deep .info-container {
  color: rgba(233, 244, 250, 0.9);
}

.dialog-main-inner ::v-deep .el-table {
  background: transparent;
  color: rgba(233, 244, 250, 0.9);
}

.dialog-main-inner ::v-deep .el-table::before,
.dialog-main-inner ::v-deep .el-table th.is-leaf,
.dialog-main-inner ::v-deep .el-table td {
  border-color: rgba(130, 191, 228, 0.12) !important;
}

.dialog-main-inner ::v-deep .el-table tr,
.dialog-main-inner ::v-deep .el-table th,
.dialog-main-inner ::v-deep .el-table td {
  background: transparent !important;
}

.dialog-main-inner ::v-deep .el-table thead th {
  background: rgba(26, 53, 77, 0.88) !important;
  color: rgba(245, 250, 255, 0.94) !important;
}

.dialog-main-inner ::v-deep .warning-row,
.dialog-main-inner ::v-deep .success-row {
  background: rgba(255, 255, 255, 0.02) !important;
}

.dialog-main-inner ::v-deep .el-table__body tr:hover > td {
  background: rgba(255, 255, 255, 0.04) !important;
}

.dialog-main-inner ::v-deep .el-input__inner,
.dialog-main-inner ::v-deep .el-textarea__inner,
.dialog-main-inner ::v-deep .el-date-editor.el-input__inner,
.dialog-main-inner ::v-deep .el-date-editor .el-input__inner {
  background: rgba(5, 17, 29, 0.92);
  border-color: rgba(119, 188, 231, 0.16);
  color: rgba(241, 248, 252, 0.94);
}

.dialog-main-inner ::v-deep .el-input__inner:focus,
.dialog-main-inner ::v-deep .el-textarea__inner:focus {
  border-color: rgba(112, 196, 255, 0.34);
}

.dialog-main-inner ::v-deep .el-radio-button__inner,
.dialog-main-inner ::v-deep .el-button {
  border-radius: 12px;
}

.dialog-main-inner ::v-deep .el-radio-button__inner {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(130, 191, 228, 0.12);
  color: rgba(224, 237, 247, 0.86);
  box-shadow: none;
}

.dialog-main-inner ::v-deep .el-radio-button__orig-radio:checked + .el-radio-button__inner {
  background: linear-gradient(135deg, rgba(56, 128, 255, 0.82) 0%, rgba(31, 157, 210, 0.8) 100%) !important;
  border-color: transparent !important;
  color: #fff !important;
}

.dialog-main-inner ::v-deep .el-button:not(.el-button--primary) {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(130, 191, 228, 0.12);
  color: rgba(235, 245, 252, 0.88);
}

.dialog-main-inner ::v-deep .el-button--primary {
  background: linear-gradient(135deg, #2d86ff 0%, #1ca2da 100%);
  border-color: transparent;
  color: #fff;
}

.dialog-main-inner ::v-deep .el-empty__description p {
  color: rgba(196, 220, 239, 0.8);
}

@media (max-width: 1200px) {
  .dialog-shell {
    padding: 24px;
  }

  .dialog {
    width: calc(100vw - 48px);
    max-height: calc(100vh - 48px);
  }
}

@media (max-width: 860px) {
  .dialog-shell {
    padding: 16px;
  }

  .dialog {
    width: calc(100vw - 32px);
    min-height: 0;
    max-height: calc(100vh - 32px);
    border-radius: 22px;
  }

  .dialog-header,
  .navs-wrapper,
  .dialog-main {
    padding-left: 18px;
    padding-right: 18px;
  }

  .dialog-main {
    padding-bottom: 18px;
  }

  .dialog-main-inner {
    padding: 18px;
    border-radius: 18px;
  }

  .drName {
    font-size: 24px;
  }
}
</style>
