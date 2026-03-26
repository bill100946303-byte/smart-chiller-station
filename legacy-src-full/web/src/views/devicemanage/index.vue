<template>
  <div class="app-container device-manage-container">
    <el-row :gutter="10">
      <el-col :md="24" :lg="6" :xl="6">
        <div class="grid-content bg-purple">
          <p>已配置设备类型</p>
          <el-tree
            class="tree"
            :data="deviceTypeTree"
            :props="defaultProps"
            @node-click="selectDeviceType"
          />
        </div>
      </el-col>
      <el-col :md="24" :lg="18" :xl="18">
        <div class="grid-content bg-purple-light">
          <div class="device-list">
            <div class="btn-left">
              <p>设备列表</p>
              <el-button type="primary" @click="handelAdd">增加</el-button>
              <ExcelUpload class="upload" :btnName="btnName2" @excelUpload="uploadFile2"/>
              <el-button type="primary" @click="output">设备导出</el-button>
              <!--<ExcelUpload class="upload" :btnName="btnName" @excelUpload="uploadFile"/>-->
              <el-button type="danger" @click="handelDeletes">批量删除</el-button>
            </div>
            <div class="btn-right">
              <p>设备类型：{{ deviceTypeName }}</p>
            </div>
          </div>
          <el-table
            :data="tableDatas"
            border
            style="width: 100%"
            max-height="650"
            @selection-change="selectDevices"
          >
            <el-table-column type="selection" width="55"></el-table-column>
            <af-table-column prop="drid" label="ID" />
            <af-table-column prop="drname" label="设备名称" />
            <af-table-column prop="drcode" label="设备编码" />
            <af-table-column label="楼栋名称" prop="buildname"/>
            <af-table-column prop="drtypename" label="设备类型" />
            <af-table-column prop="spid" label="视频编号" />
            <af-table-column prop="mdcode" label="统一编号" />
            <af-table-column prop="drManufactureFactory" label="生产厂家" />
            <af-table-column prop="drUseState" label="使用情况" />
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
    <el-dialog
      title="新增设备"
      :visible.sync="addDialogFormVisible"
      width="60%"
    >
      <el-form :model="ruleForm" :rules="rules" ref="ruleForm">
        <div class="flex">
          <el-form-item label="设备名称" prop="input1">
            <el-input v-model="ruleForm.input1" placeholder="请输入设备名称" />
          </el-form-item>
          <el-form-item label="楼栋物" prop="input2">
            <el-select
                v-model="ruleForm.input2"
                clearable
                placeholder="请选择楼栋物"
            >
              <el-option
                  v-for="item in buildOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
              ></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="类型用途">
            <el-select v-model="input13" clearable placeholder="请选择类型用途">
              <el-option
                v-for="item in TypeOptions"
                :key="item.value"
                :label="item.value"
                :value="item.id"
              ></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="视频编号">
            <el-input
              v-model="input3"
              placeholder="请输入视频编号"
              auto-complete="off"
            />
          </el-form-item>
          <el-form-item label="统一编号">
            <el-input
              v-model="input4"
              placeholder="请输入统一编号"
              auto-complete="off"
            />
          </el-form-item>
        </div>
        <div class="flex">
          <el-form-item label="生产厂家">
            <el-input
              v-model="input5"
              placeholder="请输入生产厂家"
              auto-complete="off"
            />
          </el-form-item>
          <el-form-item label="设备型号">
            <el-input v-model="input7" placeholder="请输入设备型号" />
          </el-form-item>
          <el-form-item label="联系方式">
            <el-input v-model="input8" placeholder="请输入联系方式" />
          </el-form-item>
        </div>
        <div class="flex">
          <el-form-item label="安装厂家">
            <el-input v-model="input10" placeholder="请输入安装厂家" />
          </el-form-item>
          <el-form-item label="安装时间">
            <el-date-picker
              v-model="input9"
              type="date"
              placeholder="请选择日期"
            />
          </el-form-item>
          <el-form-item label="联系方式">
            <el-input v-model="input11" placeholder="请输入联系方式" />
          </el-form-item>
        </div>
        <div class="flex">
          <el-form-item label="使用情况">
            <el-select v-model="input6" clearable placeholder="请选择使用情况">
              <el-option
                v-for="item in useOptions"
                :key="item.value"
                :label="item.value"
                :value="item.id"
              ></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="textarea" label="用途说明">
            <el-input
              v-model="input12"
              type="textarea"
              :rows="3"
              placeholder="请输入用途说明"
            />
          </el-form-item>
        </div>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="addDialogFormVisible = false">取 消</el-button>
        <el-button type="primary" @click="addTrue">确 定</el-button>
      </div>
    </el-dialog>
    <el-dialog
      title="修改设备"
      :visible.sync="updateDialogFormVisible"
      width="60%"
    >
      <el-form ref="ruleForm">
        <div class="flex">
          <el-form-item label="设备名称">
            <el-input v-model="editData.drname" placeholder="请输入设备名称" />
          </el-form-item>
          <el-form-item label="楼栋物">
            <el-select
                v-model="editData.buildname"
                clearable
                placeholder="请选择楼栋物"
            >
              <el-option
                  v-for="item in buildOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
              ></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="类型用途">
            <el-select
              v-model="editData.typeYT"
              clearable
              placeholder="请选择类型用途"
            >
              <el-option
                v-for="item in TypeOptions"
                :key="item.value"
                :label="item.value"
                :value="item.id"
              ></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="视频编号">
            <el-input v-model="editData.spid" placeholder="请输入视频编号" />
          </el-form-item>
          <el-form-item label="统一编号">
            <el-input v-model="editData.mdcode" placeholder="请输入统一编号" />
          </el-form-item>
        </div>
        <div class="flex">
          <el-form-item label="生产厂家">
            <el-input
              v-model="editData.drManufactureFactory"
              placeholder="请输入生产厂家"
            />
          </el-form-item>
          <el-form-item label="设备型号">
            <el-input
              v-model="editData.drManufactureStyle"
              placeholder="请输入设备型号"
            />
          </el-form-item>
          <el-form-item label="联系方式">
            <el-input
              v-model="editData.drFactoryphone"
              placeholder="请输入联系方式"
            />
          </el-form-item>
        </div>
        <div class="flex">
          <el-form-item label="安装厂家">
            <el-input
              v-model="editData.drInstallFactory"
              placeholder="请输入安装厂家"
            />
          </el-form-item>
          <el-form-item label="安装时间">
            <el-date-picker
              v-model="editData.drInstallTime"
              type="date"
              placeholder="请选择日期"
            />
          </el-form-item>
          <el-form-item label="联系方式">
            <el-input
              v-model="editData.drInstallPhone"
              placeholder="请输入联系方式"
            />
          </el-form-item>
        </div>
        <div class="flex">
          <el-form-item label="使用情况">
            <el-select
              v-model="editData.drUseState"
              clearable
              placeholder="请选择使用情况"
            >
              <el-option
                v-for="item in useOptions"
                :key="item.value"
                :label="item.value"
                :value="item.id"
              ></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="textarea" label="用途说明">
            <el-input
              v-model="editData.drUseExplain"
              type="textarea"
              :rows="3"
              placeholder="请输入用途说明"
            />
          </el-form-item>
        </div>
        <div class="flex">
          <el-form-item class="upload" label="设备图片">
            <img v-if="editData.iconpath" :src="baseUrl + editData.iconpath" class="project-img" />
            <MyImgUpload class="upload-logo-img" @upload="uploadImg" />
          </el-form-item>
        </div>
      </el-form>
      <div slot="footer" class="dialog-footer update-device">
        <el-button type="primary" @click="addDeviceInUpdate">新 增</el-button>
        <div>
          <el-button @click="updateDialogFormVisible = false">取 消</el-button>
          <el-button type="primary" @click="updateTrue">确 定</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import ExcelUpload from "@/components/MyImgUpload/ExcelUpload";
