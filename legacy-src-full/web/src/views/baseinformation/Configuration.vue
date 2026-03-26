<template>
  <div class="app-container building-information-container">
    <el-row :gutter="10">
      <el-col>
        <div class="grid-content bg-purple">
          <div class="project-info-title">
            <p>环境工况配置</p>
            <el-button type="primary" @click="addDialog()">增加</el-button>
            <div class="sousuo">
              <el-input
                v-model="pagelist.monitoringSite"
                placeholder="请输入检测位点名称"
              />
              <el-button type="primary" @click="findAllProject()"
                >搜索</el-button
              >
            </div>
          </div>
          <el-table
            :data="tableDatas"
            border
            style="width: 100%"
            max-height="600"
          >
            <af-table-column prop="buildingId" label="所属楼栋" />
            <af-table-column prop="monitoringSite" label="检测位点名称" />
            <af-table-column prop="temperatureSetting" label="温度设定值" />
            <af-table-column prop="temperatureMax" label="温度最大范围值" />
            <af-table-column prop="humiditySetting" label="湿度设定值" />
            <af-table-column prop="humidityMax" label="湿度最大范围值" />
            <af-table-column prop="temperatureTagname" label="温度寄存器名称" />
            <af-table-column prop="temperatureValue" label="温度实际值" />
            <af-table-column prop="humidityTagname" label="湿度寄存器名称" />
            <af-table-column prop="humidityValue" label="湿度实际值" />
            <af-table-column prop="supplyairTagname" label="送风温度寄存器" />
            <af-table-column prop="returnairTagname" label="回风温度寄存器" />
            <af-table-column prop="supplyAirValue" label="送风温度值" />
            <af-table-column prop="returnAirValue" label="回风温度值" />
            <af-table-column prop="temperatureDeviation" label="温度偏差值" />
            <af-table-column prop="humidityDeviation" label="湿度偏差值" />
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
        </div>
        <el-dialog
          :title="dialogtitle"
          style="width: 110%"
          :visible.sync="addDialogFormVisible"
        >
          <el-form class="form" :model="objconfig" ref="form" :rules="rules">
            <el-form-item label="楼栋" prop="buildingId">
              <el-select
                v-model="objconfig.buildingId"
                clearable
                placeholder="请选择楼栋"
              >
                <el-option
                  v-for="item in Buildinglist"
                  :label="item.buildname"
                  :value="item.buildid"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="检测位点名称" prop="monitoringSite">
              <el-input v-model="objconfig.monitoringSite" />
            </el-form-item>
            <el-form-item label="湿度偏差值" prop="humidityDeviation">
              <el-input v-model.number="objconfig.humidityDeviation" />
            </el-form-item>
            <el-form-item label="湿度最大范围值" prop="humidityMax">
              <el-input v-model.number="objconfig.humidityMax" />
            </el-form-item>
            <el-form-item label="湿度设定值" prop="humiditySetting">
              <el-input v-model.number="objconfig.humiditySetting" />
            </el-form-item>
            <el-form-item label="湿度寄存器名称">
              <el-input v-model="objconfig.humidityTagname" />
            </el-form-item>

            <el-form-item label="回风温度寄存器">
              <el-input v-model="objconfig.returnairTagname" />
            </el-form-item>
            <el-form-item label="送风温度寄存器">
              <el-input v-model="objconfig.supplyairTagname" />
            </el-form-item>
            <el-form-item label="温度偏差值" prop="temperatureDeviation">
              <el-input v-model.number="objconfig.temperatureDeviation" />
            </el-form-item>
            <el-form-item label="温度最大范围值" prop="temperatureMax">
              <el-input v-model.number="objconfig.temperatureMax" />
            </el-form-item>
            <el-form-item label="温度设定值" prop="temperatureSetting">
              <el-input v-model.number="objconfig.temperatureSetting" />
            </el-form-item>
            <el-form-item label="温度寄存器名称">
              <el-input v-model="objconfig.temperatureTagname" />
            </el-form-item>
          </el-form>
          <div slot="footer" class="dialog-footer">
            <el-button @click="addDialogFormVisible = false">取 消</el-button>
            <el-button type="primary" @click="handelAdd">确 定</el-button>
          </div>
        </el-dialog>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import {
  findProject,
  addProject,
  updateProject,
  deleteProject,
} from "@/api/contentsetting/baseinformation/projectinformation";
import {
  condition,
  buildinfoAll,
  addsave,
  setvalue,
  deletecem,
} from "@/api/front/environment";
import { valToId, idToVal } from "@/utils/selectexchange";
import { formatDay } from "@/utils/index";

