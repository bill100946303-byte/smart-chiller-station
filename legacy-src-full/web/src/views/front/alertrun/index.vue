<template>
  <div class="legacy-front-page alertrun-page">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Alarm Center</div>
        <h1 class="legacy-front-page__title">告警与运维</h1>
        <div class="legacy-front-page__meta">统一查看实时报警、历史记录、参数设置、台账和设备信息。</div>
      </div>
      <div class="legacy-front-stat-group">
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Sections</div>
          <div class="legacy-front-stat__value">{{ navlist.length }}</div>
        </div>
      </div>
    </div>

    <div class="legacy-front-tab-shell">
      <el-tabs v-model="activeName" @tab-click="handleClick">
        <el-tab-pane :label="$t('route.realtime')" label="实时报警" name="realtime"></el-tab-pane>
        <el-tab-pane :label="$t('route.alertrecord')" label="报警记录" name="record"></el-tab-pane>
        <el-tab-pane :label="$t('route.alarmSettings')" label="报警设置" name="settings"></el-tab-pane>
        <el-tab-pane :label="$t('route.alertbill')" label="设备台账" name="bill"></el-tab-pane>
        <el-tab-pane :label="$t('route.DeviceInformation')" label="设备信息" name="deviceinformation"></el-tab-pane>
      </el-tabs>
      <component :is="currentTabComponent"/>
    </div>
  </div>
</template>
<script>
import realtime from "./realtime.vue";
import record from "./record.vue";
import bill from "./bill.vue";
import settings from "./settings.vue";
import deviceinformation from "./deviceinformation";

export default {
  name: "index",
  components: {
    realtime,
    record,
    bill,
    settings,
    deviceinformation,
  },
  computed: {
    currentTabComponent() {
      return this.navlist[this.nav].component;
    },
  },
  data() {
    return {
      nav: 0,
      activeName: "realtime",
      navlist: [
        {
          name: "实时报警",
          component: "realtime",
        },
        {
          name: "报警记录",
          component: "record",
        },
        {
          name: "报警设置",
          component: "settings",
        },
        {
          name: "设备台账",
          component: "bill",
        },
        {
          name: "设备信息",
          component: "deviceinformation",
        },
      ]
    };
  },
  methods: {
    handleClick(tab) {
      this.nav = tab.index;
    }
  }
}
</script>
