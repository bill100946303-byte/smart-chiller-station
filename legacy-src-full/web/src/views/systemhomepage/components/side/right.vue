<template>
  <div class="right-con-box">
    <div class="title">
      <i class="al_element-icons al_iconshishinenghao title-icon"></i>
      <div class="sm-title" @click="isItVisibleAi">{{ $t('defaultpage.energyConsumptionStatistics') }}</div>
      <div class="sm-title" style="display:none">冷站能效</div>
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

    <div class="title">
      <i class="al_element-icons al_iconfuzhupianchaguanli title-icon"></i>
      <div class="sm-title" @click="gopagevideo">{{ $t('defaultpage.energyConsumptionCoefficient') }}</div>
      <div class="sm-title" style="display:none">冷站能效</div>
      <p></p>
    </div>

    <div class="line-long">
      <div class="system-cop-hero">
        <line1/>
      </div>
      <div class="system-cop-secondary-list">
        <line3/>
        <line6/>
        <line2/>
      </div>
    </div>
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import {setAiSetting} from "@/api/front/home";

import line1 from "./line1.vue";
import line2 from "./line2.vue";
import line3 from "./line3.vue";
import line6 from "./line6.vue";

export default {
  computed: {
    ...mapGetters(["ontime", "ontimeRT", "name", "path"]),
    statCards() {
      const runtimeStats = (this.$store.getters.unitSelete === "RT" ? this.ontimeRT : this.ontime) || {};
      return [
        {
          key: "totalPower",
          value: this.formatMetricValue(runtimeStats["实时总功率"]),
          label: this.$t("defaultpage.totalPower"),
          unit: "KW",
          kicker: this.$t("defaultpage.energyConsumptionStatistics"),
          iconClass: "al_icon2fl-dian",
          routeName: "实时总功率",
          routeTag: "totalPower",
        },
        {
          key: "totalCoolingCapacity",
          value: this.formatMetricValue(runtimeStats["实时总冷量"]),
          label: this.$t("defaultpage.totalCoolingCapacity"),
          unit: this.$store.getters.unitSelete,
          kicker: this.$t("defaultpage.realTimeEnergy"),
          iconClass: "al_icon2xuehua",
          routeName: "实时总冷量",
          routeTag: "totalCoolingCapacity",
        }
      ];
    }
  },
  components: {
    line1,
    line2,
    line3,
    line6,
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
      background: linear-gradient(180deg, #58f2ff 0%, #1f7bff 100%);
      opacity: 0.9;
    }

    i {
      opacity: 0.95;
    }

    .title-icon {
      font-size: 24px;
      color: rgba(133, 230, 255, 0.92);
    }

    .sm-title {
      margin-left: 12px;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: rgba(245, 251, 255, 0.96);
      text-shadow: 0 0 18px rgba(97, 197, 255, 0.16);
    }
  }

  .coldSite {
    width: 100%;
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 8px;
    margin: 0;

    .coldSite-data {
      position: relative;
      flex: 1;
      text-align: center;
      color: #fff;
      min-height: 104px;
      padding: 10px 8px 8px;
      border-radius: 16px;
      overflow: hidden;
      background:
        radial-gradient(circle at top right, rgba(88, 242, 255, 0.12), transparent 42%),
        linear-gradient(180deg, rgba(25, 70, 104, 0.38) 0%, rgba(15, 37, 56, 0.9) 100%);
      border: 1px solid rgba(137, 207, 255, 0.12);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 26px rgba(0, 0, 0, 0.16);
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      cursor: pointer;

      &:hover {
        transform: translateY(-2px);
        border-color: rgba(123, 213, 255, 0.28);
        box-shadow: 0 16px 30px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }

      .card-orb {
        position: absolute;
        width: 108px;
        height: 108px;
        right: -22px;
        top: -30px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(116, 223, 255, 0.28) 0%, rgba(116, 223, 255, 0.08) 46%, transparent 72%);
        filter: blur(2px);
        opacity: 0.9;
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

        .metric-kicker {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(167, 211, 235, 0.72);
        }

        p {
          font-size: 24px;
          font-weight: 700;
          line-height: 1.1;
          color: rgba(245, 250, 255, 0.98);
          text-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
        }

        p:nth-child(3) {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(195, 223, 241, 0.92);
        }

        .card-icon {
          margin-top: 2px;
          font-size: 30px;
          color: #82e6ff;
          filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.18));
        }
      }
    }
  }
}
</style>

<style lang="scss">
.right-con-box {
  .line-long {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px 6px 52px;
    overflow: hidden;
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(13, 32, 48, 0.82) 0%, rgba(11, 23, 34, 0.86) 100%);
    border: 1px solid rgba(124, 202, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 18px 28px rgba(0, 0, 0, 0.18);

    .system-cop-hero {
      flex: 0 0 auto;
      min-height: 0;
      padding-bottom: 2px;
    }

    .system-cop-secondary-list {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 2px;
      min-height: 0;
    }

    .wrap-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      color: rgba(239, 248, 255, 0.98);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;

      .wrap-left {
        margin-right: 24px;
      }

      .wrap-right {
        font-size: 18px;
        font-weight: 700;
        color: #8beaff;
      }
    }

    .line-box {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      height: 10vh;
      margin-bottom: 10px;
      padding: 0 2px;
      border-radius: 14px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);

      .img {
        position: absolute;
        font-size: 26px;
        top: -24px;
      }

      .p-box {
        position: relative;
        flex: 1;
        color: #fff;
        height: 15px;
        font-size: 12px;

        &:nth-child(2) {
          background: linear-gradient(90deg, rgba(66, 117, 233, 1), rgba(66, 117, 233, 0.18));
        }

        &:nth-child(3) {
          background: linear-gradient(90deg, rgba(56, 208, 184, 1), rgba(56, 208, 184, 0.18));
        }

        &:nth-child(4) {
          background: linear-gradient(90deg, rgba(222, 175, 47, 1), rgba(222, 175, 47, 0.18));
        }

        &:nth-child(5) {
          background: linear-gradient(90deg, rgba(232, 55, 117, 1), rgba(232, 55, 117, 0.18));
        }

        .desc {
          position: absolute;
          color: rgba(205, 226, 239, 0.95);
          right: 0;
          bottom: -24px;
          line-height: 20px;
          text-align: center;
          transform: translateX(50%);

          .sm-txt {
            width: 62px;
            margin-top: 4px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.02em;
          }
        }

        .first-desc {
          left: 0px;
          transform: translateX(-50%);
        }
      }
    }
  }

  .line-top-wrap {
    //margin-top: 64px;
  }
}
</style>
