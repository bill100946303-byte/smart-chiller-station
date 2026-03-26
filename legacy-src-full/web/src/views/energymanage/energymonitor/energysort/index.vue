<template>
  <div class="page-shell">
    <main class="panel-card workbench">
      <div class="panel-card__header workbench-header">
        <div>
          <p class="panel-eyebrow">配置中心</p>
          <h2 class="panel-title">能耗配置信息</h2>
        </div>
        <div class="toolbar-actions">
          <el-button type="primary" @click="addVisible = true">新增配置</el-button>
        </div>
      </div>
      <div class="panel-body">
        <el-table :data="tableDatas" border class="analysis-table">
          <af-table-column prop="energytypeid" label="能耗类型" />
          <af-table-column prop="energytypename" label="能耗名称" />
          <af-table-column prop="energytypeExplain" label="能耗描述" />
          <el-table-column label="操作" width="160">
            <template slot-scope="scope">
              <div class="table-actions">
                <el-button
                  size="mini"
                  plain
                  type="primary"
                  @click="handleEdit(scope.$index, scope.row)"
                >编辑</el-button>
                <el-button
                  size="mini"
                  plain
                  type="danger"
                  @click="handleDelete(scope.$index, scope.row)"
                >删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-bar">
          <el-pagination
            :current-page="currentPage"
            :page-sizes="[5, 10, 20, 40]"
            :page-size="pageSize"
            layout="total, prev, pager, next, sizes, jumper"
            :total="rowCount"
            background
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
      <el-dialog title="新增能耗配置" :visible.sync="addVisible" width="50%">
        <div class="dialog-shell">
          <el-form
            ref="ruleForm"
            :model="ruleForm"
            :rules="rules"
            label-position="left"
            label-width="150px"
            class="config-form"
          >
            <el-form-item label="能耗类型">
              <el-select v-model="energyType" placeholder="请选择能耗类型" clearable>
                <el-option
                  v-for="item in energyTypeOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="能耗名称">
              <el-input v-model="energyName" type="text" placeholder="请输入能耗名称" clearable />
            </el-form-item>
            <el-form-item label="是否为项目总能耗" prop="isTotalEnergy">
              <el-select v-model="ruleForm.isTotalEnergy" placeholder="请选择" @change="checkEnergy">
                <el-option
                  v-for="item in isEnergyOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="能耗描述" class="config-form__full">
              <el-input v-model="energyInfo" type="textarea" :rows="4" placeholder="请输入能耗描述" />
            </el-form-item>
          </el-form>
          <div class="selector-shell">
            <div class="selector-shell__header">
              <p class="selector-shell__eyebrow">变量绑定</p>
              <h3 class="selector-shell__title">选择用于统计的变量</h3>
            </div>
            <el-steps class="tips" space="40%" :active="active">
              <el-step title="步骤 1" description="选择设备类型查看设备"></el-step>
              <el-step title="步骤 2" description="选择设备查看变量"></el-step>
              <el-step title="步骤 3" description="选择所需变量"></el-step>
            </el-steps>
            <div class="device-data">
              <div class="device-type">
                <el-tree :data="deviceType" :props="deviceTypeProps" @node-click="selectDeviceType" />
              </div>
              <div class="device-name">
                <el-tree
                  ref="deviceTree"
                  :data="deviceName"
                  :props="deviceProps"
                  show-checkbox
                  @check-change="selectDevice"
                />
              </div>
              <div class="reg-name">
                <el-tree
                  ref="regTree"
                  :data="regName"
                  :props="regProps"
                  show-checkbox
                  @check-change="selectRegs"
                />
              </div>
            </div>
          </div>
        </div>
        <span slot="footer" class="dialog-footer">
          <el-button @click="addVisible = false">取 消</el-button>
          <el-button type="primary" @click="handleAdd">确 定</el-button>
        </span>
      </el-dialog>
      <el-dialog title="修改能耗配置" :visible.sync="updateVisible" width="50%">
        <div class="dialog-shell">
          <el-form label-position="left" label-width="150px" class="config-form">
            <el-form-item label="能耗类型">
              <el-select v-model="editData.energytypeid" placeholder="请选择能耗类型" clearable>
                <el-option
                  v-for="item in energyTypeOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="能耗名称">
              <el-input
                v-model="editData.energytypename"
                type="text"
                placeholder="请输入能耗名称"
                clearable
              />
            </el-form-item>
            <el-form-item label="是否为项目总能耗">
              <el-select v-model="editData.isapptotal" placeholder="请选择">
                <el-option
                  v-for="item in isEnergyOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="能耗描述" class="config-form__full">
              <el-input
                v-model="editData.energytypeExplain"
                type="textarea"
                :rows="4"
                placeholder="请输入能耗描述"
              />
            </el-form-item>
          </el-form>
          <div class="selector-shell">
            <div class="selector-shell__header">
              <p class="selector-shell__eyebrow">变量绑定</p>
              <h3 class="selector-shell__title">更新能耗对应的变量</h3>
            </div>
            <el-steps class="tips" space="40%" :active="active">
              <el-step title="步骤 1" description="选择设备类型查看设备"></el-step>
              <el-step title="步骤 2" description="选择设备查看变量"></el-step>
              <el-step title="步骤 3" description="选择所需变量"></el-step>
            </el-steps>
            <div class="device-data">
              <div class="device-type">
                <el-tree :data="deviceType" :props="deviceTypeProps" @node-click="selectDeviceType" />
              </div>
              <div class="device-name">
                <el-tree :data="deviceName" :props="deviceProps" @node-click="selectDevice" />
              </div>
              <div class="reg-name">
                <el-tree
                  ref="regTree"
                  :data="regName"
                  :props="regProps"
                  show-checkbox
                  @check-change="selectRegs"
                />
              </div>
            </div>
          </div>
        </div>
        <span slot="footer" class="dialog-footer">
          <el-button @click="updateVisible = false">取 消</el-button>
          <el-button type="primary" @click="updateTrue">确 定</el-button>
        </span>
      </el-dialog>
    </main>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import { findDeviceType, findDevice } from "@/api/usersetting/runlog/datatable";
