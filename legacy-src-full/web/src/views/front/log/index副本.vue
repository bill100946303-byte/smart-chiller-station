<template>
  <div class="log-front">
    <el-form :inline="true" :model="form" class="demo-form-inline" ref="form">
      <el-form-item
        label="时间"
        prop="startTime"
        :rules="[{ required: true, message: '时间不能为空' }]"
      >
        <el-date-picker
          v-model="form.startTime"
          type="date"
          placeholder="选择开始时间"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search" :loading="loadbtn">查询数据</el-button>
        <el-button type="primary" @click="handleDownClick">导出数据</el-button>
      </el-form-item>
    </el-form>
    <el-table :data="tableData1" style="width: 100%" >
      <el-table-column label="冷站参数" class-name="darkbluebg">
        <el-table-column label="对象" width="80" class-name="darkbluebg">
          <template slot-scope="scope"> 日数据 </template>
        </el-table-column>
        <el-table-column
          label="冷站输入电量(kwh)"
          class-name="darkbluebg"
          prop="inputPower"
        >
        </el-table-column>
        <el-table-column
          label="冷站输出冷量(kwh)"
          class-name="darkbluebg"
          prop="outputCoolingCapacity"
        >
        </el-table-column>
        <el-table-column
          label="系统散热量(kwh)"
          class-name="darkbluebg"
          prop="systemHeatDissipation"
        >
        </el-table-column>
        <el-table-column
          label="系统效率(kw/kw)"
          class-name="darkbluebg"
          prop="systemEfficiency"
        >
        </el-table-column>
      </el-table-column>
      <el-table-column label="分项电耗" class-name="darkbluebg">
        <el-table-column
          label="主机电量(kwh)"
          class-name="darkbluebg"
          prop="hostPower"
        >
        </el-table-column>
        <el-table-column
          label="冷冻泵电量(kwh)"
          class-name="darkbluebg"
          prop="refrigeratingPumpPower"
        >
        </el-table-column>
        <el-table-column
          label="冷却泵电量(kwh)"
          class-name="darkbluebg"
          prop="coolingPumpPower"
        >
        </el-table-column>
        <el-table-column
          label="冷却塔电量(kwh)"
          class-name="darkbluebg"
          prop="coolingTowerPower"
        >
        </el-table-column>
      </el-table-column>
    </el-table>
    <el-table :data="tableData" style="width: 100%" height="560">
      <el-table-column label="" class-name="darkbluebg">
        <el-table-column
          prop="time"
          label="时间"
          width="80"
          label-class-name="darkbluebg"
        >
        </el-table-column>
      </el-table-column>

      <el-table-column label="逐时总能耗" class-name="darkbluebg">
        <el-table-column
          label="系统,冷量(kwh)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="systemCoolingCapacity"
        >
        </el-table-column>
        <el-table-column
          label="系统,电量(kwh)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="systemPower"
        >
        </el-table-column>
      </el-table-column>
      <el-table-column label="逐时分项能耗" class-name="darkbluebg">
        <el-table-column
          label="主机,电量(kwh)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="hostPower"
        >
        </el-table-column>
        <el-table-column
          label="冷冻泵,电量(kwh)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="refrigeratingPumpPower"
        >
        </el-table-column>
        <el-table-column
          label="冷却泵,电量(kwh)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="coolingPumpPower"
        >
        </el-table-column>
        <el-table-column
          label="冷却塔,电量(kwh)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="coolingTowerPower"
        >
        </el-table-column>
      </el-table-column>

      <el-table-column label="逐时分项效率" class-name="darkbluebg">
        <el-table-column
          label="系统,效率(kw/kw)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="systemEfficiency"
        >
        </el-table-column>
        <el-table-column
          label="主机,效率(kw/kw)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="hostEfficiency"
        >
        </el-table-column>
        <el-table-column
          label="冷冻泵输,送系数(kw/kw)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="refrigerationPumpConveyingCoefficient"
        >
        </el-table-column>
        <el-table-column
          label="冷却泵输,送系数(kw/kw)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="coolingPumpConveyingCoefficient"
        >
        </el-table-column>
        <el-table-column
          label="冷却塔输,送系数(kw/kw)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="coolingTowerConveyingCoefficient"
        >
        </el-table-column>
      </el-table-column>
      <el-table-column label="逐时水温" class-name="darkbluebg">
        <el-table-column
          label="冷冻,进水,温度(℃)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="chilledWaterInputTemperature"
        >
        </el-table-column>
        <el-table-column
          label="冷冻,出水,温度(℃)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="chilledWaterOutputTemperature"
        >
        </el-table-column>
        <el-table-column
          label="冷却,进水,温度(℃)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="coolingWaterInputTemperature"
        >
        </el-table-column>
        <el-table-column
          label="冷却,出水,温度(℃)"
          :render-header="renderHeader"
          label-class-name="darkbluebg"
          prop="coolingWaterOutputTemperature"
        >
        </el-table-column>
      </el-table-column>
    </el-table>
  </div>
