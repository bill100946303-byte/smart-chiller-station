<template>
  <div class="app-container container">
    <el-row :gutter="10">
      <el-col :sm="24" :md="24" :lg="12" :xl="12">
        <div class="grid-content bg-purple">
          <div class="btn">
            <p class="title">部门设备</p>
            <el-button type="primary" @click="handleAdd">确认分配</el-button>
          </div>
          <div class="device-data">
            <div class="manage-man">
              <el-select v-model="departmentIdL" placeholder="请选择隶属部门">
                <el-option
                  :label="departmentNameL"
                  :value="departmentIdL"
                  style="height: auto"
                >
                  <el-tree
                    :data="departmentTreeL"
                    node-key="departmentid"
                    ref="tree"
                    highlight-current
                    :props="defaultProps"
                    @node-click="handleCheckL"
                  ></el-tree>
                </el-option>
              </el-select>
            </div>
            <div class="device-type">
              <el-tree
                :data="deviceType"
                :props="deviceTypeProps"
                @node-click="selectDeviceType"
              />
            </div>
            <div class="device-name">
              <el-tree
                ref="addtree"
                node-key="drid"
                show-checkbox
                :data="deviceNameL"
                :props="deviceProps"
              />
            </div>
          </div>
        </div>
      </el-col>
      <el-col :sm="24" :md="24" :lg="12" :xl="12">
        <div class="grid-content bg-purple-light">
          <div class="btn">
            <p class="title">设备分配详情</p>
            <el-button type="primary" @click="handleremove">移除设备</el-button>
          </div>
          <div class="device-data">
            <div class="manage-man">
              <el-select v-model="departmentIdR" placeholder="请选择隶属部门">
                <el-option
                  :label="departmentNameR"
                  :value="departmentIdR"
                  style="height: auto"
                >
                  <el-tree
                    :data="departmentTreeR"
                    node-key="departmentid"
                    ref="tree"
                    highlight-current
                    :props="defaultProps"
                    @node-click="handleCheckR"
                  ></el-tree>
                </el-option>
              </el-select>
            </div>
            <div class="device-name">
              <el-tree
                ref="removetree"
                show-checkbox
                node-key="id"
                :data="deviceNameR"
                :props="deviceProps"
              />
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import { findDeviceType } from "@/api/usersetting/runlog/datatable";
import {
  findDevice,
  searchdevice,
  addDevice,
  removeDevice
} from "@/api/usersetting/usermanage/departmentdevice";
import { findDepartment } from "@/api/usersetting/usermanage/departmentdispose";
export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path"])
  },
  watch: {
    departmentIdR (val) {
      if (val != "") {
        searchdevice(this.path, val)
          .then(res => {
            this.deviceNameR = res.data;
          })
          .catch(console.log);
      } else {
        this.deviceNameR = [];
      }
    }
  },
  data () {
    return {
      openAlarmMsg: false, // 是否开启短信报警
      departmentIdL: "", // 部门id(左)
      departmentNameL: "", // 部门名（左）
      departmentTreeL: [], // 部门树图（左）
      departmentIdR: "", // 部门id(右)
      departmentNameR: "", // 部门名（右）
      departmentTreeR: [], // 部门树图（右）
      deviceType: [], // 设备类型树形图数据
      deviceNameL: [], // 设备名树形图数据(左)
      deviceNameR: [], // 设备名树形图数据(右)
      deviceTypeProps: {
        children: "drtypeinfoList",
        label: "drtypename"
      },
      deviceProps: {
        label: "drname"
      },
      defaultProps: {
        children: "children",
        label: "departmentname"
      }
    };
  },
  created () {
    // 查询所有设备类型
    findDeviceType(this.path)
      .then(res => {
        this.deviceType = res.data;
      })
      .catch(console.log);
    // 查询所有部门
    findDepartment(this.path)
      .then(res => {
        this.departmentTreeL = res.data;
        this.departmentTreeR = res.data;
      })
      .catch(console.log);
  },
  methods: {
    // 选择树图
    handleCheckL (obj) {
      this.departmentNameL = obj.departmentname;
      this.departmentIdL = obj.departmentid;
    },
    handleCheckR (obj) {
      this.departmentNameR = obj.departmentname;
      this.departmentIdR = obj.departmentid;
    },
    // 选择设备类型,查询所有设备
    selectDeviceType (data) {
      if (data.drtypeinfoList.length === 0) {
        findDevice(this.path, data.drtypeid)
          .then(res => {
            this.deviceNameL = res.data;
          })
          .catch(console.log);
      }
    },
    // 新增设备给部门
    handleAdd () {
      // 获取勾选的设备id
      const keys = this.$refs.addtree.getCheckedKeys();
      var formData = new FormData();
      formData.append("departmentid", this.departmentIdL);
      formData.append("drids", keys.join(","));
      addDevice(this.path, formData)
        .then(res => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("分配成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 移除设备
    handleremove () {
      // 获取勾选的设备id
      const keys = this.$refs.removetree.getCheckedKeys();
      var formData = new FormData();
      formData.append("ids", keys.join(","));
      removeDevice(this.path, formData)
        .then(res => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("移除成功!");
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
  .bg-purple {
    padding: 20px;
    background: var(--theme-color);
  }
  .bg-purple-light {
    padding: 20px;
    background: var(--theme-color);
  }
  .bg-purple,
  .bg-purple-light {
    .btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;

      .title {
        font-size: 18px;
        font-weight: bold;
      }
    }

    .device-data {
      display: flex;
      justify-content: space-around;
      padding: 20px 0;
      background-color: var(--theme-color);
      .device-type {
        width: 20%;
      }
      .device-name {
        width: 65%;
        max-height: 800px;
        overflow-y: auto;
      }
    }
  }
  .el-col {
    border-radius: 4px;
  }
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>
