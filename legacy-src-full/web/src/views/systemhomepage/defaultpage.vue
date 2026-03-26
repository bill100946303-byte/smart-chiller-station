<template>
  <div
      :class="[
        'default-box-content',
        {
          'menu-open': leave,
          'is-2d-mode': is2DMode,
          'is-shell-compact': isShellCompact,
          'is-scene-simplified': isSceneSimplified
        }
      ]"
      :style="shellStyleVars"
      @scroll="scrollEvent"
      ref="scrollbox"
  >
    <chat/>
    <nav class="nav" v-show="loadshow" ref="navbar">
      <!--      <el-button @click="btn()">123165465</el-button>
            <el-button @click="btn2()">4444</el-button>-->
      <div class="left">
        <button class="ce menu-trigger" type="button" @click="handleMenuchange">
          <!--          <img src="../../assets/ce.png" alt="" @click="handleMenuchange"/>-->
          <i class="al_element-icons2 al_icon2caidan nav-menu-icon"></i>
        </button>
        <div class="logo" @click="Godefaultpage">
          <img
              v-if="shouldShowLogo('applogoimg')"
              class="logo-left logo-left--primary"
              :src="getLogoSrc('applogoimg')"
              :alt="brandText"
              @error="handleLogoAssetError('applogoimg')"
          />
          <img
              v-else-if="shouldShowLogo('apppic')"
              class="logo-left logo-left--secondary"
              :src="getLogoSrc('apppic')"
              :alt="brandText"
              @error="handleLogoAssetError('apppic')"
          />
          <div v-else class="logo-fallback">
            <div class="logo-fallback__mark">{{ brandInitial }}</div>
            <div class="logo-fallback__text">{{ brandText }}</div>
          </div>
        </div>
      </div>
      <div class="titleBox">
        <div class="title" @click="">
          <el-cascader
              ref="cascader"
              v-model="deviceType"
              :options="deviceTypeData"
              :placeholder="placeholder"
              :props="{
                emitPath:false,
                expandTrigger: 'hover',
                label: 'appexplainCNEN',
                value: 'key',
                children: 'appmanagerList',
              }"
              popper-class="myCascaderDefau"
              @change="chooseDeviceType"
          ></el-cascader>
        </div>
      </div>
      <div class="right">
        <div class="user">
          <div v-if="ifLangSelect" class="toolbar-item toolbar-item-lang">
            <LangSelect/>
          </div>
          <div class="toolbar-item">
            <unitSelete/>
          </div>
          <user-avater/>
        </div>
      </div>
      <!--      <div class="tempture-box"></div>-->

    </nav>
      <div v-show="loadshow" class="tempture">
        <div class="item" @click="gopage('湿球温度', undefined, '℃')">
          <div class="left">
            <i class="al_element-icons2 al_icon2a-16x16wendu tempture-icon"></i>
          </div>
          <div class="right">
            <div class="num">{{ navtop["湿球温度"] }}℃</div>
            <p>{{ $t('defaultpage.wetBulb') }}</p>
          </div>
        </div>
        <div class="item" @click="gopage('室外湿度', undefined)">
          <div class="left">
            <i class="al_element-icons2 al_icon2a-16x16shidu tempture-icon tempture-icon-small"></i>
          </div>
          <div class="right">
            <div class="num">{{ navtop["室外湿度"] }}%</div>
            <p>{{ $t('defaultpage.outdoorHumidity') }}</p>
          </div>
        </div>
        <div class="item" @click="gopage('室外温度', undefined, '℃')">
          <div class="left">
            <i class="al_element-icons2 al_icon2a-16x16wendu tempture-icon"></i>
          </div>
          <div class="right">
            <div class="num">{{ navtop["室外温度"] }}℃</div>
            <p>{{ $t('defaultpage.outdoorTemperature') }}</p>
          </div>
        </div>
      </div>
    <div :class="[leave ? 'active' : '', 'menu-box']">
      <sidebar/>
    </div>
    <!--    <div class="boxDay" @click="clickOnline">-->
    <!--        <span>{{ nowDate }}</span>-->
    <!--        <span>{{ nowWeek }}</span>-->
    <!--        <span>{{ nowTime }}</span>-->
    <!--      <span>{{ nowTimes }}</span>-->
    <!--    </div>-->
    <div
        :class="[leave ? 'noactive' : '', 'left-contatiner', logo.applogotext === '江西晶科8GW' ?'contatiner8GW':'']"
        v-show="loadshow"
    >
      <!--        v-if="modelKey !== '131szhkcooperation-1-2'"-->
      <!--      <div class="day" @click="clickOnline">-->
      <!--        <span>{{ nowDate }}</span>-->
      <!--        <span>{{ nowWeek }}</span>-->
      <!--        <span>{{ nowTime }}</span>-->
      <!--        <span>{{ nowTimes }}</span>-->
      <!--      </div>-->
      <!--      <div class="rendering" v-if="logo.applogotext === '江西晶科8GW'">-->
      <!--        <img src="../../assets/rendering.png" alt="">-->
      <!--      </div>-->
      <HomepageConfiguration style="position: absolute"/>
      <run-list v-if="template == 1"/>
      <run-list2 v-else-if="template == 2"/>
    </div>

    <div class="middle" ref="middle">
      <div class="middle-shell">
        <div :class="['scene-stage', { 'scene-stage--empty': !hasSceneSource, 'scene-stage--loading': sceneLoading }]">
          <div class="scene-stage__hud">
            <div class="scene-stage__eyebrow">{{ sceneEyebrow }}</div>
            <div class="scene-stage__title-row">
              <div class="scene-stage__title">{{ sceneTitle }}</div>
              <div class="scene-stage__badge">{{ iframeSelection }}</div>
            </div>
            <div class="scene-stage__meta">{{ sceneModeLabel }} · {{ sceneStatusText }}</div>
          </div>
          <iframe
              ref="iframe"
              :src="threeurl"
              class="scene-stage__frame"
              @load="handleSceneLoad"
              @error="handleSceneError"
              frameborder="0"
              mozallowfullscreen
              webkitallowfullscreen
              allowfullscreen
          ></iframe>
          <div v-if="showSceneOverlay" class="scene-stage__overlay">
            <div class="scene-stage__overlay-card">
              <div class="scene-stage__overlay-eyebrow">{{ sceneAvailabilityEyebrow }}</div>
              <div class="scene-stage__overlay-title">{{ sceneAvailabilityTitle }}</div>
              <p>{{ sceneAvailabilityDescription }}</p>
              <div class="scene-stage__overlay-meta">
                <span :class="['scene-stage__overlay-chip', has3DSource ? 'is-ready' : 'is-muted']">
                  3D {{ has3DSource ? '已就绪' : '缺失' }}
                </span>
                <span :class="['scene-stage__overlay-chip', has2DSource ? 'is-ready' : 'is-muted']">
                  2D {{ has2DSource ? '已就绪' : '缺失' }}
                </span>
                <span class="scene-stage__overlay-chip is-current">{{ iframeSelection }}</span>
              </div>
            </div>
          </div>
          <div class="scene-stage__vignette"></div>
          <div class="scene-stage__scanlines"></div>
          <div class="scene-stage__footer">
            <span>{{ isSceneSimplified ? "简化视图" : "标准视图" }}</span>
            <span>{{ nowTimes }}</span>
          </div>
        </div>
      </div>
      <!-- <iframe
          ref="iframe"
          src="http://127.0.0.1:3000/"
          style="width: 100%; height: 100%"
          frameborder="0"
          mozallowfullscreen
          webkitallowfullscreen
          allowfullscreen
      ></iframe>-->
      <!-- <canvas
        id="webgl"
        style="width: 100%; height: 100%; position: absolute; left: 0; top: 0"
      ></canvas> -->
    </div>
    <div v-show="loadshow" :class="['right-contatiner']">
      <!--      v-if="modelKey !== '131szhkcooperation-1-2'"-->
      <run-right v-if="template == 1"/>
      <run-right2 v-else-if="template == 2"/>
    </div>


    <div class="bottom" v-show="iscontrol">
      <div class="switch_iframe">
        <!--        <el-button :disabled="chooseData.modelIp === ''" :type="btnType ? 'primary' : ''" class="switch_iframe_btn"
                           @click="clickSwitchIframe('3D')">3D
                </el-button>
                <el-button :disabled="chooseData.model2dIp === null" :type="!btnType ? 'primary' : ''" class="switch_iframe_btn"
                           @click="clickSwitchIframe('2D')">2D
                </el-button>-->
        <!--        <div :class="['unitLeft', iframeSelection === '3D' ? 'unitIsColor': '']"
                     :style="chooseData.modelIp === null ? 'cursor: not-allowed':''"
                     @click="clickSwitchIframe('3D')">-->
        <div
            :class="['iframeLeft',
            (chooseData.modelIp === null || chooseData.modelIp === '') ? 'iframeDisable' : '',
            iframeSelection === '3D' ? 'iframeIsColor': '']"
            @click="chooseData.modelIp ? clickSwitchIframe('3D') : null"
        >3D
        </div>
        <div
            :class="[
             'iframeRight',
            (chooseData.model2dIp === null || chooseData.model2dIp === '') ? 'iframeDisable' : '',
            iframeSelection === '2D' ? 'iframeIsColor': ''
            ]"
            @click="chooseData.model2dIp ? clickSwitchIframe('2D') : null"
        >2D
        </div>
      </div>
      <div class="bottom-actions">
        <button
            type="button"
            :class="['tool-action', 'tool-action--scene-mode', isSceneSimplified ? 'is-active' : '']"
            :title="isSceneSimplified ? '切换到标准视图' : '切换到简化视图'"
            @click="toggleSceneViewMode"
        >
          <span class="tool-action__label">{{ isSceneSimplified ? '标' : '简' }}</span>
        </button>
        <i class="tool-action al_element-icons al_iconyincangshuju"
           @click="ishandlecontrol(1)"></i>
        <i class="tool-action al_element-icons al_iconshijiaojuzhong"
           @click="ishandlecontrol(2)"></i>
        <screen-full/>
      </div>

    </div>
    <!-- 3d点击采集参数弹窗 -->
    <Dialog
        v-if="dialogshow"
        @close="handledialogshow"
        :drTypeId="drTypeId"
        :structureDrid="structureDrid"
        :drName='drName'
        :drTitleName='drTitleName'
        :pageNav="pageNav"
        :runningid="runningid"
    />
  </div>
