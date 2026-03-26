<template>
  <div
      v-loading="load"
      class="runlist-con"
      element-loading-background="rgba(1, 17, 35, .1)"
      element-loading-spinner="el-icon-loading"
  >
    <div class="title">
      <i class="al_element-icons al_iconshishizonggongshuai title-icon"></i>
      <div class="sm-title" @click="gopage">{{ $t('defaultpage.realTimeEnergy') }}</div>
      <p></p>
    </div>

    <div class="chart">
      <div class="chart-list">
        <div
            v-for="item in powerStats"
            :key="item.key"
            class="item"
            :style="{ '--stat-accent': item.accent }"
            @click="handleChart(item.key)"
        >
          <div class="item__head">
            <div class="icon">
              <i :class="['al_element-icons', item.iconClass]"></i>
            </div>
            <div class="item__meta">
              <div class="eyebrow">{{ item.eyebrow }}</div>
              <div class="label">{{ item.label }}</div>
            </div>
          </div>

          <div class="item__value-row">
            <div class="num">{{ item.value }}</div>
            <div class="unit">KW</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="runlist.length" class="temp-section">
      <div class="title">
        <i class="al_element-icons al_iconqixiangziliaoyuqihoujiancezhishu title-icon"></i>
        <div class="sm-title">{{ $t('defaultpage.waterTemperatureMonitoring') }}</div>
        <div class="sm-title" style="display: none">冷站概述</div>
      </div>
      <div class="tem-list">
        <temp-box
            v-for="(item, index) in runlist"
            :key="index"
            :info="templist[index]"
            :item="item"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import tempBox from "../tempture";

const POWER_META = {
  冷机总功率: {
    iconClass: "al_iconzhilengjizu",
    accent: "#6fe9ff",
    eyebrow: "CHILLER",
  },
  冷却塔总功率: {
    iconClass: "al_iconlengqueta",
    accent: "#87c6ff",
    eyebrow: "TOWER",
  },
  冷冻泵总功率: {
    iconClass: "al_iconlengdongbeng_huaban",
    accent: "#8ff6cc",
    eyebrow: "CHW PUMP",
  },
  冷却泵总功率: {
    iconClass: "al_iconlengquebeng_huaban",
    accent: "#9bb4ff",
    eyebrow: "CW PUMP",
  },
};

export default {
  components: {
    tempBox,
  },
  computed: {
    ...mapGetters(["runlist", "websocket", "template", "totalPower", "userid"]),
    powerStats() {
      return Object.keys(this.totalPower || {}).map((key) => {
        const meta = POWER_META[key] || {
          iconClass: "al_iconshishizonggongshuai",
          accent: "#78d8ff",
          eyebrow: "POWER",
        };
        return {
          key,
          label: this.$t(`defaultpage.${key}`),
          value: this.formatPowerValue(this.totalPower[key]),
          iconClass: meta.iconClass,
          accent: meta.accent,
          eyebrow: meta.eyebrow,
        };
      });
    },
  },
  data() {
    return {
      timer: null,
      load: true,
      templist: [
        ["#5ff8ff"],
        ["#d3fb7c"],
        ["#58d0ff"],
        ["#efa728"],
      ],
    };
  },
  mounted() {
    this.timer = setInterval(() => {
      let info = {
        msgType: "curveChange",
        userId: this.userid,
        template: this.template
      };
      this.websocket.sendWS(JSON.stringify(info));
    }, 1000 * 60);
  },
  watch: {
    runlist: {
      handler(val) {
        if (val && val.length) {
          this.load = false;
        }
      },
      immediate: true,
      deep: true,
    },
  },
  beforeDestroy() {
    clearInterval(this.timer);
  },
  methods: {
    formatPowerValue(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return "--";
      }
      if (Math.abs(numeric) >= 1000) {
        return numeric.toFixed(0);
      }
      if (Math.abs(numeric) >= 100) {
        return numeric.toFixed(1);
      }
      return numeric.toFixed(2);
    },
    handleChart(key) {
      return key;
    },
    gopage() {
    },
  },
};
</script>

<style lang="scss">
.left-contatiner {
  > .runlist-con {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 0 6px 8px;
  }

  .runlist-con {
    .title {
      height: 46px;
      padding: 0 16px;
      gap: 8px;

      .sm-title {
        font-size: 15px;
      }
    }

    .chart {
      margin-bottom: 8px;
      padding: 10px 10px 10px;
      border-radius: 18px;
      background:
          radial-gradient(circle at top right, rgba(88, 242, 255, 0.08), transparent 40%),
          linear-gradient(180deg, rgba(13, 32, 48, 0.84) 0%, rgba(11, 23, 34, 0.9) 100%);
      border: 1px solid rgba(124, 202, 255, 0.12);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 18px 28px rgba(0, 0, 0, 0.18);
    }

    .chart-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      color: #fff;
    }

    .item {
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 88px;
      padding: 10px;
      border-radius: 16px;
      background:
          radial-gradient(circle at top right, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
          linear-gradient(180deg, rgba(25, 70, 104, 0.34) 0%, rgba(15, 37, 56, 0.88) 100%);
      border: 1px solid rgba(137, 207, 255, 0.12);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
      cursor: pointer;

      &::before {
        content: "";
        position: absolute;
        inset: 0 auto auto 0;
        width: 100%;
        height: 3px;
        border-radius: 18px 18px 999px 999px;
        background: linear-gradient(90deg, var(--stat-accent) 0%, rgba(255, 255, 255, 0) 72%);
        opacity: 0.9;
      }

      &::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, transparent 45%);
        pointer-events: none;
      }

      &:hover {
        transform: translateY(-2px);
        border-color: rgba(123, 213, 255, 0.24);
        box-shadow: 0 14px 24px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }
    }

    .item__head {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
      border: 1px solid rgba(255, 255, 255, 0.05);
      box-shadow: inset 0 0 22px rgba(0, 0, 0, 0.12);

      i {
        font-size: 24px;
        color: var(--stat-accent);
      }
    }

    .item__meta {
      min-width: 0;
    }

    .eyebrow {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(194, 221, 236, 0.62);
    }

    .label {
      margin-top: 3px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.03em;
      color: rgba(245, 251, 255, 0.96);
    }

    .item__value-row {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      margin-top: auto;
      padding-top: 10px;
    }

    .num {
      font-size: 24px;
      font-weight: 700;
      line-height: 1;
      color: rgba(243, 250, 255, 0.98);
      font-variant-numeric: tabular-nums;
    }

    .unit {
      padding-bottom: 1px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(191, 220, 236, 0.68);
    }

    .temp-section {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
    }

    .tem-list {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      flex: 1 1 auto;
      min-height: 0;
      gap: 6px;
      grid-template-rows: repeat(4, minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr);
      align-content: stretch;
      padding-bottom: 0;
      overflow: hidden;
    }
  }
}
</style>
