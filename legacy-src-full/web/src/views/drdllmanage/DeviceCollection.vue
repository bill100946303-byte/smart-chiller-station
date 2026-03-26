<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col :md="24" :lg="7" :xl="5">
        <div class="grid-content bg-purple">
          <p class="left-title">配置采集设备</p>
          <el-form
            class="form"
            ref="form"
            label-position="left"
            label-width="120px"
          >
            <el-form-item label="设备名称">
              <el-input
                v-model="deviceName"
                clearable
                placeholder="请输入设备名称"
              />
            </el-form-item>
            <el-form-item label="驱动">
              <el-select v-model="drdll" placeholder="请选择驱动" style="width:200px">
                <el-option
                  v-for="item in drdllOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="驱动类型">
              <el-select v-model="drdlltype" placeholder="请选择驱动类型" style="width:200px">
                <el-option
                  v-for="item in drdlltypeOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="设备IP和端口">
              <el-input
                v-model="deviceIPPort"
                clearable
                placeholder="请输入设备IP和端口"
              />
            </el-form-item>
            <el-form-item label="COM口">
              <el-input v-model="COM" clearable placeholder="请输入串口" />
            </el-form-item>
            <el-form-item label="波特率">
              <el-select v-model="bandRate" placeholder="请选择波特率" style="width:200px">
                <el-option
                  v-for="item in bandRateOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="数据位">
              <el-select v-model="dataBit" placeholder="请选择数据位" style="width:200px">
                <el-option
                  v-for="item in dataBitOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="停止位">
              <el-select v-model="stopBit" placeholder="请选择停止位" style="width:200px">
                <el-option
                  v-for="item in stopBitOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="校验">
              <el-select v-model="check" placeholder="请选择校验" style="width:200px">
                <el-option
                  v-for="item in checkOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <!-- <el-form-item label="采集周期">
              <el-input
                v-model="collectionTime"
                clearable
                placeholder="请输入采集周期"
              />
              <span>毫秒</span>
            </el-form-item> -->
            <el-form-item label="MacID">
              <el-input v-model="MacID" clearable placeholder="请输入MacID" />
            </el-form-item>
          </el-form>
          <div class="left-btn">
            <el-button type="primary" @click="handelAdd">增加</el-button>
            <el-button type="primary" @click="handelUpdate">确认修改</el-button>
          </div>
        </div>
      </el-col>
      <el-col :md="24" :lg="17" :xl="19">
        <div class="grid-content bg-purple">
          <div class="buiding-info-title">
            <p>采集设备列表</p>
            <!--<el-button type="primary" @click="exportQsTag">数据导出</el-button>-->
            <!--<ExcelUpload class="upload" :btnName="btnName" @excelUpload="uploadFile"/>-->
            <el-button type="danger" @click="handelDeletes">批量删除</el-button>
          </div>
          <el-table
            :data="tableDatas"
            border
            style="width: 100%"
            max-height="600"
            @selection-change="selectQsTags"
          >
            <el-table-column type="selection" width="55"></el-table-column>
            <af-table-column prop="drid" label="设备ID" width="85"></af-table-column>
            <af-table-column prop="drname" label="设备名称"></af-table-column>
            <af-table-column prop="drllname" label="驱动" width="105"></af-table-column>
            <af-table-column prop="type" label="驱动类型" width="85"></af-table-column>
            <af-table-column prop="ipport" label="设备IP和端口" width="180"></af-table-column>
            <af-table-column prop="com" label="COM口" width="75"></af-table-column>
            <af-table-column prop="baudRate" label="波特率" width="75"></af-table-column>
            <af-table-column prop="dataBits" label="数据位" width="65"></af-table-column>
            <af-table-column prop="stopBits" label="停止位" width="65"></af-table-column>
            <af-table-column prop="parity" label="校验" width="65"></af-table-column>
            <!-- <af-table-column prop="cycle" label="采集周期"></af-table-column> -->
            <af-table-column prop="macID" label="MacID" width="80"></af-table-column>
            <el-table-column fixed="right" label="操作" width="150">
              <template slot-scope="scope">
                <el-button
                  type="success"
                  size="mini"
                  @click="handelEdit(scope.$index, scope.row)"
                  >编辑</el-button
                >
                <el-button
                  type="danger"
                  size="mini"
                  @click="handelDelete(scope.$index, scope.row)"
                  >删除</el-button
                >
              </template>
            </el-table-column>
          </el-table>