import {
  addDevice,
  deleteDevice,
  findBuild,
  findDevice,
  inputExcel,
  outputExcel,
  updateDevice,
  inputEquipmentList
} from "@/api/contentsetting/devicemanage";
import {findDeviceType} from "@/api/contentsetting/baseinformation/typemodel";
import {exportExcel} from "@/utils/excel";
import {formatDate} from "@/utils/index";
import {idToVal, nullToStr, valToId} from "@/utils/selectexchange";
import MyImgUpload from "@/components/MyImgUpload";

export default {
  inject: ["reload"],
  name: "DeviceManage",
  components: {
    ExcelUpload,
    MyImgUpload
  },
  computed: {
    ...mapGetters(["path"])
  },
  data () {
    return {
      baseUrl: "",
      ruleForm: {
        input1: "", // 设备名
        input2: "" // 楼栋名
      },
      rules: {
        input1: [
          { required: true, message: "设备名称不能为空", trigger: "blur" }
        ],
        input2: [{required: true, message: "楼栋名不能为空", trigger: "blur"}]
      },
      btnName: "设备导入",
      btnName2: "导入设备清单",
      deviceTypeId: "",
      deviceTypeName: "",
      deviceNums: [],
      iconpath: "",//设备图片
      input3: "",
      input4: "",
      input5: "",
      input6: "",
      input7: "",
      input8: "",
      input9: "",
      input10: "",
      input11: "",
      input12: "",
      input13: "",
      currentPage: 1,
      rowCount: 0,
      pagesize: 10,
      addDialogFormVisible: false,
      updateDialogFormVisible: false,
      buildOptions: [], // 所有楼栋物名
      useOptions: [
        {
          id: 0,
          value: "未使用"
        },
        {
          id: 1,
          value: "使用"
        }
      ],
      TypeOptions: [
        {
          id: 1,
          value: "门禁刷卡"
        }
      ],
      tableDatas: [],
      editData: {},
      deviceTypeTree: [], // 设备类型树图数据
      defaultProps: {
        children: "drtypeinfoList",
        label: "drtypename"
      }
    };
  },
  created () {
    this.baseUrl = this.global.baseUrl;
    // 查询所有设备类型
    findDeviceType(this.path)
      .then(res => {
        this.deviceTypeTree = res.data;
      })
      .catch(console.log);
    // 查询所有楼栋
    findBuild(this.path)
      .then(res => {
        res.data.forEach(ele => {
          let obj = {
            id: ele.buildid,
            value: ele.buildname
          };
          this.buildOptions.push(obj);
        });
      })
      .catch(console.log);
    // 查询所有设备
    this.findAllDevice(
      this.path,
      this.currentPage,
      this.pagesize,
      this.deviceTypeId
    );
  },
  methods: {
    uploadImg(file){
      this.iconpath = file;
    },
    // 查询所有设备
    findAllDevice (path, currentPage, pageSize, id) {
      findDevice(path, currentPage, pageSize, id)
        .then(res => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
          this.tableDatas.forEach(ele => {
            ele.drUseState = idToVal(ele.drUseState, this.useOptions);
          });
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange (size) {
      this.pagesize = size;
      this.currentPage = 1;
      this.findAllDevice(
        this.path,
        this.currentPage,
        this.pagesize,
        this.deviceTypeId
      );
    },
    // 跳页
    handleCurrentChange (currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findAllDevice(
          this.path,
          this.currentPage,
          this.pagesize,
          this.deviceTypeId
        );
      }
    },
    // 上一页
    prev () {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllDevice(
            this.path,
            this.currentPage,
            this.pagesize,
            this.deviceTypeId
          );
        }
      }
    },
    // 下一页
    next () {
      const maxPage = Math.ceil(this.rowCount / this.pagesize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllDevice(
            this.path,
            this.currentPage,
            this.pagesize,
            this.deviceTypeId
          );
        }
      }
    },
    // 选择设备类型
    selectDeviceType (data) {
      if (data.drtypeinfoList.length === 0) {
        this.deviceTypeName = data.drtypename;
        this.deviceTypeId = data.drtypeid;
        // 查询设备
        this.findAllDevice(
          this.path,
          this.currentPage,
          this.pagesize,
          this.deviceTypeId
        );
      }
    },
    // 增加设备
    handelAdd () {
      if (this.deviceTypeName === "") {
        this.$message.error("增加设备前必须先选择一种设备类型！");
      } else {
        this.addDialogFormVisible = true;
      }
    },
    // 确认增加
    addTrue () {
      this.$refs.ruleForm.validate(valid => {
        if (valid) {
          var formData = new FormData();
          formData.append("drtypeid", this.deviceTypeId);
          formData.append("drname", this.ruleForm.input1);
          formData.append("buildid", this.ruleForm.input2);
          formData.append("drtypeid", this.deviceTypeId);
          formData.append("spid", this.input3);
          formData.append("mdcode", this.input4);
          formData.append("drManufactureFactory", this.input5);
          formData.append("drUseState", this.input6);
          formData.append("drManufactureStyle", this.input7);
          formData.append("drFactoryphone", this.input8);
          if (this.input9 != "") {
            formData.append("drInstallTime", this.input9);
          }
          formData.append("drInstallFactory", this.input10);
          formData.append("drInstallPhone", this.input11);
          formData.append("drUseExplain", this.input12);
          formData.append("typeYT", this.input13);
          addDevice(this.path, formData)
            .then(res => {
              if (res.status === 20000) {
                this.$message.success("新增成功!");
                this.findAllDevice(
                  this.path,
                  this.currentPage,
                  this.pagesize,
                  this.deviceTypeId
                );
                this.addDialogFormVisible = false;
              }
            })
            .catch(console.log);
        } else {
          console.log("错误提交!!");
          return false;
        }
      });
    },
    // 编辑设备
    handelEdit (index, row) {
      this.updateDialogFormVisible = true;
      this.editData = row;
      this.editData.typeYT = idToVal(this.editData.typeYT, this.TypeOptions);
    },
    // 修改设备
    updateTrue () {
      var formData = new FormData();
      formData.append("drid", this.editData.drid);
      formData.append("drname", this.editData.drname);
      formData.append(
        "buildid",
        valToId(this.editData.buildname, this.buildOptions)
      );
      formData.append("drtypeid", this.editData.drtypeid);
      formData.append("spid", nullToStr(this.editData.spid));
      formData.append("mdcode", nullToStr(this.editData.mdcode));
      formData.append(
        "drManufactureFactory",
        nullToStr(this.editData.drManufactureFactory)
      );
      formData.append(
        "drUseState",
        valToId(this.editData.drUseState, this.useOptions)
      );
      formData.append(
        "drManufactureStyle",
        nullToStr(this.editData.drManufactureStyle)
      );
      formData.append(
        "drFactoryphone",
        nullToStr(this.editData.drFactoryphone)
      );
      formData.append(
        "drInstallTime",
        nullToStr(new Date(this.editData.drInstallTime))
      );
      formData.append(
        "drInstallFactory",
        nullToStr(this.editData.drInstallFactory)
      );
      formData.append(
        "drInstallPhone",
        nullToStr(this.editData.drInstallPhone)
      );
      formData.append("drUseExplain", nullToStr(this.editData.drUseExplain));
      formData.append(
        "typeYT",
        valToId(this.editData.typeYT, this.TypeOptions)
      );
      if (this.iconpath != "") {
        formData.append("file", this.iconpath);
      }
      updateDevice(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.findAllDevice(
              this.path,
              this.currentPage,
              this.pagesize,
              this.deviceTypeId
            );
            this.updateDialogFormVisible = false;
          }
        })
        .catch(console.log);
    },
    // 在编辑中新增
    addDeviceInUpdate () {
      var formData = new FormData();
      formData.append("drname", this.editData.drname);
      formData.append(
        "buildid",
        valToId(this.editData.buildname, this.buildOptions)
      );
      formData.append("drtypeid", this.editData.drtypeid);
      formData.append("spid", nullToStr(this.editData.spid));
      formData.append("mdcode", nullToStr(this.editData.mdcode));
      formData.append(
        "drManufactureFactory",
        nullToStr(this.editData.drManufactureFactory)
      );
      formData.append(
        "drUseState",
        valToId(this.editData.drUseState, this.useOptions)
      );
      formData.append(
        "drManufactureStyle",
        nullToStr(this.editData.drManufactureStyle)
      );
      formData.append(
        "drFactoryphone",
        nullToStr(this.editData.drFactoryphone)
      );
      formData.append(
        "drInstallTime",
        nullToStr(new Date(this.editData.drInstallTime))
      );
      formData.append(
        "drInstallFactory",
        nullToStr(this.editData.drInstallFactory)
      );
      formData.append(
        "drInstallPhone",
        nullToStr(this.editData.drInstallPhone)
      );
      formData.append("drUseExplain", nullToStr(this.editData.drUseExplain));
      formData.append(
        "typeYT",
        valToId(this.editData.typeYT, this.TypeOptions)
      );
      addDevice(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("新增成功!");
            this.findAllDevice(
              this.path,
              this.currentPage,
              this.pagesize,
              this.deviceTypeId
            );
            this.updateDialogFormVisible = false;
          }
        })
        .catch(console.log);
    },

    // 删除设备
    handelDelete (index, row) {
      let tip = confirm("确定要删除该设备吗？");
      if (tip) {
        deleteDevice(this.path, row.drid)
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.findAllDevice(
                this.path,
                this.currentPage,
                this.pagesize,
                this.deviceTypeId
              );
            }
          })
          .catch(console.log);
      }
    },
    // 选择设备
    selectDevices (val) {
      this.deviceNums = val;
    },
    // 批量删除设备
    handelDeletes () {
      let tip = confirm("确定要批量删除设备吗？");
      if (tip) {
        let ids = [];
        this.deviceNums.forEach(ele => {
          ids.push(ele.drid);
        });
        deleteDevice(this.path, ids.join(","))
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("批量删除成功!");
              this.findAllDevice(
                this.path,
                this.currentPage,
                this.pagesize,
                this.deviceTypeId
              );
            }
          })
          .catch(console.log);
      }
    },
    // 导入设备清单
    uploadFile2(file){
      console.log('设备',file)
      var formData = new FormData();
      formData.append("file", file);
      const loading = this.$loading({
        lock: true,
        text: "数据正在导入数据库，请稍等",
        spinner: "el-icon-loading",
        background: "rgba(0, 0, 0, 0.7)"
      });
      inputEquipmentList(this.path, formData)
          .then(res => {
            if (res.status === 20000) {
              loading.close();
              this.$message.success("成功导入数据库!");
              this.reload();
            }
          })
          .catch(()=>loading.close());
    },
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
    // 导出设备
    output () {
      let ids = [];
      this.deviceNums.forEach(ele => {
        ids.push(ele.drid);
      });
      outputExcel(this.path, ids.join(","))
        .then(res => {
          let date = formatDate(new Date());
          const filename = "设备管理" + date + ".xls";
          exportExcel(res, filename);
        })
        .catch(console.log);
    }
  }
};
</script>

