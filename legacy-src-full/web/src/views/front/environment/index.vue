<template>
  <div class="legacy-front-page environment-page front-box-show">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Environment</div>
        <h1 class="legacy-front-page__title">环境监测</h1>
        <div class="legacy-front-page__meta">查看监测点温湿度状态、趋势曲线并维护限值参数。</div>
      </div>
      <div class="legacy-front-stat-group">
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Points</div>
          <div class="legacy-front-stat__value">{{ menulist.length }}</div>
        </div>
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Building</div>
          <div class="legacy-front-stat__value">{{ currentBuildingName || 'All' }}</div>
        </div>
      </div>
    </div>

    <div class="legacy-front-grid legacy-front-grid--two environment-layout">
      <section class="legacy-front-card environment-rail">
        <div class="legacy-front-section-title">
          <strong>监测点列表</strong>
          <span>楼栋筛选与实时温湿度</span>
        </div>

        <div class="legacy-front-toolbar environment-toolbar">
          <el-select
            v-model="value"
            class="environment-toolbar__select"
            clearable
            placeholder="请选择"
            @change="changeBuild"
          >
            <el-option
              v-for="item in buildinfo"
              :key="item.buildid"
              :label="item.buildname"
              :value="item.buildid"
            />
          </el-select>
          <el-checkbox
            v-model="checked"
            class="environment-toolbar__checkbox"
            false-label="0"
            true-label="1"
            @change="dochecked($event)"
          >
            只看冷气供应中
          </el-checkbox>
        </div>

        <div class="environment-list-head">
          <span>监测点</span>
          <span>温度</span>
          <span>湿度</span>
        </div>

        <el-scrollbar class="environment-list-scroll">
          <ul class="environment-list">
            <li
              v-for="(item, index) in menulist"
              :key="index"
              :class="{ active: cur == index }"
              @click="clickmenuitem(item, index)"
            >
              <span class="environment-list__name">{{ item.monitoringSite }}</span>
              <span>{{ item.temperatureValue }}</span>
              <span>{{ item.humidityValue }}</span>
            </li>
          </ul>
        </el-scrollbar>
      </section>

      <section class="legacy-front-card environment-workbench">
        <div class="legacy-front-section-title environment-workbench__head">
          <div>
            <strong>{{ formInline.monitoringSite || '环境详情' }}</strong>
            <span>{{ currentBuildingName ? `当前楼栋：${currentBuildingName}` : '请选择楼栋后查看详情' }}</span>
          </div>
          <div class="environment-workbench__actions">
            <el-date-picker
              v-model="timevalue"
              class="environment-workbench__date"
              placeholder="选择日期时间"
              type="datetime"
            />
            <el-button type="primary" @click="Opendialog">设置温湿度限值</el-button>
          </div>
        </div>

        <div class="environment-stat-grid">
          <div
            v-for="item in tiltedatalist"
            :key="item.title"
            class="environment-stat-card"
          >
            <div class="environment-stat-card__head">
              <span>{{ item.title }}</span>
              <el-tooltip effect="dark" placement="top">
                <div slot="content">
                  {{ item.topcenter }}
                  <br v-if="item.topcenter2" />
                  <span v-if="item.topcenter2">{{ item.topcenter2 }}</span>
                </div>
                <img :src="item.url" alt="" />
              </el-tooltip>
            </div>
            <p class="environment-stat-card__value">{{ item.data }}</p>
            <div class="environment-stat-card__hint">
              <span>{{ item.topcenter }}</span>
              <span v-if="item.topcenter2">{{ item.topcenter2 }}</span>
            </div>
          </div>
        </div>

        <div class="environment-chart-card">
          <div class="environment-chart-card__head">
            <strong>温湿度趋势</strong>
            <div class="environment-chart-card__chips">
              <span class="legacy-front-chip">温度</span>
              <span class="legacy-front-chip">湿度</span>
            </div>
          </div>
          <flexiblechart id="flexiblechart" class="environment-chart" />
        </div>
      </section>
    </div>

    <el-dialog
      :append-to-body="true"
      :before-close="closeDialog"
      :visible.sync="dialogVisible"
      class="environment-dialog"
      custom-class="legacy-dialog-shell"
      title="温湿度限值设置"
      width="720px"
    >
      <div class="environment-dialog__lead">
        当前监测点：{{ formInline.monitoringSite || '未选择' }}
      </div>
      <el-form
        :inline="true"
        :label-position="labelPosition"
        :model="formInline"
        class="environment-dialog__form"
        size="mini"
      >
        <div class="environment-dialog__grid">
          <el-form-item label="监测点名称:">
            <el-input v-model="formInline.monitoringSite" :disabled="true" />
          </el-form-item>
          <el-form-item label="室内温度设定值:">
            <el-input v-model="formInline.temperatureSetting" clearable />
          </el-form-item>
          <el-form-item label="室内温度上限值:">
            <el-input v-model="formInline.temperatureMax" clearable />
          </el-form-item>
          <el-form-item label="室内湿度偏差值:">
            <el-input v-model="formInline.humidityDeviation" clearable />
          </el-form-item>
          <el-form-item label="室内温度偏差值:">
            <el-input v-model="formInline.temperatureDeviation" clearable />
          </el-form-item>
          <el-form-item label="室内湿度设定值:">
            <el-input v-model="formInline.humiditySetting" clearable />
          </el-form-item>
          <el-form-item label="室内湿度上限值:">
            <el-input v-model="formInline.humidityMax" clearable />
          </el-form-item>
        </div>
      </el-form>

      <span slot="footer" class="dialog-footer">
        <el-button type="primary" @click="submit()">保 存</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from "vuex";