<!--          <div class="el-pagination">
            <div class="btn">
              <button @click="prev">上一页</button>
              <span>{{ currentPage }}</span>
              <button @click="next">下一页</button>
            </div>
            <div>
              <el-pagination
                :current-page="currentPage"
                :page-sizes="[5, 10, 20, 40]"
                :page-size="pagesize"
                layout="total, sizes, jumper"
                :total="rowCount"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
              />
            </div>
          </div>-->
          <div class="el-pagination">
            <el-pagination
                :current-page="currentPage"
                :page-size="pagesize"
                :page-sizes="[10, 20, 30, 50]"
                :total="rowCount"
                layout="total, sizes, prev, pager, next, jumper"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
            >
            </el-pagination>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import {
  addDllDrinfo,
  deleteDllDrinfo,
  findAllDllDrinfo,
  findDllDrinfo,
  inputExcel,
  outputExcel,
  updateDllDrinfo
} from "@/api/basesetting/devicecollection";
import ExcelUpload from "@/components/MyImgUpload/ExcelUpload";
import {exportExcel} from "@/utils/excel";
import {formatDate} from "@/utils/index";
import {idToVal, nullToStr, valToId} from "@/utils/selectexchange";

export default {
  inject: ["reload"],
  components: {
    ExcelUpload
  },
  computed: {
    ...mapGetters(["id", "path"])
  },
  data () {
    return {
      btnName: "数据导入",
      deviceName: "", // 设备名
      drdll: "", // 驱动
      drdllOptions: [], // 驱动选项
      drdlltype: 0,// 驱动类型
      drdlltypeOptions: [
        {
          id: 0,
          value: "网络"
        },
        {
          id: 1,
          value: "串口"
        }
      ], // 驱动类型选择
      deviceIPPort: "", // 设备IP和端口
      COM: "com1", // 串口
      bandRate: 1200, // 波特率
      bandRateOptions: [
        {
          id: 1200,
          value: "1200",
        },
        {
          id: 2400,
          value: "2400",
        },
        {
          id: 4800,
          value: "4800",
        },
        {
          id: 9600,
          value: "9600",
        },
        {
          id: 19200,
          value: "19200",
        },
        {
          id: 38400,
          value: "38400",
        },
        {
          id: 76800,
          value: "76800",
        },
        {
          id: 153600,
          value: "153600",
        }
      ], // 波特率选择
      dataBit: 8, // 数据位
      dataBitOptions: [
        {
          id: 7,
          value: "7",
        },
        {
          id: 8,
          value: "8"
        }
      ], // 数据位选择
      stopBit: 1, // 停止位
      stopBitOptions: [
        {
          id: 1,
          value: "1",
        },
        {
          id: 1.5,
          value: "1.5",
        },
        {
          id: 2,
          value: "2",
        }
      ], // 停止位选择
      check: 0, // 校验
      checkOptions: [
        {
          id: 0,
          value: "无"
        },
        {
          id: 1,
          value: "奇校验"
        },
        {
          id: 2,
          value: "偶校验"
        }
      ], // 校验选择
      collectionTime: '3000', // 采集周期
      drdlls: [], // 选择的寄存器数组
      MacID: "",

      currentPage: 1, // 初始页
      pagesize: 10,
      rowCount: 0,
      tableDatas: [],
      editData: {}
    };
  },
  mounted () {
    findAllDllDrinfo(this.path)
      .then(res => {
        res.data.forEach(ele => {
          let obj = {
            id: ele.drllid,
            value: ele.drllname
          }
          this.drdllOptions.push(obj);
        })
      })
      .catch(console.log);
    this.findDllDrinfo(this.path, this.currentPage, this.pagesize);
  },
  methods: {
    // 查询变量寄存器
    findDllDrinfo (path, currentPage, pageSize) {
      findDllDrinfo(path, currentPage, pageSize)
        .then(res => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
          this.tableDatas.forEach(ele => {
            ele.type = idToVal(ele.type, this.drdlltypeOptions)
            ele.parity = idToVal(ele.parity, this.checkOptions)
          })
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange (size) {
      this.pagesize = size;
      this.currentPage = 1;
      this.findDllDrinfo(this.path, this.currentPage, this.pagesize);
    },
    // 跳页
    handleCurrentChange (currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findDllDrinfo(this.path, this.currentPage, this.pagesize);
      }
    },
    // 上一页
    prev () {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findDllDrinfo(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 下一页
    next () {
      const maxPage = Math.ceil(this.rowCount / this.pagesize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findDllDrinfo(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 增加
    handelAdd () {
      var formData = new FormData();
      formData.append("drname", this.deviceName);
      formData.append("drllid", this.drdll);
      formData.append("type", this.drdlltype);
      formData.append("ipport", this.deviceIPPort);
      formData.append("com", this.COM);
      formData.append("baudRate", this.bandRate);
      formData.append("dataBits", this.dataBit);
      formData.append("stopBits", this.stopBit);
      formData.append("parity", this.check);
      formData.append("cycle", this.collectionTime);
      formData.append("macID", this.MacID);
      addDllDrinfo(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("新增成功!");
            this.findDllDrinfo(this.path, this.currentPage, this.pagesize);
          }
        })
        .catch(console.log);
    },
    // 编辑
    handelEdit (index, row) {
      this.editData = row;
      this.deviceName = row.drname;
      this.drdll = row.drllname;
      this.drdlltype = row.type
      this.deviceIPPort = row.ipport
      this.COM = row.com
      this.bandRate = row.baudRate
      this.dataBit = row.dataBits
      this.stopBit = row.stopBits
      this.check = idToVal(row.parity, this.checkOptions)
      this.collectionTime = row.cycle
      this.MacID = row.macID;
    },
    // 确认修改
    handelUpdate () {
      var formData = new FormData();
      formData.append("drid", this.editData.drid);
      formData.append("drname", this.deviceName);
      formData.append("drllid", valToId(this.drdll, this.drdllOptions));
      formData.append("type", valToId(this.drdlltype, this.drdlltypeOptions));
      formData.append("ipport", nullToStr(this.deviceIPPort));
      formData.append("com", nullToStr(this.COM));
      formData.append("baudRate", valToId(this.bandRate, this.bandRateOptions));
      formData.append("dataBits", valToId(this.dataBit, this.dataBitOptions));
      formData.append("stopBits", valToId(this.stopBit, this.stopBitOptions));
      formData.append("parity", valToId(this.check, this.checkOptions));
      formData.append("cycle", nullToStr(this.collectionTime));
      formData.append("macID", this.MacID);
      updateDllDrinfo(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.findDllDrinfo(this.path, this.currentPage, this.pagesize);
          }
        })
        .catch(console.log);
    },

    // 删除
    handelDelete (index, row) {
      let tip = confirm("确定要删除吗？");
      if (tip) {
        deleteDllDrinfo(this.path, row.drid)
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.findDllDrinfo(this.path, this.currentPage, this.pagesize);
            }
          })
          .catch(console.log);
      }
    },
    // 选择楼栋
    selectQsTags (val) {
      this.drdlls = val;
    },
    // 批量删除
    handelDeletes () {
      let tip = confirm("确定要批量删除吗？");
      if (tip) {
        let ids = [];
        this.drdlls.forEach(ele => {
          ids.push(ele.drid);
        });
        deleteDllDrinfo(this.path, ids.join(","))
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("批量删除成功!");
              this.findDllDrinfo(this.path, this.currentPage, this.pagesize);
            }
          })
          .catch(console.log);
      }
    },
    // 导入
    uploadFile (file) {
      var formData = new FormData();
      formData.append("file", file);
      const loading = this.$loading({
        lock: true,
        text: "数据正在导入数据库，请稍等",
        spinner: "el-icon-loading",
        background: "rgba(0, 0, 0, 0.7)"
      });
      inputExcel(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            loading.close();
            this.$message.success("成功导入数据库!");
            this.reload();
          }
        })
        .catch(()=>loading.close());
    },
    // 导出
    exportQsTag () {
      outputExcel(this.path)
        .then(res => {
          let date = formatDate(new Date());
          const filename = "设备采集数据信息" + date + ".xls";
          exportExcel(res, filename);
        })
        .catch(console.log);
    }
  }
};
</script>

<style lang="scss" scoped>
.app-container {
  .el-col {
    border-radius: 4px;
  }
  .bg-purple {
    position: relative;
    padding: 20px;
    background: var(--theme-color);

    .left-title {
      margin-bottom: 20px;
      font-size: 18px;
      font-weight: bold;
    }

    .left-btn {
      position: absolute;
      top: 10px;
      right: 10px;
    }

    .buiding-info-title {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
      p {
        margin-right: 20px;
        font-size: 18px;
        font-weight: bold;
      }
      .upload {
        margin: 0 10px;
      }
    }
    .el-pagination {
      display: flex;
      justify-content: center;
      margin-top: 10px;
      text-align: center;
      align-items: center;
      .btn {
        margin-top: 10px;
        padding: 2px 5px;
      }
    }
  }
  .form {
    .el-input {
      width: 200px;
    }
    .el-textarea {
      width: 200px;
    }
  }

  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>
