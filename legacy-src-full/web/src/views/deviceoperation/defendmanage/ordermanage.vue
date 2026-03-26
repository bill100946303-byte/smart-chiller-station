<template>
  <div class="app-container container">
    <el-row :gutter="10">
      <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
        <div class="grid-content bg-purple-light">
          <div class="btn">
            <p class="title">工单信息</p>
            <el-button type="primary" @click="addVisible = true"
              >新增</el-button
            >
            <el-button type="danger" @click="handleDeletes">批量删除</el-button>
            <el-button type="info" icon="el-icon-warning" @click="finish(1)"
              >待处理工单</el-button
            >
            <el-button type="warning" icon="el-icon-time" @click="finish(2)"
              >处理中工单</el-button
            >
            <el-button type="success" icon="el-icon-success" @click="finish(3)"
              >已完成工单</el-button
            >
            <el-button type="primary" @click="exportOrder">导出工单</el-button>
          </div>
          <el-table
            :data="tableDatas"
            border
            style="width: 100%"
            max-height="600px"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" fixed width="55" />
            <af-table-column prop="drtypename" label="设备类型" />
            <af-table-column prop="drname" label="设备" />
            <af-table-column prop="worktime" label="派单时间" />
            <af-table-column prop="workuser" label="派单人" />
            <af-table-column prop="worklevel" label="工单级别" />
            <af-table-column prop="executeuser" label="接单人" />
            <af-table-column prop="executetime" label="工单处理时间" />
            <af-table-column prop="finishtime" label="工单完成时间" />
            <af-table-column prop="state" label="工单状态" />
            <af-table-column prop="workexplain" label="工单描述" />
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
                :page-size="pageSize"
                layout="total, sizes, jumper"
                :total="rowCount"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
              />
            </div>
          </div>
        </div>
        <el-dialog title="新增工单信息" :visible.sync="addVisible" width="30%">
          <el-form label-position="left" label-width="80px">
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
            <el-form-item label="设备">
              <el-select v-model="deviceName" placeholder="请选择设备">
                <el-option
                  v-for="item in deviceOptions"
                  :key="item.value"
                  :label="item.drname"
                  :value="item.drid"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="派单时间">
              <el-date-picker
                v-model="dispatchTime"
                type="datetime"
                placeholder="请选择派单时间"
              />
            </el-form-item>
            <el-form-item label="派单人">
              <el-input v-model="dispatchMan" type="text" readonly />
            </el-form-item>
            <el-form-item label="工单级别">
              <el-select v-model="orderLevel" placeholder="请选择工单状态">
                <el-option
                  v-for="item in orderLevelOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="接单人">
              <el-select v-model="acceptMan" placeholder="请选择接单人">
                <el-option
                  v-for="item in acceptManOptions"
                  :key="item.value"
                  :label="item.username"
                  :value="item.username"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="工单描述">
              <el-input
                v-model="orderInfo"
                type="textarea"
                :rows="4"
                placeholder="请输入工单描述"
              />
            </el-form-item>
          </el-form>
          <span slot="footer" class="dialog-footer">
            <el-button @click="addVisible = false">取 消</el-button>
            <el-button type="primary" @click="handleAdd">确 定</el-button>
          </span>
        </el-dialog>
        <el-dialog
          title="修改工单信息"
          :visible.sync="updateVisible"
          width="30%"
        >
          <el-form label-position="left" label-width="80px">
            <el-form-item label="设备类型">
              <el-select
                v-model="editData.drtypeid"
                placeholder="请选择设备类型"
              >
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
            <el-form-item label="设备">
              <el-select v-model="editData.drname" placeholder="请选择设备">
                <el-option
                  v-for="item in deviceOptions"
                  :key="item.value"
                  :label="item.drname"
                  :value="item.drid"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="派单时间">
              <el-date-picker
                v-model="editData.worktime"
                type="datetime"
                placeholder="请选择派单时间"
              />
            </el-form-item>
            <el-form-item label="派单人">
              <el-input v-model="editData.workuser" type="text" readonly />
            </el-form-item>
            <el-form-item label="工单级别">
              <el-select
                v-model="editData.worklevel"
                placeholder="请选择工单级别"
              >
                <el-option
                  v-for="item in orderLevelOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="接单人">
              <el-select
                v-model="editData.executeuser"
                placeholder="请选择接单人"
              >
                <el-option
                  v-for="item in acceptManOptions"
                  :key="item.value"
                  :label="item.username"
                  :value="item.username"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="工单处理时间">
              <el-date-picker
                v-model="editData.executetime"
                type="datetime"
                placeholder="请选择工单处理时间"
              />
            </el-form-item>
            <el-form-item label="工单完成时间">
              <el-date-picker
                v-model="editData.finishtime"
                type="datetime"
                placeholder="请选择工单完成时间"
              />
            </el-form-item>
            <el-form-item label="工单状态">
              <el-select v-model="editData.state" placeholder="请选择工单状态">
                <el-option
                  v-for="item in orderStatusOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="工单描述">
              <el-input
                v-model="editData.workexplain"
                type="textarea"
                :rows="4"
                placeholder="请输入工单描述"
              />
            </el-form-item>
          </el-form>
          <span slot="footer" class="dialog-footer">
            <el-button @click="updateVisible = false">取 消</el-button>
            <el-button type="primary" @click="updateTrue">确 定</el-button>
          </span>
        </el-dialog>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import {
  findDeviceType,
  findDevice,
  findAcceptMan,
  findOrder,
  addOrder,
  updateOrder,
  deleteOrder
} from "@/api/usersetting/deviceoperation/ordermanage";
import { formatDate } from "@/utils/index";
import { valToId, idToVal } from "@/utils/selectexchange";

