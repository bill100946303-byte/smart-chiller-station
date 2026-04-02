<template>
  <div class="energy-test-page legacy-front-page">
    <div class="legacy-front-page__hero energy-test-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">专项分析工作台</div>
        <h1 class="legacy-front-page__title">能效分析</h1>
        <div class="legacy-front-page__meta">
          日历、查询、对比、负荷和热不平衡统一分析。
        </div>
      </div>
      <div class="energy-test-page__hero-meta">
        <div class="legacy-front-chip">当前：{{ activePage.title }}</div>
        <div class="legacy-front-chip energy-test-page__hero-focus">{{ activePage.meta }}</div>
      </div>
    </div>

    <section class="legacy-front-tab-shell energy-test-nav-shell">
      <div class="legacy-front-section-title">
        <strong>分析导航</strong>
        <span>{{ activePage.summary }}</span>
      </div>
      <div class="energy-test-tabs" role="tablist" aria-label="energy-test-tabs">
        <button
          v-for="item in navlist"
          :key="item.name"
          type="button"
          :class="[
            'energy-test-tabs__item',
            activeName === item.name ? 'is-active' : '',
            item.core ? 'is-core' : ''
          ]"
          @click="handleClick(item.name)"
        >
          <span class="energy-test-tabs__label">{{ item.title }}</span>
          <span class="energy-test-tabs__meta">{{ item.meta }}</span>
          <span class="energy-test-tabs__desc">{{ item.desc }}</span>
        </button>
      </div>
    </section>

    <section class="legacy-front-tab-shell energy-test-content-shell">
      <component :is="currentTabComponent"/>
    </section>
  </div>
</template>

<script>
import day from "./day.vue";
import search from "./search.vue";
import compare from "./compare.vue";
import proportion from "./proportion.vue";
import hotbalance from "./hotbalance.vue";

export default {
  name: "EnergyTestIndex",
  components: {
    day,
    search,
    compare,
    proportion,
    hotbalance
  },
  data() {
    return {
      activeName: "analysis",
      navlist: [
        {
          name: "analysis",
          title: "能效日历",
          meta: "月度总览",
          desc: "查看每日能效变化、月度主指标和构成分布。",
          summary: "先看月度总览，再钻取到单日表现。",
          component: "day",
          core: true
        },
        {
          name: "search",
          title: "能效查询",
          meta: "对象趋势",
          desc: "按设备对象、时间区间和粒度查询趋势、峰值与设备明细。",
          summary: "围绕对象与时间范围读取趋势和结果。",
          component: "search",
          core: true
        },
        {
          name: "compare",
          title: "能效对比",
          meta: "时段对照",
          desc: "对比不同时间组下的整体值、平均值和最优最差表现。",
          summary: "突出不同时间组之间的能效差异。",
          component: "compare",
          core: true
        },
        {
          name: "proportion",
          title: "负荷比重",
          meta: "区间占比",
          desc: "查看负荷区间占比与冷站能效的联动关系。",
          summary: "聚焦负荷区间与冷站效能的对应关系。",
          component: "proportion",
          core: false
        },
        {
          name: "Rate",
          title: "热不平衡率",
          meta: "达标分析",
          desc: "跟踪热不平衡率曲线、达标率与统计结果。",
          summary: "优先看达标率，再查看对象明细。",
          component: "hotbalance",
          core: false
        }
      ]
    };
  },
  computed: {
    activePage() {
      return this.navlist.find(item => item.name === this.activeName) || this.navlist[0];
    },
    currentTabComponent() {
      return this.activePage.component;
    }
  },
  methods: {
    handleClick(name) {
      this.activeName = name;
    }
  }
};
</script>

<style lang="scss" scoped>
.energy-test-page {
  min-height: calc(100vh - 120px);
}

.energy-test-page__hero {
  margin-bottom: 2px;
}

.energy-test-page__hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: flex-end;
  max-width: 280px;
}

.energy-test-nav-shell,
.energy-test-content-shell {
  margin-top: 2px;
  padding: 6px 8px;
}

.energy-test-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 3px;
  margin-top: 2px;
}

.energy-test-tabs__item {
  min-height: 40px;
  padding: 5px 6px;
  border-radius: 10px;
  border: 1px solid rgba(132, 187, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(198, 222, 236, 0.72);
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.energy-test-tabs__item:hover {
  transform: translateY(-1px);
  border-color: rgba(128, 219, 255, 0.22);
  color: rgba(240, 248, 255, 0.92);
}

.energy-test-tabs__item.is-core {
  background: linear-gradient(180deg, rgba(17, 42, 61, 0.88) 0%, rgba(9, 23, 36, 0.96) 100%);
}

.energy-test-tabs__item.is-active {
  color: rgba(245, 251, 255, 0.98);
  border-color: rgba(104, 204, 255, 0.36);
  background: linear-gradient(180deg, rgba(23, 68, 101, 0.92) 0%, rgba(13, 34, 51, 0.96) 100%);
  box-shadow: 0 16px 28px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.energy-test-tabs__label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.energy-test-tabs__meta {
  display: inline-flex;
  margin-top: 1px;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 5px;
  letter-spacing: 0.12em;
  color: rgba(184, 214, 232, 0.7);
}

.energy-test-tabs__desc {
  display: none;
}

.energy-test-page__hero-meta :deep(.legacy-front-chip) {
  padding: 3px 7px;
  font-size: 8px;
}

.energy-test-page__hero-focus {
  max-width: 170px;
}

@media (max-width: 1480px) {
  .energy-test-page__hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .energy-test-page__hero-meta {
    justify-content: flex-start;
    max-width: none;
  }
}

@media (max-width: 1280px) {
  .energy-test-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