import flexiblechart from "./chart/flexiblechart.vue";
import { buildinfoAll, condition, setvalue } from "@/api/front/environment";

export default {
  components: {
    flexiblechart
  },
  data() {
    return {
      timevalue: "",
      cur: -1,
      labelPosition: "right",
      formInline: {
        id: "",
        temperatureSetting: "",
        temperatureMax: "",
        humidityDeviation: "",
        temperatureDeviation: "",
        humiditySetting: "",
        humidityMax: "",
        buildingId: "",
        monitoringSite: ""
      },
      dialogVisible: false,
      tiltedatalist: [
        {
          title: "室内温度达标率",
          url: require("../../../assets/home/wenhao.png"),
          data: "95%",
          topcenter: "基于冷气供应时段数据计算"
        },
        {
          title: "平均室内温度",
          url: require("../../../assets/home/wenhao.png"),
          data: "95%",
          topcenter: "基于冷气供应时段数据计算"
        },
        {
          title: "平均室内湿度",
          url: require("../../../assets/home/wenhao.png"),
          data: "91%",
          topcenter: "基于冷气供应时段数据计算"
        },
        {
          title: "平均送风温度",
          url: require("../../../assets/home/wenhao.png"),
          data: "23.1%",
          topcenter: "1.指送风口冷风温度",
          topcenter2: "2.基于冷气供应时段数据计算"
        }
      ],
      setoptions: [],
      menulist: [],
      checked: 0,
      value: "",
      buildinfo: []
    };
  },
  computed: {
    ...mapGetters(["path"]),
    currentBuildingName() {
      const buildingId = this.value || this.formInline.buildingId;
      const current = this.buildinfo.find(item => String(item.buildid) === String(buildingId));
      return current ? current.buildname : "";
    }
  },
  methods: {
    submit() {
      if (this.formInline.buildingId != "" && this.formInline.id != "") {
        setvalue(this.path, this.formInline).then(res => {
          if (res.status === 20000) {
            this.dialogVisible = false;
            this.$message.success("设置成功!");
          }
        });
      } else {
        this.$message.warning("请先选择监测点位哦!");
      }
    },
    dochecked(e) {
      const buildingId = this.value || this.formInline.buildingId;
      condition(this.path, buildingId, e).then(res => {
        this.menulist = res.data;
      });
    },
    changeBuild(e) {
      this.value = e;
      this.formInline.buildingId = e;
      condition(this.path, e, this.checked).then(res => {
        this.menulist = res.data;
      });
    },
    getbuildinfoAll() {
      buildinfoAll(this.path).then(res => {
        this.buildinfo = res.data;
      });
    },
    closeDialog() {
      this.dialogVisible = false;
    },
    Opendialog() {
      this.dialogVisible = true;
    },
    clickmenuitem(ele, val) {
      this.cur = val;
      this.formInline = {
        ...this.formInline,
        ...ele
      };
    }
  },
  created() {
    this.getbuildinfoAll();
    condition(this.path).then(res => {
      this.menulist = res.data;
    });
  }
};
</script>

