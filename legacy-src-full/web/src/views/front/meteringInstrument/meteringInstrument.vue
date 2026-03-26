<template>
  <section class="legacy-front-table-card meteringInstrument">
    <div class="legacy-front-table-card__head">
      <div class="legacy-front-section-title">
        <strong>{{ currentTitle }}</strong>
        <span>{{ tableDatas.length ? `${tableDatas.length} rows` : "暂无数据" }}</span>
      </div>
    </div>

    <div class="meteringInstrument__tabs">
      <el-tabs v-model="activeName" @tab-click="sendRequest">
        <el-tab-pane
          v-for="tab in tabs"
          :key="tab.name"
          :label="tab.label"
          :name="tab.name"
        />
      </el-tabs>
    </div>

    <el-table
      v-loading="loading"
      :data="tableDatas"
      :fit="true"
      :header-cell-style="{
        background: '#122739',
        color: '#fff',
      }"
      class="report-search-tabel"
      element-loading-background="rgba(4, 11, 19, 0.72)"
      max-height="750"
      style="width: 100%"
    >
      <el-table-column
        v-for="(item, i) in tableTitle"
        :key="i"
        :label="item"
        class-name="front-column"
      >
        <template slot-scope="scope">
          <p>{{ scope.row[item] }}</p>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<script>
import { reportmanage } from "@/api/front/runrecords";
import { mapGetters } from "vuex";

export default {
  name: "index",
  computed: {
    ...mapGetters(["path"]),
    currentTitle() {
      const current = this.tabs.find(tab => tab.name === this.activeName);
      return current ? current.label : "";
    }
  },
  data() {
    return {
      tableTitle: [],
      tableDatas: [],
      loading: false,
      activeName: "electricityMeter",
      tabs: [
        {
          name: "electricityMeter",
          label: this.$t("meteringInstrument.electricityMeter"),
        },
        {
          name: "energyMeter",
          label: this.$t("meteringInstrument.energyMeter"),
        }
      ],
    }
  },
  mounted() {
    this.sendRequest();
  },
  methods: {
    sendRequest() {
      const type = this.activeName === "energyMeter" ? 1 : 2;
      this.loading = true;
      reportmanage(this.path, { type }).then(res => {
        const records = res && res.data && res.data.records ? res.data.records : [];
        this.tableTitle = records.length ? Object.keys(records[0]) : [];
        this.$nextTick(() => {
          this.tableDatas = records;
        });
      }).finally(() => {
        this.loading = false;
      });
    }
  }
}
</script>
