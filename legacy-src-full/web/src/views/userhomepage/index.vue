<template>
  <div v-if="showTabel" class="content">
    <div ref="contentViewport" class="contentViewport">
      <div class="contentCanvas" :style="contentCanvasStyle">
        <nav class="nav">
      <div class="titleBox">
        <div class="eyebrow">能源运营中枢</div>
        <div class="title">{{ $t('login.title') }}</div>
        <div class="day">{{ nowTimes }}</div>
      </div>
      <div class="logoBox">
        <img alt="" class="logo" src="@/assets/newLogo.png">
        <div class="brandCopy">
          <div class="brandCopy__title">G-Energy</div>
          <div class="brandCopy__meta">冷站网络总览</div>
        </div>
      </div>
      <!--      <div class="left">-->
      <!--        <div class="day">-->
      <!--          &lt;!&ndash;          <span>{{ nowDate }}</span>-->
      <!--                    <span>{{ nowWeek }}</span>-->
      <!--                    <span>{{ nowTime }}</span>&ndash;&gt;-->
      <!--          <span>{{ nowTimes }}</span>-->
      <!--        </div>-->
      <!--      </div>-->
      <div class="right">
        <div class="controlCluster">
          <div class="controlCluster__meta">
            <span class="controlCluster__label">平台模式</span>
            <span class="controlCluster__value">总览监控</span>
          </div>
          <div class="controlCluster__chips">
            <span class="controlCluster__chip">
              <strong>{{ devicedata.totalproject }}</strong>
              <span>项目</span>
            </span>
            <span class="controlCluster__chip controlCluster__chip--warn">
              <strong>{{ devicedata.totalalarm }}</strong>
              <span>报警</span>
            </span>
          </div>
          <div v-if="ifLangSelect" class="LangSelect">
            <LangSelect/>
          </div>
          <div class="user">
            <user-avater/>
          </div>
        </div>
      </div>
        </nav>
        <div class="main-box">
      <div class="left-contatiner">
        <div class="title title1">
          <div class="sm-title">
            <div>
              <!--              <svg-icon class-name="international-icon" icon-class="language"/>-->
              <span class="al_element-icons2 al_icon2xiangmuxuanze custom"></span>
            </div>
            <div>&nbsp;{{ $t('userHomePage.overviewColdStation') }}</div>
          </div>
          <!--          <div class="right-line" style="margin-top: 31px">-->
          <!--            <p></p>-->
          <!--            &lt;!&ndash; <div class="top-btn" @click="showproject = !showproject">-->
          <!--              项目管理-->
          <!--            </div> &ndash;&gt;-->
          <!--          </div>-->
        </div>
        <div class="leng">
          <div class="leng-detail">
            <div class="overview-shell" aria-hidden="true"></div>
            <div class="overview-grid">
              <div
                v-for="item in overviewMetrics"
                :key="item.label"
                :class="['overview-metric', item.tone]"
              >
                <div class="overview-metric__label">{{ item.label }}</div>
                <div class="overview-metric__value">
                  <AnimateInterger :value="item.value" class="overview-metric__number"/>
                  <span class="overview-metric__unit">{{ item.unit }}</span>
                </div>
                <div class="overview-metric__meta">{{ item.meta }}</div>
              </div>
            </div>
          </div>
        </div>
        <button class="projectAction" type="button" @click="showTabel = !showTabel">
          <span class="projectAction__title">项目选择</span>
          <span class="projectAction__hint">进入项目工作台</span>
        </button>

        <div class="title" style="cursor: pointer; margin-top: 10px">
          <div class="sm-title">
            <div>
              <i class="al_element-icons al_iconpaihang02-L" style="font-size: 30px;"></i>
            </div>
            <div>&nbsp;COP &nbsp;{{ $t('userHomePage.ranking') }}</div>
          </div>
          <div class="titleMeta">前 {{ Math.min(copline.length, 10) }}</div>
        </div>
        <div class="copLine">
          <cop-line :data="copline"/>
        </div>
        <div class="title">
          <div class="sm-title">
            <div>
              <!--              <svg-icon class-name="international-icon" icon-class="language"/>-->
            </div>
            <div>&nbsp;{{ $t('userHomePage.totalEnergyConsumptionMonth') }}</div><!--能耗统计-->
          </div>
          <div class="titleMeta">近 30 天</div>
        </div>

        <div class="chart">
          <lineChart
              :totalEnergyDataX="totalEnergyDataX"
              :totalEnergyDataY="totalEnergyDataY"
              style="width: 100%; height: 100%"
          />
        </div>
      </div>

      <div class="middle" v-if="!showproject">
        <Map/>
        <div class="mapInsights">
          <div class="mapInsights__hero">
            <div class="mapInsights__eyebrow">网络态势</div>
            <div class="mapInsights__title">全国项目分布与运行状态</div>
            <div class="mapInsights__desc">让地图承载网络密度与运行结构，而不是只展示孤立点位。</div>
          </div>
          <div class="mapInsights__cards">
            <div v-for="item in mapInsightsMetrics" :key="item.label" class="insightCard">
              <div class="insightCard__label">{{ item.label }}</div>
              <div class="insightCard__value">
                <span>{{ item.value }}</span>
                <small v-if="item.suffix">{{ item.suffix }}</small>
              </div>
              <div class="insightCard__meta">{{ item.meta }}</div>
            </div>
          </div>
        </div>
        <div class="mapRegionTray">
          <div class="mapRegionTray__eyebrow">区域态势</div>
          <div class="mapRegionTray__title">重点区域</div>
          <div class="mapRegionTray__summary">
            <div class="mapRegionMetric">
              <span>覆盖区域</span>
              <strong>{{ regionDistribution.length }}</strong>
            </div>
            <div class="mapRegionMetric">
              <span>头部占比</span>
              <strong>{{ regionLeadShare }}%</strong>
            </div>
          </div>
          <div class="mapRegionTray__list">
            <div v-for="item in regionHighlights" :key="item.name" class="region-pill">
              <span class="region-pill__name">{{ item.name }}</span>
              <span class="region-pill__share">{{ item.share }}%</span>
              <span class="region-pill__value">{{ item.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <div :class="['right-contatiner']" v-if="!showproject">
        <div class="title title2">
          <div class="sm-title">
            <div>
              <i class="al_element-icons al_iconbaojingxinxi" style="font-size: 26px;"></i>
            </div>
            <div>&nbsp;{{ $t('userHomePage.alarmInfo') }}</div>
          </div>
          <div class="sectionMetrics">
            <span class="sectionMetric sectionMetric--critical">
              <small>紧急</small>
              <strong>{{ alarmSummary.critical }}</strong>
            </span>
            <span class="sectionMetric sectionMetric--warning">
              <small>一般</small>
              <strong>{{ alarmSummary.warning }}</strong>
            </span>
            <span class="sectionMetric sectionMetric--info">
              <small>提示</small>
              <strong>{{ alarmSummary.info }}</strong>
            </span>
          </div>
        </div>
        <div class="cop-list">
          <router-link :to="{ name: 'totalalarm', query: { appids: appids } }">
            <div v-if="!prioritizedAlarms.length" class="alarm-empty">
              当前暂无有效报警
            </div>
            <div
                v-for="(item, index) in prioritizedAlarms"
                :key="index"
                :class="[index === colactive ? 'active' : '', 'item', `alarm-card--${alarmSeverityTone(item.alarmLevel)}`]"
                :title="item.alarmexplain"
                @click="colactive = index"
            >
              <div class="alarm-card__top">
                <div class="alarm-card__time">{{ item.time }}</div>
                <span :class="['alarm-card__badge', alarmSeverityClass(item.alarmLevel)]">
                  {{ alarmSeverityText(item.alarmLevel) }}
                </span>
              </div>
              <div class="alarm-card__device">{{ item.drnameEN }}</div>
              <div class="alarm-card__project">{{ item.appexplain || item.appexplainCNEN || '未命名项目' }}</div>
              <div class="alarm-card__meta">
                <span>{{ alarmMetaPrimary(item) }}</span>
                <span>{{ alarmMetaSecondary(item) }}</span>
              </div>
            </div>
          </router-link>
        </div>
        <!--        <div class="title">-->
        <!--          <div class="sm-title">设备工单</div>-->
        <!--          <div class="right-line">-->
        <!--            <p></p>-->
        <!--          </div>-->
        <!--        </div>-->
        <!--        <work />-->
      </div>

      <div class="project-list" v-if="showproject">
        <img
            alt=""
            class="cha"
            src="../../assets/cha.png"
            @click="showproject = false"
        />
        <div class="serach">
          <search @handleSearch="handleSearch"/>
        </div>
        <div class="tabel">
          <my-tabel :data="appsInfo"/>
        </div>
      </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else>
    <content-table @isShowTabel='handleShowTabel'/>
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import lineChart from "@/views/systemhomepage/components/Echart/homechart.vue";
import {findTopFiveAlarmLog} from "@/api/user";
import {
  findAllByCondition,
  findByUserId,
  findCOPRank,
} from "@/api/front/home";
import AnimateInterger from "@/components/animate";
// import Ditu from './components/ditu.vue'
import Map from "./components/Map";
import userAvater from "./components/user-avater";
import search from "./components/search";
import myTabel from "./components/tabel";
import contentTable from "./components/contentTable";
import work from "./components/work";
import CopLine from "./components/copline";
import LangSelect from '@/components/LangSelect'
import dayjs from "dayjs";

export default {
  components: {
    Map,
    lineChart,
    userAvater,
    search,
    myTabel,
    work,
    CopLine,
    AnimateInterger,
    LangSelect,
    contentTable
  },
  computed: {
    ...mapGetters(["path", "sidelist", "leave", "userid", 'appusergroup']),
    contentCanvasStyle() {
      const width = this.viewportSize.width || this.designCanvas.width;
      const height = this.viewportSize.height || this.designCanvas.height;
      const scale = this.viewportScale || 1;
      const offsetX = Math.max((width - this.designCanvas.width * scale) / 2, 0);
      const offsetY = Math.max((height - this.designCanvas.height * scale) / 2, 0);
      return {
        transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
      };
    },
    overviewMetrics() {
      return [
        {
          label: "设备总量",
          value: this.devicedata.totaldevice,
          unit: "台",
          meta: "接入设备规模",
          tone: "is-cyan",
        },
        {
          label: "运行设备",
          value: this.devicedata.totalrun,
          unit: "台",
          meta: "在线运行中",
          tone: "is-blue",
        },
        {
          label: "当前报警",
          value: this.devicedata.totalalarm,
          unit: "条",
          meta: "需优先跟进",
          tone: "is-amber",
        },
        {
          label: "故障设备",
          value: this.devicedata.totalerro,
          unit: "台",
          meta: "异常设备数量",
          tone: "is-rose",
        },
      ];
    },
    regionDistribution() {
      const regionCountMap = {};
      (this.appsInfo || []).forEach((item) => {
        const regionName = String(item.region || item.city || "未分区").replace(/省|市|自治区|特别行政区/g, "");
        regionCountMap[regionName] = (regionCountMap[regionName] || 0) + 1;
      });
      return Object.keys(regionCountMap)
        .map((name) => ({ name, count: regionCountMap[name] }))
        .sort((a, b) => b.count - a.count);
    },
    regionHighlights() {
      const total = this.regionDistribution.reduce((sum, item) => sum + item.count, 0) || 1;
      return this.regionDistribution.slice(0, 5).map((item) => ({
        ...item,
        share: Math.round((item.count / total) * 100),
      }));
    },
    regionLeadShare() {
      const total = this.regionDistribution.reduce((sum, item) => sum + item.count, 0);
      if (!total || !this.regionDistribution.length) {
        return 0;
      }
      return Math.round((this.regionDistribution[0].count / total) * 100);
    },
    mapInsightsMetrics() {
      const totalDevice = Number(this.devicedata.totaldevice) || 0;
      const totalRun = Number(this.devicedata.totalrun) || 0;
      const totalError = Number(this.devicedata.totalerro) || 0;
      const onlineRate = totalDevice ? Math.round((totalRun / totalDevice) * 100) : 0;
      const faultRate = totalDevice ? Math.round((totalError / totalDevice) * 100) : 0;
      return [
        {
          label: "在线率",
          value: onlineRate,
          suffix: "%",
          meta: "在网设备实时运行占比",
        },
        {
          label: "故障占比",
          value: faultRate,
          suffix: "%",
          meta: "异常设备在接入规模中的比重",
        },
        {
          label: "覆盖区域",
          value: this.regionDistribution.length,
          suffix: "区",
          meta: "当前项目网络覆盖的重点区域",
        },
      ];
    },
    prioritizedAlarms() {
      const severityOrder = { "3": 3, "2": 2, "1": 1, "0": 0 };
      return [...(this.coplist || [])].sort((a, b) => {
        const severityDiff = (severityOrder[String(b.alarmLevel)] || 0) - (severityOrder[String(a.alarmLevel)] || 0);
        if (severityDiff !== 0) {
          return severityDiff;
        }
        return String(b.time || "").localeCompare(String(a.time || ""));
      });
    },
    alarmSummary() {
      return (this.coplist || []).reduce(
        (summary, item) => {
          if (String(item.alarmLevel) === "3") {
            summary.critical += 1;
          } else if (String(item.alarmLevel) === "2") {
            summary.warning += 1;
          } else {
            summary.info += 1;
          }
          return summary;
        },
        { critical: 0, warning: 0, info: 0 }
      );
    },
  },
  data() {
    return {
      weatherData: "",
      appid: "",
      secret: "",
      totalEnergyDataY: [],
      totalEnergyDataX: [],
      coplist: [],
      copline: [],
      appsInfo: [],
      showproject: false,
      nowWeek: "",
      nowDate: "",
      nowTime: "",
      nowTimes: '',
      devicedata: {
        totalproject: 0,
        totaldevice: 0,
        totalalarm: 0,
        totalrun: 0,
        totalerro: 0,
      },
      colactive: 0,
      appids: "",
      ifLangSelect: false,
      showTabel: true,
      designCanvas: {
        width: 1920,
        height: 1080,
      },
      viewportScale: 1,
      viewportSize: {
        width: 1920,
        height: 1080,
      },
    };
  },
  watch: {
    showTabel(val) {
      if (val) {
        this.$nextTick(() => {
          this.updateViewportScale();
        });
      }
    },
  },
  created() {
    if (process.env.VUE_APP_IFLANGSELECT === 'true') {
      this.ifLangSelect = true
    }
    if (this.appusergroup) {
      this.appsInfo = this.appusergroup;
      this.devicedata.totalproject = this.appsInfo.length || 0;
      let arr = [];
      this.appsInfo.forEach((item) => {
        this.devicedata.totaldevice += Number(item.drCount);
        this.devicedata.totalalarm += Number(item.drAlarmSum);
        this.devicedata.totalrun += Number(item.drRunSum);
        this.devicedata.totalerro += Number(item.drmalfunctionSum);
        arr.push(item.appid);
      });
      this.appids = arr.join(",");
    } else {

    }
    //报警信息
    findTopFiveAlarmLog(this.userid).then((res) => {
      // console.log(res, "res报警");
      let data = []
      for (let item of res.data) {
        if (item.alarmexplain) {
          data.push(item)
        }
      }
      this.coplist = data
    });
    findByUserId().then((res) => {
      // this.totalEnergyDataY = res.data || []
      res.data.forEach((item) => {
        // console.log(item);
        this.totalEnergyDataY.push(item.value);
        this.totalEnergyDataX.push(item.name);
      });
    });
    findCOPRank(this.userid).then((res) => {
      this.copline = res.data.map(item => ({
        name: item.name,
        value: isNaN(Number(item.value)) ? 0 : Number(item.value)
      }));
    });
  },

  mounted() {
    this.setNowTimes();
    this.timer = setInterval(() => {
      this.setNowTimes();
    }, 1000);
    this.changBackGround("darkblue");
    this.updateViewportScale();
    window.addEventListener("resize", this.updateViewportScale);
  },
  beforeDestroy() {
    clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener("resize", this.updateViewportScale);
  },
  methods: {
    handleShowTabel() {
      this.showTabel = !this.showTabel
    },
    isColor(val) {
      if (val === '2') {
        return '#ff9a23'
      } else if (val === '3') {
        return '#ff0606'
      } else {
        return '#00c5fd'
      }
    },
    alarmSeverityClass(level) {
      if (String(level) === "3") {
        return "is-critical";
      }
      if (String(level) === "2") {
        return "is-warning";
      }
      return "is-info";
    },
    alarmSeverityTone(level) {
      if (String(level) === "3") {
        return "critical";
      }
      if (String(level) === "2") {
        return "warning";
      }
      return "info";
    },
    alarmLabel(item) {
      return item.regNameEN || item.alarmexplain || "报警";
    },
    alarmMetaPrimary(item) {
      return item.regNameEN || item.alarmexplain || "报警项";
    },
    alarmMetaSecondary(item) {
      if (item.alarmexplain && item.regNameEN && item.alarmexplain !== item.regNameEN) {
        return item.alarmexplain;
      }
      return "查看详情";
    },
    alarmSeverityText(level) {
      if (String(level) === "3") {
        return "紧急";
      }
      if (String(level) === "2") {
        return "一般";
      }
      return "提示";
    },
    handleSearch(info) {
      let obj = Object.assign({userId: this.userid}, info);
      findAllByCondition(obj).then((res) => {
        this.appsInfo = res.data || [];
      });
    },
    changBackGround(theme) {
      this.$store.commit("user/SET_THEME", theme);
    },
    updateViewportScale() {
      const viewport = this.$refs.contentViewport;
      const width = viewport ? viewport.clientWidth : window.innerWidth;
      const height = viewport ? viewport.clientHeight : window.innerHeight;
      const scale = Math.min(
        width / this.designCanvas.width,
        height / this.designCanvas.height
      );
      this.viewportSize = {
        width,
        height,
      };
      this.viewportScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    },
    handleMenuchange() {
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
      this.nowTimes = formattedTime
    },
  },
};
</script>
<style lang="scss">
.el-dropdown {
  color: #fff;

  .international-icon {
    width: 30px;
    height: 30px;
  }
}
</style>
<style lang="scss" scoped>
$yellow: #f8b514;
@mixin yellow {
  text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
  background: linear-gradient(bottom, #eea551 0%, #feffff 110%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

@mixin green {
  text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
  background: linear-gradient(bottom, #00ff5a 0%, #fff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

@mixin gray {
  text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
  /* background: linear-gradient(
    bottom,
    rgba(79, 108, 161, 1) 0%,
    rgba(79, 108, 161, 0) 100%
  ); */

  background: linear-gradient(0deg, #c4d5f4 0%, rgba(36, 47, 67, 0) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  /* text-shadow: 0px 5px 7px rgba(0, 0, 0, 0.75);
  -webkit-text-stroke: 1px #000000;
  text-stroke: 1px #000000;
  color: #ffffff; */
  font-weight: bold;
}

@mixin bluetext {
  text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
  background: linear-gradient(top, #fff 0%, rgba(111, 236, 255, 0.75) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

@mixin bluetextbottom {
  text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
  background: linear-gradient(bottom, rgba(0, 140, 255, 1) 0%, #fff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.mt0 {
  margin-top: 0 !important;
}

.custom {
  font-size: 25px;
  color: #5cdbe5 !important;
}

.content {
  position: relative;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background:
      radial-gradient(circle at 18% 18%, rgba(84, 199, 255, 0.14) 0%, transparent 24%),
      radial-gradient(circle at 80% 26%, rgba(11, 124, 255, 0.16) 0%, transparent 28%),
      linear-gradient(180deg, #09141f 0%, #10263a 100%);

  .contentViewport {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .contentCanvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 1920px;
    height: 1080px;
    transform-origin: top left;
    will-change: transform;
  }

  .nav {
    position: relative;
    z-index: 4;
    display: flex;
    //align-items: center;
    justify-content: center; /* 使子元素在水平方向上居中 */
    width: 100%;
    height: 150px;
    //background: url("../../assets/default.png") 0 0 / 100% no-repeat;
    background:
        linear-gradient(180deg, rgba(12, 30, 47, 0.88) 0%, rgba(16, 40, 61, 0.72) 100%);
    border-bottom: 1px solid rgba(133, 184, 255, 0.12);
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.12);

    .titleBox {
      width: 600px;
      text-align: center;
      color: #fff;
      //font-size: 2.8em;

      .title {
        margin-top: 10px;
        font-size: 2.8em;
        position: relative;
        padding: 10px 20px 12px;
        border-radius: 18px;
        background:
            linear-gradient(135deg, rgba(84, 199, 255, 0.12) 0%, rgba(11, 124, 255, 0.04) 100%);
        border: 1px solid rgba(133, 184, 255, 0.1);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);

        &::before {
          content: "";
          position: absolute;
          left: 22%;
          right: 22%;
          bottom: 6px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent 0%, rgba(92, 219, 229, 0.9) 50%, transparent 100%);
        }
      }

      .day {
        font-size: 2em;
      }
    }

    .logoBox {
      position: absolute;
      display: flex;
      align-items: center;
      gap: 14px;
      width: 320px;
      height: 70px;
      line-height: 70px;
      left: 15px;

      .logo {
        width: 174px;
        height: 52px;
      }

      .brandCopy {
        display: grid;
        gap: 2px;
        line-height: 1.2;
      }

      .brandCopy__title {
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: #ecf7ff;
      }

      .brandCopy__meta {
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(183, 214, 236, 0.58);
      }
    }

    .right {
      width: 200px;
      position: absolute;
      top: 8%;
      right: 0;
      display: flex;
      justify-content: space-around;

      .LangSelect {
        //border: 1px solid red;
        margin-top: 8px;
        width: 30px;
        height: 30px;
      }
    }
  }

  .middle {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1;
  }

  .main-box {
    //margin-top: 40px;
    margin-top: -75px;
    z-index: 2;
  }

    .left-contatiner,
    .right-contatiner {
      background: rgba(18, 45, 70, 0.5);
      position: absolute;
      box-sizing: border-box;
    width: 420px;
    padding-left: 15px;
    padding-right: 15px;
    //height: 100vh;
    z-index: 3;

    .title2 {
      position: sticky; /* Keeps the title fixed at the top */
      top: 0; /* Aligns title to the top */
      z-index: 3; /* Ensures it is above other content */
      background-color: #112338;
    }

      .title {
        display: flex;
        box-sizing: border-box;
        width: 100%;
        height: 40px;
        line-height: 40px;
        margin-top: 0px;
        border-radius: 0;
        background:
            linear-gradient(90deg, rgba(84, 199, 255, 0.14) 0%, rgba(11, 124, 255, 0.02) 70%, rgba(11, 124, 255, 0) 100%);
        border-bottom: 1px solid rgba(133, 184, 255, 0.1);

        &.title1 {
          margin-top: 0;
        }

      .sm-title {
        flex-shrink: 0;
        //width: 85px;
        padding: 0 10px;
        margin-top: 30px;
        text-align: center;
        font-size: 25px;
        //height: 15px;
        //line-height: 15px;
        color: #fff;
        display: flex;
        //border-left: 2px solid $yellow;
        //border-right: 2px solid $yellow;
      }

      .sm-title:nth-child(1) {
        margin-top: 0
      }

      .right-line {
        display: flex;
        align-items: center;
        flex: 1;
        margin-top: 12px;

        p {
          width: 100%;
          height: 2px;
          background: #0070ff;
          opacity: 0.3;
          margin-left: 10px;
        }

        .top-btn {
          flex-shrink: 0;
          line-height: 25px;
          margin-left: 8px;
          height: 25px;
          padding: 0 14px;
          background-color: #115fa5;
          font-size: 14px;
          color: #fff;
          border-radius: 13px;
          cursor: pointer;
        }

        &.nobtn {
          margin-top: 12px;
        }
      }
    }
  }

  .left-contatiner {
    left: 0;
    height: calc(100vh - 170px);

    .leng {
      position: relative;
      width: 400px;
      //height: 288px;
      height: 210px;
      margin-left: 0px;
      margin-top: 10px;
    }

    .copLine {
      height: 33%;
    }

    .leng-detail {
      position: absolute;
      width: 392px;
      height: 100%;
      left: 50%;
      transform: translateX(-50%);

      .overview-shell {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border-radius: 24px;
        background:
            radial-gradient(circle at 22% 18%, rgba(84, 199, 255, 0.2) 0%, rgba(84, 199, 255, 0.06) 24%, transparent 42%),
            radial-gradient(circle at 78% 20%, rgba(11, 124, 255, 0.18) 0%, rgba(11, 124, 255, 0.04) 26%, transparent 44%),
            linear-gradient(180deg, rgba(14, 32, 50, 0.96) 0%, rgba(8, 20, 34, 0.98) 100%);
        border: 1px solid rgba(133, 184, 255, 0.12);
        box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 18px 30px rgba(0, 0, 0, 0.12);
      }

      .list {
        position: absolute;
        top: 0%;
        width: 100%;
        height: 100%;

        .item {
          height: 100%;
          position: absolute;
          text-align: center;
          color: #fff;

          &:nth-child(1) {
            position: absolute;
            width: 70px;
            height: 100%;
            text-align: center;
            left: 18px;
            top: 13px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            font-size: 25px;

            .top {
              .name {
                margin-top: 10px;
                font-size: 18px;
              }
            }

            .bottom {
              margin-bottom: 24px;

              .num {
              }

              .name {
                //margin-top: 10px;
                font-size: 18px;
                margin-bottom: 10px;
              }
            }

            //.num {
            //font-family: DIN Condensed;
            //font-size: 25px;
            //@include bluetext;
            //}

            //.name {
            //  margin-top: 12px;
            //  font-size: 15px;
            //@include green;
            //font-style: italic;
            //}

            //.bottom {
            //margin-top: 60px;

            //.name2 {
            //  margin-top: 0;
            //}

            //.num2 {
            //  margin-top: 12px;
            //}
            //}
          }

          &:nth-child(2) {
            width: 120px;
            //text-align: center;
            height: 100%;
            //line-height: 100%;
            display: flex;
            align-items: center; /* 垂直居中 */
            justify-content: center; /* 水平居中 */
            left: 135px;
            top: 10px;
            //left: 140px;
            //top: 90px;

            .num {
              //font-size: 78px;
              font-size: 25px;
              //font-family: DIN Condensed;
              //@include yellow;
            }

            //.name {
            //  margin-top: -8px;
            //  font-size: 13px;
            //  @include gray;
            //}
          }

          &:nth-child(3) {
            position: absolute;
            width: 70px;
            height: 100%;
            text-align: center;
            top: 13px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            font-size: 25px;
            right: 20px;

            .top {
              .name {
                margin-top: 10px;
                font-size: 18px;
              }
            }

            .bottom {
              margin-bottom: 24px;

              .num {
              }

              .name {
                //margin-top: 10px;
                font-size: 18px;
                margin-bottom: 10px;
              }
            }

            //.num {
            //  font-family: DIN Condensed;
            //  font-size: 32px;
            //  @include bluetext;
            //}
            //
            //.name {
            //  margin-top: 6px;
            //  font-size: 10px;
            //  @include green;
            //
            //  font-style: italic;
            //}
            //
            //.bottom {
            //  margin-top: 52px;
            //}
          }
        }
      }
    }

    .linechart {
      width: 100%;
      height: 140px;
    }

    .peo-num {
      width: 99%;
      height: 400px;
      // background: red;
      margin-top: 20px;
      display: flex;
      justify-content: space-around;
      align-items: center;
      flex-wrap: wrap;
      text-align: center;
      font-size: 28px;
      font-family: Microsoft YaHei;
      padding-left: 15px;

      .Lydata {
        width: 135px;
        height: 90px;
        background: url("../../assets/home/taizi.png");

        .data {
          // background: red;
          font-size: 43px;
          font-weight: bold;
          margin-top: -30px;
          color: #fff;

          span:nth-child(1) {
            font-size: 28px;
          }

          span:nth-child(2) {
            font-size: 19px;
            @include bluetext;
          }
        }

        .name {
          width: 100%;
          height: 20px;
          font-size: 17px;
          font-weight: 800;
          @include bluetext;
          margin-top: 70px;
        }
      }
    }

    .chart {
      width: 100%;
      height: 33%;
    }

    .chart-list {
      padding-left: 30px;
      margin-top: 30px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;

      .item {
        display: flex;
        align-items: center;
        margin-right: 30px;
        padding-bottom: 20px;
        cursor: pointer;

        &:nth-child(3) {
          margin-right: 0;
        }
      }

      .circle {
        width: 15px;
        height: 15px;
        margin-right: 15px;
        border-radius: 4px;
        background: darkgray;
      }

      .name {
        color: #fff;
        font-size: 15px;
      }
    }
  }

  .right-contatiner {
    overflow-y: auto;
    z-index: 6;
    right: 0;
    padding-left: 0;

    .cop-list {
      height: calc(100vh - 170px);
      margin-bottom: 38px;
      margin-top: 15px;
      width: 100%;

      .item {
        cursor: pointer;
        padding: 0 20px;
        height: 90px;
        //line-height: 90px;
        font-size: 14px;
        color: #fff;
        background: rgba(0, 150, 255, 0.1);
        //margin-bottom: 17px;
        border-bottom: 2px solid #b965a4;
        width: 100%;
        //overflow: hidden;
        //text-overflow: ellipsis;
        //white-space: nowrap;

        .time {
          padding: 20px 0;
        }

        .inDetail {
          display: flex;
          justify-content: space-between;
        }

        &:hover {
          background: #f0ab33;
          color: #333333;
        }

        //&.active {
        //  background: #f0ab33;
        //  color: #333333;
        //}
        &:last-child {
          margin-bottom: 0;
        }
      }
    }
  }

  .project-list {
    position: relative;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 20px 17px 45px;
    margin-left: 355px;
    height: 895px;
    background: #02172e;

    .cha {
      position: absolute;
      top: 15px;
      right: 15px;
      width: 18px;
    }

    .serach {
      margin-bottom: 15px;
    }

    .tabel {
      flex: 1;
    }
  }

  .nav {
    height: 94px;
    padding: 10px 18px 0;

    .titleBox {
      display: grid;
      gap: 3px;
      width: 560px;

      .eyebrow {
        margin-bottom: 2px;
        font-size: 9px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: rgba(183, 214, 236, 0.58);
      }

      .title {
        margin-top: 0;
        font-size: 32px;
        line-height: 1.04;
        padding: 4px 18px 6px;
        background:
            linear-gradient(135deg, rgba(84, 199, 255, 0.08) 0%, rgba(11, 124, 255, 0.03) 100%);
      }

      .day {
        margin-top: 0;
        font-size: 15px;
        line-height: 1.08;
        color: rgba(230, 244, 255, 0.72);
      }
    }

    .logoBox {
      left: 14px;
      width: 286px;
      height: 48px;
      opacity: 0.82;

      .logo {
        width: 156px;
        height: 44px;
        flex: 0 0 auto;
      }

      .brandCopy {
        min-width: 0;
        gap: 4px;
      }

      .brandCopy__title {
        font-size: 13px;
        line-height: 1.1;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }

      .brandCopy__meta {
        font-size: 8px;
        line-height: 1.3;
        letter-spacing: 0.12em;
        white-space: normal;
      }
    }

    .right {
      top: 8px;
      right: 14px;
      width: auto;
      justify-content: flex-end;
    }
  }

  .controlCluster {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px 6px 10px;
    border-radius: 18px;
    border: 1px solid rgba(132, 187, 255, 0.12);
    background: linear-gradient(135deg, rgba(13, 33, 51, 0.92) 0%, rgba(8, 20, 34, 0.86) 100%);
    box-shadow: 0 14px 26px rgba(0, 0, 0, 0.16);
  }

  .controlCluster__meta {
    display: grid;
    gap: 2px;
    min-width: 68px;
    text-align: right;
  }

  .controlCluster__chips {
    display: flex;
    gap: 6px;
  }

  .controlCluster__chip {
    display: grid;
    gap: 2px;
    min-width: 48px;
    padding: 5px 7px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(132, 187, 255, 0.12);
    text-align: center;
    color: rgba(208, 228, 243, 0.72);

    strong {
      font-size: 14px;
      line-height: 1;
      color: #f4fbff;
    }

    span {
      font-size: 8px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
  }

  .controlCluster__chip--warn strong {
    color: #ffd59e;
  }

  .controlCluster__label {
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(183, 214, 236, 0.48);
  }

  .controlCluster__value {
    font-size: 12px;
    font-weight: 600;
    color: #eef7ff;
  }

  .main-box {
    --overview-side-width: 388px;
    --overview-shell-gap: 14px;
    --overview-middle-inset: calc(var(--overview-side-width) + (var(--overview-shell-gap) * 2));
    margin-top: -10px;
  }

  .left-contatiner,
  .right-contatiner {
    top: 104px;
    bottom: 14px;
    width: var(--overview-side-width);
    padding: 12px 14px 14px;
    border: 1px solid rgba(132, 187, 255, 0.06);
    border-radius: 24px;
    background: linear-gradient(180deg, rgba(13, 31, 49, 0.92) 0%, rgba(8, 20, 34, 0.88) 100%);
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.16);
    backdrop-filter: blur(16px);
  }

  .left-contatiner {
    left: var(--overview-shell-gap);
    height: auto;
    display: flex;
    flex-direction: column;
  }

  .right-contatiner {
    right: var(--overview-shell-gap);
    overflow: hidden;
  }

  .middle {
    top: 104px;
    left: var(--overview-middle-inset);
    right: var(--overview-middle-inset);
    bottom: 14px;
    border-radius: 30px;
    overflow: hidden;
    border: 1px solid rgba(132, 187, 255, 0.06);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18);
  }

  .mapInsights {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 4;
    display: grid;
    gap: 8px;
    width: 304px;
    pointer-events: none;
  }

  .mapRegionTray {
    position: absolute;
    left: 18px;
    bottom: 18px;
    z-index: 4;
    display: grid;
    gap: 10px;
    width: 388px;
    padding: 14px 16px;
    border-radius: 22px;
    border: 1px solid rgba(132, 187, 255, 0.08);
    background: linear-gradient(135deg, rgba(9, 22, 36, 0.92) 0%, rgba(7, 18, 31, 0.78) 100%);
    box-shadow: 0 18px 32px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(14px);
    pointer-events: none;
  }

  .mapRegionTray__eyebrow {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(183, 214, 236, 0.54);
  }

  .mapRegionTray__title {
    font-size: 20px;
    font-weight: 600;
    color: #f5fbff;
  }

  .mapRegionTray__summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .mapRegionMetric {
    display: grid;
    gap: 4px;
    padding: 8px 10px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(132, 187, 255, 0.08);

    span {
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(183, 214, 236, 0.54);
    }

    strong {
      font-size: 20px;
      line-height: 1;
      color: #f4fbff;
    }
  }

  .mapRegionTray__list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .region-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(132, 187, 255, 0.08);
  }

  .region-pill__name {
    color: rgba(222, 240, 251, 0.86);
  }

  .region-pill__share {
    font-size: 10px;
    color: rgba(183, 214, 236, 0.58);
  }

  .region-pill__value {
    min-width: 22px;
    height: 22px;
    padding: 0 7px;
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(47, 124, 255, 0.26) 0%, rgba(63, 208, 255, 0.24) 100%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #f4fbff;
  }

  .mapInsights__hero,
  .insightCard {
    border: 1px solid rgba(132, 187, 255, 0.05);
    background: linear-gradient(135deg, rgba(9, 22, 36, 0.68) 0%, rgba(7, 18, 31, 0.46) 100%);
    box-shadow: 0 12px 20px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(12px);
  }

  .mapInsights__hero {
    padding: 10px 12px;
    border-radius: 20px;
  }

  .mapInsights__eyebrow {
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(183, 214, 236, 0.56);
  }

  .mapInsights__title {
    margin-top: 4px;
    font-size: 18px;
    font-weight: 600;
  }

  .mapInsights__desc {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.55;
    color: rgba(183, 214, 236, 0.58);
  }

  .mapInsights__cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .insightCard {
    padding: 8px 10px;
    border-radius: 14px;
  }

  .insightCard__label {
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(183, 214, 236, 0.54);
  }

  .insightCard__value {
    margin-top: 4px;
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-size: 19px;
    font-weight: 600;
    line-height: 1;

    small {
      font-size: 10px;
      color: rgba(183, 214, 236, 0.56);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
  }

  .insightCard__meta {
    margin-top: 4px;
    font-size: 9px;
    line-height: 1.45;
    color: rgba(183, 214, 236, 0.56);
  }

  .title {
    height: 42px;
    border-radius: 16px;
    align-items: center;
    padding: 0 6px;
    border-bottom-color: rgba(133, 184, 255, 0.08);
  }

  .titleMeta {
    margin-left: auto;
    padding: 0 10px;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(183, 214, 236, 0.56);
  }

  .left-contatiner .title .sm-title,
  .right-contatiner .title .sm-title {
    align-items: center;
    padding: 0 6px;
    margin-top: 0;
    font-size: 15px;
  }

  .right-contatiner .title {
    height: 40px;
    padding: 0 6px;
  }

  .right-contatiner .title .sm-title {
    font-size: 14px;
  }

  .left-contatiner .leng {
    width: 100%;
    height: 250px;
    margin-top: 8px;
  }

  .left-contatiner .leng-detail {
    width: 100%;
  }

  .overview-grid {
    position: absolute;
    inset: 14px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .overview-metric {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 6px;
    padding: 12px;
    min-height: 88px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(132, 187, 255, 0.08);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  .overview-metric.is-cyan {
    background: linear-gradient(180deg, rgba(45, 182, 212, 0.14) 0%, rgba(255, 255, 255, 0.03) 100%);
  }

  .overview-metric.is-blue {
    background: linear-gradient(180deg, rgba(47, 124, 255, 0.14) 0%, rgba(255, 255, 255, 0.03) 100%);
  }

  .overview-metric.is-amber {
    background: linear-gradient(180deg, rgba(255, 185, 74, 0.14) 0%, rgba(255, 255, 255, 0.03) 100%);
  }

  .overview-metric.is-rose {
    background: linear-gradient(180deg, rgba(255, 98, 131, 0.14) 0%, rgba(255, 255, 255, 0.03) 100%);
  }

  .overview-metric__label {
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(190, 218, 237, 0.6);
  }

  .overview-metric__value {
    display: flex;
    align-items: baseline;
    gap: 5px;
    min-height: 30px;
  }

  .overview-metric__number {
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
    color: #f4fbff;
  }

  .overview-metric__unit {
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(190, 218, 237, 0.56);
  }

  .overview-metric__meta {
    font-size: 11px;
    color: rgba(190, 218, 237, 0.72);
  }

  .projectAction {
    width: 100%;
    height: 42px;
    margin-top: 8px;
    padding: 0 14px;
    border: 1px solid rgba(132, 187, 255, 0.12);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, rgba(25, 71, 128, 0.92) 0%, rgba(36, 102, 168, 0.9) 100%);
    color: #f5fbff;
    cursor: pointer;
    box-shadow: 0 10px 16px rgba(23, 78, 146, 0.16);
  }

  .projectAction__title {
    font-size: 15px;
    font-weight: 600;
  }

  .projectAction__hint {
    font-size: 12px;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.78);
  }

  .left-contatiner .copLine,
  .left-contatiner .chart {
    margin-top: 10px;
    padding: 12px 12px 10px;
    border: 1px solid rgba(132, 187, 255, 0.06);
    border-radius: 24px;
    background: linear-gradient(180deg, rgba(11, 26, 42, 0.84) 0%, rgba(8, 20, 34, 0.92) 100%);
  }

  .left-contatiner .copLine {
    height: 216px;
  }

  .left-contatiner .chart {
    flex: 1 1 auto;
    min-height: 204px;
    background: linear-gradient(180deg, rgba(9, 20, 33, 0.74) 0%, rgba(7, 18, 29, 0.86) 100%);
  }

  .right-contatiner .cop-list {
    display: grid;
    gap: 10px;
    height: calc(100% - 56px);
    margin: 10px 0 0;
    padding-right: 2px;
    overflow-y: auto;
  }

  .right-contatiner .cop-list .item {
    height: auto;
    padding: 12px 14px;
    border: 1px solid rgba(132, 187, 255, 0.06);
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(16, 40, 61, 0.76) 0%, rgba(10, 23, 38, 0.92) 100%);
    color: #eef7ff;
    transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease;
  }

  .right-contatiner .cop-list .item:hover,
  .right-contatiner .cop-list .item.active {
    transform: translateY(-1px);
    border-color: rgba(132, 187, 255, 0.2);
    background: linear-gradient(180deg, rgba(25, 64, 96, 0.82) 0%, rgba(11, 28, 45, 0.96) 100%);
    color: #eef7ff;
  }

  .right-contatiner .cop-list .item.alarm-card--critical {
    border-left: 3px solid rgba(255, 84, 112, 0.72);
  }

  .right-contatiner .cop-list .item.alarm-card--warning {
    border-left: 3px solid rgba(255, 188, 90, 0.72);
  }

  .right-contatiner .cop-list .item.alarm-card--info {
    border-left: 3px solid rgba(87, 210, 255, 0.72);
  }

  .sectionMetrics {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sectionMetric {
    display: grid;
    justify-items: center;
    gap: 3px;
    min-width: 48px;
    padding: 5px 7px;
    border-radius: 12px;
    color: rgba(228, 240, 250, 0.86);
    background: rgba(255, 255, 255, 0.04);

    small {
      font-size: 9px;
      line-height: 1;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.78;
    }

    strong {
      font-size: 13px;
      line-height: 1;
      font-weight: 700;
      color: #f4fbff;
    }
  }

  .sectionMetric--critical {
    background: rgba(255, 84, 112, 0.16);
    color: #ffc4d0;
  }

  .sectionMetric--warning {
    background: rgba(255, 188, 90, 0.16);
    color: #ffd9a4;
  }

  .sectionMetric--info {
    background: rgba(87, 210, 255, 0.14);
    color: #b8eeff;
  }

  .alarm-empty {
    display: grid;
    place-items: center;
    min-height: 144px;
    border-radius: 16px;
    border: 1px dashed rgba(132, 187, 255, 0.14);
    background: rgba(255, 255, 255, 0.03);
    color: rgba(190, 218, 237, 0.72);
  }

  .alarm-card__top,
  .alarm-card__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .alarm-card__time,
  .alarm-card__meta {
    color: rgba(183, 214, 236, 0.68);
    font-size: 11px;
  }

  .alarm-card__device {
    margin-top: 10px;
    font-size: 17px;
    font-weight: 600;
    color: #f6fbff;
  }

  .alarm-card__project {
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.45;
    color: rgba(206, 225, 239, 0.68);
  }

  .alarm-card__meta {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(132, 187, 255, 0.08);
  }

  .alarm-card__badge {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .alarm-card__badge.is-critical {
    background: rgba(255, 84, 112, 0.18);
    color: #ffc0cc;
  }

  .alarm-card__badge.is-warning {
    background: rgba(255, 188, 90, 0.18);
    color: #ffd7a0;
  }

  .alarm-card__badge.is-info {
    background: rgba(87, 210, 255, 0.16);
    color: #b6efff;
  }
}
</style>
