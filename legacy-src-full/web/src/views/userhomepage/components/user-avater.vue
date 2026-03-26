<template>
  <div class="user-control-surface">
    <el-dropdown
      class="avatar-container right-menu-item hover-effect"
      trigger="click"
      placement="bottom-end"
      popper-class="user-avatar-popper"
      @command="handleCommand"
    >
      <div :class="['avatar-wrapper', themeClass]">
        <div class="avatar-avatar">
          {{ userInitials }}
        </div>
        <div class="avatar-copy">
          <span class="avatar-name">{{ name }}</span>
          <span class="avatar-meta">账号中心</span>
        </div>
        <i class="el-icon-arrow-down avatar-chevron"></i>
      </div>
      <el-dropdown-menu slot="dropdown">
        <el-dropdown-item v-if="showproject && appusergroup.length > 1" command="project">
          <div class="menu-action">
            <i class="al_element-icons al_iconqiehuan"></i>
            <span>项目管理</span>
            <span class="menu-action__hint">{{ appusergroup.length }}</span>
          </div>
        </el-dropdown-item>
        <el-dropdown-item command="alarm">
          <div class="menu-action">
            <i class="al_element-icons al_iconshishinenghao"></i>
            <span>{{ $t('defaultpage.alarmPushVisible') }}</span>
          </div>
        </el-dropdown-item>
        <el-dropdown-item command="password">
          <div class="menu-action">
            <i class="al_element-icons al_iconzhanghao"></i>
            <span>{{ $t('defaultpage.changePassword') }}</span>
          </div>
        </el-dropdown-item>
        <el-dropdown-item divided command="logout">
          <div class="menu-action menu-action--logout">
            <i class="el-icon-switch-button"></i>
            <span>{{ $t('defaultpage.logout') }}</span>
          </div>
        </el-dropdown-item>
      </el-dropdown-menu>
    </el-dropdown>

    <el-dialog
      :modal="false"
      :title="$t('defaultpage.alarmPushVisible')"
      :visible.sync="alarmPushVisible"
      custom-class="control-dialog control-dialog--alarm"
      destroy-on-close
      append-to-body
      width="420px"
    >
      <div class="control-panel">
        <div class="control-panel__lead">
          <div>
            <div class="control-panel__lead-title">报警推送二维码</div>
            <div class="control-panel__lead-desc">刷新后可重新获取最新绑定信息。</div>
          </div>
          <el-button class="control-panel__ghost" size="mini" plain @click="requestAlarmPush">
            {{ $t('defaultpage.refresh') }}
          </el-button>
        </div>
        <div class="alarmPushVisible">
          <el-image :src="alarmPushSrc">
            <div slot="error" class="image-slot">
              <i class="el-icon-picture-outline"></i>
              <span>暂无二维码</span>
            </div>
          </el-image>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      :modal="false"
      :title="$t('defaultpage.changePassword')"
      :visible.sync="updateVisible"
      custom-class="control-dialog control-dialog--password"
      destroy-on-close
      append-to-body
      width="460px"
    >
      <el-form
        ref="ruleForm"
        :model="ruleForm"
        :rules="rules"
        class="password-form"
        label-position="top"
      >
        <el-form-item :label="$t('defaultpage.oldPassword')" prop="oldPass">
          <el-input
            v-model="ruleForm.oldPass"
            auto-complete="off"
            placeholder="请输入旧密码"
            type="password"
          />
        </el-form-item>
        <el-form-item :label="$t('defaultpage.newPassword')" prop="pass">
          <el-input
            v-model="ruleForm.pass"
            auto-complete="off"
            placeholder="请输入新密码"
            type="password"
          />
        </el-form-item>
        <el-form-item :label="$t('defaultpage.confirmNewPassword')" prop="checkPass">
          <el-input
            v-model="ruleForm.checkPass"
            auto-complete="off"
            placeholder="再次输入新密码"
            type="password"
          />
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="updateVisible = false">{{ $t('defaultpage.cancellation') }}</el-button>
        <el-button type="primary" @click="changepassword">{{ $t('defaultpage.confirm') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import { changePass, alarmPush } from "@/api/user";
import { toggleClass } from "@/utils";

export default {
  props: {
    showproject: Boolean,
  },
  computed: {
    ...mapGetters(["colortheme", "name", "userid", "appusergroup"]),
    themeClass() {
      return this.colortheme === "light" ? "is-light" : "is-dark";
    },
    userInitials() {
      const value = String(this.name || "").trim();
      if (!value) {
        return "U";
      }
      return value.slice(0, 2).toUpperCase();
    },
  },
  created() {
    this.$store.commit("user/SET_THEME", "darkblue");
  },
  watch: {
    colortheme: {
      handler(val) {
        toggleClass(document.body, val);
      },
      immediate: true,
    },
  },
  data() {
    const validatePass = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("请输入密码"));
        return;
      }
      if (this.ruleForm.checkPass !== "") {
        this.$refs.ruleForm.validateField("checkPass");
      }
      callback();
    };
    const validatePass2 = (rule, value, callback) => {
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
      alarmPushVisible: false,
      alarmPushSrc: "",
    };
  },
  methods: {
    handleCommand(command) {
      switch (command) {
        case "project":
          if (this.$route.path !== "/") {
            this.$router.push("/");
          }
          break;
        case "alarm":
          this.alarmPushVisible = true;
          this.requestAlarmPush();
          break;
        case "password":
          this.updateVisible = true;
          break;
        case "logout":
          this.logout();
          break;
        default:
          break;
      }
    },
    requestAlarmPush() {
      alarmPush().then((res) => {
        if (res.status === 20000) {
          this.alarmPushSrc = res.data;
        } else {
          this.alarmPushSrc = "";
        }
      }).catch(() => {
        this.alarmPushSrc = "";
      });
    },
    logout() {
      setTimeout(() => {
        this.$store.dispatch("user/logout");
        this.$router.push("/login");
        window.location.reload();
      }, 1000);
    },
    changepassword() {
      this.$refs.ruleForm.validate((valid) => {
        if (!valid) {
          return false;
        }
        changePass(this.name, this.ruleForm.oldPass, this.ruleForm.pass)
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("密码修改成功!");
              this.updateVisible = false;
              this.ruleForm = {
                oldPass: "",
                pass: "",
                checkPass: "",
              };
            }
          })
          .catch(console.log);
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.user-control-surface {
  display: flex;
  align-items: center;
}

.avatar-container {
  display: block;
}

.avatar-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 192px;
  padding: 10px 14px 10px 12px;
  border-radius: 18px;
  cursor: pointer;
  border: 1px solid rgba(120, 210, 255, 0.16);
  background: linear-gradient(135deg, rgba(6, 24, 38, 0.96) 0%, rgba(15, 48, 70, 0.82) 100%);
  box-shadow: 0 14px 28px rgba(2, 10, 18, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(97, 214, 255, 0.18) 0%, rgba(97, 214, 255, 0) 42%);
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(130, 225, 255, 0.34);
    box-shadow: 0 18px 32px rgba(2, 10, 18, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  &.is-light {
    border-color: rgba(10, 59, 87, 0.14);
    background: linear-gradient(135deg, rgba(252, 253, 255, 0.98) 0%, rgba(232, 242, 248, 0.9) 100%);
    box-shadow: 0 12px 24px rgba(10, 40, 58, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.65);
  }

  &.is-light .avatar-name {
    color: rgba(11, 31, 44, 0.92);
  }

  &.is-light .avatar-meta {
    color: rgba(78, 102, 119, 0.82);
  }

  &.is-light .avatar-chevron {
    color: rgba(35, 64, 82, 0.65);
  }
}

.avatar-avatar {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #07131d;
  background: linear-gradient(135deg, #92f5ff 0%, #5ab8ff 55%, #3166f6 100%);
  box-shadow: 0 10px 18px rgba(49, 102, 246, 0.24);
}

.avatar-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.avatar-name {
  font-size: 16px;
  font-weight: 600;
  color: #f6fbff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar-meta {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(200, 224, 240, 0.78);
}

.avatar-chevron {
  position: relative;
  z-index: 1;
  margin-left: auto;
  font-size: 14px;
  color: rgba(221, 240, 255, 0.72);
  transition: transform 0.2s ease, color 0.2s ease;
}

.avatar-wrapper:hover .avatar-chevron {
  transform: translateY(1px);
}

.control-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.control-panel__lead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(120, 215, 255, 0.1);
}

.control-panel__lead-title {
  font-size: 15px;
  font-weight: 600;
  color: #f2f8ff;
}

.control-panel__lead-desc {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(205, 224, 238, 0.72);
}

.control-panel__ghost {
  border-radius: 999px;
}

.alarmPushVisible {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.alarmPushVisible .el-image {
  width: 280px;
  height: 280px;
  padding: 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(120, 215, 255, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.alarmPushVisible .image-slot {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(203, 221, 235, 0.82);
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-action {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  color: rgba(240, 247, 251, 0.96);
  background: rgba(255, 255, 255, 0.03);
  transition: background 0.2s ease, transform 0.2s ease;
}

.menu-action i {
  font-size: 16px;
  color: #89e7ff;
}

.menu-action--logout i {
  color: #ff9cad;
}

.menu-action__hint {
  margin-left: auto;
  font-size: 12px;
  color: rgba(206, 222, 234, 0.72);
}

::v-deep .el-popper.user-avatar-popper {
  min-width: 224px;
  padding: 10px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(6, 19, 31, 0.99) 0%, rgba(13, 33, 50, 0.98) 100%);
  border: 1px solid rgba(116, 211, 255, 0.16);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

::v-deep .el-popper.user-avatar-popper .popper__arrow {
  border-bottom-color: rgba(116, 211, 255, 0.16);
}

::v-deep .el-popper.user-avatar-popper .popper__arrow::after {
  border-bottom-color: rgba(6, 19, 31, 0.99);
}

::v-deep .user-avatar-popper .el-dropdown-menu {
  background: transparent;
  border: 0;
  padding: 0;
}

::v-deep .user-avatar-popper .el-dropdown-menu__item {
  padding: 0;
  margin-bottom: 8px;
  color: rgba(241, 248, 255, 0.96);
  line-height: normal;
  background: transparent;
}

::v-deep .user-avatar-popper .el-dropdown-menu__item:last-child {
  margin-bottom: 0;
}

::v-deep .user-avatar-popper .el-dropdown-menu__item:not(.is-disabled):hover,
::v-deep .user-avatar-popper .el-dropdown-menu__item:not(.is-disabled):focus {
  background: transparent;
}

::v-deep .user-avatar-popper .el-dropdown-menu__item:not(.is-disabled):hover .menu-action,
::v-deep .user-avatar-popper .el-dropdown-menu__item:not(.is-disabled):focus .menu-action {
  background: rgba(102, 186, 255, 0.14);
  color: rgba(248, 251, 255, 0.99);
  transform: translateX(1px);
}

::v-deep .user-avatar-popper .el-dropdown-menu__item.is-disabled {
  opacity: 0.6;
}

::v-deep .user-avatar-popper .el-dropdown-menu__item.divided {
  margin-top: 2px;
  padding-top: 8px;
  border-top: 1px solid rgba(120, 215, 255, 0.1);
}

::v-deep .control-dialog {
  border-radius: 22px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(6, 19, 31, 0.98) 0%, rgba(13, 31, 48, 0.98) 100%);
  border: 1px solid rgba(118, 215, 255, 0.12);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.34);
}

::v-deep .control-dialog .el-dialog__header {
  padding: 18px 22px 0;
}

::v-deep .control-dialog .el-dialog__title {
  color: #f5fbff;
  font-size: 18px;
  font-weight: 600;
}

::v-deep .control-dialog .el-dialog__headerbtn .el-dialog__close {
  color: rgba(198, 218, 230, 0.9);
}

::v-deep .control-dialog .el-dialog__body {
  padding: 18px 22px 24px;
  color: #dce8f1;
}

::v-deep .control-dialog .el-dialog__footer {
  padding: 0 22px 22px;
}

::v-deep .control-dialog .el-input__inner {
  height: 40px;
  line-height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(122, 210, 255, 0.14);
  color: #f5fbff;
}

::v-deep .control-dialog .el-input__inner::placeholder {
  color: rgba(198, 219, 233, 0.62);
}

::v-deep .control-dialog .el-form-item__label {
  color: rgba(225, 236, 245, 0.9);
  padding-bottom: 8px;
}

::v-deep .control-dialog .el-button {
  border-radius: 12px;
}

::v-deep .control-dialog .el-button--default {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(120, 215, 255, 0.14);
  color: #f5fbff;
}

::v-deep .control-dialog .el-button--primary {
  background: linear-gradient(135deg, #5db7ff 0%, #2f67f6 100%);
  border: 0;
  color: #fff;
  box-shadow: 0 12px 20px rgba(47, 103, 246, 0.26);
}
</style>