export default {
  inject: ["reload"],
  name: "ProjectInformation",
  components: {},
  computed: {
    ...mapGetters(["path", "project"]),
  },
  data() {
    var validatePass1 = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("请输入湿度偏差值"));
      } else if (!Number.isInteger(value)) {
        callback(new Error("请输入数字值!"));
      } else {
        callback();
      }
    };
    var validatePass2 = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("请输入湿度最大范围值"));
      } else if (!Number.isInteger(value)) {
        callback(new Error("请输入数字值!"));
      } else {
        callback();
      }
    };
    var validatePass3 = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("请输入湿度设定值"));
      } else if (!Number.isInteger(value)) {
        callback(new Error("请输入数字值!"));
      } else {
        callback();
      }
    };
    var validatePass4 = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("请输入温度偏差值"));
      } else if (!Number.isInteger(value)) {
        callback(new Error("请输入数字值!"));
      } else {
        callback();
      }
    };
    var validatePass5 = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("请输入温度最大范围值"));
      } else if (!Number.isInteger(value)) {
        callback(new Error("请输入数字值!"));
      } else {
        callback();
      }
    };
    var validatePass6 = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("请输入温度设定值"));
      } else if (!Number.isInteger(value)) {
        callback(new Error("请输入数字值!"));
      } else {
        callback();
      }
    };
    return {
      baseUrl: "",
      dialogtitle: "",

      addDialogFormVisible: false, // 控制项目新增页面弹窗
      updateDialogFormVisible: false, // 控制项目修改页面弹窗
      currentPage: 1, // 初始页
      pagesize: 10,
      rowCount: 0,
      objconfig: {
        id: "",
        buildingId: "", //所属楼栋
        monitoringSite: "", //检测位点名称
        temperatureSetting: "", //温度设定值
        temperatureMax: "", //温度最大范围值
        humiditySetting: "", //湿度设定值
        humidityMax: "", //湿度最大范围值
        temperatureTagname: "", //温度寄存器名称
        humidityTagname: "", //湿度寄存器名称
        supplyairTagname: "", //送风温度寄存器
        returnairTagname: "", //回风温度寄存器
        temperatureDeviation: "", //温度偏差值
        humidityDeviation: "", //湿度偏差值
      },
      rules: {
        buildingId: [
          { required: true, message: "请选择楼栋", trigger: "blur" },
        ],
        monitoringSite: [
          { required: true, message: "请输入检测位点名称", trigger: "blur" },
        ],
        humidityDeviation: [{ validator: validatePass1, trigger: "blur" }],
        humidityMax: [{ validator: validatePass2, trigger: "blur" }],
        humiditySetting: [{ validator: validatePass3, trigger: "blur" }],
        temperatureDeviation: [{ validator: validatePass4, trigger: "blur" }],
        temperatureMax: [{ validator: validatePass5, trigger: "blur" }],
        temperatureSetting: [{ validator: validatePass6, trigger: "blur" }],
      },
      pagelist: {
        monitoringSite: "", //检测位点名称
      },
      editeData: {},
      tableDatas: [],
      Buildinglist: [],
    };
  },
  created() {
    this.baseUrl = this.global.baseUrl;
    // 查询所有项目信息
    this.findAllProject();
    this.chaxunloudong();
  },
  methods: {
    addDialog() {
      this.addDialogFormVisible = true;
      this.dialogtitle = "增加环境工况";
    },
    chaxunloudong() {
      buildinfoAll(this.path).then((res) => {
        console.log(res, "11");
        this.Buildinglist = res.data;
        console.log(this.Buildinglist);
      });
    },

    // 查询所有项目信息
    findAllProject() {
      condition(this.path, "", "", this.pagelist.monitoringSite)
        .then((res) => {
          this.tableDatas = res.data;
        })
        .catch(console.log);
    },

    // 增加
    handelAdd() {
      this.$refs.form.validate((valid) => {
        if (valid) {
          if (this.objconfig.id != "") {
            // 修改
            setvalue(this.path, this.objconfig).then((res) => {
              if (res.status == 20000) {
                // console.log(res, "修改");
                this.$message.success("修改成功");
                this.addDialogFormVisible = false;
                this.findAllProject();
              }
            });
          } else {
            // 增加
            addsave(this.path, this.objconfig)
              .then((res) => {
                // console.log(res, "tiajia");
                if (res.status == 20000) {
                  // console.log(res, "增加");
                  this.$message.success("新增成功");
                  this.addDialogFormVisible = false;
                  this.findAllProject();
                }
              })
              .catch(console.log);
          }
        } else {
          console.log("验证失败");
        }
      });
    },
    // 编辑
    handelEdit(index, row) {
      console.log(this.objconfig.id);
      this.addDialogFormVisible = true;
      this.dialogtitle = "修改环境工况";
      this.objconfig = JSON.parse(JSON.stringify(row));
    },

    // 删除
    handelDelete(index, row) {
      console.log(row.id);
      let tip = confirm("确定要删除该项目的信息吗？");
      if (tip === true) {
        deletecem(this.path, row.id)
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.reload();
            }
          })
          .catch(console.log);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.building-information-container {
  .el-col {
    border-radius: 4px;
  }
  .bg-purple {
    position: relative;
    padding: 20px;
    background: var(--theme-color);

    .project-info-title {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
      p {
        margin-right: 20px;
        font-size: 18px;
        font-weight: bold;
      }
      .sousuo {
        // width: 200px;
        // height: 50px;
        margin-left: 30px;
        display: flex;
        .el-button {
          margin-left: 20px;
        }
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

  .el-dialog {
    .form {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      .el-input {
        width: 200px;
      }
      .el-form-item {
        width: 33%;
        .project-img {
          width: 148px;
          height: 148px;
        }
        .upload-logo-img {
          margin-left: 80px;
        }
        .upload-project-img {
          margin-left: 67px;
        }
      }
      .upload {
        width: 50%;
      }
    }
  }

  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>