</template>
<script>
import {getLengZhanRecords} from "@/api/front/rizhi";
import dayjs from "dayjs";
import {mapGetters} from "vuex";
import {downloadExl} from "./index";
// import XLSX from "xlsx";
// import XLSXStyle from "xlsx-style"
import XLSX from "xlsx-style";

export default {
  computed: {
    ...mapGetters(["path"]),
  },
  data() {
    return {
      form: { startTime: new Date() },
      tableData: [],
      tableData1: [],
      exporttime: "",
      loadbtn:false
    };
  },
  created() {
    (this.exporttime = dayjs().format("YYYY-MM-DD HH:mm")), this.initData();
  },
  methods: {
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
    renderHeader(h, { column, $index }) {
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
    leadOut() {
      var aoa = this.getTableExcel();
      var sheet = XLSX.utils.aoa_to_sheet(aoa);
      sheet["!merges"] = [
        // 设置A1-C1的单元格合并
        { s: { r: 0, c: 1 }, e: { r: 0, c: 15 } },
        { s: { r: 1, c: 1 }, e: { r: 1, c: 15 } },
        { s: { r: 2, c: 1 }, e: { r: 2, c: 15 } },
        { s: { r: 3, c: 1 }, e: { r: 3, c: 8 } },
        { s: { r: 3, c: 9 }, e: { r: 3, c: 15 } },

        { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
        { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } },
        { s: { r: 4, c: 3 }, e: { r: 4, c: 4 } },
        { s: { r: 4, c: 5 }, e: { r: 4, c: 6 } },
        { s: { r: 4, c: 7 }, e: { r: 4, c: 8 } },
        { s: { r: 4, c: 9 }, e: { r: 4, c: 10 } },
        { s: { r: 4, c: 11 }, e: { r: 4, c: 12 } },
        { s: { r: 4, c: 13 }, e: { r: 4, c: 14 } },

        { s: { r: 5, c: 1 }, e: { r: 5, c: 2 } },
        { s: { r: 5, c: 3 }, e: { r: 5, c: 4 } },
        { s: { r: 5, c: 5 }, e: { r: 5, c: 6 } },
        { s: { r: 5, c: 7 }, e: { r: 5, c: 8 } },
        { s: { r: 5, c: 9 }, e: { r: 5, c: 10 } },
        { s: { r: 5, c: 11 }, e: { r: 5, c: 12 } },
        { s: { r: 5, c: 13 }, e: { r: 5, c: 14 } },

        { s: { r: 6, c: 1 }, e: { r: 6, c: 2 } },
        { s: { r: 6, c: 3 }, e: { r: 6, c: 4 } },
        { s: { r: 6, c: 5 }, e: { r: 6, c: 6 } },
        { s: { r: 5, c: 7 }, e: { r: 6, c: 8 } },
        { s: { r: 5, c: 9 }, e: { r: 6, c: 10 } },
        { s: { r: 6, c: 11 }, e: { r: 6, c: 12 } },
        { s: { r: 6, c: 13 }, e: { r: 6, c: 14 } },

        { s: { r: 7, c: 1 }, e: { r: 7, c: 2 } },
        { s: { r: 7, c: 3 }, e: { r: 7, c: 6 } },
        { s: { r: 7, c: 7 }, e: { r: 7, c: 11 } },
        { s: { r: 7, c: 12 }, e: { r: 7, c: 15 } },
        { s: { r: 8, c: 0 }, e: { r: 9, c: 0 } },
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

      sheet["!cols"] = new Array(16).fill({ wpx: 80, hpx: 40 });
      this.openDownloadDialog(this.sheet2blob(sheet), "冷站日志.xlsx");
    },
    sheet2blob(sheet, sheetName) {
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
      var blob = new Blob([s2ab(wbout)], { type: "application/octet-stream" });
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

    handleDownClick() {
      // 数据
      var data = this.getTableExcel();
      //表格标题
      var dataTitle = "冷站日志";

      var mergelist = [
        // 设置A1-C1的单元格合并
        { s: { r: 0, c: 1 }, e: { r: 0, c: 15 } },
        { s: { r: 1, c: 1 }, e: { r: 1, c: 15 } },
        { s: { r: 2, c: 1 }, e: { r: 2, c: 15 } },
        { s: { r: 3, c: 1 }, e: { r: 3, c: 8 } },
        { s: { r: 3, c: 9 }, e: { r: 3, c: 15 } },

        { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
        { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } },
        { s: { r: 4, c: 3 }, e: { r: 4, c: 4 } },
        { s: { r: 4, c: 5 }, e: { r: 4, c: 6 } },
        { s: { r: 4, c: 7 }, e: { r: 4, c: 8 } },
        { s: { r: 4, c: 9 }, e: { r: 4, c: 10 } },
        { s: { r: 4, c: 11 }, e: { r: 4, c: 12 } },
        { s: { r: 4, c: 13 }, e: { r: 4, c: 14 } },

        { s: { r: 5, c: 1 }, e: { r: 5, c: 2 } },
        { s: { r: 5, c: 3 }, e: { r: 5, c: 4 } },
        { s: { r: 5, c: 5 }, e: { r: 5, c: 6 } },
        { s: { r: 5, c: 7 }, e: { r: 5, c: 8 } },
        { s: { r: 5, c: 9 }, e: { r: 5, c: 10 } },
        { s: { r: 5, c: 11 }, e: { r: 5, c: 12 } },
        { s: { r: 5, c: 13 }, e: { r: 5, c: 14 } },

        { s: { r: 6, c: 1 }, e: { r: 6, c: 2 } },
        { s: { r: 6, c: 3 }, e: { r: 6, c: 4 } },
        { s: { r: 6, c: 5 }, e: { r: 6, c: 6 } },
        { s: { r: 6, c: 7 }, e: { r: 6, c: 8 } },
        { s: { r: 6, c: 9 }, e: { r: 6, c: 10 } },
        { s: { r: 6, c: 11 }, e: { r: 6, c: 12 } },
        { s: { r: 6, c: 13 }, e: { r: 6, c: 14 } },

        { s: { r: 7, c: 1 }, e: { r: 7, c: 2 } },
        { s: { r: 7, c: 3 }, e: { r: 7, c: 6 } },
        { s: { r: 7, c: 7 }, e: { r: 7, c: 11 } },
        { s: { r: 7, c: 12 }, e: { r: 7, c: 15 } },
        { s: { r: 8, c: 0 }, e: { r: 9, c: 0 } },
      ];
      // 配置文件类型
      const wopts = {
        bookType: "xlsx",
        bookSST: true,
        type: "binary",
        cellStyles: true,
      };
      downloadExl(data, wopts, dataTitle, mergelist);
    },
  },
};
</script>
<style lang="scss">
.log-front {
  margin-right: 25px;

  .demo-form-inline {
    margin-bottom: 8px;
  }
  .darkbluebg {
    background: #153356 !important;
    color: #cccccc;
    .cell {
      white-space: normal !important;
      word-break: break-all !important;
    }
    .colum-text {
      white-space: normal !important;
      word-break: break-all !important;
      padding: 0 !important;
      line-height: 18px !important;
    }
  }
  .el-table {
    .cell {
      text-align: center !important;
    }
    .el-table__row{
      color: #cccccc;
    }
  }
  .colum-text {
    line-height: 18px !important;
  }
}
</style>