export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path", "name"])
  },
  data () {
    return {
      currentPage: 1, // 初始页
      pageSize: 10,
      rowCount: 0,
      deviceTypeId: "", // 选择的设备类型id
      deviceType: "", // 选择的设备类型
      deviceName: "", // 选择的设备
      dispatchTime: "", // 派单时间
      dispatchMan: "", // 派单人
      orderLevel: "", // 工单级别
      acceptMan: "", // 接单人
      dispatchTime: "", // 工单处理时间
      finishTime: "", // 工单完成时间
      orderStatus: "", // 工单状态
      orderInfo: "", // 工单描述
      deviceTypeData: [], // 设备类型的树形菜单
      deviceOptions: [], // 设备选项
      acceptManOptions: [], // 派单人选项
      orderLevelOptions: [
        {
          id: 1,
          value: "紧急"
        },
        {
          id: 2,
          value: "中等"
        },
        {
          id: 3,
          value: "一般"
        }
      ], // 工单级别选项
      orderStatusOptions: [
        {
          id: 1,
          value: "待处理"
        },
        {
          id: 2,
          value: "处理中"
        },
        {
          id: 3,
          value: "已完成"
        }
      ], // 工单状态选择
      tableDatas: [], // 表格数据
      editData: {}, // 修改单行数据
      addVisible: false, // 控制新增弹窗
      updateVisible: false, // 控制修改弹窗
      defaultProps: {
        children: "drtypeinfoList",
        label: "drtypename"
      },
      orderIds: [] // 批量删除工单id
    };
  },
  created () {
    // 查询所有工单
    this.findOrder(this.path, this.currentPage, this.pageSize);
    // 查询所有设备类型
    findDeviceType(this.path)
      .then(res => {
        this.deviceTypeData = res.data;
      })
      .catch(console.log);
    // 查询用户信息
    this.dispatchMan = this.name;
    // this.$store
    //   .dispatch("user/getInfo", this.ZSQY_TEST)
    //   .then(res => {
    //     this.dispatchMan = res.name;
    //   })
    //   .catch(console.log);
    // 查询所有派单人
    findAcceptMan(this.path)
      .then(res => {
        this.acceptManOptions = res.data;
      })
      .catch(console.log);
  },
  methods: {
    // 查询所有工单
    findOrder (path, currentPage, pageSize, state) {
      findOrder(path, currentPage, pageSize, state)
        .then(res => {
          this.tableDatas = res.data.records;
          this.rowCount = res.data.rowCount;
          this.tableDatas.forEach(ele => {
            ele.worktime = formatDate(ele.worktime);
            if (ele.executetime != null) {
              ele.executetime = formatDate(ele.executetime);
            }
            if (ele.finishtime != null) {
              ele.finishtime = formatDate(ele.finishtime);
            }
            ele.worklevel = idToVal(ele.worklevel, this.orderLevelOptions);
            ele.state = idToVal(ele.state, this.orderStatusOptions);
          });
        })
        .catch(console.log);
    },
    // 查询待处理工单
    finish (state) {
      this.findOrder(this.path, this.currentPage, this.pageSize, state);
    },
    handleCheck (obj) {
      this.deviceType = obj.drtypename;
      this.deviceTypeId = obj.drtypeid;
      if (this.editData != {}) {
        this.editData.drtypeid = obj.drtypeid;
        this.editData.drtypename = obj.drtypename;
        this.editData.drname = "";
      }
      if (this.deviceTypeId != "") {
        findDevice(this.path, this.deviceTypeId)
          .then(res => {
            this.deviceOptions = res.data;
          })
          .catch(console.log);
      }
      if (this.editData.drtypeid != "") {
        findDevice(this.path, this.editData.drtypeid)
          .then(res => {
            this.deviceOptions = res.data;
          })
          .catch(console.log);
      }
    },
    // 改变显示页数
    handleSizeChange (size) {
      this.pageSize = size;
      this.currentpage = 1;
      this.findOrder(this.path, this.currentPage, this.pageSize);
    },
    // 跳页
    handleCurrentChange (currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findOrder(this.path, this.currentPage, this.pageSize);
      }
    },
    // 上一页
    prev () {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findOrder(this.path, this.currentPage, this.pageSize);
        }
      }
    },
    // 下一页
    next () {
      const maxPage = Math.ceil(this.rowCount / this.pageSize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findOrder(this.path, this.currentPage, this.pageSize);
        }
      }
    },
    // 新增
    handleAdd () {
      var formData = new FormData();
      formData.append("drtypeid", this.deviceTypeId);
      formData.append("drid", this.deviceName);
      formData.append("worktime", this.dispatchTime);
      formData.append("workuser", this.dispatchMan);
      formData.append("worklevel", this.orderLevel);
      formData.append("executeuser", this.acceptMan);
      formData.append("state", 1);
      formData.append("workexplain", this.orderInfo);
      addOrder(this.path, formData)
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
    },
    // 确认修改
    updateTrue () {
      var formData = new FormData();
      formData.append("id", this.editData.id);
      formData.append("drtypeid", this.editData.drtypeid);
      formData.append(
        "drid",
        valToId(this.editData.drname, this.deviceOptions)
      );
      formData.append("worktime", new Date(this.editData.worktime));
      formData.append("workuser", this.editData.workuser);
      formData.append(
        "worklevel",
        valToId(this.editData.worklevel, this.orderLevelOptions)
      );
      formData.append("executeuser", this.editData.executeuser);
      if (this.editData.executetime != null) {
        formData.append("executetime", new Date(this.editData.executetime));
      }
      if (this.editData.finishtime != null) {
        formData.append("finishtime", new Date(this.editData.finishtime));
      }
      formData.append(
        "state",
        valToId(this.editData.state, this.orderStatusOptions)
      );
      formData.append("workexplain", this.editData.workexplain);
      updateOrder(this.path, formData)
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
      deleteOrder(this.path, row.id)
        .then(res => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("删除成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    handleSelectionChange (val) {
      this.storeIds = val;
    },
    // 批量删除
    handleDeletes () {
      let ids = [];
      this.orderIds.forEach(ele => {
        ids.push(ele.id);
      });
      deleteOrder(this.path, ids.join(","))
        .then(res => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("批量删除成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 导出工单
    exportOrder () {

    }
  }
};
</script>

<style lang="scss" scoped>
.container {
  .el-col {
    border-radius: 4px;
  }
  .bg-purple-light {
    padding: 20px;
    background: var(--theme-color);

    .btn {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 10px;
      .el-button {
        margin-left: 20px;
        margin-bottom: 10px;
      }
      .title {
        font-size: 18px;
        font-weight: bold;
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
    .el-input {
      width: 200px;
    }
    .el-textarea {
      width: 400px;
    }
  }
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>
