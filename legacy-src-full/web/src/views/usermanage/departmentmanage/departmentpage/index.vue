<template>
  <div class="app-container container">
    <el-row :gutter="10">
      <el-col>
        <div class="grid-content bg-purple">
          <div class="btn">
            <div class="title">
              <p>部门页面</p>
              <el-button type="primary" @click="handleAdd">确认分配</el-button>
            </div>
            <p>所选部门: {{ departmentName }}</p>
          </div>
          <div class="device-data">
            <el-tree
              class="manage-man"
              ref="departmentTree"
              default-expand-all
              :data="departmentTree"
              :props="departmentProps"
              @node-click="checkDepartment"
            ></el-tree>
            <el-tree
              class="left-page"
              ref="leftPageTree"
              node-key="picid"
              show-checkbox
              default-expand-all
              :data="allPages"
              :props="pageProps"
            />
            <el-tree
              class="right-page"
              ref="rightPageTree"
              node-key="picid"
              default-expand-all
              :data="ownerPages"
              :props="pageProps"
            />
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import { findPages } from "@/api/contentsetting/systemmenu";
import { findDepartment } from "@/api/usersetting/usermanage/departmentdispose";
import { findPage, addPage } from "@/api/usersetting/usermanage/departmentpage";
export default {
  computed: {
    ...mapGetters(["path"])
  },
  data () {
    return {
      departmentId: "", // 部门id
      departmentName: "", // 部门名字
      departmentTree: [], // 部门树形图
      allPages: [], // 页面名树形图数据(左)
      ownerPages: [], // 页面名树形图数据(右)
      departmentProps: {
        children: "children",
        label: "departmentname"
      },
      pageProps: {
        children: "children",
        label: "picname"
      }
    };
  },
  created () {
    // 查询所有部门
    findDepartment(this.path)
      .then(res => {
        this.departmentTree = res.data;
      })
      .catch(console.log);
    // 查询所有页面
    findPages(this.path)
      .then(res => {
        this.allPages = res.data;
      })
      .catch(console.log);
  },
  methods: {
    // 点击部门
    checkDepartment (data) {
      this.departmentId = data.departmentid;
      this.departmentName = data.departmentname;
      this.findPageByDepartment();
    },
    // 根据部门id查询部门页面
    findPageByDepartment () {
      findPage(this.path, this.departmentId)
        .then(res => {
          this.ownerPages = res.data;
        })
        .catch(console.log);
    },
    // 新增页面给部门
    handleAdd () {
      // 获取勾选的页面id
      let keys = this.$refs.leftPageTree.getCheckedKeys();
      let halfKeys = this.$refs.leftPageTree.getHalfCheckedKeys();
      let datas = keys.concat(halfKeys);
      var formData = new FormData();
      formData.append("departmentid", this.departmentId);
      formData.append("picids", datas.join(","));
      addPage(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("分配成功!");
            this.findPageByDepartment();
          }
        })
        .catch(console.log);
    }
  }
};
</script>

<style lang="scss" scoped>
.container {
  overflow: auto;
  .bg-purple,
  .bg-purple-light {
    padding: 20px;
    background: var(--theme-color);
    .btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;

      .title {
        display: flex;
        align-items: center;
      }

      p {
        margin-right: 20px;
        font-size: 18px;
        font-weight: bold;
      }
    }
    .device-data {
      display: flex;
      justify-content: space-around;
      padding: 20px 0;

      .manage-man,
      .left-page,
      .right-page {
        height: 700px;
        overflow: auto;
        width: 35%;
      }
    }
  }
  .el-col {
    border-radius: 4px;
  }
  .grid-content {
    min-width: 728px;
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>
