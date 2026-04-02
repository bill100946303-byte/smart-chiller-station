<template>
  <div class="contentTable">
    <nav class="tableNav">
      <button class="tableNav__back" @click="$emit('isShowTabel', false)">
        <i class="al_element-icons al_iconfanhui"></i>
      </button>
      <div class="tableNav__copy">
        <div class="tableNav__eyebrow">项目工作台</div>
        <div class="tableNav__title">{{ $t('totalalarm.SelectProject') }}</div>
        <div class="tableNav__desc">按状态、客户和区域快速锁定最值得进入的冷站项目。</div>
      </div>
      <div class="tableNav__summary">
        <div class="summary-chip">
          <span class="summary-chip__label">项目数</span>
          <span class="summary-chip__value">{{ summary.totalProjects }}</span>
        </div>
        <div class="summary-chip">
          <span class="summary-chip__label">活跃率</span>
          <span class="summary-chip__value">{{ summary.activeRate }}</span>
        </div>
        <div class="summary-chip">
          <span class="summary-chip__label">平均能效</span>
          <span class="summary-chip__value">{{ summary.avgEfficiency }}</span>
        </div>
      </div>
    </nav>

    <div class="tabelContent">
      <aside class="tabelSearch">
        <div class="filter-card">
          <div class="filter-card__head">
            <div>
              <div class="filter-card__title">筛选条件</div>
              <div class="filter-card__desc">按冷站、客户和区域快速过滤项目列表。</div>
            </div>
            <div class="filter-card__count">已启用 {{ activeFilterCount }} 项</div>
          </div>
          <div class="filter-segment">
            <button
              v-for="item in statusTabs"
              :key="item.value"
              :class="['filter-segment__item', { 'is-active': activeStatus === item.value }]"
              type="button"
              @click="activeStatus = item.value"
            >
              {{ item.label }}
            </button>
          </div>
          <el-form ref="formInline" :model="formInline" class="filter-form" label-position="top">
            <el-form-item :label="$t('userHomePage.coldStationName')" prop="appName">
              <el-input
                v-model.trim="formInline.appName"
                :placeholder="$t('userHomePage.pleaseEnter')"
              />
            </el-form-item>
            <el-form-item :label="$t('userHomePage.customerName')" prop="customer">
              <el-input
                v-model.trim="formInline.customer"
                :placeholder="$t('userHomePage.pleaseEnter')"
              />
            </el-form-item>
            <city-select
              :cityName="formInline.city"
              :provinceName="formInline.region"
              @selectChange="selectChange"
            />
            <div class="filter-actions">
              <el-button class="reset-btn" @click="resetform">
                {{ $t('userHomePage.remakeFilteringCriteria') }}
              </el-button>
              <el-button class="search-btn" type="primary" @click="onSubmit">
                {{ $t('public.search') }}
              </el-button>
            </div>
          </el-form>
        </div>
      </aside>

      <section class="table-shell">
        <div class="table-shell__head">
          <div>
            <div class="table-shell__eyebrow">项目清单</div>
            <div class="table-shell__title">选择冷站项目</div>
          </div>
          <div class="table-shell__meta">当前展示 {{ filteredTableData.length }} / {{ summary.totalProjects }} 个项目</div>
        </div>
        <div class="table-shell__highlights">
          <div class="highlight-tile">
            <span class="highlight-tile__label">需关注项目</span>
            <strong class="highlight-tile__value">{{ summary.attentionProjects }}</strong>
            <span class="highlight-tile__meta">低能效或停运项目</span>
          </div>
          <div class="highlight-tile">
            <span class="highlight-tile__label">停运项目</span>
            <strong class="highlight-tile__value">{{ summary.pausedProjects }}</strong>
            <span class="highlight-tile__meta">当前未在运行冷站</span>
          </div>
          <div class="highlight-tile">
            <span class="highlight-tile__label">覆盖区域</span>
            <strong class="highlight-tile__value">{{ summary.coverageRegions }}</strong>
            <span class="highlight-tile__meta">{{ summary.topRegion }}项目分布最多</span>
          </div>
        </div>

        <div class="mytable-home">
          <el-table
            :data="filteredTableData"
            :row-class-name="tableRowClassName"
            class="table-style"
            height="100%"
            @row-click="gopage"
          >
            <el-table-column :label="$t('userHomePage.coldStationName')" min-width="360">
              <template slot-scope="scope">
                <div class="station-cell">
                  <div class="station-cell__topline">
                    <span class="station-cell__rank">{{ scope.$index + 1 }}</span>
                    <span v-if="isRecommended(scope.row)" class="station-cell__tag">推荐进入</span>
                  </div>
                  <div class="station-cell__name">{{ scope.row.appexplainCNEN }}</div>
                  <div class="station-cell__meta">
                    <span>{{ scope.row.customer || '未配置客户' }}</span>
                    <span>{{ [scope.row.region, scope.row.city].filter(Boolean).join(' / ') || '区域待补充' }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="运行态势" width="260">
              <template slot-scope="scope">
                <div class="ops-cell">
                  <span :class="['status-pill', getEffectiveRunState(scope.row) === 1 ? 'is-running' : 'is-stopped']">
                    {{ getStatus(scope.row) }}
                  </span>
                  <div :class="['efficiency-cell', efficiencyTone(scope.row.efficiency)]">
                    <span class="efficiency-cell__value">{{ formatEfficiency(scope.row.efficiency) }}</span>
                    <span class="efficiency-cell__unit">COP</span>
                  </div>
                  <span class="ops-cell__hint">{{ getProjectSignal(scope.row) }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column :label="$t('userHomePage.createdTime')" width="160">
              <template slot-scope="scope">
                <div class="date-cell">{{ getNowTime(scope.row.createTime) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template slot-scope="scope">
                <button
                  :class="['enter-btn', { 'is-limited': !hasProjectGroup(scope.row) }]"
                  @click.stop="handleEnter(scope.row)"
                >
                  进入工作台
                </button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import CitySelect from "@/components/ProvinceCity/index";
import { handlePost } from "@/utils/handlepost";
import { mapGetters } from "vuex";
import { findAllByCondition } from "@/api/front/home";
import srcMp3 from "@/assets/warmBlank.mp3";
import dayjs from "dayjs";

export default {
  name: "contentTable",
  components: {
    CitySelect,
  },
  computed: {
    ...mapGetters(["userid", "appusergroup"]),
    summary() {
      const projects = this.tableData || [];
      const efficiencies = projects
        .map((item) => Number(item.efficiency))
        .filter((value) => Number.isFinite(value) && value > 0);
      const avg = efficiencies.length
        ? (efficiencies.reduce((sum, value) => sum + value, 0) / efficiencies.length).toFixed(1)
        : "--";
      const regionMap = {};
      projects.forEach((item) => {
        const regionName = String(item.region || item.city || "未分区").replace(/省|市|自治区|特别行政区/g, "");
        regionMap[regionName] = (regionMap[regionName] || 0) + 1;
      });
      const topRegion = Object.keys(regionMap).sort((a, b) => regionMap[b] - regionMap[a])[0] || "--";
      const runningProjects = projects.filter((item) => this.getEffectiveRunState(item) === 1).length;
      const pausedProjects = projects.filter((item) => this.getEffectiveRunState(item) !== 1).length;
      const attentionProjects = projects.filter((item) => {
        const efficiency = Number(item.efficiency);
        return this.getEffectiveRunState(item) !== 1 || !Number.isFinite(efficiency) || efficiency <= 5;
      }).length;
      return {
        totalProjects: projects.length,
        runningProjects,
        pausedProjects,
        attentionProjects,
        activeRate: projects.length ? `${Math.round((runningProjects / projects.length) * 100)}%` : "--",
        avgEfficiency: avg,
        topRegion,
        coverageRegions: Object.keys(regionMap).length || "--",
      };
    },
    processedProjects() {
      return [...this.tableData].sort((left, right) => {
        const leftReady = this.hasProjectGroup(left) ? 1 : 0;
        const rightReady = this.hasProjectGroup(right) ? 1 : 0;
        if (rightReady !== leftReady) {
          return rightReady - leftReady;
        }
        const leftRun = this.getEffectiveRunState(left);
        const rightRun = this.getEffectiveRunState(right);
        if (rightRun !== leftRun) {
          return rightRun - leftRun;
        }
        const leftEfficiency = Number(left.efficiency);
        const rightEfficiency = Number(right.efficiency);
        const safeLeftEfficiency = Number.isFinite(leftEfficiency) ? leftEfficiency : -1;
        const safeRightEfficiency = Number.isFinite(rightEfficiency) ? rightEfficiency : -1;
        if (safeRightEfficiency !== safeLeftEfficiency) {
          return safeRightEfficiency - safeLeftEfficiency;
        }
        return new Date(right.createTime || 0) - new Date(left.createTime || 0);
      });
    },
    filteredTableData() {
      const data = this.processedProjects;
      if (this.activeStatus === "all") {
        return data;
      }
      const runValue = this.activeStatus === "running" ? 1 : 0;
      return data.filter((item) => this.getEffectiveRunState(item) === runValue);
    },
    recommendedProject() {
      return this.filteredTableData[0] || null;
    },
    activeFilterCount() {
      let count = this.activeStatus === "all" ? 0 : 1;
      ["appName", "customer", "region", "city"].forEach((key) => {
        if (this.formInline[key]) {
          count += 1;
        }
      });
      return count;
    },
  },
  data() {
    return {
      tableData: [],
      activeStatus: "all",
      statusTabs: [
        { label: "全部", value: "all" },
        { label: "运行中", value: "running" },
        { label: "已暂停", value: "stopped" },
      ],
      formInline: {
        appName: "",
        runState: "",
        region: "",
        city: "",
        customer: "",
      },
    };
  },
  created() {
    if (this.appusergroup) {
      this.tableData = this.appusergroup;
    }
  },
  methods: {
    findCanonicalProject(projectInfo = {}) {
      const candidates = Array.isArray(this.appusergroup) ? this.appusergroup : [];
      return (
        candidates.find((item) => {
          if (projectInfo.appid && item.appid && String(item.appid) === String(projectInfo.appid)) {
            return true;
          }
          if (projectInfo.key && item.key && String(item.key) === String(projectInfo.key)) {
            return true;
          }
          if (projectInfo.appName && item.appName && String(item.appName) === String(projectInfo.appName)) {
            return true;
          }
          if (projectInfo.appexplainCNEN && item.appexplainCNEN && String(item.appexplainCNEN) === String(projectInfo.appexplainCNEN)) {
            return true;
          }
          return false;
        }) || null
      );
    },
    hydrateProjectInfo(projectInfo = {}) {
      const canonical = this.findCanonicalProject(projectInfo);
      if (!canonical) {
        return projectInfo;
      }
      return {
        ...canonical,
        ...projectInfo,
        appinfo: projectInfo.appinfo || canonical.appinfo || canonical,
      };
    },
    getProjectGroupId(projectInfo = {}) {
      const source = this.hydrateProjectInfo(projectInfo);
      const rawAppInfo = source.appinfo || source.appInfo || source.logo || null;
      let nestedProjectInfo = {};
      if (rawAppInfo && typeof rawAppInfo === "string") {
        try {
          nestedProjectInfo = JSON.parse(rawAppInfo);
        } catch (error) {
          nestedProjectInfo = {};
        }
      } else if (rawAppInfo && typeof rawAppInfo === "object") {
        nestedProjectInfo = rawAppInfo;
      }
      return (
        source.appuserground ||
        source.appusergroup ||
        source.appusergroupid ||
        source.appUserGroupId ||
        source.appgroupid ||
        source.appGroupId ||
        source.groupid ||
        source.groupId ||
        source.usergroupid ||
        source.userGroupId ||
        nestedProjectInfo.appuserground ||
        nestedProjectInfo.appusergroup ||
        nestedProjectInfo.appusergroupid ||
        nestedProjectInfo.appUserGroupId ||
        nestedProjectInfo.appgroupid ||
        nestedProjectInfo.appGroupId ||
        nestedProjectInfo.groupid ||
        nestedProjectInfo.groupId ||
        nestedProjectInfo.usergroupid ||
        nestedProjectInfo.userGroupId ||
        ""
      );
    },
    hasProjectGroup(data) {
      return Boolean(this.getProjectGroupId(data));
    },
    canEnterProject(data) {
      const source = this.hydrateProjectInfo(data);
      return Boolean(source && (source.appid || source.key || source.appName || source.appexplainCNEN));
    },
    onSubmit() {
      this.formInline.userId = this.userid;
      this.handleSearch(handlePost(this.formInline));
    },
    resetform() {
      this.$refs.formInline.resetFields();
      this.formInline.region = "";
      this.formInline.city = "";
      this.handleSearch();
    },
    selectChange(province, city) {
      this.formInline.city = city;
      this.formInline.region = province;
    },
    handleSearch(info) {
      const query = Object.assign({ userId: this.userid }, info);
      findAllByCondition(query).then((res) => {
        this.tableData = res.data || [];
      });
    },
    handleEnter(data) {
      this.gopage(data);
    },
    gopage(data) {
      const projectInfo = this.hydrateProjectInfo(data);
      if (!this.canEnterProject(projectInfo)) {
        this.$message.warning("项目基础信息缺失，当前无法进入工作台");
        return;
      }
      this.$store.commit("user/SET_MODELKEY", projectInfo.key);
      this.$store.commit("user/SET_TEMPLATE", projectInfo.template);
      this.$store
        .dispatch("project/getMenuId", projectInfo)
        .then(() => {
          const mp3 = this.MP3;
          mp3.src = srcMp3;
          mp3.play();
          setTimeout(() => {
            mp3.pause();
            this.$router.push({ name: "defaultpage" });
          }, 1);
        })
        .catch((error) => {
          this.$message.error(error.message || "进入项目失败");
        });
    },
    getEffectiveRunState(data) {
      const efficiency = Number(data.efficiency);
      if (Number(data.runStatus) !== 1) {
        return 0;
      }
      if (!Number.isFinite(efficiency) || efficiency <= 0) {
        return 0;
      }
      return 1;
    },
    getStatus(data) {
      switch (this.getEffectiveRunState(data)) {
        case 1:
          return this.$t("totalalarm.InOperation");
        case 0:
          return this.$t("totalalarm.paused");
        default:
          return "--";
      }
    },
    formatEfficiency(value) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric.toFixed(1) : "--";
    },
    efficiencyTone(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return "is-muted";
      }
      if (numeric >= 7) {
        return "is-strong";
      }
      if (numeric >= 5) {
        return "is-balanced";
      }
      return "is-soft";
    },
    getProjectSignal(data) {
      if (!this.hasProjectGroup(data)) {
        return "默认工作台";
      }
      const efficiency = Number(data.efficiency);
      if (this.getEffectiveRunState(data) !== 1) {
        return "当前停运";
      }
      if (efficiency >= 7) {
        return "优先进入";
      }
      if (efficiency >= 5) {
        return "运行稳定";
      }
      return "建议关注";
    },
    isRecommended(data) {
      return this.hasProjectGroup(data) && this.recommendedProject && this.recommendedProject.key === data.key;
    },
    tableRowClassName({ row }) {
      if (!this.hasProjectGroup(row)) {
        return "is-limited-row";
      }
      return this.isRecommended(row) ? "is-recommended-row" : "";
    },
    getNowTime(time) {
      return time ? dayjs(time).format("YYYY-MM-DD") : "--";
    },
  },
};
</script>

<style lang="scss">
.contentTable {
  .filter-form {
    display: flex;
    flex: 1;
    flex-direction: column;

    .el-form-item {
      margin-bottom: 12px;
    }

    .el-form-item__label {
      padding-bottom: 6px;
      color: rgba(209, 231, 248, 0.78);
      line-height: 1.2;
      font-size: 12px;
    }

    .el-input__inner,
    .el-select .el-input__inner {
      height: 40px;
      border: 1px solid rgba(122, 190, 255, 0.18);
      border-radius: 12px;
      background: rgba(11, 31, 49, 0.78);
      color: #eef7ff;
      font-size: 13px;
    }

    .el-input__inner::placeholder {
      color: rgba(176, 207, 228, 0.42);
    }

    .el-select .el-input .el-select__caret {
      color: rgba(176, 207, 228, 0.72);
    }
  }

  .mytable-home {
    .el-table {
      background: transparent;
      color: #edf6ff;

      &::before {
        display: none;
      }

      th {
        background: rgba(18, 44, 67, 0.78);
        text-align: center;
        font-weight: 500;
        border-bottom: 1px solid rgba(122, 190, 255, 0.14);
      }

      tr {
        background: transparent;
      }

      td {
        border-bottom: 1px solid rgba(122, 190, 255, 0.1);
      }

      .cell {
        padding: 10px 8px;
        line-height: 1.25;
      }

      .el-table__body tr:hover > td {
        background: rgba(54, 121, 194, 0.16) !important;
      }

      .el-table__body tr.is-recommended-row > td {
        background: rgba(48, 120, 255, 0.08);
      }

      .el-table__body tr.is-limited-row > td {
        background: rgba(255, 162, 92, 0.05);
      }
    }
  }
}
</style>

<style lang="scss" scoped>
.contentTable {
  height: 100vh;
  padding: 16px 18px;
  box-sizing: border-box;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(86, 205, 255, 0.14) 0%, transparent 24%),
    radial-gradient(circle at top right, rgba(47, 103, 255, 0.14) 0%, transparent 26%),
    linear-gradient(180deg, #08111c 0%, #102235 100%);
  color: #eef7ff;

  .tableNav {
    display: grid;
    grid-template-columns: auto minmax(240px, 1fr) auto;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    padding: 10px 14px;
    border: 1px solid rgba(125, 191, 255, 0.12);
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(16, 37, 57, 0.94) 0%, rgba(11, 24, 39, 0.82) 100%);
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.18);
  }

  .tableNav__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(28, 78, 114, 0.9) 0%, rgba(22, 49, 76, 0.92) 100%);
    color: #eef7ff;
    font-size: 16px;
    cursor: pointer;
  }

  .tableNav__copy {
    min-width: 0;
  }

  .tableNav__eyebrow {
    font-size: 10px;
    letter-spacing: 0.18em;
    color: rgba(184, 215, 236, 0.6);
  }

  .tableNav__title {
    margin-top: 4px;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  .tableNav__desc {
    margin-top: 4px;
    color: rgba(184, 215, 236, 0.68);
    font-size: 11px;
  }

  .tableNav__summary {
    display: flex;
    gap: 8px;
  }

  .summary-chip {
    display: grid;
    gap: 4px;
    min-width: 78px;
    padding: 6px 8px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(125, 191, 255, 0.1);
  }

  .summary-chip__label {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(184, 215, 236, 0.62);
  }

  .summary-chip__value {
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
  }

  .tabelContent {
    display: grid;
    grid-template-columns: 236px minmax(0, 1fr);
    gap: 10px;
    height: calc(100vh - 92px);
    min-height: 0;
  }

  .tabelSearch,
  .table-shell {
    height: 100%;
    min-width: 0;
    border: 1px solid rgba(125, 191, 255, 0.12);
    border-radius: 20px;
    background: linear-gradient(180deg, rgba(15, 36, 56, 0.92) 0%, rgba(9, 20, 34, 0.9) 100%);
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.18);
  }

  .filter-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    min-height: 0;
    padding: 12px;
  }

  .filter-card__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .filter-card__count {
    flex-shrink: 0;
    padding: 6px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(125, 191, 255, 0.1);
    font-size: 10px;
    color: rgba(184, 215, 236, 0.82);
  }

  .filter-card__title {
    font-size: 16px;
    font-weight: 600;
  }

  .filter-card__desc {
    margin-top: 8px;
    line-height: 1.5;
    font-size: 10px;
    color: rgba(184, 215, 236, 0.72);
  }

  .filter-segment {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    margin-bottom: 8px;
    padding: 4px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(125, 191, 255, 0.1);
  }

  .filter-segment__item {
    flex: 1;
    height: 30px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    padding: 0 4px;
    white-space: nowrap;
    line-height: 1;
    font-size: 11px;
    color: rgba(200, 226, 242, 0.76);
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;
  }

  .filter-segment__item.is-active {
    background: linear-gradient(135deg, rgba(47, 124, 255, 0.82) 0%, rgba(63, 208, 255, 0.78) 100%);
    color: #fff;
  }

  .filter-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    margin-top: auto;
    padding-top: 6px;
  }

  .filter-actions .el-button + .el-button {
    margin-left: 0;
  }

  .reset-btn,
  .search-btn {
    width: 100%;
    min-width: 0;
    height: 34px;
    border-radius: 12px;
    font-size: 12px;
  }

  .reset-btn {
    border-color: rgba(125, 191, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #dbeeff;
  }

  .search-btn {
    border: 0;
    background: linear-gradient(135deg, #2f7cff 0%, #3fd0ff 100%);
  }

  .table-shell {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .table-shell__head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 14px 8px;
    border-bottom: 1px solid rgba(125, 191, 255, 0.1);
  }

  .table-shell__highlights {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 8px 14px 0;
  }

  .highlight-tile {
    display: grid;
    gap: 4px;
    padding: 9px 11px;
    border-radius: 14px;
    border: 1px solid rgba(125, 191, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
  }

  .highlight-tile__label {
    font-size: 10px;
    letter-spacing: 0.12em;
    color: rgba(184, 215, 236, 0.58);
  }

  .highlight-tile__value {
    font-size: 18px;
    font-weight: 600;
    color: #f5fbff;
  }

  .highlight-tile__value--date {
    font-size: 19px;
  }

  .highlight-tile__meta {
    font-size: 10px;
    color: rgba(184, 215, 236, 0.68);
  }

  .table-shell__eyebrow {
    font-size: 10px;
    letter-spacing: 0.18em;
    color: rgba(184, 215, 236, 0.56);
  }

  .table-shell__title {
    margin-top: 6px;
    font-size: 19px;
    font-weight: 600;
  }

  .table-shell__meta {
    font-size: 11px;
    color: rgba(184, 215, 236, 0.72);
  }

  .mytable-home {
    flex: 1;
    min-height: 0;
    padding: 8px;
    overflow: hidden;
  }

  .station-cell {
    display: grid;
    gap: 4px;
  }

  .station-cell__topline {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 0;
  }

  .station-cell__rank {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: rgba(64, 126, 255, 0.22);
    color: #bfe0ff;
    font-size: 10px;
    font-weight: 700;
  }

  .station-cell__tag {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(67, 212, 175, 0.12);
    border: 1px solid rgba(67, 212, 175, 0.2);
    color: #98f0da;
    font-size: 10px;
  }

  .station-cell__name {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    color: #f4fbff;
  }

  .station-cell__meta {
    margin-top: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 2px 6px;
    font-size: 10px;
    line-height: 1.2;
    color: rgba(184, 215, 236, 0.6);
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 68px;
    height: 22px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
  }

  .status-pill.is-running {
    background: rgba(67, 212, 175, 0.14);
    border: 1px solid rgba(67, 212, 175, 0.24);
    color: #9df6dc;
  }

  .status-pill.is-stopped {
    background: rgba(255, 173, 90, 0.12);
    border: 1px solid rgba(255, 173, 90, 0.22);
    color: #ffd6a8;
  }

  .efficiency-cell {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }

  .ops-cell {
    display: grid;
    gap: 3px;
    align-items: start;
  }

  .ops-cell__hint {
    font-size: 10px;
    line-height: 1.2;
    color: rgba(184, 215, 236, 0.68);
  }

  .efficiency-cell.is-strong .efficiency-cell__value {
    color: #8ff6dc;
  }

  .efficiency-cell.is-balanced .efficiency-cell__value {
    color: #d3fb88;
  }

  .efficiency-cell.is-soft .efficiency-cell__value {
    color: #ffd8a1;
  }

  .efficiency-cell.is-muted .efficiency-cell__value {
    color: rgba(184, 215, 236, 0.54);
  }

  .efficiency-cell__value {
    font-size: 16px;
    font-weight: 600;
    color: #f4fbff;
  }

  .efficiency-cell__unit,
  .date-cell {
    font-size: 11px;
    color: rgba(184, 215, 236, 0.72);
  }

  .enter-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 88px;
    height: 30px;
    padding: 0 10px;
    border: 1px solid rgba(95, 181, 255, 0.18);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    color: #eaf6ff;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  }

  .enter-btn:hover {
    background: rgba(60, 131, 255, 0.18);
    border-color: rgba(95, 181, 255, 0.3);
    transform: translateY(-1px);
  }

  .enter-btn.is-limited {
    background: rgba(255, 173, 90, 0.08);
    border-color: rgba(255, 173, 90, 0.16);
    color: rgba(255, 216, 168, 0.88);
  }

  .enter-btn.is-limited:hover {
    background: rgba(255, 173, 90, 0.08);
    border-color: rgba(255, 173, 90, 0.16);
  }
}
</style>
