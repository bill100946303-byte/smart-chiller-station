<template>
  <div class="legacy-front-page log-front front-box-show">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Station Log</div>
        <h1 class="legacy-front-page__title">{{ $t('route.coldStationLog') || '冷站日志' }}</h1>
        <div class="legacy-front-page__meta">按日查看冷站总览、逐时能耗、效率与水温明细，并支持直接导出当前日志。</div>
      </div>
      <div class="legacy-front-stat-group">
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Date</div>
          <div class="legacy-front-stat__value">{{ selectedDateLabel }}</div>
        </div>
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Rows</div>
          <div class="legacy-front-stat__value">{{ tableData.length }}</div>
        </div>
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">System COP</div>
          <div class="legacy-front-stat__value">{{ summaryEfficiency }}</div>
        </div>
      </div>
    </div>

    <section class="legacy-front-toolbar">
      <div class="legacy-front-toolbar__title">
        <strong>查询条件</strong>
        <span>选择日期后刷新当前冷站运行日志，导出会沿用当前页面数据。</span>
      </div>
      <el-form :inline="true" :model="form" class="log-toolbar-form" ref="form">
        <el-form-item
            :label="$t('logrizi.time')"
            :rules="[{ required: true, message: $t('prompt.pleaseSelect')+$t('logrizi.time') }]"
            prop="startTime"
        >
          <el-date-picker
              v-model="form.startTime"
              placeholder="选择开始时间"
              prefix-icon="al_element-icons al_icona-huaban1"
              type="date"
          />
        </el-form-item>
        <el-form-item class="log-toolbar-form__actions">
          <el-button :loading="loadbtn" class="log-action-btn" type="primary" @click="search">
            <i class="al_element-icons al_iconchaxun log-action-btn__icon"></i>
            {{ $t('public.search') }}
          </el-button>
          <el-button class="log-action-btn log-action-btn--ghost" type="primary" @click="handleDownClick">
            <i class="al_element-icons2 al_icon2daochu log-action-btn__icon"></i>
            {{ $t('public.exportData') }}
          </el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="legacy-front-table-card">
      <div class="legacy-front-table-card__head">
        <div class="legacy-front-toolbar__title">
          <strong>日总览</strong>
          <span>聚合展示当日冷站输入、输出、系统效率和分项电耗。</span>
        </div>
      </div>
      <el-table :data="tableData1" class="log-table log-table--summary" size="small" style="width: 100%;">
        <template slot="empty">
          <div class="log-table__empty">暂无日汇总数据</div>
        </template>
      <el-table-column :label="$t('logrizi.chillerPlantParameters')" class-name="darkbluebg">
        <el-table-column :label="$t('logrizi.object')" class-name="darkbluebg2 darkbluebg" width="80">
          <template slot-scope="scope"> {{ $t('logrizi.dailyData') }}</template>
        </el-table-column>
        <el-table-column
            :label="$t('logrizi.chillerPlantInputElectricity')+'(KW*h)'"
            class-name="darkbluebg darkbluebg2"
            prop="inputPower"
        >
        </el-table-column>
        <el-table-column
            :label="$t('logrizi.chillerPlantOutputCoolingCapacity')+'('+$store.getters.unitSelete+'*h)'"
            class-name="darkbluebg"
            prop="outputCoolingCapacity"
        >
        </el-table-column>
        <el-table-column
            :label="$t('logrizi.systemHeatDissipation')+'('+$store.getters.unitSelete+')'"
            class-name="darkbluebg"
            prop="systemHeatDissipation"
        >
        </el-table-column>
        <el-table-column
            :label="$t('logrizi.systemEfficiency')+'(KW/RT)'"
            class-name="darkbluebg"
            prop="systemEfficiency"
        >
        </el-table-column>
      </el-table-column>
      <el-table-column :label="$t('logrizi.subsystemElectricityConsumption')" class-name="darkbluebg">
        <el-table-column
            :label="$t('logrizi.chillerElectricityConsumption')+'(KW*h)'"
            class-name="darkbluebg"
            prop="hostPower"
        >
        </el-table-column>
        <el-table-column
            class-name="darkbluebg"
            label="冷冻泵电量(kwh)"
            prop="refrigeratingPumpPower"
            :label="$t('logrizi.chilledWaterPumpElectricityConsumption')+'(KW*h)'"
        >
        </el-table-column>
        <el-table-column
            class-name="darkbluebg"
            label="冷却泵电量(kwh)"
            prop="coolingPumpPower"
            :label="$t('logrizi.coolingWaterPumpElectricityConsumption')+'(KW*h)'"
        >
        </el-table-column>
        <el-table-column
            class-name="darkbluebg"
            label="冷却塔电量(kwh)"
            prop="coolingTowerPower"
            :label="$t('logrizi.coolingTowerElectricityConsumption')+'(KW*h)'"
        >
        </el-table-column>
      </el-table-column>
      </el-table>
    </section>

    <section class="legacy-front-table-card log-detail-card">
      <div class="legacy-front-table-card__head">
        <div class="legacy-front-toolbar__title">
          <strong>逐时明细</strong>
          <span>冻结时间列，集中查看逐时总能耗、分项能耗、系统效率和水温参数。</span>
        </div>
      </div>
      <el-table :data="tableData" class="log-table log-table--detail" height="52vh" style="width: 100%">
        <template slot="empty">
          <div class="log-table__empty">当前日期暂无逐时日志</div>
        </template>
      <el-table-column label="" class-name="darkbluebg">
        <el-table-column
            label="时间"
            :label="$t('logrizi.time')"
            label-class-name="darkbluebg"
            prop="time"
            fixed="left"
            width="80"
        >
        </el-table-column>
      </el-table-column>

      <el-table-column :label="$t('logrizi.hourlyTotalEnergyConsumption')" class-name="darkbluebg">
        <el-table-column
            :render-header="renderHeader"
            label="系统,冷量(kwh)"
            label-class-name="darkbluebg"
            prop="systemCoolingCapacity"
            :label="$i18n.locale === 'zh'? $t('logrizi.system')+$t('logrizi.coolingCapacity')+'('+$store.getters.unitSelete+'*h)' : $t('logrizi.coolingCapacity')+'('+$store.getters.unitSelete+'*h)'"
        >
        </el-table-column>
        <el-table-column
            :render-header="renderHeader"
            label="系统,电量(kwh)"
            :label="$t('logrizi.powerConsunption')+'(KW*h)'"
            label-class-name="darkbluebg"
            prop="systemPower"
        >
        </el-table-column>
      </el-table-column>
      <el-table-column :label="$t('logrizi.hourlySubsystemEnergyConsumption')" class-name="darkbluebg">
        <el-table-column
            :render-header="renderHeader"
            label="主机,电量(kwh)"
            :label="$t('logrizi.chillerlogrizi')+'(KW*h)'"
            label-class-name="darkbluebg"
            prop="hostPower"
        >
        </el-table-column>
        <el-table-column
            :render-header="renderHeader"
            label="冷冻泵,电量(kwh)"
            :label="$t('logrizi.chilldeWaterPump')+'(KW*h)'"
            label-class-name="darkbluebg"
            prop="refrigeratingPumpPower"
        >
        </el-table-column>
        <el-table-column
            :render-header="renderHeader"
            label="冷却泵,电量(kwh)"
            :label="$t('logrizi.condenserPump')+'(KW*h)'"
            label-class-name="darkbluebg"
            prop="coolingPumpPower"
        >
        </el-table-column>
        <el-table-column
            :render-header="renderHeader"
            label="冷却塔,电量(kwh)"
            :label="$t('logrizi.coolingTower')+$t('logrizi.quantityElectricity')+'(KW*h)'"
            label-class-name="darkbluebg"
            prop="coolingTowerPower"
        >
        </el-table-column>
      </el-table-column>

      <el-table-column :label="$t('logrizi.hourlySubsystemEfficiency')" class-name="darkbluebg">
        <el-table-column
            :render-header="renderHeader"
            label="系统,效率(kw/kw)"
            :label="$t('logrizi.systemEfficiency')+'('+$store.getters.unitSelete+'/'+$store.getters.unitSelete+')'"
            label-class-name="darkbluebg"
            prop="systemEfficiency"
        >
        </el-table-column>
        <el-table-column
            :render-header="renderHeader"
            label="主机,效率(kw/kw)"
            :label="$t('logrizi.chillerEffieiency')+'('+$store.getters.unitSelete+'/'+$store.getters.unitSelete+'))'"
            label-class-name="darkbluebg"
            prop="hostEfficiency"
        >
        </el-table-column>
        <el-table-column
            :render-header="renderHeader"
            label="冷冻泵输,送系数(kw/kw)"
            :label="$t('logrizi.chilledWaterPumpDeliveryCoefficient')+'('+$store.getters.unitSelete+'/'+$store.getters.unitSelete+'))'"
            label-class-name="darkbluebg"
            prop="refrigerationPumpConveyingCoefficient"
        >
        </el-table-column>
        <el-table-column
            :render-header="renderHeader"
            label="冷却泵输,送系数(kw/kw)"
            :label="$t('logrizi.coolingWaterPumpDeliveryCoefficient')"
            label-class-name="darkbluebg"
            prop="coolingPumpConveyingCoefficient"
        >
        </el-table-column>
        <el-table-column
            :render-header="renderHeader"
            label="冷却塔输,送系数(kw/kw)"
            :label="$t('logrizi.coolingTowerDeliveryCoefficient')"
            label-class-name="darkbluebg"
            prop="coolingTowerConveyingCoefficient"
        >
        </el-table-column>
      </el-table-column>
      <el-table-column :label="$t('logrizi.hourlyWaterTemperature')" class-name="darkbluebg">
        <el-table-column
            :render-header="renderHeader"
            label="冷冻,进水,温度(℃)"
            :label="$t('logrizi.chilledWaterInletTemperature')+'(℃)'"
            label-class-name="darkbluebg"
            prop="chilledWaterInputTemperature"
        >
        </el-table-column>
        <el-table-column
            :render-header="renderHeader"
            label="冷冻,出水,温度(℃)"
            :label="$t('logrizi.chilledWaterOutletTemperature')+'(℃)'"
            label-class-name="darkbluebg"
            prop="chilledWaterOutputTemperature"
        >
        </el-table-column>
        <el-table-column
            :render-header="renderHeader"
            label="冷却,进水,温度(℃)"
            :label="$t('logrizi.coolingWaterInletTemperature')+'(℃)'"
            label-class-name="darkbluebg"
            prop="coolingWaterInputTemperature"
        >
        </el-table-column>
        <el-table-column
            :render-header="renderHeader"
            label="冷却,出水,温度(℃)"
            :label="$t('logrizi.coolingWaterOutletTemperature')+'(℃)'"
            label-class-name="darkbluebg"
            prop="coolingWaterOutputTemperature"
        >
        </el-table-column>
      </el-table-column>
      </el-table>
    </section>
  </div>