</template>

<script>
import {mapGetters} from "vuex";

import navMenu from "./components/navMenu";
import chat from "./components/chat";
import sidebar from "./components/Sidebar";
import Dialog from "./components/dialog";
import HomepageConfiguration from "./components/HomepageConfiguration";
import ScreenFull from "./components/ScreenFull.vue";
import runList from "./components/side/left";
import runList2 from "./components/side/left2";
import runRight from "./components/side/right";
import runRight2 from "./components/side/right2";
import {findSub, operationRegs} from "@/api/usersetting/devicemonitor/model1";
import {findAllByCondition, findAllFloorModel} from "@/api/front/home";
import userAvater from "../userhomepage/components/user-avater";
// import { Instantiate, ILus, IOperation } from "zsqy-cold-site";
import {MySocket} from "./websocket/index";
import globalData from "@/utils/global";
import srcMp3 from '@/assets/warn.mp3'
import {getToken} from '@/utils/auth'
import {notify} from "@/api/usersetting/userpagehome";
import LangSelect from '@/components/LangSelect'
import unitSelete from '@/components/unitSelete'
import dayjs from "dayjs";
import 'dayjs/locale/zh-cn'; // 导入中文语言包
import 'dayjs/locale/en';
import Cookies from "js-cookie"; // 导入英文语言包