import {
  findReg,
  findEnergy,
  checkTotalEnergy,
  addEnergy,
  updateEnergy,
  deleteEnergy
} from "@/api/usersetting/energymange/energysort";
import { valToId, idToVal } from "@/utils/selectexchange";
export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    // 验证是否为总能耗
    const validEnergy = (rule, value, callback) => {
      if (value === 1) {
        checkTotalEnergy(this.path)
          .then(res => {
            if (res.data === true) {
              callback(new Error("项目总能耗不能重复配置"));
            } else {
              callback();
            }
          })
          .catch();
      }
    };
    return {
      ruleForm: {
        isTotalEnergy: "否" // 是否为项目总能耗
      },
      rules: {
        isTotalEnergy: [
          { required: true, trigger: "change", validator: validEnergy }
        ]
      },
      active: 1, // 步骤
      currentPage: 1, // 初始页
      pageSize: 10,
      rowCount: 0,
      energyType: "", // 能耗类型
      energyName: "", // 能耗名称
      energyInfo: "", // 能耗描述
      energyTypeOptions: [
        {
          id: 1,
          value: "总能耗"
        },
        {
          id: 2,
          value: "分类能耗"
        },
        {
          id: 3,
          value: "自定义能耗"
        }
      ], // 能耗类型选项
      isEnergyOptions: [
        {
          id: 1,
          value: "是"
        },
        {
          id: 0,
          value: "否"
        }
      ], // 是否为项目总能耗选项
      deviceType: [], // 设备类型树形图数据
      deviceName: [], // 设备名树形图数据
      regName: [], // 变量名树形图数据
      regs: [], // 选择的变量
      tableDatas: [], // 表格数据
      editData: {}, // 修改单行数据
      addVisible: false, // 控制新增弹窗
      updateVisible: false, // 控制修改弹窗
      deviceTypeProps: {
        children: "drtypeinfoList",
        label: "drtypename"
      },
      deviceProps: {
        label: "drname"
      },
      regProps: {
        label: "regName"
      }
    };
  },
  created() {
    // 查询所有设备类型
    findDeviceType(this.path)
      .then(res => {
        this.deviceType = res.data;
      })
      .catch(console.log);
    // 查询所有能耗配置
    this.findEnergy(this.path, this.currentPage, this.pageSize);
  },
  methods: {
    // 查询所有能耗配置
    findEnergy(path, currentPage, pageSize) {
      findEnergy(path, currentPage, pageSize)
        .then(res => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
          this.tableDatas.forEach(ele => {
            ele.energytypeid = idToVal(
              ele.energytypeid,
              this.energyTypeOptions
            );
          });
        })
        .catch(console.log);
    },
    // 选择设备类型,查询所有设备
    selectDeviceType(data) {
      this.regName = [];
      this.active = 2;
      if (data.drtypeinfoList.length === 0) {
        findDevice(this.path, data.drtypeid)
          .then(res => {
            this.deviceName = res.data;
          })
          .catch(console.log);
      }
    },
    // 选择设备，查询变量
    selectDevice(data, checked) {
      this.active = 3;
      if (checked) {
        findReg(this.path, data.drid, 1)
          .then(res => {
            res.data.forEach(ele => {
              this.regName.push(ele);
            });
          })
          .catch(console.log);
      } else {
        for (let i = this.regName.length - 1; i >= 0; i--) {
          if(this.regName[i].drId === data.drid) {
            this.regName.splice(i, 1);
          }
        }
      }
    },
    // 选择所需变量
    selectRegs() {
      this.regs = this.$refs.regTree.getCheckedNodes();
    },
    // 改变显示页数
    handleSizeChange(size) {
      this.pageSize = size;
      this.currentPage = 1;
      this.findEnergy(this.path, this.currentPage, this.pageSize);
    },
    // 跳页
    handleCurrentChange(currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findEnergy(this.path, this.currentPage, this.pageSize);
      }
    },
    // 上一页
    prev() {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findEnergy(this.path, this.currentPage, this.pageSize);
        }
      }
    },
    // 下一页
    next() {
      const maxPage = Math.ceil(this.rowCount / this.pageSize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findEnergy(this.path, this.currentPage, this.pageSize);
        }
      }
    },

    checkEnergy() {
      this.$refs.ruleForm.validate(valid => {
        if (valid) {
        } else {
          console.log("错误提交!!");
          return false;
        }
      });
    },
    // 新增
    handleAdd() {
      if (this.regs.length != 0) {
        let tagName = [];
        this.regs.forEach(ele => {
          tagName.push(ele.tagName);
        });
        var formData = new FormData();
        formData.append("energytypeid", this.energyType);
        formData.append("energytypename", this.energyName);
        formData.append(
          "isapptotal",
          valToId(this.ruleForm.isTotalEnergy, this.isEnergyOptions)
        );
        formData.append("energytypeExplain", this.energyInfo);
        formData.append("tagnames", tagName.join(","));
        addEnergy(this.path, formData)
          .then(res => {
            const { msg } = res;
            if (msg == "OK") {
              this.$message.success("新增成功!");
              this.reload();
            }
          })
          .catch(console.log);
      } else {
        this.$message.warning("必须选择变量！");
      }
    },
    // 修改
    handleEdit(index, row) {
      this.updateVisible = true;
      this.editData = row;
      //this.editData.isapptotal == 0 ? "否" : "是";
    },
    // 确认修改
    updateTrue() {
      let tagName = [];
      this.regs.forEach(ele => {
        tagName.push(ele.tagName);
      });
      var formData = new FormData();
      formData.append("id", this.editData.id);
      formData.append(
        "energytypeid",
        valToId(this.editData.energytypeid, this.energyTypeOptions)
      );
      formData.append("energytypename", this.editData.energytypename);
      formData.append(
        "isapptotal",
        valToId(this.editData.isapptotal, this.isEnergyOptions)
      );
      formData.append("energytypeExplain", this.editData.energytypeExplain);
      formData.append("tagnames", tagName.join(","));
      updateEnergy(this.path, formData)
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
    handleDelete(index, row) {
      deleteEnergy(this.path, row.id)
        .then(res => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("删除成功!");
            this.reload();
          }
        })
        .catch(console.log);
    }
  }
};
</script>

