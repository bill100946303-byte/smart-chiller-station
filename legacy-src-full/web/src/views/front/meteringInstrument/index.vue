<template>
  <div class="legacy-front-page metering-instrument-page">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Metering</div>
        <h1 class="legacy-front-page__title">计量仪表</h1>
        <div class="legacy-front-page__meta">在计量仪表和能耗抄表之间切换，保持统一的查看入口。</div>
      </div>
      <div class="legacy-front-stat-group">
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Tabs</div>
          <div class="legacy-front-stat__value">{{ navlist.length }}</div>
        </div>
      </div>
    </div>

    <section class="legacy-front-tab-shell">
      <el-tabs v-model="activeName">
        <el-tab-pane
          v-for="tab in navlist"
          :key="tab.name"
          :label="tab.label"
          :name="tab.name"
        />
      </el-tabs>
      <component :is="currentTabComponent"/>
    </section>
  </div>
</template>

<script>
import meteringInstrument from "./meteringInstrument";
import meterReading from "./meterReading";

export default {
  name: "index",
  components: {
    meteringInstrument,
    meterReading
  },
  data() {
    return {
      activeName: "meteringInstrument",
      navlist: [
        {
          name: "meteringInstrument",
          label: "计量仪表",
          component: "meteringInstrument",
        },
        {
          name: "meterReading",
          label: "能耗抄表",
          component: "meterReading",
        }
      ]
    };
  },
  computed: {
    currentTabComponent() {
      const current = this.navlist.find(item => item.name === this.activeName);
      return current ? current.component : "meteringInstrument";
    },
  },
}
</script>