</template>
<script>
import {getLengZhanRecords} from "@/api/front/rizhi";
import dayjs from "dayjs";
import {mapGetters} from "vuex";
import {downloadExl} from "./index";

export default {
  computed: {
    ...mapGetters(["path"]),
    selectedDateLabel() {
      return dayjs(this.form.startTime).format("YYYY-MM-DD");
    },
    summaryEfficiency() {
      if (!this.tableData1.length) {
        return "--";
      }
      const value = Number(this.tableData1[0].systemEfficiency);
      return Number.isFinite(value) ? value.toFixed(2) : "--";
    },
  },
  data() {
    return {
      form: {startTime: new Date()},
      tableData: [],
      tableData1: [],
      exporttime: "",
      loadbtn: false,
      styledExcelPromise: null,
    };
  },
  created() {
    (this.exporttime = dayjs().format("YYYY-MM-DD HH:mm")), this.initData();
  },
  methods: {
    loadStyledExcel() {
      if (!this.styledExcelPromise) {
        this.styledExcelPromise = import(
          /* webpackChunkName: "xlsx-style-export" */ "xlsx-style"
        ).then((module) => module.default || module);
      }
      return this.styledExcelPromise;
    },
    initData() {
      this.loadbtn = true;
      let info = {
        date: dayjs(this.form.startTime).format("YYYY-MM-DD"),
      };
      getLengZhanRecords(this.path, info).then((res) => {
        this.loadbtn = false;
        this.tableData1 = []
        this.tableData = res.data.lengZhanRecordsDetailVOList;
        this.tableData1.push({
          inputPower: res.data.inputPower,
          outputCoolingCapacity: res.data.outputCoolingCapacity,
          systemHeatDissipation: res.data.systemHeatDissipation,
          systemEfficiency: res.data.systemEfficiency,
          hostPower: res.data.hostPower,
          refrigeratingPumpPower: res.data.refrigeratingPumpPower,
          coolingPumpPower: res.data.coolingPumpPower,
          coolingTowerPower: res.data.coolingTowerPower,
        });
      });
    },
    renderHeader(h, {column, $index}) {
      let arr = column.label.split(",");
      let textarr = [];
      textarr = arr.reduce((pre, next, index) => {
        textarr.push(h("span", next));
        // if (index < arr.length - 1) {
        //   textarr.push(h("br"));
        // }
        return textarr;
      }, textarr);
      return h(
          "div",
          {
            class: "colum-text",
          },
          textarr
      );
    },
    gettime() {
      return dayjs(this.form.startTime).format("YYYY年MM月DD日");
    },
    gettime2() {
      return this.exporttime;
    },
    getTableExcel() {
      let time = dayjs(this.form.startTime).format("YYYY年MM月DD日");
      let obj = this.tableData1[0];
      let arr = [
        [
          "报表名称",
          "冷站运行日志",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        [
          "数据时间",
          time,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        [
          "导出时间",
          this.exporttime,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        [
          null,
          "冷站参数",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          "分项电耗",
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        [
          "对象",
          "冷站输入电量",
          null,
          "冷站输出冷量",
          null,
          "系统散热量",
          null,
          "系统效率",
          null,
          "主机电量",
          null,
          "冷冻泵电量",
          null,
          "冷却泵电量",
          null,
          "冷却塔电量",
        ],
        [
          null,
          "kwh",
          null,
          "kwh",
          null,
          "kwh",
          null,
          "kwh",
          null,
          "kwh",
          null,
          "kwh",
          null,
          "kwh",
          null,
          "kwh",
        ],
        [
          "日数据",
          obj.inputPower,
          null,
          obj.outputCoolingCapacity,
          null,
          obj.systemHeatDissipation,
          null,
          obj.systemEfficiency,
          null,
          obj.hostPower,
          null,
          obj.refrigeratingPumpPower,
          null,
          obj.coolingPumpPower,
          null,
          obj.coolingTowerPower,
        ],
        [
          null,
          "逐时总能耗",
          null,
          "逐时分项能耗",
          null,
          null,
          null,
          "逐时分项效率",
          null,
          null,
          null,
          null,
          "逐时水温",
          null,
          null,
          null,
        ],
        [
          "时间",
          "系统冷量",
          "系统电量",
          "主机电量",
          "冷冻泵电量",
          "冷却泵电量",
          "冷却塔电量",
          "系统效率",
          "主机效率",
          "冷冻泵输送系数",
          "冷却泵输送系数",
          "冷却塔输送系数",
          "冷冻进水温度",
          "冷冻出水温度",
          "冷却进水温度",
          "冷却出水温度",
        ],
      ];
      let ar = new Array(15).fill("kwh");
      ar.unshift(null);
      console.log("ar", ar);
      arr.push(ar);
      this.tableData.forEach((element) => {
        let a = [
          element.time,
          element.systemCoolingCapacity,
          element.systemPower,
          element.hostPower,
          element.refrigeratingPumpPower,
          element.coolingPumpPower,
          element.coolingTowerPower,
          element.systemEfficiency,
          element.hostEfficiency,
          element.refrigerationPumpConveyingCoefficient,
          element.coolingPumpConveyingCoefficient,
          element.coolingTowerConveyingCoefficient,
          element.chilledWaterInputTemperature,
          element.chilledWaterOutputTemperature,
          element.coolingWaterInputTemperature,
          element.coolingWaterOutputTemperature,
        ];
        arr.push(a);
      });
      return arr;
    },
    async leadOut() {
      const XLSX = await this.loadStyledExcel();
      var aoa = this.getTableExcel();
      var sheet = XLSX.utils.aoa_to_sheet(aoa);
      sheet["!merges"] = [
        // 设置A1-C1的单元格合并
        {s: {r: 0, c: 1}, e: {r: 0, c: 15}},
        {s: {r: 1, c: 1}, e: {r: 1, c: 15}},
        {s: {r: 2, c: 1}, e: {r: 2, c: 15}},
        {s: {r: 3, c: 1}, e: {r: 3, c: 8}},
        {s: {r: 3, c: 9}, e: {r: 3, c: 15}},

        {s: {r: 4, c: 0}, e: {r: 5, c: 0}},
        {s: {r: 4, c: 1}, e: {r: 4, c: 2}},
        {s: {r: 4, c: 3}, e: {r: 4, c: 4}},
        {s: {r: 4, c: 5}, e: {r: 4, c: 6}},
        {s: {r: 4, c: 7}, e: {r: 4, c: 8}},
        {s: {r: 4, c: 9}, e: {r: 4, c: 10}},
        {s: {r: 4, c: 11}, e: {r: 4, c: 12}},
        {s: {r: 4, c: 13}, e: {r: 4, c: 14}},

        {s: {r: 5, c: 1}, e: {r: 5, c: 2}},
        {s: {r: 5, c: 3}, e: {r: 5, c: 4}},
        {s: {r: 5, c: 5}, e: {r: 5, c: 6}},
        {s: {r: 5, c: 7}, e: {r: 5, c: 8}},
        {s: {r: 5, c: 9}, e: {r: 5, c: 10}},
        {s: {r: 5, c: 11}, e: {r: 5, c: 12}},
        {s: {r: 5, c: 13}, e: {r: 5, c: 14}},

        {s: {r: 6, c: 1}, e: {r: 6, c: 2}},
        {s: {r: 6, c: 3}, e: {r: 6, c: 4}},
        {s: {r: 6, c: 5}, e: {r: 6, c: 6}},
        {s: {r: 5, c: 7}, e: {r: 6, c: 8}},
        {s: {r: 5, c: 9}, e: {r: 6, c: 10}},
        {s: {r: 6, c: 11}, e: {r: 6, c: 12}},
        {s: {r: 6, c: 13}, e: {r: 6, c: 14}},

        {s: {r: 7, c: 1}, e: {r: 7, c: 2}},
        {s: {r: 7, c: 3}, e: {r: 7, c: 6}},
        {s: {r: 7, c: 7}, e: {r: 7, c: 11}},
        {s: {r: 7, c: 12}, e: {r: 7, c: 15}},
        {s: {r: 8, c: 0}, e: {r: 9, c: 0}},
      ];
      var kk = ["A1", "B1"];
      kk.forEach((item) => {
        sheet[item].s = {
          alignment: {
            horizontal: "center", // 水平垂直
            vertical: "center",
            wrapText: 1, // 自动换行，换行字符："\r\n"
          },
        };
      });

      sheet["!cols"] = new Array(16).fill({wpx: 80, hpx: 40});
      this.openDownloadDialog(this.sheet2blob(sheet, "sheet1", XLSX), "冷站日志.xlsx");
    },
    sheet2blob(sheet, sheetName, XLSX) {
      sheetName = sheetName || "sheet1";
      var workbook = {
        SheetNames: [sheetName],
        Sheets: {},
      };
      workbook.Sheets[sheetName] = sheet;
      // 生成excel的配置项
      var wopts = {
        bookType: "xlsx", // 要生成的文件类型
        bookSST: false, // 是否生成Shared String Table，官方解释是，如果开启生成速度会下降，但在低版本IOS设备上有更好的兼容性
        type: "binary",
      };
      var wbout = XLSX.write(workbook, wopts);
      var blob = new Blob([s2ab(wbout)], {type: "application/octet-stream"});

      // 字符串转ArrayBuffer
      function s2ab(s) {
        var buf = new ArrayBuffer(s.length);
        var view = new Uint8Array(buf);
        for (var i = 0; i != s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
        return buf;
      }

      return blob;
    },
    openDownloadDialog(url, saveName) {
      if (typeof url == "object" && url instanceof Blob) {
        url = URL.createObjectURL(url); // 创建blob地址
      }
      var aLink = document.createElement("a");
      aLink.href = url;
      aLink.download = saveName || ""; // HTML5新增的属性，指定保存文件名，可以不要后缀，注意，file:///模式下不会生效
      var event;
      if (window.MouseEvent) event = new MouseEvent("click");
      else {
        event = document.createEvent("MouseEvents");
        event.initMouseEvent(
            "click",
            true,
            false,
            window,
            0,
            0,
            0,
            0,
            0,
            false,
            false,
            false,
            false,
            0,
            null
        );
      }
      aLink.dispatchEvent(event);
    },
    search() {
      this.$refs.form.validate((valid) => {
        if (valid) {
          this.initData();
        } else {
          return false;
        }
      });
    },

    async handleDownClick() {
      // 数据
      var data = this.getTableExcel();
      //表格标题
      var dataTitle = "冷站日志";

      var mergelist = [
        // 设置A1-C1的单元格合并
        {s: {r: 0, c: 1}, e: {r: 0, c: 15}},
        {s: {r: 1, c: 1}, e: {r: 1, c: 15}},
        {s: {r: 2, c: 1}, e: {r: 2, c: 15}},
        {s: {r: 3, c: 1}, e: {r: 3, c: 8}},
        {s: {r: 3, c: 9}, e: {r: 3, c: 15}},

        {s: {r: 4, c: 0}, e: {r: 5, c: 0}},
        {s: {r: 4, c: 1}, e: {r: 4, c: 2}},
        {s: {r: 4, c: 3}, e: {r: 4, c: 4}},
        {s: {r: 4, c: 5}, e: {r: 4, c: 6}},
        {s: {r: 4, c: 7}, e: {r: 4, c: 8}},
        {s: {r: 4, c: 9}, e: {r: 4, c: 10}},
        {s: {r: 4, c: 11}, e: {r: 4, c: 12}},
        {s: {r: 4, c: 13}, e: {r: 4, c: 14}},

        {s: {r: 5, c: 1}, e: {r: 5, c: 2}},
        {s: {r: 5, c: 3}, e: {r: 5, c: 4}},
        {s: {r: 5, c: 5}, e: {r: 5, c: 6}},
        {s: {r: 5, c: 7}, e: {r: 5, c: 8}},
        {s: {r: 5, c: 9}, e: {r: 5, c: 10}},
        {s: {r: 5, c: 11}, e: {r: 5, c: 12}},
        {s: {r: 5, c: 13}, e: {r: 5, c: 14}},

        {s: {r: 6, c: 1}, e: {r: 6, c: 2}},
        {s: {r: 6, c: 3}, e: {r: 6, c: 4}},
        {s: {r: 6, c: 5}, e: {r: 6, c: 6}},
        {s: {r: 6, c: 7}, e: {r: 6, c: 8}},
        {s: {r: 6, c: 9}, e: {r: 6, c: 10}},
        {s: {r: 6, c: 11}, e: {r: 6, c: 12}},
        {s: {r: 6, c: 13}, e: {r: 6, c: 14}},

        {s: {r: 7, c: 1}, e: {r: 7, c: 2}},
        {s: {r: 7, c: 3}, e: {r: 7, c: 6}},
        {s: {r: 7, c: 7}, e: {r: 7, c: 11}},
        {s: {r: 7, c: 12}, e: {r: 7, c: 15}},
        {s: {r: 8, c: 0}, e: {r: 9, c: 0}},
      ];
      // 配置文件类型
      const wopts = {
        bookType: "xlsx",
        bookSST: true,
        type: "binary",
        cellStyles: true,
      };
      await downloadExl(data, wopts, dataTitle, mergelist);
    },
  },
};
</script>
<style lang="scss">
.log-front {
  .log-toolbar-form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 18px;
  }

  .log-toolbar-form__actions {
    margin-left: auto;
  }

  .log-action-btn {
    min-width: 118px;
    border-radius: 12px;
    background: linear-gradient(135deg, #1c8dc3 0%, #166d9b 100%);
    border-color: rgba(75, 179, 233, 0.36);
    color: #f5fbff;
  }

  .log-action-btn--ghost {
    background: linear-gradient(135deg, rgba(36, 118, 165, 0.86) 0%, rgba(21, 77, 114, 0.92) 100%);
  }

  .log-action-btn__icon {
    margin-right: 5px;
  }

  .log-detail-card {
    padding-bottom: 14px;
  }

  .log-table {
    border-radius: 18px;
    overflow: hidden;
    background: transparent;
    border: 1px solid rgba(92, 174, 223, 0.12);

    &::before,
    &.el-table--group::after,
    &.el-table--border::after {
      background-color: rgba(92, 174, 223, 0.16);
    }

    .cell {
      text-align: center !important;
      color: rgba(230, 240, 246, 0.92);
      word-break: break-word !important;
    }

    .el-table__header-wrapper,
    .el-table__fixed-header-wrapper {
      th.el-table__cell {
        border-bottom: 1px solid rgba(92, 174, 223, 0.14);
      }
    }

    .el-table__fixed,
    .el-table__fixed-right {
      box-shadow: none;
    }

    .el-table__fixed::before,
    .el-table__fixed-right::before {
      background: transparent;
    }

    td.el-table__cell,
    th.el-table__cell {
      border-right: 1px solid rgba(92, 174, 223, 0.1);
      border-bottom: 1px solid rgba(92, 174, 223, 0.1);
    }

    .el-table__body tr:hover > td.el-table__cell {
      background: rgba(79, 148, 196, 0.08) !important;
    }

    .el-table__body tr.current-row > td.el-table__cell {
      background: rgba(79, 148, 196, 0.1) !important;
    }
  }

  .log-table--summary .el-table__body td.el-table__cell,
  .log-table--summary .el-table__body tr:hover > td.el-table__cell {
    background: rgba(10, 22, 36, 0.74) !important;
  }

  .log-table--detail .el-table__body td.el-table__cell {
    background: rgba(8, 18, 31, 0.78) !important;
  }

  .darkbluebg {
    background: linear-gradient(180deg, rgba(17, 75, 112, 0.96) 0%, rgba(10, 58, 89, 0.98) 100%) !important;
    color: rgba(246, 250, 255, 0.98) !important;

    .cell {
      white-space: normal !important;
      line-height: 1.45 !important;
      color: inherit !important;
    }

    .colum-text {
      white-space: normal !important;
      padding: 0 !important;
      line-height: 18px !important;
      color: inherit !important;
    }
  }

  .darkbluebg2 {
    background: linear-gradient(180deg, rgba(14, 60, 91, 0.98) 0%, rgba(9, 44, 68, 0.98) 100%) !important;
  }

  .colum-text {
    display: grid;
    gap: 2px;
    line-height: 1.35 !important;
  }

  .log-table__empty {
    padding: 28px 0;
    color: rgba(191, 220, 236, 0.68);
    letter-spacing: 0.08em;
  }
}

.log-toolbar-form .el-form-item__label {
  color: rgba(223, 236, 245, 0.86);
}

.log-toolbar-form .el-input__inner,
.log-toolbar-form .el-date-editor.el-input,
.log-toolbar-form .el-date-editor.el-input__inner {
  border-radius: 12px;
}

.log-toolbar-form .el-input__inner {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(122, 210, 255, 0.14);
  color: rgba(245, 251, 255, 0.96);
}

.log-front .el-table,
.log-front .el-table__expanded-cell {
  background-color: transparent;
}

.log-front .el-table__empty-block {
  background: transparent;
}
</style>
