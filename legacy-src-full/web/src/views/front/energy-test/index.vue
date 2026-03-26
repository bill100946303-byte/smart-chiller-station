<template>
  <div class="energy-test-page">
    <div class="energy-test-shell">
      <div class="energy-test-shell__header">
        <div class="energy-test-shell__eyebrow">ENERGY ANALYTICS</div>
        <div class="energy-test-shell__title">{{ activeTitle }}</div>
        <div class="energy-test-shell__desc">能效日历、查询、对比、负荷比重与热不平衡率统一在同一分析壳层中。</div>
      </div>
      <div class="energy-test-tabs" role="tablist" aria-label="energy-test-tabs">
        <button
          v-for="item in navlist"
          :key="item.name"
          type="button"
          :class="['energy-test-tabs__item', activeName === item.name ? 'is-active' : '']"
          @click="handleClick(item.name)"
        >
          <span class="energy-test-tabs__label">{{ item.title }}</span>
          <span class="energy-test-tabs__meta">{{ item.meta }}</span>
        </button>
      </div>
      <div class="energy-test-shell__body">
        <component :is="currentTabComponent"/>
      </div>
    </div>
  </div>
</template>
<script>
import day from "./day.vue";
import search from "./search.vue";
import compare from "./compare.vue";
import proportion from "./proportion.vue";
import hotbalance from "./hotbalance.vue";

export default {
  name: "index",
  components: {
    day,
    search,
    compare,
    proportion,
    hotbalance
  },
  computed: {
    currentTabComponent() {
      const active = this.navlist.find((item) => item.name === this.activeName) || this.navlist[0];
      return active.component;
    },
    activeTitle() {
      const active = this.navlist.find((item) => item.name === this.activeName) || this.navlist[0];
      return active.title;
    },
  },
  data() {
    return {
      activeName: 'analysis',
      navlist: [
        {
          name: "analysis",
          title: "能效日历",
          meta: this.$t('route.analysis'),
          component: "day",
        },
        {
          name: "search",
          title: "能效查询",
          meta: this.$t('route.search'),
          component: "search",
        },
        {
          name: "compare",
          title: "能效对比",
          meta: this.$t('route.compare'),
          component: "compare",
        },
        {
          name: "proportion",
          title: "负荷比重",
          meta: this.$t('route.proportion'),
          component: "proportion",
        },
        {
          name: "Rate",
          title: "热不平衡率",
          meta: this.$t('route.thermalImbalanceRate'),
          component: "hotbalance",
        },
      ]
    };
  },
  methods: {
    handleClick(name) {
      this.activeName = name;
    }
  }
}
</script>

<style lang="scss">
.energy-test-page {
  min-height: 100%;
  padding: 16px;
  background:
    radial-gradient(circle at top left, rgba(46, 120, 255, 0.14), transparent 30%),
    radial-gradient(circle at top right, rgba(45, 236, 213, 0.08), transparent 24%),
    linear-gradient(180deg, rgba(3, 11, 20, 0.98) 0%, rgba(8, 22, 34, 0.98) 100%);
}

.energy-test-shell {
  min-height: calc(100vh - 32px);
  padding: 18px 18px 20px;
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(11, 27, 42, 0.98) 0%, rgba(6, 18, 30, 0.98) 100%);
  border: 1px solid rgba(120, 210, 255, 0.12);
  box-shadow: 0 22px 44px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.energy-test-shell__header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  padding: 4px 6px 0;
}

.energy-test-shell__eyebrow {
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(162, 204, 227, 0.72);
}

.energy-test-shell__title {
  font-size: 22px;
  font-weight: 700;
  color: rgba(245, 251, 255, 0.96);
}

.energy-test-shell__desc {
  max-width: 760px;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(195, 221, 235, 0.7);
}

.energy-test-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.energy-test-tabs__item {
  min-width: 160px;
  padding: 12px 16px;
  border-radius: 18px;
  border: 1px solid rgba(122, 208, 255, 0.12);
  background: linear-gradient(180deg, rgba(16, 36, 54, 0.9) 0%, rgba(9, 23, 36, 0.92) 100%);
  color: rgba(198, 222, 236, 0.72);
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.energy-test-tabs__item:hover {
  transform: translateY(-1px);
  border-color: rgba(128, 219, 255, 0.24);
  color: rgba(240, 248, 255, 0.92);
}

.energy-test-tabs__item.is-active {
  color: rgba(245, 251, 255, 0.98);
  border-color: rgba(104, 204, 255, 0.36);
  background: linear-gradient(180deg, rgba(23, 68, 101, 0.92) 0%, rgba(13, 34, 51, 0.96) 100%);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.energy-test-tabs__label {
  display: block;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.energy-test-tabs__meta {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(171, 205, 225, 0.62);
}

.energy-test-shell__body {
  padding-top: 2px;
}

@media (max-width: 1280px) {
  .energy-test-page {
    padding: 12px;
  }

  .energy-test-shell {
    min-height: calc(100vh - 24px);
    padding: 14px;
  }

  .energy-test-tabs__item {
    min-width: 140px;
  }
}
</style>