<style lang="scss" scoped>
.device-manage-container {
  .el-form {
    .flex {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      padding: 20px;
      border-bottom: 1px solid #d3d0d0;
      .el-form-item {
        display: flex;
        align-items: center;
        width: 25%;
        min-width: 300px;
        .el-input {
          width: 150px;
        }
        .el-select {
          width: 150px;
        }
      }
      .textarea {
        width: 50%;
        .el-textarea {
          width: 400px;
        }
      }

      .project-img {
        width: 148px;
        height: 148px;
        margin-left: 20px;
      }
      .upload-logo-img {
        margin-left: 20px;
      }
      .upload {
        width: 50%;
      }
    }
  }

  .el-col {
    border-radius: 4px;
  }
  .bg-purple-dark {
    background: #99a9bf;
  }
  .bg-purple {
    position: relative;
    padding: 20px;
    background: var(--theme-color);

    .tree {
      max-height: 700px;
      overflow-y: auto;
    }

    p {
      margin-bottom: 20px;
      font-size: 18px;
      font-weight: bold;
    }
  }
  .bg-purple-light {
    padding: 20px;
    background: var(--theme-color);
    .device-list {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      .btn-left {
        display: flex;
        //justify-content: space-between;
        width: 600px;
        p {
          font-size: 18px;
          font-weight: bold;
          line-height: 30px;
        }
        .el-button {
          // margin-left: 0;
          margin-left: 10px;
        }
        .upload{
          margin-left: 10px;
        }
      }
      .btn-right {
        display: flex;
        align-items: center;
      }
    }
    .el-pagination {
      display: flex;
      justify-content: center;
      margin-top: 10px;
      text-align: center;
      .btn {
        margin-top: 10px;
        padding: 2px 5px;
      }
    }
  }
  .el-dialog {
    .dialog-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  }
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>
