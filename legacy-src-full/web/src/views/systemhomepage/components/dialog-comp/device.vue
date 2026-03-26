<template>
  <div class="device-panel">
    <div v-if="show" class="device-panel__content">
      <div class="device-panel__toolbar">
        <div class="device-panel__segment">
          <el-radio-group
            v-model="range"
            size="small"
            @change="initData"
          >
            <el-radio-button
              v-for="item in rangeOptions"
              :key="item.value"
              :label="item.value"
            >
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </div>

        <el-date-picker
          v-model="value1"
          type="date"
          value-format="yyyy-MM-dd"
          placeholder="选择日期"
          :clearable="false"
          class="device-panel__date"
          @change="initData"
        />
      </div>

      <div class="device-panel__body">
        <aside class="device-panel__summary">
          <div class="summary-card">
            <div class="summary-card__eyebrow">{{ drName }}</div>
            <div class="summary-card__title">{{ $t('dialog.powerConsumption') }}</div>
            <div class="summary-card__meta">
              <span class="summary-card__chip">{{ activeRangeLabel }}</span>
              <span class="summary-card__chip">{{ value1 }}</span>
              <span class="summary-card__chip">{{ chartPointCount }} points</span>
            </div>
            <div class="summary-card__metric">
              <span class="summary-card__metric-value">{{ title || '--' }}</span>
              <span class="summary-card__metric-unit">KWH</span>
            </div>
            <div class="summary-card__hint">{{ $t('public.timeperiodSelection') }} · {{ value1 }}</div>
            <div class="summary-card__orb"></div>
          </div>
        </aside>

        <section class="device-panel__chart">
          <div class="device-panel__chart-head">
            <div>
              <div class="device-panel__eyebrow">Energy Curve</div>
              <div class="device-panel__chart-title">{{ drName }} {{ $t('dialog.powerConsumption') }}</div>
            </div>
            <div class="device-panel__chart-meta">{{ activeRangeLabel }}</div>
          </div>
          <LineBox v-if="dateType" :xData="curveValueList" />
        </section>
      </div>
    </div>

    <section v-else class="device-panel__empty">
      <el-empty description="暂无设备能耗数据" />
    </section>
  </div>
</template>

<script>
import { getPopupEnergyStatisticsCurve } from "@/api/front/home";
import { mapGetters } from "vuex";
import { handlePost } from "@/utils/handlepost";
import LineBox from "./line.vue";
import dayjs from "dayjs";

export default {
  props: ["drId", "drName"],
  components: {
    LineBox,
  },
  data() {
    return {
      value1: dayjs().format("YYYY-MM-DD"),
      range: "day",
      title: "",
      curveValueList: [],
      show: true,
      rangeOptions: [
        { value: "year", label: this.$t("public.year") },
        { value: "month", label: this.$t("public.month") },
        { value: "day", label: this.$t("public.day") },
      ],
    };
  },
  computed: {
    ...mapGetters(["path"]),
    dateType() {
      switch (this.range) {
        case "year":
          return 3;
        case "month":
          return 2;
        case "day":
          return 1;
        default:
          return undefined;
      }
    },
    activeRangeLabel() {
      const item = this.rangeOptions.find(option => option.value === this.range);
      return item ? item.label : "--";
    },
    chartPointCount() {
      return Array.isArray(this.curveValueList) ? this.curveValueList.length : 0;
    },
  },
  watch: {
    drId: {
      handler() {
        this.initData();
      },
      immediate: true,
    },
  },
  methods: {
    initData() {
      if (!this.drName) {
        return;
      }

      this.show = !(this.drName.startsWith("T") || this.drName.startsWith("DV"));
      if (!this.show) {
        this.title = "";
        this.curveValueList = [];
        return;
      }

      getPopupEnergyStatisticsCurve(
        this.path,
        handlePost({
          dateType: this.dateType,
          drId: this.drId,
          date: this.value1,
          drCode: this.drName,
        })
      ).then((res) => {
        this.title = res.data.title || "--";
        this.curveValueList = res.data.curveValueList || [];
      });
    },
  },
};
</script>

<style lang="scss">
.device-panel {
  color: rgba(234, 244, 250, 0.94);
}

.device-panel__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.device-panel__segment .el-radio-button__inner {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(124, 202, 255, 0.12);
  color: rgba(227, 238, 246, 0.86);
  box-shadow: none;
}

.device-panel__segment .el-radio-button__orig-radio:checked + .el-radio-button__inner {
  background: linear-gradient(135deg, #2d86ff 0%, #1ca2da 100%) !important;
  border-color: transparent !important;
  color: #fff !important;
}

.device-panel__date .el-input__inner {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(124, 202, 255, 0.12);
  color: rgba(234, 244, 250, 0.94);
}
</style>

<style lang="scss" scoped>
.device-panel {
  min-height: 100%;
}

.device-panel__body {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.6fr);
  gap: 16px;
  align-items: stretch;
}

.summary-card {
  position: relative;
  height: 100%;
  min-height: 420px;
  padding: 22px;
  border-radius: 20px;
  border: 1px solid rgba(124, 202, 255, 0.12);
  background: linear-gradient(180deg, rgba(12, 26, 41, 0.96) 0%, rgba(9, 20, 33, 0.92) 100%);
  overflow: hidden;
}

.summary-card__eyebrow,
.device-panel__eyebrow {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(181, 212, 231, 0.68);
}

.summary-card__title {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 600;
  color: rgba(246, 250, 255, 0.98);
}

.summary-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.summary-card__chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(124, 202, 255, 0.14);
  color: rgba(196, 220, 239, 0.78);
  font-size: 12px;
}

.summary-card__metric {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 18px;
}

.summary-card__metric-value {
  font-size: 42px;
  font-weight: 700;
  color: #76e7ff;
}

.summary-card__metric-unit {
  font-size: 14px;
  letter-spacing: 0.12em;
  color: rgba(188, 216, 232, 0.72);
}

.summary-card__hint {
  margin-top: 12px;
  font-size: 13px;
  color: rgba(196, 220, 239, 0.68);
}

.summary-card__orb {
  position: absolute;
  right: -28px;
  bottom: -28px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(96, 240, 255, 0.18) 0%, rgba(61, 134, 255, 0.08) 46%, transparent 72%);
}

.device-panel__chart {
  min-height: 420px;
  padding: 16px;
  border-radius: 20px;
  border: 1px solid rgba(124, 202, 255, 0.12);
  background: linear-gradient(180deg, rgba(12, 26, 41, 0.96) 0%, rgba(9, 20, 33, 0.92) 100%);
}

.device-panel__chart-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.device-panel__chart-title {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
  color: rgba(246, 250, 255, 0.98);
}

.device-panel__chart-meta {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(124, 202, 255, 0.14);
  color: rgba(196, 220, 239, 0.78);
  font-size: 12px;
}

.device-panel__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.device-panel__empty {
  min-height: 420px;
  display: grid;
  place-items: center;
  border-radius: 20px;
  border: 1px solid rgba(124, 202, 255, 0.12);
  background: linear-gradient(180deg, rgba(12, 26, 41, 0.96) 0%, rgba(9, 20, 33, 0.92) 100%);
}

@media (max-width: 1280px) {
  .device-panel__body {
    grid-template-columns: 1fr;
  }
}
</style>
