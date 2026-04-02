<template>
  <div class="temp-box" :style="boxStyle" @click="gopage(item.title,item.tagname,'℃')">
    <div class="tem-title">
      <div class="left">
        <div class="eyebrow">Trend</div>
        <div class="title-text">{{ $t(`defaultpage.${item.id}`) }}</div>
      </div>
      <div class="right">
        <span class="num">{{ displayValue }}</span>
        <span class="unit">℃</span>
      </div>
    </div>
    <div class="chart-shell">
      <div class="chart">
        <temp-chart :totalEnergyDataY="item.curveData" :id="item.id" :info="info"/>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import tempChart from "./Echart/tempchart.vue";

export default {
  props: ["item", "index", "info"],
  components: {
    tempChart,
  },
  computed: {
    ...mapGetters(["runleft"]),
    displayValue() {
      const numeric = Number(this.runleft[this.item.title]);
      if (!Number.isFinite(numeric)) {
        return "--";
      }
      if (Math.abs(numeric) >= 100) {
        return numeric.toFixed(0);
      }
      return numeric.toFixed(1);
    },
    accentColor() {
      return this.info && this.info.length ? this.info[0] : "#58d0ff";
    },
    boxStyle() {
      return {
        "--temp-accent": this.accentColor,
      };
    },
  },
  methods: {
    gopage(name, tagname, unit) {
      this.$router.push({
        path: "/front/dialog",
        query: {
          name,
          tagname,
          unit
        }
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.temp-box {
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  padding: 8px;
  border-radius: 14px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(25, 70, 104, 0.36) 0%, rgba(15, 37, 56, 0.92) 100%);
  border: 1px solid rgba(137, 207, 255, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 14px 24px rgba(0, 0, 0, 0.12);

  &::before {
    content: "";
    position: absolute;
    left: 12px;
    right: 12px;
    top: 0;
    height: 3px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--temp-accent) 0%, rgba(31, 123, 255, 0.9) 100%);
    opacity: 0.92;
  }

  .tem-title {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 2px 5px;
  }

  .left {
    min-width: 0;
  }

  .eyebrow {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(191, 220, 236, 0.58);
  }

  .title-text {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.2;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: var(--temp-accent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .right {
    display: flex;
    align-items: flex-end;
    gap: 4px;

    .num {
      font-size: 16px;
      font-weight: 700;
      line-height: 1;
      color: rgba(245, 251, 255, 0.98);
      font-variant-numeric: tabular-nums;
    }

    .unit {
      padding-bottom: 1px;
      font-size: 10px;
      color: rgba(195, 223, 241, 0.9);
    }
  }

  .chart-shell {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    padding: 8px 10px 10px;
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(6, 18, 31, 0.78) 0%, rgba(10, 24, 40, 0.58) 100%);
    border: 1px solid rgba(132, 187, 255, 0.08);
  }
}

.chart {
  flex: 1 1 auto;
  min-height: 88px;
  height: 100%;
}
</style>
