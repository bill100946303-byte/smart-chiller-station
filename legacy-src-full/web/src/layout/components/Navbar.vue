<template>
  <div class="navbar">
    <hamburger
      id="hamburger-container"
      :is-active="sidebar.opened"
      class="hamburger-container"
      @toggleClick="toggleSideBar"
    />

    <!-- <div class="project-name" v-if="appexplain">
      <p>欢迎来到：{{ appexplain }}</p>
    </div> -->
    <div class="project-name" v-if="project">
      <p>欢迎来到：{{ appexplain }}（{{ path }}）项目</p>
    </div>

    <div class="right-menu">
      <template v-if="device !== 'mobile'">
        <screenfull id="screenfull" class="right-menu-item hover-effect" />
      </template>

      <el-dropdown
        class="avatar-container right-menu-item hover-effect"
        trigger="click"
      >
        <div class="avatar-wrapper">
          <svg-icon icon-class="loginengineer" class="user-avatar" />
          <i class="el-icon-caret-bottom" />
        </div>
        <el-dropdown-menu slot="dropdown">
          <el-dropdown-item divided>
            <span @click="goBack">项目管理</span>
          </el-dropdown-item>
          <el-dropdown-item divided>
            <span style="display: block" @click="updateVisible = true"
              >修改密码</span
            >
          </el-dropdown-item>
          <el-dropdown-item divided>
            <span style="display: block" @click="logout">退出</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </el-dropdown>
      <el-dialog :modal="false" title="修改密码" :visible.sync="updateVisible">
        <el-form
          :model="ruleForm"
          status-icon
          :rules="rules"
          ref="ruleForm"
          label-position="left"
          label-width="100px"
          class="demo-ruleForm"
        >
          <el-form-item label="旧密码" prop="oldPass">
            <el-input
              type="password"
              v-model="ruleForm.oldPass"
              auto-complete="off"
            ></el-input>
          </el-form-item>
          <el-form-item label="新密码" prop="pass">
            <el-input
              type="password"
              v-model="ruleForm.pass"
              auto-complete="off"
            ></el-input>
          </el-form-item>
          <el-form-item label="确认密码" prop="checkPass">
            <el-input
              type="password"
              v-model="ruleForm.checkPass"
              auto-complete="off"
            ></el-input>
          </el-form-item>
        </el-form>
        <span slot="footer" class="dialog-footer">
          <el-button @click="updateVisible = false">取 消</el-button>
          <el-button type="primary" @click="changepassword">确 定</el-button>
        </span>
      </el-dialog>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import Cookies from "js-cookie";
import Hamburger from "@/components/Hamburger/engineer";
import Screenfull from "@/components/Screenfull";
import { changePass, getRequestCode, sendCode } from "@/api/user";

export default {
  components: {
    Screenfull,
    Hamburger,
  },
  computed: {
    ...mapGetters(["sidebar", "avatar", "device", "project", "name", "appexplain", "path", "appexplain"]),
  },
  data() {
    var validatePass = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("请输入密码"));
      } else {
        if (this.ruleForm.checkPass !== "") {
          this.$refs.ruleForm.validateField("checkPass");
        }
        callback();
      }
    };
    var validatePass2 = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("请再次输入密码"));
      } else if (value !== this.ruleForm.pass) {
        callback(new Error("两次输入密码不一致!"));
      } else {
        callback();
      }
    };
    return {
      ruleForm: {
        oldPass: "",
        pass: "",
        checkPass: "",
      },
      rules: {
        pass: [{ validator: validatePass, trigger: "blur" }],
        checkPass: [{ validator: validatePass2, trigger: "blur" }],
      },
      updateVisible: false,
    };
  },
  methods: {
    toggleSideBar() {
      this.$store.dispatch("app/toggleSideBar");
    },
    async logout() {
      await this.$store.dispatch("user/logout");
      this.$router.push("/login");
      window.location.reload();
    },
    // 确认修改
    changepassword() {
      this.$refs.ruleForm.validate((valid) => {
        if (valid) {
          changePass(this.name, this.ruleForm.oldPass, this.ruleForm.pass)
            .then((res) => {
              if (res.status === 20000) {
                this.$message.success("密码修改成功!");
                this.updateVisible = false;
              }
            })
            .catch(console.log);
        } else {
          console.log("错误提交!!");
          return false;
        }
      });
    },

    // 退回项目选择页面
    goBack() {
      Cookies.remove("projectName");
      Cookies.remove("appexplain");
      this.$router.push("/basesetting/objectmanage");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
  },
};
</script>

<style lang="scss" scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  overflow: hidden;
  position: relative;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);

  .hamburger-container {
    line-height: 46px;
    height: 100%;
    cursor: pointer;
    transition: background 0.3s;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      background: rgba(0, 0, 0, 0.025);
    }
  }

  .breadcrumb-container {
  }
  .project-name {
    font-size: 20px;
    font-weight: bold;
    display: flex;
    align-items: center;
    .el-button {
      margin-left: 30px;
    }
  }

  .errLog-container {
    display: inline-block;
    vertical-align: top;
  }
  .right-menu {
    float: right;
    height: 100%;
    line-height: 50px;

    &:focus {
      outline: none;
    }

    .right-menu-item {
      display: inline-block;
      padding: 0 8px;
      height: 100%;
      font-size: 18px;
      color: #5a5e66;
      vertical-align: text-bottom;

      &.hover-effect {
        cursor: pointer;
        transition: background 0.3s;

        &:hover {
          background: rgba(126, 22, 22, 0.025);
        }
      }
    }

    .avatar-container {
      margin-right: 30px;

      .avatar-wrapper {
        margin-top: 5px;
        position: relative;
        cursor: pointer;
        .user-avatar {
          cursor: pointer;
          width: 25px;
          height: 25px;
          border-radius: 10px;
        }

        .el-icon-caret-bottom {
          cursor: pointer;
          position: absolute;
          right: -20px;
          top: 25px;
          font-size: 12px;
        }
      }
    }
    .add-dialog {
      .add-content {
        display: flex;
        align-items: center;
        .el-input {
          margin-left: 20px;
          width: 200px;
        }
      }
    }
  }
}
</style>