export default {
  inject: ["reload"],
  components: {
    userAvater,
    runList,
    runList2,
    navMenu,
    sidebar,
    Dialog,
    runRight,
    runRight2,
    ScreenFull,
    LangSelect,
    unitSelete,
    chat,
    HomepageConfiguration
  },
  computed: {
    ...mapGetters([
      "path",
      "sidelist",
      "leave",
      "userid",
      "navtop",
      "websocket",
      "logo",
      "appusergroup",
      "alarmData",
      "clearAlarmSound",
      "name",
      "iframeSelection",
      "modelKey",
      "template"
    ]),
    brandText() {
      return (this.logo && this.logo.applogotext) || "冷站控制台";
    },
    brandInitial() {
      return String(this.brandText || "冷").slice(0, 1);
    },
    sceneTitle() {
      return this.placeholder && this.placeholder !== "请选择" ? this.placeholder : this.brandText;
    },
    sceneEyebrow() {
      return this.template === 2 ? "热站系统图" : "冷站系统图";
    },
    sceneModeLabel() {
      return this.iframeSelection === "3D" ? "数字孪生主舞台" : "工艺流程主舞台";
    },
    is2DMode() {
      return this.iframeSelection === "2D";
    },
    isSceneSimplified() {
      return this.sceneViewMode === "simplified";
    },
    has3DSource() {
      return Boolean(this.chooseData && this.chooseData.modelIp);
    },
    has2DSource() {
      return Boolean(this.chooseData && this.chooseData.model2dIp);
    },
    hasSceneSource() {
      return Boolean(this.modelIp);
    },
    showSceneOverlay() {
      return !this.hasSceneSource || this.sceneLoading || this.sceneLoadFailed;
    },
    sceneStatusText() {
      if (this.sceneLoadFailed) {
        return "场景异常";
      }
      if (!this.hasSceneSource) {
        return "无可用源";
      }
      if (this.sceneLoading) {
        return "场景加载中";
      }
      return "场景已就绪";
    },
    sceneAvailabilityEyebrow() {
      if (this.sceneLoadFailed) {
        return "Scene Error";
      }
      if (!this.hasSceneSource) {
        return "Scene Missing";
      }
      return "Scene Loading";
    },
    sceneAvailabilityTitle() {
      if (this.sceneLoadFailed) {
        return `${this.iframeSelection} 场景暂时不可用`;
      }
      if (!this.hasSceneSource) {
        return `当前项目未配置 ${this.iframeSelection} 场景`;
      }
      return `${this.iframeSelection} 场景正在接入`;
    },
    sceneAvailabilityDescription() {
      if (this.sceneLoadFailed) {
        return "场景容器已创建，但旧场景资源没有正常返回。请检查模型地址、静态资源服务或跨域配置。";
      }
      if (!this.hasSceneSource) {
        if (this.iframeSelection === "3D" && this.has2DSource) {
          return "当前只检测到 2D 场景源，可以先切到 2D 模式继续查看设备链路。";
        }
        if (this.iframeSelection === "2D" && this.has3DSource) {
          return "当前只检测到 3D 场景源，可以先切到 3D 模式继续查看场景画面。";
        }
        return "当前项目缺少可用的 2D / 3D 场景地址，旧场景无法在这里建立连接。";
      }
      return "正在连接旧场景资源并建立视图桥接。切到 2D 时会自动补发登录 token，避免空白或未鉴权状态。";
    },
    sceneTargetOrigin() {
      if (!this.threeurl) {
        return "*";
      }
      try {
        return new URL(this.threeurl, window.location.href).origin;
      } catch (error) {
        return "*";
      }
    },
    threeurl() {
      // let model = this.appusergroup.find((ele) => ele.appid === this.value);
      // return model ? model.modelIp : "";
      // let model = "http://127.0.0.1:3000/";
      // return model;
      // return "https://ln.szgreenenergy.com:4015/2d/floor/
      // eleven"
      return this.modelIp
      // return 'http://192.168.110.134:3000/'
    },
    shellScale() {
      const baseWidth = 1920;
      const baseHeight = 1080;
      const widthRatio = this.viewportWidth / baseWidth;
      const heightRatio = this.viewportHeight / baseHeight;
      return Math.max(0.78, Math.min(1, Math.min(widthRatio, heightRatio)));
    },
    isShellCompact() {
      return this.shellScale < 0.92 || this.viewportHeight < 980;
    },
    shellStyleVars() {
      const scale = this.shellScale;
      const edgePadding = Math.max(10, Math.min(16, Math.round(16 * scale)));
      const navOffsetBase = this.is2DMode ? 84 : 88;
      const navShellBase = this.is2DMode ? 62 : 68;
      const navOffset = Math.max(60, Math.min(92, Math.round((navOffsetBase - (this.isSceneSimplified ? 14 : 0)) * scale)));
      const navShellHeight = Math.max(46, Math.min(68, Math.round((navShellBase - (this.isSceneSimplified ? 12 : 0)) * scale)));
      const menuWidth = Math.max(160, Math.min(188, Math.round(184 * scale)));
      const panelGap = Math.max(10, Math.min(20, Math.round((this.is2DMode ? 16 : 16) * scale)) - (this.isSceneSimplified ? 2 : 0));
      const panelWidthMax = (this.is2DMode ? 386 : 366) - (this.isSceneSimplified ? 88 : 0);
      const panelWidthMin = (this.is2DMode ? 308 : 296) - (this.isSceneSimplified ? 56 : 0);
      const panelWidth = Math.max(panelWidthMin, Math.min(panelWidthMax, Math.round(panelWidthMax * scale)));
      const panelBottom = Math.max(16, Math.min(58, Math.round(((this.is2DMode ? 48 : 42) - (this.isSceneSimplified ? 22 : 0)) * scale)));
      const dockBottom = Math.max(12, Math.min(44, Math.round(((this.is2DMode ? 36 : 32) - (this.isSceneSimplified ? 14 : 0)) * scale)));
      const tempBarWidth = Math.max(
        188,
        Math.min(
          (this.is2DMode ? 376 : 432) - (this.isSceneSimplified ? 132 : 0),
          this.viewportWidth - (panelWidth * 2) - (panelGap * 2) - ((this.is2DMode ? 250 : 328) - (this.isSceneSimplified ? 64 : 0))
        )
      );
      let sceneFrameScale = this.is2DMode ? 0.89 : 0.94;
      if (this.is2DMode) {
        const scalePressure = Math.min(1, Math.max(0, (0.96 - scale) / 0.18));
        const widthPressure = Math.min(1, Math.max(0, (1680 - this.viewportWidth) / 420));
        const heightPressure = Math.min(1, Math.max(0, (960 - this.viewportHeight) / 220));
        const pressure = Math.max(scalePressure, widthPressure, heightPressure);
        sceneFrameScale = 0.89 - pressure * 0.08;
        if (this.viewportHeight < 980) {
          sceneFrameScale = Math.min(sceneFrameScale, 0.8);
        }
      } else {
        const widthPressure = Math.min(1, Math.max(0, (1760 - this.viewportWidth) / 520));
        const heightPressure = Math.min(1, Math.max(0, (980 - this.viewportHeight) / 240));
        const pressure = Math.max(widthPressure, heightPressure);
        sceneFrameScale = 0.94 - pressure * 0.04;
      }
      return {
        "--shell-edge-padding": `${edgePadding}px`,
        "--nav-offset": `${navOffset}px`,
        "--nav-shell-height": `${navShellHeight}px`,
        "--menu-width": `${menuWidth}px`,
        "--panel-gap": `${panelGap}px`,
        "--panel-width": `${panelWidth}px`,
        "--panel-bottom": `${panelBottom}px`,
        "--dock-bottom": `${dockBottom}px`,
        "--temperature-bar-width": `${tempBarWidth}px`,
        "--scene-frame-scale": Number(sceneFrameScale).toFixed(3),
      };
    },
  },
  created() {
    // if (process.env.VUE_APP_BASE_URL === 'https://ln.szgreenenergy.com:8098')
    // if (process.env.VUE_APP_BASE_URL === 'https://www.ssge.com.cn:8098' || process.env.VUE_APP_BASE_URL === 'http://10.148.51.1:8098') {
    if (process.env.VUE_APP_IFLANGSELECT === 'true') {
      this.ifLangSelect = true
    }
    //可以封装成js，全局调用，如果是vue使用也可以写在App.vue文件的mounted中
    // 此段代码相关链接 https://blog.csdn.net/Refuelefforts/article/details/127547830
    window.addEventListener('beforeunload', this.beforeunloadHandler)
    let isOpen = localStorage.getItem('isOpen')//1
    let reload = localStorage.getItem('reload')//2
    this.timer2 = setTimeout(() => {
      localStorage.removeItem('reload')//4
    }, 2000);
    if (isOpen == 'open' && reload != 'reload') {
      localStorage.removeItem('isOpen')
      localStorage.removeItem('reload')
      this.timer3 = setTimeout(() => {
        let open1 = localStorage.getItem('isOpen')//7
        let load1 = localStorage.getItem('reload')
        if (open1 == 'open' && load1 !== 'reload') {
          // this.$alert('当前页面已经在浏览器中打开，重复打开主页，会消耗内存，影响操作！请关闭其中一个主页。', {
          //   confirmButtonText: '确定',
          //   callback: action => {
          //   }
          // });
          this.$alert('当前页面已经在浏览器中打开，重复打开主页，会消耗内存，影响操作！请关闭其中一个主页。', '注意', {
            confirmButtonText: '确定',
            type: 'warning',
            callback: action => {
              // this.$message({
              //   type: 'info',
              //   message: `action: ${ action }`
              // });
            }
          });
          // this.timer4 = setTimeout(() => {
          //   window.opener = null;
          //   location.href = "about:blank";
          //   window.close();
          //   localStorage.removeItem('reload')
          //   localStorage.removeItem('isOpen')//6
          // }, 5000)
        } else {
          history.go(0)
        }
      }, 1000)
    } else {
      // setInterval(() => {
      //   console.log('一秒掉一次')
      //   localStorage.setItem('isOpen', 'open')//5
      // }, 5000);
      this.timer4 = setInterval(() => {
        // console.log('一秒调一次');
        localStorage.setItem('isOpen', 'open');
      }, 1000);
    }
    // console.log("window", window.threeUrlPort);
    // console.log("logo",  this.logo);
    // if(process.env.NODE_ENV === 'development'){
    //   this.threeurl = "http://192.168.101.31:3001/"
    // }else{
    //   let {hostname} = window.location;
    //   this.threeurl = `http://${hostname}:${window.threeUrlPort}${window.threeUrl}`
    // }
    // findAllByCondition({userId: this.userid}).then((res) => {
    //   this.options = res.data || [];
    //   this.value = parseInt(this.path);
    //   console.log('this.value', this.value)
    //   console.log(this.options, this.value);
    // });
    findAllFloorModel({userId: this.userid}).then(res => {
      // this.deviceType = []
      this.deviceTypeData = res.data || [];
      for (let item of res.data) {
        if (parseInt(this.path) === item.appid) {
          if (!item.modelIp) {
            this.$store.commit("front/SET_IFRAMESELECTION", "2D");
          }
          this.$store.commit("user/SET_TEMPLATE", item.template);
          this.deviceType = [item.key]
          // this.modelIp = item.model2dIp ? item.model2dIp : item.modelIp
          this.updateSceneSource(this.iframeSelection === "3D" ? item.modelIp : item.model2dIp)
          // this.modelIp = 'http://192.168.110.180:8081/'
          this.btnType = this.iframeSelection === "3D"

          if (this.iframeSelection === '2D') {
            this.request2DSceneAccess();
          }
          // this.btnType = item.model2dIp
          this.chooseData = item
          this.placeholder = item.appexplainCNEN
        }
      }
    })
  },
  data() {
    return {
      baseurl: globalData.baseUrl,
      logoLoadState: {
        applogoimg: true,
        apppic: true,
      },
      iscontrol: true,
      options: [],
      deviceTypeData: [],
      deviceType: [],
      modelIp: '',
      sceneLoading: false,
      sceneLoadFailed: false,
      placeholder: '请选择',
      value: "",
      scrolldirection: "",
      workpieceList: [
        {
          name: "冷站效率",
          num: 5.53,
          status1: "需改善",
          status2: "一般",
          status3: "良好",
          status4: "优秀",
          data1: "cop",
          data2: 3.5,
          data3: 4.15,
          data4: 5,
          image: require("../../assets/home/xuanze.png"),
        },
      ],
      dropdownitem: [
        {
          id: 1,
          name: "冷冻泵",
        },
        {
          id: 2,
          name: "冷却泵",
        },
        {
          id: 3,
          name: "冷水机组",
        },
        {
          id: 4,
          name: "冷却塔",
        },
      ],
      activetitleIndex: 1,
      selectItemId: "",
      iframeWin: null,
      loadshow: true,

      activeIndex: 0,
      nowWeek: "",
      nowDate: "",
      nowTime: "",
      nowTimes: '',
      dialogshow: false,

      menudata: [],
      selectMenuItem: {},
      drTypeId: "", //结构图drtypeid
      structureDrid: "", //结构图设备类型drid
      drName: '', // 当前点击的模型名
      drTitleName: '',// 当前点击的模型名的title
      runningid: '', // 运行id
      deviceTypeInfo: [],
      op: null,
      lastLeave: null,
      circulate: false,
      circulateTime: null,
      pageNav: 0,// 点击警告框时跳到对应的页面
      map: new Map(),
      chooseData: {},//点击切换iframe时用到
      btnType: true, // 按钮高亮
      ifLangSelect: false,
      sceneViewMode: "standard",
      viewportWidth: typeof window !== "undefined" ? window.innerWidth : 1920,
      viewportHeight: typeof window !== "undefined" ? window.innerHeight : 1080
    };
  },
  mounted() {
    this.setNowTimes();
    this.handleViewportResize();
    window.addEventListener("resize", this.handleViewportResize);

    setTimeout(() => {
      if (!window.websocket) {
        new MySocket(this.userid, this.path).init().then((websocket) => {
          console.log('item template222')
          this.$store.commit("websocket/SET_WEBSOCKET", websocket);//这里的websocket就是new出来的MySocket对象本身
        });
      }
      window.addEventListener("message", this.handleMessage);
      this.iframeWin = this.$refs.iframe.contentWindow;
    }, 500)

    this.timer = setInterval(() => {
      this.setNowTimes();
    }, 1000);
    // window.addEventListener('beforeunload', this.beforeUnload);
    // let that = this
    // window.addEventListener('beforeunload', function(event) {
    //   event.preventDefault();
    //   event.returnValue = '';
    //   if (confirm('确定要关闭窗口吗？')) {
    //     // 用户点击了确定按钮，执行关闭操作
    //     console.log('1111111')
    //     // that.callApi()
    //     findSub('1111111').then((res) => {
    //       console.log('res')
    //       // window.close();
    //     }).catch(err=>{
    //       console.log('err')
    //     })
    //   } else {
    //     // 用户点击了取消按钮，取消关闭操作
    //     console.log('222')
    //   }
    // });
    // window.onbeforeunload = function (e) {
    //   console.log('11111111111')
    // }
  },
  destroyed() {
    //进行监听销毁
    this.websocket.closeWs();
    // 移除监听事件
    window.removeEventListener('beforeunload', this.beforeunloadHandler);
    window.removeEventListener('message', this.handleMessage);
    window.removeEventListener("resize", this.handleViewportResize);
    this.iframeWin = null
    // 进行清理操作
    localStorage.removeItem('isOpen');
    localStorage.removeItem('reload');
    clearTimeout(this.timer2);
    clearTimeout(this.timer3);
    clearTimeout(this.timer4);
  },
  beforeDestroy() {
    this.$notify.closeAll();
    clearInterval(this.circulateTime)
    clearInterval(this.timer);
    this.timer = null;
    this.map.clear()
  },
  watch: {
    logo: {
      handler() {
        this.resetLogoState();
      },
      deep: true,
      immediate: true,
    },
    modelIp: {
      handler(val) {
        this.sceneLoading = Boolean(val);
        this.sceneLoadFailed = false;
      },
      immediate: true,
    },

    // alarmData: {
    //   handler(val) {
    //     //{key:value}
    //     //{114:提醒} {114:114}
    //     //set {114:提醒} get114得到提醒
    //     //
    //     // 1.之前没有值。get114得到undifined, 弹提醒
    //     // 2.只有有值。get114得到提醒meg，此时，要做判断，提醒和现在最新的消息msg是否一样,是一样就不弹窗，否则就弹窗
    //
    //     let repeatKeyValue = val.repeatKey //拿到推送过来的 repeatKey 字段 对应的值；
    //     let oldValue = this.map.get(repeatKeyValue);// 拿到本地之前存的值
    //     console.log('oldValue',oldValue)
    //     console.log('repeatKeyValue',repeatKeyValue)
    //     // if(oldValue !== '' && oldValue === repeatKeyValue){
    //       if(oldValue !== '' && oldValue === val.message){
    //       //说明上次处理过了，不再处理
    //       console.log('重复')
    //     }else{
    //       //弹窗处理
    //       // this.map.set('repeatKey',repeatKeyValue);
    //       this.map.set(repeatKeyValue,val.message);
    //       this.open()
    //     }
    //   },
    //   deep: true,
    //   immediate: true,
    // },
    alarmData: {
      handler(val) {
        //{key:value}
        //{114:提醒} {114:114}
        //set {114:提醒} get114得到提醒
        //
        // 1.之前没有值。get114得到undifined, 弹提醒
        // 2.只有有值。get114得到提醒meg，此时，要做判断，提醒和现在最新的消息msg是否一样,是一样就不弹窗，否则就弹窗

        let repeatKeyValue = val.repeatKey //拿到推送过来的 repeatKey 字段 对应的值；
        let oldValue = this.map.get(repeatKeyValue);// 拿到本地之前存的值
        // console.log('oldValue', oldValue)
        // console.log('repeatKeyValue', repeatKeyValue)
        // console.log('message', val.message)
        if (!oldValue) {
          oldValue = new Set()
        }
        // console.log('has', oldValue.has(val.message))
        if (!val.message || oldValue.has(val.message)) {
          //说明上次处理过了，不再处理
          console.log('重复')
        } else {
          //弹窗处理
          // this.map.set('repeatKey',repeatKeyValue);
          oldValue.add(val.message)
          this.map.set(repeatKeyValue, oldValue);
          this.open(val)
        }
        // console.log('oldValue222', oldValue)
        // console.log('repeatKeyValue222', repeatKeyValue)
        // console.log('message222', val.message)
      },
      deep: true,
      immediate: true,
    },
    clearAlarmSound: {
      handler(val) {
        if (this.clearAlarmSound.play == 'false') {
          console.log('清除报警声音', this.clearAlarmSound)
          this.circulate = false
          clearInterval(this.circulateTime)
        }
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    handleViewportResize() {
      this.viewportWidth = window.innerWidth;
      this.viewportHeight = window.innerHeight;
    },
    syncSceneViewMode(delay = 0) {
      const payload = {
        mode: this.sceneViewMode,
        simplified: this.isSceneSimplified,
        showSecondaryLabels: !this.isSceneSimplified,
        aggregateRepeatingGroups: this.isSceneSimplified,
        collisionStrategy: this.isSceneSimplified ? "compact" : "standard",
      };
      const run = () => {
        if (!this.iframeWin) {
          return;
        }
        const target = this.sceneTargetOrigin || "*";
        try {
          this.iframeWin.postMessage({id: "OnSceneDisplayMode", data: payload}, target);
        } catch (error) {}
        try {
          this.iframeWin.postMessage({cmd: "SceneDisplayModeChange", params: payload}, target);
        } catch (error) {}
        try {
          this.iframeWin.postMessage({cmd: "SceneViewMode", params: payload}, target);
        } catch (error) {}
      };
      if (delay > 0) {
        setTimeout(run, delay);
        return;
      }
      run();
    },
    toggleSceneViewMode() {
      this.sceneViewMode = this.isSceneSimplified ? "standard" : "simplified";
      this.syncSceneViewMode(60);
    },
    updateSceneSource(url) {
      this.modelIp = url || "";
      this.sceneLoading = Boolean(this.modelIp);
      this.sceneLoadFailed = false;
    },
    postSceneToken(delay = 0) {
      const run = () => {
        if (this.iframeSelection !== "2D" || !this.threeurl || !this.iframeWin) {
          return;
        }
        try {
          this.iframeWin.postMessage({token: getToken()}, this.sceneTargetOrigin);
        } catch (error) {}
      };

      if (delay > 0) {
        setTimeout(run, delay);
        return;
      }

      run();
    },
    request2DSceneAccess() {
      notify(this.path).catch(() => {})
      this.postSceneToken(240);
      this.postSceneToken(900);
    },
    handleSceneLoad() {
      this.iframeWin = this.$refs.iframe ? this.$refs.iframe.contentWindow : null;
      this.sceneLoading = false;
      this.sceneLoadFailed = false;
      this.postSceneToken(60);
      this.syncSceneViewMode(90);
    },
    handleSceneError() {
      this.sceneLoading = false;
      this.sceneLoadFailed = true;
    },
    resetLogoState() {
      this.logoLoadState = {
        applogoimg: true,
        apppic: true,
      };
    },
    handleLogoAssetError(field) {
      this.$set(this.logoLoadState, field, false);
    },
    shouldShowLogo(field) {
      return Boolean(this.logo && this.logo[field] && this.logoLoadState[field]);
    },
    getLogoSrc(field) {
      if (!this.logo || !this.logo[field]) {
        return "";
      }
      return this.baseurl + this.logo[field];
    },
    beforeunloadHandler(e) {    //根据事件进行操作进行操作
      // localStorage.setItem('reload', 'reload')
      setTimeout(() => {
        localStorage.setItem('reload', 'reload');
      }, 100);
    },
    gopage(name, tagname, unit) {
      // let {href} = this.$router.resolve({
      //   path: "/front/dialog",
      //   query: {
      //     name,
      //     tagname,
      //     unit
      //   },
      // });
      // window.open(href, "_blank");
      this.$router.push({
        path: "/front/dialog",
        query: {
          name,
          tagname,
          unit
        }
      });
    },
    // 切换3D或2D
    clickSwitchIframe(val) {
      if (val === '3D') {
        // 记录是2D还是3D，存入vuex
        this.$store.commit("front/SET_IFRAMESELECTION", "3D");
        this.btnType = true
        this.updateSceneSource(this.chooseData.modelIp)
      } else {
        this.$store.commit("front/SET_IFRAMESELECTION", "2D");
        this.btnType = false
        this.updateSceneSource(this.chooseData.model2dIp)
        this.request2DSceneAccess();
      }
      this.syncSceneViewMode(90);
    },
    //切换项目
    chooseDeviceType() {
      let nodesInfo = this.$refs['cascader'].getCheckedNodes()[0].data
      this.$store.commit("user/SET_MODELKEY", nodesInfo.key);
      this.$store.commit("user/SET_TEMPLATE", nodesInfo.template);
      if (!nodesInfo.modelIp) {
        this.$store.commit("front/SET_IFRAMESELECTION", "2D");
      }
      if (nodesInfo.model2dIp === null) {
        this.$store.commit("front/SET_IFRAMESELECTION", "3D");
      }
      this.chooseData = nodesInfo
      this.$notify.closeAll();
      // this.value = nodesInfo.appid
      // this.modelIp = nodesInfo.modelIp
      this.btnType = this.iframeSelection === "3D"
      this.updateSceneSource(this.iframeSelection === "3D" ? nodesInfo.modelIp : nodesInfo.model2dIp)
      // this.modelIp = nodesInfo.model2dIp ? nodesInfo.model2dIp : nodesInfo.modelIp
      let item = this.appusergroup.find((ele) => ele.appid == nodesInfo.appid);
      // console.log('item', item, this.appusergroup)
      this.$store.dispatch("project/getMenuId", item).then((res) => {
        this.websocket.closeWs();
        this.$store.commit("front/clearWebSocket");
        // console.log('path11111',this.path)
        new MySocket(this.userid, this.path).init().then((websocket) => {
          this.$store.commit("websocket/SET_WEBSOCKET", websocket);//这里的websocket就是new 出来的MySocket对象本身
        });
        if (this.iframeSelection === '2D') {
          this.request2DSceneAccess();
        }
        this.syncSceneViewMode(90);
      }).catch(error => {
        this.$message.error(error.message || "切换项目失败");
      })
    },
    clickOnline() {
      if (process.env.VUE_APP_BASE_URL === 'https://www.ssge.com.cn:8098') {
        let admin = ["admin", "ghb", "yaozh"]
        for (const item of admin) {
          if (item === this.name) {
            console.log('我进来了')
            let {href} = this.$router.resolve({
              path: "/front/online",
            });
            window.open(href, "_blank");
          }
        }
        console.log('11111', this.name)
        console.log('2222', process.env.VUE_APP_BASE_URL)
      } else {
        console.log('else')
      }
    },
    warningMusic() {
      console.log('音乐触发')
      let mp3 = this.MP3;
      let duration = 1500
      let bgm
      mp3.src = srcMp3;
      mp3.ondurationchange = function () {
        duration = mp3.duration * 1500
      }
      bgm = function bgm() {
        console.log('111', duration)
        mp3.play();
      }
      this.circulateTime = setInterval(
          bgm
          , duration);
    },
    btn() {
      this.map.set('11111', '22222');
      return
      this.alarmData.play = 'true'
      this.open()
    },
    btn2() {
      console.log(this.map.get('11111'))
      return
      this.circulate = false
      clearInterval(this.circulateTime)
    },
    open(alarmData) {
      let that = this
      if (!this.circulate) {
        if (alarmData.play == 'true') {
          /* 音乐只触发一次*/
          that.circulate = true
          that.warningMusic()
        }
      }
      console.log('html触发', alarmData)
      this.$notify({
        // title: '警告',
        dangerouslyUseHTMLString: true,
        message: alarmData.message,
        duration: 0,
        position: 'top-right',
        type: 'warning',
        customClass: 'notificationClass',
        /*onClick:()=>{
          if (!this.circulate){
            console.log('点击')
            /!* 音乐只触发一次*!/
            that.circulate = true
            that.warningMusic()
            // 点击警告框时跳到对应的页面
            // that.pageNav = 3
            // 打开弹出框所需数据
            /!*let event = {
              data:{
                id:'onClickModelObservable',
                data:{
                  id: "7",
                  type:'',
                  name:''
                }
              }
            }
            console.log('event',event)
            that.handleMessage(event)*!/
          }
        },*/
        onClose: () => {
          // 关闭音乐
          that.circulate = false

          //关闭弹窗时候
          //this.map.delete(this.alarmData.repeatKey);//删除这个标识，以便下次推送过来的时候，重新弹窗
          that.map.get(alarmData.repeatKey).delete(alarmData.message)
          console.log('删除', that.map.get(alarmData.repeatKey))
          // 这是一个实例方法，删除的也是实例里面的数据
          // that.pageNav = 0
          clearInterval(that.circulateTime)
        }
      });
    },
    ishandlecontrol(num) {
      if (num == 1) {
        this.loadshow = !this.loadshow;
        if (this.leave) {
          this.lastLeave = true
          this.$store.commit("project/close", !this.leave);// false
        } else {
          if (this.lastLeave) {
            this.$store.commit("project/close", !this.leave);// true
          } else {
            this.lastLeave = false
            this.$store.commit("project/close", this.leave);// false
          }
        }
      } else if (num == 2) {
        this.loadshow = true;// 重新定位，展开两侧的数据
        let event = {
          id: "OnResetCamera",
          data: {},
        };
        this.iframeWin.postMessage(event, this.threeurl);
      }
    },
    Godefaultpage() {
      // 移除监听事件
      window.removeEventListener("message", this.handleMessage);
      // 清理数据
      this.iframeWin = null;

      this.$router.push({
        path: "/",
        replace: true
      });
    },
    scrollEvent() {
      let top = this.$refs.scrollbox.scrollTop;
      if (top > 20) {
        this.$refs.navbar.style.backgroundColor = "#000";
      } else {
        this.$refs.navbar.style.backgroundColor = "transparent";
      }
    },
    handlechange() {
      this.map.clear()
      // this.$notify.closeAll();
      let item = this.appusergroup.find((ele) => ele.appid == this.value);
      console.log('item', item)
      this.$store.dispatch("project/getMenuId", item).then((res) => {
        this.websocket.closeWs();
        this.$store.commit("front/clearWebSocket");
        console.log('path11111', this.path)
        new MySocket(this.userid, this.path).init().then((websocket) => {
          this.$store.commit("websocket/SET_WEBSOCKET", websocket);//这里的websocket就是new 出来的MySocket对象本身
        });
      })
          .catch(error => {
            this.$message.error("Promise失败!");
            console.log('Promise失败', error)
          })
    },
    handledialogshow() {
      this.loadshow = true;// 重新定位，展开两侧的数据
      this.pageNav = 0
      // this.loadshow = true
      this.dialogshow = false;
      let info = {
        msgType: "delete",
        userId: this.userid,
        drId: this.structureDrid,
        isEnergy: true,
      };
      let info2 = {
        msgType: "delete",
        userId: this.userid,
        drId: this.structureDrid,
        isEnergy: true,
      };
      let event = {
        id: "rotate",
        data: {},
      }
      // this.websocket.sendWS(JSON.stringify(info));
      // this.websocket.sendWS(JSON.stringify(info2));
      this.$store.commit("front/clearCenter");// 重置baseInfo、baseInfo2等
      if (this.path == '126lnoffice') {
        // 暂时先测试公司的旋转问题
        console.log('关闭', this.path)
        this.iframeWin.postMessage(event, this.threeurl);
      }
    },
    clickCommandItem(command) {
    },

    controlchange(info) {
      this.iframeWin.postMessage(
        {
          cmd: "WebInfoReceive",
          params: info,
        },
        this.sceneTargetOrigin
      );
    },
    handleMenuchange() {
      this.lastLeave = !this.leave
      this.$store.commit("project/close", !this.leave);
    },
    getUrlParams(url) {
      let obj = {};
      url.split("&").forEach((item) => {
        let arr = item.split("=");
        Object.defineProperty(obj, arr[0], {
          value: arr[1],
        });
      });
      return obj;
    },

    sendMessage(cmd) {
      this.$store.commit("project/close", false);
      this.iframeWin.postMessage(
        {
          cmd,
        },
        this.sceneTargetOrigin
      );
    },
    async handleMessage(event) {
      //自己消息不接收
      if (event.source == window.self) return;
      const data = event.data;
      if (data.id == "onReady") {
        this.loadshow = true;
        this.iscontrol = true;
      }
      if (data.id === "postCommand") {
        let params = new URLSearchParams(data.val);
        let result = {}
        for (let param of params) {
          result[param[0]] = param[1];
        }
        // console.log('111',result)
        this.postCommandFun(result)
      }
      if (data.id === "onClickModelObservable") {
        let allinfo = data.data;
        this.drTypeId = allinfo.type;
        this.structureDrid = allinfo.id;
        // this.drName = this.judgeName(allinfo.name)
        this.drName = allinfo.name;
        this.drTitleName = allinfo.name
        this.runningid = allinfo.runningid
        console.log('allinfo', allinfo)
        this.$store.commit("project/close", false);
        // this.loadshow = false
        if (!window.websocket) {
          new MySocket(this.userid, this.path).init().then((websocket) => {
            this.$store.commit("websocket/SET_WEBSOCKET", websocket);//这里的websocket就是new 出来的MySocket对象本身
          })
              .then((res) => {
                console.log('11111')
                this.getsub();
              });
        } else {
          console.log('else 11111')
          this.getsub();
        }
      } else if (parseInt(data.id)) {
        // 此处为2D，2D传过来的只有id（为数字）
        let dataSplit = data.id.split('|')
        this.structureDrid = dataSplit[0];
        this.drTitleName = dataSplit[1]
        this.drName = dataSplit[1]
        this.$store.commit("project/close", false);
        // this.loadshow = false
        if (!window.websocket) {
          new MySocket(this.userid, this.path).init().then((websocket) => {
            this.$store.commit("websocket/SET_WEBSOCKET", websocket);//这里的websocket就是new 出来的MySocket对象本身
          }).then((res) => {
            console.log('if 2D')
            this.getsub();
          });
        } else {
          console.log('else 2D')
          this.getsub();
        }
      }
    },
    // 2D按钮直接修改
    postCommandFun(val) {
      val.userId = this.userid
      console.log('val', val);
      let name = val.msg.split("|")
      let message = '您确定要修改  “' + name[0] + '”  的值为  “' + val.commandName + '“  吗?'
      console.log('val', message);
      let title = '提示：' + this.logo.applogotext
      this.$confirm(message, title, {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
      }).then(() => {
        operationRegs(this.path, val)
            .then((res) => {
              if (res.status === 20000) {
                this.$message.success(res.msg + "修改成功！");
              } else {
                this.$message.error(res.msg + "修改失败！");
              }
            })
            .catch(console.log);
      }).catch(() => {
      })
    },
    judgeName(e) {
      if (e.indexOf('CT') != -1) {
        // console.log('名字',e.slice(0,e.length-1))
        e = e.slice(0, e.length - 1)
      }
      // console.log('名字',e)
      return e
    },
    getsub() {
      console.log('getsub', this.path)
      return findSub(this.path).then((res) => {
        this.$store.commit("front/setsubs", res.data);
        this.dialogshow = true;
      });
    },
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
      //   console.log('2222',this.$i18n.locale,Cookies.get('language'))
      this.nowTimes = formattedTime
      // console.log('输出', formattedTime); // 输出：2024年1月14日 星期日 11.22.33
    },
  },
};
</script>
<style lang="scss">
.myCascaderDefau {
  margin-top: 10px !important;
  border: 1px solid rgba(116, 211, 255, 0.14) !important;
  border-radius: 22px !important;
  background: linear-gradient(180deg, rgba(6, 19, 31, 0.98) 0%, rgba(11, 30, 48, 0.98) 100%) !important;
  box-shadow: 0 28px 56px rgba(0, 0, 0, 0.34) !important;
  backdrop-filter: blur(20px);
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
<style lang="scss">
$yellow: #f8b514;
@mixin yellow {
  text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
  background: linear-gradient(bottom, #eea551 0%, #feffff 110%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

@mixin green {
  text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
  background: linear-gradient(bottom, #00ff5a 0%, #feffff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

@mixin bluetext {
  text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
  background: linear-gradient(top, #fff 0%, rgba(0, 140, 255, 1) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

@mixin bluetextbottom {
  text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
  background: linear-gradient(bottom, rgba(0, 140, 255, 1) 0%, #fff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tooltip_content {
  font-size: 18px;
  color: #fff;
  width: 200px;
  display: flex;
  flex-wrap: wrap;

  .content {
    width: 50%;
  }
}

.notificationClass {
  margin-right: 345px !important;
}

.default-box-content {
  --shell-edge-padding: 16px;
  --panel-width: 300px;
  --panel-gap: 24px;
  --nav-offset: 92px;
  --nav-shell-height: 68px;
  --menu-width: 188px;
  --panel-bottom: 78px;
  --dock-bottom: 24px;
  --temperature-bar-width: 520px;
  --scene-frame-scale: 1;
  position: relative;
  height: 100vh;
  overflow: hidden;
  color: var(--shell-text);
  background:
      linear-gradient(180deg, rgba(5, 11, 22, 0.52) 0%, rgba(4, 10, 20, 0.78) 100%),
      radial-gradient(circle at 20% 0%, rgba(32, 96, 190, 0.32) 0%, rgba(32, 96, 190, 0) 42%),
      radial-gradient(circle at 78% 12%, rgba(65, 176, 255, 0.16) 0%, rgba(65, 176, 255, 0) 26%),
      linear-gradient(180deg, #08111d 0%, #0a1827 100%);

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        linear-gradient(90deg, rgba(4, 10, 20, 0.88) 0%, rgba(4, 10, 20, 0.24) 22%, rgba(4, 10, 20, 0.24) 78%, rgba(4, 10, 20, 0.88) 100%),
        linear-gradient(180deg, rgba(4, 10, 20, 0.72) 0%, rgba(4, 10, 20, 0.08) 24%, rgba(4, 10, 20, 0.08) 74%, rgba(4, 10, 20, 0.82) 100%);
    z-index: 0;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 18px;
    border-radius: 36px;
    border: 1px solid rgba(133, 184, 255, 0.08);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
    pointer-events: none;
    z-index: 0;
  }

  .slide {
    position: absolute;
    top: 40px;
    left: 20px;
    width: 300px;
    height: 300px;
    background: skyblue;
    z-index: 1;
  }

  .nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: grid;
    grid-template-columns: minmax(228px, 1fr) minmax(300px, 540px) minmax(228px, 1fr);
    align-items: start;
    gap: 16px;
    padding: 14px var(--shell-edge-padding) 0;
    z-index: 8;
    width: 100%;
    height: var(--nav-offset);

    &::before {
      content: "";
      position: absolute;
      inset: 10px var(--shell-edge-padding) auto;
      height: var(--nav-shell-height);
      border-radius: 22px;
      border: 1px solid var(--shell-border);
      background: linear-gradient(135deg, rgba(11, 24, 41, 0.94) 0%, rgba(8, 18, 34, 0.78) 100%);
      box-shadow: var(--shell-shadow-soft), inset 0 1px 0 rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(16px);
    }

    &::after {
      content: "";
      position: absolute;
      inset: 10px var(--shell-edge-padding) auto;
      height: var(--nav-shell-height);
      border-radius: 22px;
      background: linear-gradient(90deg, rgba(92, 200, 255, 0) 0%, rgba(92, 200, 255, 0.1) 50%, rgba(92, 200, 255, 0) 100%);
      opacity: 0.8;
      pointer-events: none;
    }

    .titleBox {
      width: 100%;
      text-align: center;
      color: var(--shell-text);
      z-index: 2;

      .title {
        padding-top: 2px;

        .el-cascader {
          width: 100%;

          .el-input {
            .el-input__inner {
              text-align: center;
              height: 50px;
              border: 1px solid rgba(132, 187, 255, 0.12);
              border-radius: 20px;
              background: rgba(255, 255, 255, 0.025);
              box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
              font-size: clamp(16px, 1.35vw, 24px);
              font-weight: 700;
              letter-spacing: 0.01em;
              color: var(--shell-text);
              text-shadow: none;
              padding: 0 52px 0 28px;
              text-overflow: ellipsis;
            }

            .el-input__suffix {
              right: 14px;
            }

            .el-input__suffix-inner {
              display: flex;
              align-items: center;
              color: rgba(201, 224, 241, 0.72);
            }
          }
        }
      }

      .day {
        margin-top: 5px;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--shell-text-muted);
        opacity: 0.86;
      }
    }

    .txt {
      position: absolute;
      font-size: 40px;
      font-family: DIN Condensed;
      font-weight: bold;
    }

    .def-num {
      position: absolute;
      width: 354px;
      height: 66px;
      top: 70px;
      left: 326px;
      border-radius: 18px;
      border: 1px solid rgba(133, 184, 255, 0.12);
      background:
          linear-gradient(135deg, rgba(20, 48, 86, 0.72) 0%, rgba(10, 24, 40, 0.88) 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 22px rgba(0, 0, 0, 0.18);

      &::before {
        content: "";
        position: absolute;
        inset: 8px 14px;
        border-radius: 14px;
        background: linear-gradient(90deg, rgba(84, 199, 255, 0.18) 0%, rgba(11, 124, 255, 0.04) 100%);
      }

      .txt {
        @include yellow;
        top: 4px;
        right: 56px;
      }
    }

    .def-num2 {
      position: absolute;
      width: 354px;
      height: 66px;
      top: 70px;
      right: 336px;
      border-radius: 18px;
      border: 1px solid rgba(133, 184, 255, 0.12);
      background:
          linear-gradient(135deg, rgba(8, 22, 36, 0.92) 0%, rgba(11, 34, 58, 0.82) 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 22px rgba(0, 0, 0, 0.18);

      &::before {
        content: "";
        position: absolute;
        inset: 8px 14px;
        border-radius: 14px;
        background: linear-gradient(90deg, rgba(11, 124, 255, 0.04) 0%, rgba(84, 199, 255, 0.18) 100%);
      }

      .txt {
        top: 4px;
        left: 54px;
        // text-shadow: 0px 6px 8px rgba(0, 0, 0, 0.75);

        background: linear-gradient(
                0deg,
                rgba(0, 0, 0, 0.8) 0%,
                rgba(79, 108, 161, 0.5) 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
    }

    .top-btn-list {
      position: absolute;
      top: 43px;
      display: flex;
      align-items: center;

      .btn-item {
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 24px;
        margin-right: 33px;
        font-size: 14px;
        background: rgba(0, 46, 123, 0.58);
        box-shadow: inset 0px 0px 13px 0px #3870ff;
        border-radius: 12px;
      }
    }

    .left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      z-index: 2;

      .ce {
        margin: 0;
      }

      .logo {
        width: 100%;
        max-width: 248px;
        height: 46px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 12px;
        border-radius: 18px;
        border: 1px solid rgba(132, 187, 255, 0.12);
        background: linear-gradient(135deg, rgba(13, 30, 48, 0.88) 0%, rgba(10, 22, 37, 0.72) 100%);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }

      .logo-left {
        width: auto;
        max-width: 100%;
        height: 34px;
        object-fit: contain;
        margin: 0 auto;
      }

      .logo-fallback {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-width: 0;
        color: var(--shell-text);

        &__mark {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(88, 242, 255, 0.26) 0%, rgba(31, 123, 255, 0.18) 100%);
          color: rgba(245, 251, 255, 0.98);
          font-size: 18px;
          font-weight: 700;
          flex: 0 0 auto;
        }

        &__text {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: rgba(245, 251, 255, 0.92);
        }
      }


      .weather {
        margin-left: 44px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        font-size: 15px;
        font-family: Lantinghei SC;
        font-weight: 600;
        text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
        color: #fff;

        img {
          width: 35px;
        }

        .we-title {
          position: relative;
          font-size: 15px;
          font-family: Impact;
          font-weight: 600;
          color: #fff;
          margin-right: 5px;
          background: repeating-linear-gradient(
                  180deg,
                  rgba(184, 182, 182, 0.5),
                  7px,
                  green,
                  7px,
                  #fff 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .gradient {
          font-size: 24px;
          font-family: Lantinghei SC;
          font-weight: 600;
          color: #fff;

          background: repeating-linear-gradient(
                  180deg,
                  rgba(184, 182, 182, 0.5),
                  13px,
                  green,
                  13px,
                  #fff 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .gradient1 {
          margin-left: 5px;
        }

        .gradient2 {
          margin-left: 12px;
        }
      }
    }

    .right {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      min-width: 0;
      z-index: 2;

      .user {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        width: 100%;
        margin-left: 0;

        .toolbar-item {
          flex: 0 0 auto;
          min-width: 112px;
        }

        .el-select {
          width: 164px;

          .el-input__inner {
            height: 42px;
            border: 1px solid rgba(132, 187, 255, 0.16);
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.04);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
            font-style: normal;
            text-align: left;
            font-size: 14px;
            font-family: inherit;
            font-weight: 500;
            color: var(--shell-text);
            text-shadow: none;
          }
        }

        .el-cascader {
          width: 220px;

          .el-input__inner {
            height: 42px;
            border: 1px solid rgba(132, 187, 255, 0.16);
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.04);
            font-style: normal;
            text-align: left;
            font-size: 14px;
            font-family: inherit;
            font-weight: 500;
            color: var(--shell-text);
            text-shadow: none;
          }
        }

        .operationMode {
          padding-right: 0;

          .el-button {
            border: none;
            border-radius: 14px;
            background-color: rgba(255, 255, 255, 0.04);
            font-size: 14px;
            font-style: normal;
            text-align: left;
            font-weight: 500;
            color: var(--shell-text);
            text-shadow: none;
          }
        }
      }
    }

    //.tempture-box {
    //  position: fixed;
    //  top: 70px;
    //  left: 50%;
    //  transform: translateX(-50%);
    //  width: calc(100% - 760px);
    //
    //  &:after {
    //    position: absolute;
    //    left: 0;
    //    top: 0;
    //    content: "";
    //    width: 100%;
    //    height: 1px;
    //    //box-shadow: 0 40px 10px 40px rgba(0, 0, 0, 0.45);
    //  }
    //}


  }

  //.tempture:hover + .bottom {
  //  left: 45% !important;
  //}
  .tempture:hover {
    .item {
      transform: translateY(-1px);

      .right {
        .num {
          color: var(--shell-text);
        }

        p {
          color: var(--shell-text);
        }
      }
    }
  }

  .tempture {
    position: fixed;
    left: 50%;
    bottom: var(--dock-bottom);
    transform: translateX(calc(-100% - 8px));
    width: var(--temperature-bar-width);
    z-index: 7;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border: 1px solid rgba(132, 187, 255, 0.12);
    border-radius: 22px;
    background: linear-gradient(135deg, rgba(9, 20, 36, 0.92) 0%, rgba(8, 18, 34, 0.8) 100%);
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(16px);
    pointer-events: auto;

    .item {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 10px;
      flex: 1 1 0;
      min-width: 0;
      min-height: 62px;
      padding: 10px 12px;
      border-radius: 16px;
      font-size: 14px;
      position: relative;
      color: var(--shell-text);
      cursor: pointer;
      background: rgba(255, 255, 255, 0.03);
      transition: transform 0.24s ease, background 0.24s ease, border-color 0.24s ease;

      &:hover {
        background: rgba(92, 200, 255, 0.08);
      }

      .left {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: rgba(92, 200, 255, 0.1);
        color: var(--shell-accent);
      }

      .right {
        flex: 1;
        min-width: 0;
        text-align: left;

        .num {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        p {
          margin-top: 3px;
          font-size: 11px;
          letter-spacing: 0.08em;
          color: var(--shell-text-muted);
        }
      }
    }
  }

  .middle {
    position: fixed;
    inset: 0;
    z-index: 1;
  }

  .middle-shell {
    position: absolute;
    top: calc(var(--nav-offset) + 10px);
    right: calc(var(--panel-width) + var(--panel-gap));
    bottom: var(--panel-bottom);
    left: calc(var(--panel-width) + var(--panel-gap));
    transition: left 0.32s ease, right 0.32s ease, bottom 0.32s ease;
    pointer-events: none;
  }

  &.menu-open {
    .middle-shell {
      left: calc(var(--panel-width) + var(--menu-width) + 18px);
    }
  }

  .scene-stage {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 32px;
    border: 1px solid rgba(133, 184, 255, 0.12);
    background: linear-gradient(180deg, rgba(7, 17, 31, 0.36) 0%, rgba(7, 17, 31, 0.16) 100%);
    box-shadow: 0 28px 48px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(255, 255, 255, 0.03);
    pointer-events: auto;

    &::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
      background:
        radial-gradient(circle at 14% 18%, rgba(103, 209, 255, 0.16) 0%, rgba(103, 209, 255, 0) 24%),
        radial-gradient(circle at 88% 14%, rgba(103, 209, 255, 0.12) 0%, rgba(103, 209, 255, 0) 22%);
    }
  }

  .scene-stage__frame {
    position: absolute;
    top: 50%;
    left: 50%;
    display: block;
    width: calc(100% / var(--scene-frame-scale));
    height: calc(100% / var(--scene-frame-scale));
    border: 0;
    background: #08111d;
    pointer-events: auto;
    transform: translate(-50%, -50%) scale(var(--scene-frame-scale));
    transform-origin: center center;
    transition: opacity 0.24s ease, transform 0.24s ease, width 0.24s ease, height 0.24s ease;
  }

  .scene-stage__hud {
    position: absolute;
    top: 18px;
    left: 18px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: min(320px, calc(100% - 40px));
    padding: 12px 14px;
    border-radius: 20px;
    border: 1px solid rgba(132, 187, 255, 0.14);
    background: linear-gradient(135deg, rgba(8, 20, 35, 0.92) 0%, rgba(7, 18, 31, 0.64) 100%);
    box-shadow: 0 18px 32px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
    pointer-events: none;
  }

  .scene-stage__eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: rgba(191, 220, 236, 0.62);
  }

  .scene-stage__title-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .scene-stage__title {
    min-width: 0;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: rgba(245, 251, 255, 0.96);
  }

  .scene-stage__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 52px;
    height: 28px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(130, 209, 255, 0.2);
    background: linear-gradient(135deg, rgba(57, 129, 255, 0.28) 0%, rgba(88, 242, 255, 0.12) 100%);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(245, 251, 255, 0.96);
  }

  .scene-stage__meta {
    font-size: 11px;
    letter-spacing: 0.04em;
    color: rgba(191, 220, 236, 0.62);
  }

  .scene-stage__overlay {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px;
    pointer-events: none;
  }

  .scene-stage__overlay-card {
    display: grid;
    gap: 12px;
    width: min(420px, 100%);
    padding: 18px 20px;
    border-radius: 22px;
    border: 1px solid rgba(132, 187, 255, 0.16);
    background: linear-gradient(135deg, rgba(8, 20, 35, 0.92) 0%, rgba(7, 18, 31, 0.72) 100%);
    box-shadow: 0 24px 38px rgba(0, 0, 0, 0.24);
    backdrop-filter: blur(18px);
  }

  .scene-stage__overlay-eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(191, 220, 236, 0.62);
  }

  .scene-stage__overlay-title {
    font-size: 24px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: rgba(245, 251, 255, 0.96);
  }

  .scene-stage__overlay-card p {
    margin: 0;
    font-size: 14px;
    line-height: 1.7;
    color: rgba(191, 220, 236, 0.82);
  }

  .scene-stage__overlay-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .scene-stage__overlay-chip {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(132, 187, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(245, 251, 255, 0.92);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;

    &.is-ready {
      border-color: rgba(123, 224, 255, 0.22);
      background: rgba(123, 224, 255, 0.12);
      color: #eafcff;
    }

    &.is-muted {
      opacity: 0.5;
    }

    &.is-current {
      border-color: rgba(123, 224, 255, 0.22);
    }
  }

  .scene-stage__frame {
    will-change: transform, opacity;
  }

  .scene-stage--loading,
  .scene-stage--empty {
    .scene-stage__frame {
      opacity: 0.18;
    }
  }

  .scene-stage__vignette {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(4, 10, 20, 0.42) 0%, rgba(4, 10, 20, 0.04) 22%, rgba(4, 10, 20, 0.02) 74%, rgba(4, 10, 20, 0.54) 100%),
      linear-gradient(90deg, rgba(4, 10, 20, 0.5) 0%, rgba(4, 10, 20, 0.04) 16%, rgba(4, 10, 20, 0.04) 84%, rgba(4, 10, 20, 0.56) 100%);
  }

  .scene-stage__scanlines {
    position: absolute;
    inset: auto 24px 24px 24px;
    z-index: 2;
    height: 72px;
    border-radius: 22px;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(5, 12, 24, 0) 0%, rgba(5, 12, 24, 0.68) 100%),
      repeating-linear-gradient(180deg, rgba(112, 179, 232, 0.08) 0 1px, rgba(112, 179, 232, 0) 1px 8px);
    opacity: 0.72;
  }

  .scene-stage__footer {
    position: absolute;
    right: 18px;
    bottom: 18px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(132, 187, 255, 0.14);
    background: linear-gradient(135deg, rgba(8, 20, 35, 0.88) 0%, rgba(7, 18, 31, 0.6) 100%);
    color: rgba(245, 251, 255, 0.9);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    pointer-events: none;
  }

  .bottom {
    position: fixed;
    left: 50%;
    bottom: var(--dock-bottom);
    transform: translateX(8px);
    z-index: 9;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 9px;
    border: 1px solid var(--shell-border);
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(8, 18, 34, 0.9) 0%, rgba(10, 24, 42, 0.74) 100%);
    box-shadow: var(--shell-shadow-soft);
    backdrop-filter: blur(16px);
    pointer-events: auto;

    .switch_iframe {
      cursor: pointer;
      width: 146px;
      height: 42px;
      line-height: 1;
      display: flex;
      text-align: center;
      color: var(--shell-text-dim);
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.12em;
      padding: 3px;
      border: 1px solid rgba(132, 187, 255, 0.1);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.03);
      box-shadow: none;
      backdrop-filter: blur(0);

      .iframeLeft, .iframeRight {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 50%;
        height: 100%;
        border-radius: 999px;
        transition: color 0.24s ease;
      }

      .iframeLeft {
        padding-left: 0;
      }

      .iframeRight {
        padding-right: 0;
      }

      .iframeIsColor {
        color: var(--shell-text);
        background: linear-gradient(90deg, rgba(52, 131, 255, 0.34) 0%, rgba(90, 231, 255, 0.18) 100%);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }

      .iframeDisable {
        opacity: 0.38;
        cursor: not-allowed;
      }
    }

    .bottom-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-left: 8px;
      border-left: 1px solid rgba(132, 187, 255, 0.08);
    }

    img {
      width: 40px;
      height: 40px;
      cursor: pointer;
      margin-left: 10px;
    }
  }

  .scrool-left {
    position: absolute;
    width: 343px;
    top: 87px;
    height: calc(100vh - 87px);
    overflow: scroll;
    z-index: 5;
  }

  .boxDay {
    position: absolute;
    z-index: 2;
    left: 1%;
    top: 7.5%;
    width: 343px;
    padding-top: 15px;
    font-size: 20px;
    font-family: Lantinghei SC;
    font-weight: 600;
    text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
    color: #fff;
  }

  .left-contatiner,
  .right-contatiner {
    position: fixed;
    top: var(--nav-offset);
    bottom: var(--panel-bottom);
    width: var(--panel-width);
    box-sizing: border-box;
    height: auto;
    z-index: 7;
    display: flex;
    flex-direction: column;
    padding: 10px 0 0;
    border: 1px solid var(--shell-border);
    border-radius: 28px;
    background: linear-gradient(180deg, rgba(10, 22, 39, 0.9) 0%, rgba(7, 17, 31, 0.76) 100%);
    box-shadow: var(--shell-shadow);
    backdrop-filter: blur(18px);
    overflow: hidden;

    > .runlist-con,
    > .right-con-box {
      flex: 1;
      min-height: 0;
    }

    .title {
      display: flex;
      align-items: center;
      gap: 10px;
      box-sizing: border-box;
      width: 100%;
      height: 56px;
      padding: 0 20px;
      cursor: pointer;
      background: linear-gradient(90deg, rgba(92, 200, 255, 0.12) 0%, rgba(92, 200, 255, 0.02) 45%, rgba(92, 200, 255, 0) 100%);
      border-bottom: 1px solid rgba(132, 187, 255, 0.1);

      i {
        margin-left: 0;
        color: var(--shell-accent);
      }

      .sm-title {
        font-size: 16px;
        line-height: 1;
        font-weight: 600;
        letter-spacing: 0.08em;
        color: var(--shell-text);
      }
    }
  }

  .menu-box {
    position: fixed;
    transition: all 0.3s linear 0.4s;
    width: 0px;
    top: var(--nav-offset);
    bottom: var(--panel-bottom);
    left: var(--shell-edge-padding);
    height: auto;
    z-index: 9;
    border-radius: 24px;
    overflow: hidden;

    ::-webkit-scrollbar {
      display: none; /* Chrome Safari */
    }

    &.active {
      width: var(--menu-width);
    }
  }

  .contatiner8GW {
    height: 1150px;
  }

  .left-contatiner {
    transition: all .3s linear .4s;
    left: var(--shell-edge-padding);

    .rendering {
      width: 340px;
      height: 100px;
      margin: 0 auto 15px;

      img {
        width: 100%;
        height: 100%;
      }
    }

    .day {
      //z-index: 6;
      position: absolute;
      top: -28px;
      left: 10px;
      font-size: 20px;
      font-family: Lantinghei SC;
      font-weight: 600;
      text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
      color: #fff;

      span:nth-last-child(1) {
        position: relative;
        font-size: 22px;
        font-family: Impact;
        font-weight: 400;
        color: #fff;
        //margin-left: 22px;
        margin-left: 10px;
      }

      span:nth-last-child(2) {
        padding-left: 5px;
      }

      span {
        &:first-child,
        &:nth-child(2) {
          font-size: 20px;
          font-family: Lantinghei SC;
          font-weight: 600;
          color: #fff;
        }
      }
    }

    &.noactive {
      transition: all .3s linear .4s;
      left: calc(var(--shell-edge-padding) + var(--menu-width) + 18px);
    }

    > .runlist-con {
      height: 100%;
    }
  }

  //.switch_iframe {
  //  //position: absolute;
  //  right: 19%;
  //  top: 87px;
  //  width: 150px;
  //  padding-top: 15px;
  //  box-sizing: border-box;
  //  z-index: 4;
  //  display: flex;
  //  justify-content: center;
  //
  //  .switch_iframe_btn {
  //    color: #fff;
  //    border-bottom-left-radius: 20px;
  //    border-top-left-radius: 20px;
  //    height: 40px;
  //    width: 50%;
  //    font-size: 16px;
  //    font-weight: bold;
  //    margin: 0;
  //    border: none;
  //
  //    &:nth-child(2) {
  //      border-bottom-left-radius: 0;
  //      border-top-left-radius: 0;
  //      border-bottom-right-radius: 20px;
  //      border-top-right-radius: 20px;
  //    }
  //  }
  //}

  .right-contatiner {
    z-index: 3;
    right: var(--shell-edge-padding);
    //.coldSite {
    //  width: 100%;
    //  height: 118px;
    //  display: flex;
    //  align-items: center;
    //  justify-content: space-evenly;
    //  margin-top: 20px;
    //
    //  .coldSite-data {
    //    position: relative;
    //    text-align: center;
    //    color: #fff;
    //
    //    img {
    //      width: 145px;
    //    }
    //
    //    .detail {
    //      position: absolute;
    //      cursor: pointer;
    //      width: 100%;
    //      top: 0;
    //      left: 0;
    //      bottom: 0;
    //      display: flex;
    //      flex-direction: column;
    //      justify-content: space-evenly;
    //
    //      p {
    //        text-align: center;
    //        font-size: 14px;
    //      }
    //
    //      p:nth-child(2) {
    //        font-size: 19px;
    //        font-weight: 500;
    //      }
    //    }
    //  }
    //}

    .workpiece-box {
      margin-top: 58px;

      &:first-child {
        margin-top: 14px;

        .num {
          padding: 0 15px;
          text-indent: -4px;

          p {
            flex: 1;
          }
        }
      }

      &:nth-child(2) {
        .location-box {
          img {
            right: 148px;
          }
        }

        .progress {
          .box:nth-child(4) {
            width: 25%;
            height: 100%;
            background: rgba(30, 118, 82, 1);
          }

          .box:nth-child(5) {
            width: 25%;
            height: 100%;
            background: #783f17;
          }

          .box:nth-child(6) {
            width: 25%;
            height: 100%;

            background: #772129;
          }
        }

        .num {
          padding: 0 15px;
          text-align: right;
          text-indent: 2em;

          p {
            flex: 1;
          }
        }
      }

      .workpiece {
        width: 100%;
        display: flex;
        color: #ffffff;
        padding-left: 18px;
        font-size: 24px;
        font-family: Microsoft YaHei;
        font-weight: 400;

        .data {
          margin-left: 46px;
        }
      }

      .location-box {
        position: relative;
        margin: 14px 15px 10px 15px;
        height: 25px;

        img {
          position: absolute;
          width: 20px;
          right: 0;
        }
      }

      .progress {
        padding: 0 15px;
        height: 35px;
        display: flex;
        text-align: center;
        line-height: 35px;
        color: #fff;
        font-size: 18px;
        font-family: Microsoft YaHei;

        .box:nth-child(1) {
          width: 25%;
          height: 100%;
          background: rgba(119, 33, 41, 1);
        }

        .box:nth-child(2) {
          width: 25%;
          height: 100%;
          background: rgba(120, 63, 23, 1);
        }

        .box:nth-child(3) {
          width: 25%;
          height: 100%;
          background: rgba(30, 118, 82, 1);
        }

        .box:nth-child(4) {
          width: 25%;
          height: 100%;
          background: rgba(25, 91, 113, 1);
        }
      }

      .num {
        display: flex;
        justify-content: space-around;
        font-size: 18px;
        font-family: Microsoft YaHei;
        font-weight: 400;
        color: #5e5e5e;
        margin-bottom: 10px;
      }
    }
  }

  .btom-sys {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    scrollbar-width: none; /* Firefox */
    &::-webkit-scrollbar {
      display: none; /* Chrome Safari */
    }

    width: 100%;
    min-height: 65px;
    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 999;

    .item {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 180px;
      height: 46px;
      font-size: 20px;
      font-weight: 500;
      margin-right: 62px;
      border-radius: 999px;
      border: 1px solid rgba(133, 184, 255, 0.12);
      color: #dfeefe;
      background:
          linear-gradient(135deg, rgba(17, 39, 63, 0.92) 0%, rgba(10, 22, 36, 0.84) 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 20px rgba(0, 0, 0, 0.16);

      &:last-child {
        margin-right: 0;
      }

      .txt {
        color: #f2fffe;
        text-shadow: 0px 2px 4px rgba(0, 0, 0, 0.3);
        background: linear-gradient(
                0deg,
                #4f6ca1 0%,
                rgba(79, 108, 161, 0) 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      &.active {
        background:
            linear-gradient(135deg, rgba(84, 199, 255, 0.9) 0%, rgba(11, 124, 255, 0.86) 100%);
        color: #08111d;
        box-shadow: 0 14px 22px rgba(11, 124, 255, 0.22);

        .txt {
          color: #08111d;
          background: none;
          -webkit-text-fill-color: initial;
        }
      }
    }
  }

  .menu-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    padding: 0;
    border: 1px solid rgba(132, 187, 255, 0.16);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--shell-text);
    cursor: pointer;
    transition: background 0.24s ease, border-color 0.24s ease, transform 0.24s ease;

    &:hover {
      background: rgba(92, 200, 255, 0.12);
      border-color: rgba(132, 187, 255, 0.3);
      transform: translateY(-1px);
    }
  }

  .nav-menu-icon {
    font-size: 24px;
  }

  .tempture-icon {
    font-size: 20px;
  }

  .tempture-icon-small {
    font-size: 18px;
  }

  .tool-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    margin: 0;
    border: 1px solid var(--shell-border);
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(8, 18, 34, 0.94) 0%, rgba(10, 24, 42, 0.8) 100%);
    box-shadow: var(--shell-shadow-soft);
    color: var(--shell-text);
    cursor: pointer;
    transition: transform 0.24s ease, border-color 0.24s ease, color 0.24s ease;
    font-size: 22px;

    &:hover {
      transform: translateY(-1px);
      border-color: var(--shell-border-strong);
      color: var(--shell-accent);
    }
  }

  .tool-action--scene-mode {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.14em;

    .tool-action__label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    &.is-active {
      border-color: var(--shell-border-strong);
      color: var(--shell-accent);
      background: linear-gradient(135deg, rgba(31, 123, 255, 0.2) 0%, rgba(88, 242, 255, 0.12) 100%);
    }
  }

  .screen-full {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border: 1px solid var(--shell-border);
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(8, 18, 34, 0.94) 0%, rgba(10, 24, 42, 0.8) 100%);
    box-shadow: var(--shell-shadow-soft);
    color: var(--shell-text);

    i {
      font-size: 22px !important;
    }
  }

  &.is-2d-mode {
    .scene-stage__hud {
      max-width: min(320px, calc(100% - 32px));
    }

    .scene-stage__scanlines {
      height: 54px;
      opacity: 0.56;
    }
  }

  &.is-2d-mode.is-shell-compact {
    .scene-stage__hud {
      max-width: min(264px, calc(100% - 24px));
      padding: 10px 12px;
    }

    .scene-stage__footer {
      gap: 8px;
      padding: 7px 10px;

      span:first-child {
        display: none;
      }
    }
  }

  &.is-shell-compact {
    .nav {
      grid-template-columns: minmax(196px, 1fr) minmax(260px, 480px) minmax(196px, 1fr);

      .left {
        .logo {
          max-width: 220px;
          height: 42px;
        }

        .logo-left {
          height: 30px;
        }
      }

      .titleBox {
        .title {
          .el-cascader {
            .el-input {
              .el-input__inner {
                height: 44px;
                font-size: clamp(15px, 1.15vw, 20px);
              }
            }
          }
        }

        .day {
          margin-top: 2px;
          font-size: 10px;
          letter-spacing: 0.1em;
        }
      }
    }

    .menu-trigger {
      width: 42px;
      height: 42px;
    }

    .scene-stage__hud {
      top: 14px;
      left: 14px;
      gap: 6px;
      max-width: min(296px, calc(100% - 28px));
      padding: 12px 14px;
    }

    .scene-stage__eyebrow,
    .scene-stage__meta {
      display: none;
    }

    .scene-stage__title {
      font-size: 17px;
    }

    .scene-stage__badge {
      min-width: 46px;
      height: 24px;
      padding: 0 10px;
      font-size: 10px;
    }

    .scene-stage__scanlines {
      inset: auto 18px 18px 18px;
      height: 56px;
      opacity: 0.58;
    }

    .scene-stage__footer {
      right: 14px;
      bottom: 14px;
      gap: 10px;
      padding: 8px 12px;
      font-size: 10px;
    }

    .tempture {
      padding: 8px;
      gap: 6px;

      .item {
        min-height: 56px;
        padding: 8px 10px;
        gap: 8px;

        .left {
          width: 32px;
          height: 32px;
        }

        .right {
          .num {
            font-size: 18px;
          }

          p {
            margin-top: 2px;
            font-size: 10px;
          }
        }
      }
    }

    .bottom {
      gap: 8px;
      padding: 6px 8px;

      .switch_iframe {
        width: 132px;
        height: 38px;
        font-size: 14px;
      }

      .bottom-actions {
        gap: 8px;
        padding-left: 6px;
      }
    }

    .tool-action,
    .screen-full {
      width: 46px;
      height: 46px;

      i {
        font-size: 20px !important;
      }
    }
  }

  &.is-scene-simplified {
    .left-contatiner,
    .right-contatiner {
      box-shadow: 0 20px 34px rgba(0, 0, 0, 0.16);

      .title {
        min-height: 44px;
      }
    }

    .left-contatiner {
      .runlist-con {
        padding-bottom: 0;
      }

      .chart {
        margin-bottom: 0;
      }

      .temp-section {
        display: none !important;
      }
    }

    .right-contatiner {
      .right-con-box,
      .hot-panel {
        gap: 6px;
      }

      .coldSite {
        display: none !important;
      }
    }

    .scene-stage__hud {
      top: 14px;
      left: 14px;
      gap: 4px;
      max-width: min(252px, calc(100% - 28px));
      padding: 9px 12px;
    }

    .scene-stage__eyebrow,
    .scene-stage__meta {
      display: none;
    }

    .scene-stage__title {
      font-size: 16px;
    }

    .scene-stage__badge {
      min-width: 44px;
      height: 24px;
      padding: 0 10px;
      font-size: 10px;
    }

    .scene-stage__scanlines {
      inset: auto 18px 18px 18px;
      height: 44px;
      opacity: 0.46;
    }

    .scene-stage__footer {
      right: 14px;
      bottom: 14px;
      gap: 8px;
      padding: 7px 10px;
    }

    .tempture {
      padding: 6px 8px;
      gap: 4px;

      .item {
        min-height: 50px;
        padding: 6px 8px;

        .left {
          width: 30px;
          height: 30px;
        }

        .right {
          .num {
            font-size: 16px;
          }

          p {
            font-size: 10px;
          }
        }
      }
    }

    .bottom {
      gap: 8px;
      padding: 6px 8px;
    }

    .tool-action,
    .screen-full {
      width: 48px;
      height: 48px;
    }
  }
}