<style lang="scss" scoped>
.page-shell {
  padding: 0 20px 20px;
}

.panel-card {
  background: var(--theme-color);
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.08);
}

.panel-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.panel-eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.45);
}

.panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.workbench {
  min-width: 0;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.panel-body {
  min-width: 0;
}

.analysis-table {
  width: 100%;
}

.table-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.dialog-shell {
  padding-top: 8px;
}

.config-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}

.config-form__full {
  grid-column: 1 / -1;
}

.config-form .el-input,
.config-form .el-select,
.config-form .el-textarea {
  width: 100%;
}

.selector-shell {
  margin-top: 20px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.45);
}

.selector-shell__header {
  margin-bottom: 16px;
}

.selector-shell__eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.45);
}

.selector-shell__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.device-data {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.device-type,
.device-name,
.reg-name {
  min-width: 0;
  max-height: 320px;
  overflow: auto;
  border-radius: 12px;
  padding: 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

@media (max-width: 960px) {
  .config-form,
  .device-data {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .page-shell {
    padding: 0 12px 12px;
  }

  .panel-card {
    padding: 16px;
  }

  .panel-card__header {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-actions {
    width: 100%;
  }

  .toolbar-actions .el-button {
    flex: 1 1 auto;
  }

  .pagination-bar {
    justify-content: center;
  }
}
</style>