<style lang="scss" scoped>
.environment-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.environment-layout {
  align-items: start;
}

.environment-rail,
.environment-workbench {
  min-width: 0;
}

.environment-toolbar {
  margin-top: 0;
}

.environment-toolbar__select {
  min-width: 180px;
}

.environment-toolbar__checkbox {
  color: rgba(214, 227, 238, 0.78);
}

.environment-list-head {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) repeat(2, minmax(72px, 1fr));
  gap: 12px;
  margin: 8px 0 14px;
  padding: 0 14px;
  color: var(--shell-text-muted);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.environment-list-scroll {
  height: clamp(480px, 70vh, 680px);
}

.environment-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.environment-list li {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) repeat(2, minmax(72px, 1fr));
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(132, 187, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(216, 228, 238, 0.92);
  cursor: pointer;
}

.environment-list li.active {
  border-color: rgba(114, 212, 255, 0.34);
  background: rgba(55, 149, 223, 0.16);
}

.environment-list__name {
  color: #ffffff;
  font-weight: 600;
}

.environment-workbench__head {
  margin-bottom: 18px;
}

.environment-workbench__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.environment-workbench__date {
  min-width: 220px;
}

.environment-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.environment-stat-card {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(132, 187, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
}

.environment-stat-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: rgba(234, 243, 250, 0.92);
  font-size: 13px;
}

.environment-stat-card__head img {
  width: 18px;
  height: 18px;
}

.environment-stat-card__value {
  margin: 16px 0 8px;
  font-size: 30px;
  font-weight: 700;
  color: #6de4ff;
}

.environment-stat-card__hint {
  display: grid;
  gap: 6px;
  color: var(--shell-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.environment-chart-card {
  margin-top: 18px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(132, 187, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
}

.environment-chart-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
  color: rgba(244, 250, 255, 0.98);
  font-size: 16px;
  font-weight: 600;
}

.environment-chart-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.environment-chart {
  width: 100%;
  min-height: 360px;
}

.environment-dialog__lead {
  margin-bottom: 14px;
  color: var(--shell-text-muted);
}

.environment-dialog__form {
  width: 100%;
}

.environment-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
}

.environment-dialog__grid ::v-deep .el-form-item {
  width: 100%;
}

.environment-dialog__grid ::v-deep .el-input {
  width: 100%;
}

.environment-dialog ::v-deep .el-dialog {
  background: linear-gradient(180deg, rgba(10, 24, 39, 0.98) 0%, rgba(6, 16, 28, 0.98) 100%);
  border: 1px solid rgba(132, 187, 255, 0.14);
  border-radius: 22px;
  overflow: hidden;
}

@media (max-width: 1200px) {
  .environment-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .environment-dialog__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .environment-workbench__head,
  .environment-workbench__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .environment-workbench__date {
    min-width: 0;
    width: 100%;
  }

  .environment-list-head,
  .environment-list li {
    grid-template-columns: minmax(0, 1fr) repeat(2, minmax(60px, 0.6fr));
  }
}
</style>
