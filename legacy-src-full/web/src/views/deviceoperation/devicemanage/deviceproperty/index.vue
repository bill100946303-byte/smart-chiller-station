<template>
  <div class="app-container container">
    <el-row :gutter="10">
      <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
        <div class="grid-content bg-purple-light">
          <p class="title">信息记录</p>
          <div class="operation">
            <div class="margin">
              <span>物资编号:</span>
              <el-input v-model="mdcode" clearable></el-input>
            </div>
            <div class="btn">
              <el-button type="primary" @click="search" class="margin"
                >查询</el-button
              >
              <el-button
                type="primary"
                @click="addVisible = true"
                class="margin"
                >新增</el-button
              >
              <el-button type="danger" @click="handleDeletes" class="margin"
                >批量删除</el-button
              >
              <el-button
                type="primary"
                v-popover:popover
                @click="createQRcode"
                class="margin"
                >生成二维码</el-button
              >
              <el-button type="primary" @click="printQRcode" class="margin"
                >打印二维码</el-button
              >
            </div>
          </div>
          <el-table
            :data="tableDatas"
            style="width: 100%"
            max-height="600px"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="55" fixed />
            <af-table-column prop="drname" label="设备名" />
            <af-table-column prop="drtypename" label="类型名" />
            <af-table-column prop="drManufactureStyle" label="设备型号" />
            <af-table-column prop="drManufactureFactory" label="生产厂家" />
            <af-table-column prop="drFactoryphone" label="厂家电话" />
            <af-table-column prop="drInstallTime" label="安装时间" />
            <af-table-column prop="drInstallFactory" label="安装厂家" />
            <af-table-column prop="drInstallPhone" label="维护电话" />
            <af-table-column prop="drUseState" label="状态" />
            <el-table-column label="操作" width="180px">
              <template slot-scope="scope">
                <el-button
                  size="mini"
                  type="success"
                  @click="handleEdit(scope.$index, scope.row)"
                  >编辑</el-button
                >
                <el-button
                  size="mini"
                  type="danger"
                  @click="handleDelete(scope.$index, scope.row)"
                  >删除</el-button
                >
              </template>
            </el-table-column>
          </el-table>
          <div class="el-pagination">
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
          </div>
          <el-popover
            ref="popover"
            placement="bottom"
            width="auto"
            trigger="click"
          >
            <div id="qrcode" ref="qrcode"></div>
          </el-popover>
          <el-dialog
            title="修改设备资产"
            :visible.sync="updateVisible"
            width="55%"
          >
            <el-form label-position="left" label-width="80px">
              <el-form-item label="设备名">
                <el-input
                  v-model="editData.drname"
                  readonly
                  type="text"
                  clearable
                />
              </el-form-item>
              <el-form-item label="隶属楼栋">
                <el-select v-model="editData.buildname" disabled>
                  <el-option
                      v-for="item in buildingOptions"
                      :key="item.value"
                      :label="item.buildname"
                      :value="item.buildid"
                  ></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="设备类型">
                <el-select v-model="editData.drtypeid" disabled>
                  <el-option
                    :label="editData.drtypename"
                    :value="editData.drtypeid"
                    style="height: auto"
                  >
                    <el-tree
                      :data="deviceTypeData"
                      node-key="drtypeid"
                      ref="tree"
                      highlight-current
                      :props="defaultProps"
                      @node-click="handleCheck"
                    ></el-tree>
                  </el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="设备型号">
                <el-input
                  v-model="editData.drManufactureStyle"
                  type="text"
                  clearable
                />
              </el-form-item>
              <el-form-item label="生产厂家">
                <el-input
                  v-model="editData.drManufactureFactory"
                  type="text"
                  clearable
                />
              </el-form-item>
              <el-form-item label="联系方式">
                <el-input
                  v-model="editData.drFactoryphone"
                  type="text"
                  clearable
                />
              </el-form-item>
              <el-form-item label="安装时间">
                <el-date-picker
                  v-model="editData.drInstallTime"
                  type="datetime"
                  placeholder="选择安装时间"
                />
              </el-form-item>
              <el-form-item label="安装厂家">
                <el-input
                  v-model="editData.drInstallFactory"
                  type="text"
                  clearable
                />
              </el-form-item>
              <el-form-item label="联系方式">
                <el-input
                  v-model="editData.drInstallPhone"
                  type="text"
                  clearable
                />
              </el-form-item>
              <el-form-item label="使用情况">
                <el-select v-model="editData.drUseState" clearable>
                  <el-option
                    v-for="item in useOptions"
                    :key="item.value"
                    :label="item.value"
                    :value="item.id"
                  ></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="库房选择">
                <el-select
                  v-model="editData.storeroom"
                  clearable
                  placeholder="请选择库房"
                >
                  <el-option
                    v-for="item in storeOptions"
                    :key="item.value"
                    :label="item.roomname"
                    :value="item.id"
                  ></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="资产说明">
                <el-input
                  v-model="editData.drUseExplain"
                  type="text"
                  clearable
                />
              </el-form-item>
              <el-form-item label="说明文档">
                <el-select
                  v-model="editData.instructionsid"
                  clearable
                  placeholder="请选择说明文档"
                >
                  <el-option
                    v-for="item in docOptions"
                    :key="item.value"
                    :label="item.instructionsName"
                    :value="item.id"
                  ></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="资产编码">
                <el-input v-model="editData.mdcode" type="text" clearable />
              </el-form-item>
            </el-form>
            <span slot="footer" class="dialog-footer">
              <el-button @click="updateVisible = false">取 消</el-button>
              <el-button type="primary" @click="updateTrue">确 定</el-button>
            </span>
          </el-dialog>
          <el-dialog
            title="新增设备资产"
            :visible.sync="addVisible"
            width="55%"
          >
            <el-form label-position="left" label-width="80px">
              <el-form-item label="资产名称">
                <el-input
                  v-model="input1"
                  type="text"
                  clearable
                  placeholder="请输入资产名称"
                />
              </el-form-item>
              <el-form-item label="隶属楼栋">
                <el-select
                    v-model="input2"
                    clearable
                    placeholder="请选择隶属楼栋"
                >
                  <el-option
                      v-for="item in buildingOptions"
                      :key="item.value"
                      :label="item.buildname"
                      :value="item.buildid"
                  ></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="设备类型">
                <el-select v-model="deviceTypeId" placeholder="请选择设备类型">
                  <el-option
                    :label="deviceType"
                    :value="deviceTypeId"
                    style="height: auto"
                  >
                    <el-tree
                      :data="deviceTypeData"
                      node-key="drtypeid"
                      ref="tree"
                      highlight-current
                      :props="defaultProps"
                      @node-click="handleCheck"
                    ></el-tree>
                  </el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="设备型号">
                <el-input
                  v-model="input3"
                  type="text"
                  clearable
                  placeholder="请输入设备型号"
                />
              </el-form-item>
              <el-form-item label="生产厂家">
                <el-input
                  v-model="input4"
                  type="text"
                  clearable
                  placeholder="请输入生产厂家"
                />
              </el-form-item>
              <el-form-item label="联系方式">
                <el-input
                  v-model="input5"
                  type="text"
                  clearable
                  placeholder="请输入生产厂家联系方式"
                />
              </el-form-item>
              <el-form-item label="安装时间">
                <el-date-picker
                  v-model="input6"
                  type="datetime"
                  placeholder="选择安装时间"
                />
              </el-form-item>
              <el-form-item label="安装厂家">
                <el-input
                  v-model="input7"
                  type="text"
                  clearable
                  placeholder="请输入安装厂家"
                />
              </el-form-item>
              <el-form-item label="联系方式">
                <el-input
                  v-model="input8"
                  type="text"
                  clearable
                  placeholder="请输入安装厂家联系方式"
                />
              </el-form-item>
              <el-form-item label="使用情况">
                <el-select
                  v-model="input9"
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
              <el-form-item label="库房选择">
                <el-select v-model="input10" clearable placeholder="请选择库房">
                  <el-option
                    v-for="item in storeOptions"
                    :key="item.value"
                    :label="item.roomname"
                    :value="item.id"
                  ></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="资产说明">
                <el-input
                  v-model="input11"
                  type="text"
                  clearable
                  placeholder="请输入资产说明"
                />
              </el-form-item>
              <el-form-item label="说明文档">
                <el-select
                  v-model="input12"
                  clearable
                  placeholder="请选择说明文档"
                >
                  <el-option
                    v-for="item in docOptions"
                    :key="item.value"
                    :label="item.instructionsName"
                    :value="item.id"
                  ></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="资产编码">
                <el-input
                  v-model="input13"
                  type="text"
                  clearable
                  placeholder="请输入资产编码"
                />
              </el-form-item>
            </el-form>
            <span slot="footer" class="dialog-footer">
              <el-button @click="addVisible = false">取 消</el-button>
              <el-button type="primary" @click="handleAdd">确 定</el-button>
            </span>
          </el-dialog>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import {
  findDeviceProperty,
  findBuildings,
  findDeviceType,
  findStore,
  findDoc,
  addDeviceProperty,
  updateDeviceProperty,
  deleteDeviceProperty
} from "@/api/usersetting/deviceoperation/deviceproperty";
import { formatDate } from "@/utils/index";
import { exportExcel } from "@/utils/excel";
import { valToId, idToVal } from "@/utils/selectexchange";
import QRCode from "qrcodejs2";
export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path", "project"])
  },
  components: { QRCode },
  data () {
    return {
      currentPage: 1, // 初始页
      pagesize: 10,
      rowCount: 0,
      tableDatas: [], // 表格数据
      editData: {}, // 修改单行数据
      mdcode: "", // 物资编号
      addVisible: false, // 控制新增弹窗
      updateVisible: false, // 控制修改弹窗
      input1: "", // 设备名
      input2: "", // 隶属楼栋
      input3: "", // 设备型号
      input4: "", // 生产厂家
      input5: "", // 联系方式
      input6: "", // 安装时间
      input7: "", // 安装厂家
      input8: "", // 联系方式
      input9: "", // 使用情况
      input10: "", // 库房选择
      input11: "", // 资产说明
      input12: "", // 说明文档
      input13: "", // 资产编码
      property: "", // 勾选的资产
      buildingOptions: [], // 隶属楼栋选择
      useOptions: [
        {
          id: 1,
          value: "使用"
        },
        {
          id: 2,
          value: "库存"
        }
      ], // 使用情况选择
      deviceTypeData: [], // 下拉树形图数据
      deviceTypeId: "",
      deviceType: "",
      storeOptions: [], // 库房选择
      docOptions: [], // 说明文档选择
      mineStatusValue: [],
      defaultProps: {
        children: "drtypeinfoList",
        label: "drtypename"
      }
    };
  },
  created () {
    // 查询所有设备资产
    this.findDeviceProperty(
      this.path,
      this.currentPage,
      this.pagesize,
      this.mdcode
    );
    // 查询所有楼栋
    findBuildings(this.path)
      .then(res => {
        this.buildingOptions = res.data;
      })
      .catch(console.log);
    // 查询设备类型
    findDeviceType(this.path)
      .then(res => {
        this.deviceTypeData = res.data;
      })
      .catch(console.log);
    // 查询所有仓库信息
    findStore(this.path)
      .then(res => {
        this.storeOptions = res.data;
      })
      .catch(console.log);
  },
  methods: {
    // 查询设备资产
    findDeviceProperty (path, currentPage, pageSize, mdcode) {
      findDeviceProperty(path, currentPage, pageSize, mdcode)
        .then(res => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
          this.tableDatas.forEach(ele => {
            if (ele.drInstallTime != null) {
              ele.drInstallTime = formatDate(ele.drInstallTime);
            }
            ele.drUseState = idToVal(ele.drUseState, this.useOptions);
          });
        })
        .catch(console.log);
    },
    // 选择树图
    handleCheck (obj) {
      this.deviceType = obj.drtypename;
      this.deviceTypeId = obj.drtypeid;
      if (this.editData != {}) {
        this.editData.drtypeid = obj.drtypeid;
        this.editData.drtypename = obj.drtypename;
        this.editData.instructionsid = "";
      }
      if (this.deviceTypeId != "") {
        findDoc(this.path, this.deviceTypeId)
          .then(res => {
            this.docOptions = res.data;
          })
          .catch(console.log);
      }
      if (this.editData.drtypeid != "") {
        findDoc(this.path, this.editData.drtypeid)
          .then(res => {
            this.docOptions = res.data;
          })
          .catch(console.log);
      }
    },
    // 勾选
    handleSelectionChange (val) {
      this.deviceIds = val;
      this.property = val;
    },
    // 条件查询
    search () {
      this.findDeviceProperty(
        this.path,
        this.currentPage,
        this.pagesize,
        this.mdcode
      );
    },
    qrcode () {
      let mdcode = this.property[0].mdcode == null ? '' : this.property[0].mdcode;
      let reg = /[0-9]+/g;
      let projectId = parseInt(this.path);
      let name = this.path.replace(reg, "");
      let drid = this.property[0].drid;
      let drname = this.property[0].drname;
      let drtypename = this.property[0].drtypename;
      let qrcode = new QRCode("qrcode", {
        width: 232, // 设置宽度
        height: 232, // 设置高度
        text: `设备编号: ${mdcode},项目ID: ${projectId},项目名: ${name},设备ID: ${drid},设备名称: ${drname},设备类型: ${drtypename}`
      });
    },
    // 生成二维码
    createQRcode () {
      if (this.property.length != 1) {
        this.$message.error("选择设备资产数量超过1或者未选择设备资产！");
      } else {
        let qrcode = document.getElementById("qrcode");
        qrcode.innerHTML = "";
        this.$nextTick(function () {
          this.qrcode();
        });
      }
    },
    // 打印二维码
    printQRcode () { },
    // 改变显示页数
    handleSizeChange (size) {
      this.pagesize = size;
      this.currentpage = 1;
      this.findDeviceProperty(
        this.path,
        this.currentPage,
        this.pagesize,
        this.mdcode
      );
    },
    // 跳页
    handleCurrentChange (currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findDeviceProperty(
          this.path,
          this.currentPage,
          this.pagesize,
          this.mdcode
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
          this.findDeviceProperty(
            this.path,
            this.currentPage,
            this.pagesize,
            this.mdcode
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
          this.findDeviceProperty(
            this.path,
            this.currentPage,
            this.pagesize,
            this.mdcode
          );
        }
      }
    },
    // 新增
    handleAdd () {
      var formData = new FormData();
      formData.append("drname", this.input1);
      formData.append("buildid", this.input2);
      formData.append("drtypeid", this.deviceTypeId);
      formData.append("drManufactureStyle", this.input3);
      formData.append("drManufactureFactory", this.input4);
      formData.append("drFactoryphone", this.input5);
      if (this.input7 != "") {
        formData.append("drInstallTime", this.input6);
      }
      formData.append("drInstallFactory", this.input7);
      formData.append("drInstallPhone", this.input8);
      formData.append("drUseState", this.input9);
      formData.append("storeroom", this.input10);
      formData.append("drUseExplain", this.input11);
      formData.append("instructionsid", this.input12);
      formData.append("mdcode", this.input13);
      addDeviceProperty(this.path, formData)
        .then(res => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("新增成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 修改
    handleEdit (index, row) {
      this.updateVisible = true;
      this.editData = row;
      findDoc(this.path, this.editData.drtypeid)
        .then(res => {
          this.docOptions = res.data;
        })
        .catch(console.log);
    },
    // 确认修改
    updateTrue () {
      var formData = new FormData();
      formData.append("drid", this.editData.drid);
      formData.append("drname", this.editData.drname);
      formData.append(
        "buildid",
        valToId(this.editData.buildname, this.buildingOptions)
      );
      formData.append("drtypeid", this.editData.drtypeid);
      formData.append("drManufactureStyle", this.editData.drManufactureStyle);
      formData.append(
        "drManufactureFactory",
        this.editData.drManufactureFactory
      );
      formData.append("drFactoryphone", this.editData.drFactoryphone);
      if (this.editData.drInstallTime != "") {
        formData.append("drInstallTime", new Date(this.editData.drInstallTime));
      }
      formData.append("drInstallFactory", this.editData.drInstallFactory);
      formData.append("drInstallPhone", this.editData.drInstallPhone);
      formData.append(
        "drUseState",
        valToId(this.editData.drUseState, this.useOptions)
      );
      formData.append(
        "storeroom",
        valToId(this.editData.storeroom, this.storeOptions)
      );
      formData.append("drUseExplain", this.editData.drUseExplain);
      formData.append(
        "instructionsid",
        valToId(this.editData.instructionsid, this.docOptions)
      );
      formData.append("mdcode", this.editData.mdcode);
      updateDeviceProperty(this.path, formData)
        .then(res => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("修改成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 删除
    handleDelete (index, row) {
      deleteDeviceProperty(this.path, row.drid)
        .then(res => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("删除成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 批量删除
    handleDeletes () {
      let ids = [];
      this.deviceIds.forEach(ele => {
        ids.push(ele.drid);
      });
      deleteDeviceProperty(this.path, ids.join(","))
        .then(res => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("批量删除成功!");
            this.reload();
          }
        })
        .catch(console.log);
    }
  }
};
</script>

<style lang="scss" scoped>
.container {
  .el-col {
    border-radius: 4px;
  }
  .bg-purple {
    position: relative;
    padding: 20px;
    background: var(--theme-color);

    .title {
      margin-bottom: 30px;
      font-size: 18px;
      font-weight: bold;
    }
  }
  .bg-purple-light {
    padding: 20px;
    background: var(--theme-color);
    .title {
      font-size: 18px;
      font-weight: bold;
    }
    .operation {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 20px;
      .margin {
        margin-right: 10px;
        margin-bottom: 20px;
      }
      .el-select {
        width: 150px;
      }
      .el-input {
        width: 200px;
      }
      .btn {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        margin-left: 10px;
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
    .el-form {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      .el-form-item {
        margin-right: 30px;
        .el-input {
          width: 200px;
        }
      }
    }
  }
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>