@media (max-width: 1680px) {
  .default-box-content {
    .nav {
      grid-template-columns: minmax(210px, 1fr) minmax(280px, 500px) minmax(210px, 1fr);
    }
  }
}

@media (max-width: 1440px) {
  .default-box-content {
    .nav {
      gap: 14px;
      grid-template-columns: minmax(200px, 1fr) minmax(260px, 460px) minmax(200px, 1fr);
    }
  }
}

.threed {
  position: absolute;
  top: 159px;
  left: 50%;
  z-index: 3;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 602px;
  height: 40px;

  .d-item {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 133px;
    height: 40px;
    font-size: 19px;
    color: #fff;

    .iconfont {
      font-size: 16px;
      margin-right: 9px;
    }

    &:nth-child(1) {
      background: linear-gradient(
              0deg,
              #848484 0%,
              rgba(132, 132, 132, 0.24) 100%
      );
    }

    &:nth-child(2) {
      background: linear-gradient(
              0deg,
              #28629f 0%,
              rgba(40, 94, 151, 0.24) 100%
      );
    }

    &:nth-child(3) {
      background: linear-gradient(0deg, #002954 0%, rgba(0, 41, 84, 0.24) 100%);
    }

    &:nth-child(4) {
      background: linear-gradient(0deg, #002954 0%, rgba(0, 41, 84, 0.24) 100%);
    }
  }
}
</style>
