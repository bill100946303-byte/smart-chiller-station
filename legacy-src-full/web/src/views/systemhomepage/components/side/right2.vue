<template>
  <div class="right-con-box hot-panel">
    <div class="title">
      <i class="al_element-icons al_iconshishinenghao title-icon"></i>
      <div class="sm-title" @click="isItVisibleAi">{{ $t('defaultpage.realTimeEnergy') }}</div>
      <p></p>
    </div>

    <div class="coldSite">
      <div
          v-for="item in statCards"
          :key="item.key"
          class="coldSite-data"
          @click="gopage(item.routeName, item.routeTag)"
      >
        <div class="card-orb"></div>
        <div class="detail">
          <div class="metric-kicker">{{ item.kicker }}</div>
          <p>{{ item.value }}</p>
          <p>{{ item.label }}（{{ item.unit }}）</p>
          <i :class="['al_element-icons2', item.iconClass, 'card-icon']"></i>
        </div>
      </div>
    </div>

    <div class="title titleCoefficient">
      <i class="al_element-icons al_iconfuzhupianchaguanli title-icon"></i>
      <div class="sm-title" @click="gopagevideo">{{ $t('defaultpage.energyConsumptionCoefficient') }}</div>
      <p></p>
    </div>

    <div class="coefficient">
      <div v-for="item in coefficientCards" :key="item.key" class="metric-card">
        <div class="metric-card__eyebrow">{{ item.eyebrow }}</div>
        <div class="metric-card__title">{{ item.label }}</div>
        <div class="metric-card__value">{{ item.value }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import {setAiSetting} from "@/api/front/home";

export default {
  computed: {
    ...mapGetters(["ontimeHot", "coldStationCopHot", "chillerCopHot", "chilledWaterPumpCopHot", "path", "name"]),
    statCards() {
      const runtimeStats = this.ontimeHot || {};
      return [
        {
          key: "totalHotPower",
          value: this.formatMetricValue(runtimeStats["热站实时总功率"]),
          label: this.$t("defaultpage.HotTotalPower"),
          unit: "KW",
          kicker: "HOT STATION",
          iconClass: "al_icon2fl-dian",
          routeName: "热站实时总功率",
          routeTag: "totalHotPower",
        },
        {
          key: "RealTimeHeatingCapacity",
          value: this.formatMetricValue(runtimeStats["热站实时总热量"]),
          label: this.$t("defaultpage.HotTotalCoolingCapacity"),
          unit: this.$store.getters.unitSelete,
          kicker: "THERMAL LOAD",
          iconClass: "al_icon2xuehua",
          routeName: "热站实时总热量",
          routeTag: "RealTimeHeatingCapacity",
        },
      ];
    },
    coefficientCards() {
      return [
        {
          key: "coldStationCopHot",
          eyebrow: "SYSTEM COP",
          label: this.$t("defaultpage.systemEnergyEfficiency"),
          value: this.formatMetricValue(this.coldStationCopHot),
        },
        {
          key: "chillerCopHot",
          eyebrow: "THERMAL COP",
          label: this.$t("defaultpage.ThermalEnergyEfficiency"),
          value: this.formatMetricValue(this.chillerCopHot),
        },
        {
          key: "chilledWaterPumpCopHot",
          eyebrow: "PUMP INDEX",
          label: this.$t("defaultpage.coolingPumpHot"),
          value: this.formatMetricValue(this.chilledWaterPumpCopHot),
        },
      ];
    },
  },
  methods: {
    formatMetricValue(value) {
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
    isItVisibleAi() {
      if (process.env.VUE_APP_BASE_URL !== 'https://www.ssge.com.cn:8098') return
      this.$confirm('', '是否开启AI算法', {
        confirmButtonText: '开启',
        cancelButtonText: '不开启',
        type: 'warning'
      }).then(() => {
        setAiSetting(this.path, {ai: 1}).then(res => {
          if (res.status === 20000) {
            this.$message.success("开启成功 !");
          } else {
            this.$message.error(res.msg);
          }
        })
      }).catch(() => {
        setAiSetting(this.path, {ai: 0}).then(res => {
          if (res.status === 20000) {
            this.$message.success("成功关闭 !");
          } else {
            this.$message.error(res.msg);
          }
        })
      });
    },
    gopagevideo() {
      if (this.name === 'ghb') {
        let {href} = this.$router.resolve({
          path: "/systemhomepage/components/side/video",
        });
        window.open(href, "_blank");
      }
    },
    gopage(name, tagname) {
      this.$router.push({
        path: "/front/dialog",
        query: {
          name,
          tagname,
          unit: this.$store.getters.unitSelete
        }
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.hot-panel {
  .titleCoefficient {
    margin-top: 0;
  }

  .coefficient {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    flex: 1 1 auto;
    min-height: 0;
  }

  .metric-card {
    position: relative;
    padding: 12px 14px 14px;
    border-radius: 18px;
    background:
      radial-gradient(circle at top right, rgba(255, 198, 84, 0.1), transparent 38%),
      linear-gradient(180deg, rgba(26, 70, 88, 0.42) 0%, rgba(16, 39, 54, 0.92) 100%);
    border: 1px solid rgba(152, 220, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 18px 28px rgba(0, 0, 0, 0.14);
  }

  .metric-card__eyebrow {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(187, 219, 238, 0.68);
  }

  .metric-card__title {
    margin-top: 4px;
    font-size: 14px;
    font-weight: 600;
    color: rgba(241, 248, 255, 0.96);
  }

  .metric-card__value {
    margin-top: 8px;
    font-size: 24px;
    font-weight: 700;
    color: #8feaff;
    letter-spacing: 0.02em;
    text-shadow: 0 10px 20px rgba(0, 0, 0, 0.18);
  }
}

.right-con-box {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  overflow: hidden;
  padding: 0 6px 8px;

  .title {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 42px;
    margin: 0;
    padding: 0 12px 0 16px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(13, 30, 48, 0.92) 0%, rgba(18, 52, 72, 0.76) 100%);
    border: 1px solid rgba(126, 202, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 28px rgba(0, 0, 0, 0.15);

    &::before {
      content: "";
      position: absolute;
      left: 12px;
      top: 11px;
      bottom: 11px;
      width: 3px;
      border-radius: 999px;
      background: linear-gradient(180deg, #ffd26f 0%, #ff8a3d 100%);
      opacity: 0.92;
    }

    .title-icon {
      font-size: 24px;
      color: rgba(255, 208, 122, 0.92);
    }

    .sm-title {
      margin-left: 12px;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: rgba(245, 251, 255, 0.96);
    }
  }

  .coldSite {
    display: flex;
    gap: 8px;
    margin: 0;

    .coldSite-data {
      position: relative;
      flex: 1;
      min-height: 104px;
      border-radius: 16px;
      overflow: hidden;
      background:
        radial-gradient(circle at top right, rgba(255, 208, 112, 0.12), transparent 42%),
        linear-gradient(180deg, rgba(34, 82, 100, 0.44) 0%, rgba(17, 40, 54, 0.92) 100%);
      border: 1px solid rgba(156, 211, 241, 0.12);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 26px rgba(0, 0, 0, 0.16);
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      cursor: pointer;

      &:hover {
        transform: translateY(-2px);
        border-color: rgba(255, 202, 117, 0.24);
        box-shadow: 0 16px 30px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }
    }

    .card-orb {
      position: absolute;
      width: 108px;
      height: 108px;
      right: -22px;
      top: -30px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 206, 107, 0.28) 0%, rgba(255, 206, 107, 0.08) 46%, transparent 72%);
      filter: blur(2px);
    }

    .detail {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 3px;
      padding: 10px 8px 8px;
      text-align: center;
    }

    .metric-kicker {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(255, 224, 173, 0.72);
    }

    p {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      line-height: 1.1;
      color: rgba(249, 252, 255, 0.98);
      text-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
    }

    p:nth-child(3) {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(210, 228, 241, 0.92);
    }

    .card-icon {
      margin-top: 2px;
      font-size: 30px;
      color: #ffd28e;
      filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.18));
    }
  }
}
</style>
