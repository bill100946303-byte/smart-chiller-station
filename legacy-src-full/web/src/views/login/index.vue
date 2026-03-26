<template>
  <div class="login-container">
    <div class="login-backdrop" aria-hidden="true"></div>
    <div class="login-hero" aria-hidden="true"></div>
    <div class="login-glow login-glow-a" aria-hidden="true"></div>
    <div class="login-glow login-glow-b" aria-hidden="true"></div>
    <div class="login-shell">
      <section class="brand-panel">
        <img alt="" class="logo" src="@/assets/newLogo.png">
        <div class="brand-copy">
          <p class="eyebrow">ENERGY OPERATIONS PLATFORM</p>
          <h1>{{ $t('login.title') }}</h1>
          <p class="summary">
            面向冷站运行的统一入口。更清晰的信息层级，更稳定的操作节奏，更少的视觉噪音。
          </p>
        </div>
        <div class="brand-badges" aria-hidden="true">
          <span>实时监控</span>
          <span>能效分析</span>
          <span>权限管理</span>
        </div>
      </section>

      <section class="login-box">
        <el-form
            ref="loginForm"
            :model="loginForm"
            class="login-form"
            auto-complete="on"
            label-position="left"
        >
          <div class="form-head">
            <div class="title">{{ $t('login.title') }}</div>
            <div class="subtitle">Secure access to site operations</div>
          </div>

          <el-form-item prop="username">
            <img alt="" class="svg-container" src="../../assets/login/acount.png"/>
            <el-input
                ref="username"
                v-model="loginForm.username"
                auto-complete="off"
                name="username"
                placeholder="请输入用户名"
                tabindex="1"
                type="text"
                @keyup.enter.native="handleLogin"
            />
          </el-form-item>

          <el-tooltip
              v-model="capsTooltip"
              content="Caps lock is On"
              manual
              placement="right"
          >
            <el-form-item prop="password">
              <img alt="" class="svg-container" src="../../assets/login/pwds.png"/>
              <el-input
                  :key="passwordType"
                  ref="password"
                  v-model="loginForm.password"
                  :type="passwordType"
                  auto-complete="off"
                  name="password"
                  placeholder="请输入密码"
                  tabindex="2"
                  @blur="capsTooltip = false"
                  @keyup.native="checkCapslock"
                  @keyup.enter.native="handleLogin"
              />
              <span
                :class="['show-pwd', { 'is-open': passwordType !== 'password' }]"
                title="显示或隐藏密码"
                @click="showPwd"
              >
                <i class="el-icon-view pwd-icon"></i>
              </span>
            </el-form-item>
          </el-tooltip>

          <div class="LangSelect">
            <el-checkbox v-model="checked" class="remember">{{ $t('login.rememberPassword') }}</el-checkbox>
            <div class="row-actions">
              <div v-if="ifSwitchThemes" class="theme" @click="switchThemes">{{ $t('login.SwitchThemes') }}</div>
              <LangSelect v-if="ifLangSelect" class="lang"/>
            </div>
          </div>

          <div class="btn">
            <el-button
                :loading="loading"
                type="primary"
                @click.native.prevent="handleLogin"
            >{{ $t('login.logIn') }}
            </el-button
            >
          </div>
        </el-form>
      </section>
    </div>

    <el-dialog
        style="z-index: 2"
        title="权限验证"
        :visible.sync="codeDialog"
        :close-on-click-modal="false"
    >
      <div class="flex">
        <p>申请码</p>
        <el-input
            v-model="code1"
            :rows="2"
            class="textarea"
            placeholder="请输入授权码"
            readonly
            type="textarea"
        ></el-input>
      </div>
      <div class="flex">
        <p>授权码</p>
        <el-input
            v-model="code2"
            :rows="2"
            placeholder="请输入授权码"
            type="textarea"
        ></el-input>
      </div>

      <p class="tip">
        <span>*</span>
        提示：保存申请码后请联系管理员
      </p>

      <span slot="footer" class="dialog-footer">
        <el-button @click="codeDialog = false">取 消</el-button>
        <el-button type="primary" @click="sendCode">确 定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import {sendCode} from "@/api/user";
import {mapGetters} from "vuex";
import {saveUserInfo} from "@/api/usersetting/userpagehome";
import Storage from "@/utils/localstorage";
import CryptoJS from "crypto-js";
// import srcMp3 from '@/assets/warn.mp3'
import srcMp3 from '@/assets/warmBlank.mp3'; // 空白音频
import LangSelect from '@/components/LangSelect'

export default {
  components: {
    LangSelect
  },
  name: "Login",
  data() {
    return {
      loginForm: {
        username: Storage.get("username") || "",
        password: Storage.get("password") || "",
      },
      passwordType: "password",
      capsTooltip: false,
      loading: false,
      showDialog: false,
      redirect: undefined,
      otherQuery: {},
      checked: true,
      codeDialog: false, // 申请码弹窗
      code1: null,
      code2: null,
      contextMenuHandler: null,
      ifLangSelect: false,
      ifSwitchThemes: false
    };
  },
  computed: {
    ...mapGetters(["permission", "modelKey"]),
  },
  watch: {
    $route: {
      handler: function (route) {
        const query = route.query;
        if (query) {
          this.redirect = query.redirect;
          this.otherQuery = this.getOtherQuery(query);
        }
      },
      immediate: true,
    },
  },
  mounted() {
    // if (process.env.VUE_APP_IFLANGSELECT === 'true'){
    //   console.log('process2222222',process.env.VUE_APP_IFLANGSELECT)
    // }
    // if (process.env.VUE_APP_BASE_URL === 'https://www.ssge.com.cn:8098' || process.env.VUE_APP_BASE_URL === 'http://10.148.51.1:8098') {
    if (process.env.VUE_APP_BASE_URL === 'https://www.ssge.com.cn:8098') {
      this.ifSwitchThemes = true
    } else {
      this.ifSwitchThemes = false
    }
    if (process.env.VUE_APP_IFLANGSELECT === 'true') {
      this.ifLangSelect = true
    }
    if (this.loginForm.username === "") {
      this.$refs.username.focus();
    } else if (this.loginForm.password === "") {
      this.$refs.password.focus();
    }
    this.handleDecryption();
    // document.addEventListener('contextmenu', (event) => {
    //   console.log(event)
    //   event.preventDefault() // 禁用鼠标右键
    // });
    this.contextMenuHandler = (event) => {
      event.preventDefault(); // 禁用鼠标右键
    }
    document.addEventListener('contextmenu', this.contextMenuHandler);
  },
  beforeDestroy() {
    document.removeEventListener('contextmenu', this.contextMenuHandler);// 移除禁用鼠标右键
  },
  destroyed() {
  },
  methods: {
    switchThemes() {
      window.location.href = 'https://ln.szgreenenergy.com:3000/'
    },
    handleDecryption() {
      let getpsd = Storage.get("password");
      if (getpsd) {
        this.loginForm.password = CryptoJS.AES.decrypt(
            getpsd,
            "zs_qy"
        ).toString(CryptoJS.enc.Utf8);
      }
    },
    checkCapslock({shiftKey, key} = {}) {
      if (key && key.length === 1) {
        if (
            (shiftKey && key >= "a" && key <= "z") ||
            (!shiftKey && key >= "A" && key <= "Z")
        ) {
          this.capsTooltip = true;
        } else {
          this.capsTooltip = false;
        }
      }
      if (key === "CapsLock" && this.capsTooltip === true) {
        this.capsTooltip = false;
      }
    },
    showPwd() {
      if (this.passwordType === "password") {
        this.passwordType = "";
      } else {
        this.passwordType = "password";
      }
      this.$nextTick(() => {
        this.$refs.password.focus();
      });
    },
    ensurePermissionRoutes(roles = []) {
      return this.$store.dispatch("permission/generateRoutes", roles).then((accessRoutes) => {
        this.$router.addRoutes(accessRoutes);
        return accessRoutes;
      });
    },
    handleLogin() {
      this.$refs.loginForm.validate((valid) => {
        if (valid) {
          let mp3 = this.MP3; // 为了解除谷歌用户不交互，不会播放音乐
          mp3.src = srcMp3;
          mp3.play();
          setTimeout(() => {
            mp3.pause();
          }, 100)
          this.loading = true;
          let info = {
            ...this.loginForm,
            checked: this.checked,
          };
          this.$store
              .dispatch("user/login", info)
              .then((res) => {
                if (this.permission == 1) {
                  // 管理员
                  this.$router.push({
                    path: "/basesetting/objectmanage",
                  });
                } else {
                  // 用户权限，查询用户项目个数
                  this.$store
                      .dispatch("user/getInfo")
                      .then((res) => {
                        const projects = Array.isArray(res.appusergroup) ? res.appusergroup : [];
                        if (!projects.length) {
                          throw new Error("当前账号未绑定可访问项目");
                        }
                        return this.ensurePermissionRoutes(res.roles).then(() => {
                        var formData = new FormData();
                        formData.append("username", projects[0].username);
                        formData.append("userid", projects[0].userid);
                        formData.append("state", 1);

                        if (projects.length === 1) {
                          // 如果只有一个项目，直接跳转项目首页
                          this.$store.commit("user/SET_MODELKEY", projects[0].key);
                          this.$store.commit("user/SET_TEMPLATE", projects[0].template);
                          return this.$store
                              .dispatch("project/getMenuId", projects[0])
                              .then(() => {
                                return this.$router.replace({
                                  path: "/systemhomepage",
                                  query: {appinfo: projects[0]},
                                });
                              });
                        } else {
                          saveUserInfo('root', formData).then().catch(console.log);
                          // 多个项目，跳转项目管理页面
                          return this.$router.replace("/");
                        }
                        });
                      })
                      .catch((error) => {
                        this.loading = false;
                        if (window.localStorage.getItem("status") == 50000) {
                          this.codeDialog = true;
                          this.code1 = window.localStorage.getItem("code");
                        } else if (error) {
                          this.$message.error(error.message || error || "登录后初始化失败");
                        }
                      });
                }
                this.loading = false;
              })
              .catch((error) => {
                setTimeout((e) => {
                  if (this.loading == true) {
                    this.loading = false;
                    //     this.$message.error("请求超时，请稍后再试");
                  }
                }, 1000);
              });
        } else {
          console.log("错误提交!!");
          this.loading = false;
          return false;
        }
      });
    },
    // 发送申请码获取授权
    sendCode() {
      sendCode(this.code2)
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("授权成功");
              window.localStorage.removeItem("status");
              window.localStorage.removeItem("code");
              this.codeDialog = false;
            }
          })
          .catch(console.log);
    },
    getOtherQuery(query) {
      return Object.keys(query).reduce((acc, cur) => {
        if (cur !== "redirect") {
          acc[cur] = query[cur];
        }
        return acc;
      }, {});
    },
  },
};
</script>

<style lang="scss">
/* overall page chrome */
$bg-deep: #061424;
$bg-mid: #0d2a43;
$bg-line: rgba(150, 206, 255, 0.18);
$panel: rgba(9, 22, 35, 0.72);
$panel-strong: rgba(11, 28, 44, 0.88);
$line: rgba(151, 212, 255, 0.22);
$line-strong: rgba(151, 212, 255, 0.34);
$text-main: rgba(246, 252, 255, 0.96);
$text-soft: rgba(196, 220, 236, 0.72);
$accent: #54c7ff;
$accent-2: #0b7cff;

/* 修复input 背景不协调 和光标变色 */
/* Detail see https://github.com/PanJiaChen/vue-element-admin/pull/927 */

$light_gray: rgba(239, 248, 255, 0.96);
$cursor: #8be6ff;

@supports (-webkit-mask: none) and (not (cater-color: $cursor)) {
  .login-container .el-input input {
    color: $cursor;
  }
}

/* reset element-ui css */
.login-container {
  position: relative;
  width: 100vw;
  min-width: 100vw;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  background:
      radial-gradient(circle at 18% 18%, rgba(84, 199, 255, 0.16), transparent 24%),
      radial-gradient(circle at 82% 26%, rgba(11, 124, 255, 0.15), transparent 26%),
      linear-gradient(180deg, #09131f 0%, #0b1a2b 100%);

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
        linear-gradient(115deg, rgba(2, 8, 16, 0.78), rgba(2, 8, 16, 0.42)),
        linear-gradient(180deg, rgba(3, 8, 14, 0.12), rgba(3, 8, 14, 0.5));
    z-index: 0;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
        radial-gradient(circle at center, transparent 0 38%, rgba(4, 12, 22, 0.28) 68%, rgba(4, 12, 22, 0.62) 100%);
    z-index: 0;
    pointer-events: none;
  }

  .login-backdrop,
  .login-glow,
  .login-hero,
  .login-shell {
    position: absolute;
  }

  .login-backdrop {
    inset: 0;
    background: linear-gradient(180deg, rgba(4, 10, 16, 0.3), rgba(4, 10, 16, 0.6));
    z-index: 0;
  }

  .login-hero {
    inset: 7vh 8vw 12vh 8vw;
    border-radius: 42px;
    background:
        radial-gradient(circle at 18% 22%, rgba(84, 199, 255, 0.22) 0%, rgba(84, 199, 255, 0.04) 26%, transparent 42%),
        radial-gradient(circle at 80% 76%, rgba(11, 124, 255, 0.18) 0%, rgba(11, 124, 255, 0.04) 24%, transparent 40%),
        linear-gradient(135deg, rgba(9, 22, 34, 0.28) 0%, rgba(6, 15, 25, 0.08) 100%);
    border: 1px solid rgba(139, 209, 255, 0.08);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 30px 80px rgba(0, 0, 0, 0.12);
    opacity: 0.9;
    overflow: hidden;
    z-index: 1;

    &::before,
    &::after {
      content: "";
      position: absolute;
      border-radius: inherit;
      pointer-events: none;
    }

    &::before {
      inset: 16px;
      border: 1px solid rgba(121, 198, 255, 0.08);
      background:
          linear-gradient(135deg, rgba(15, 42, 65, 0.18) 0%, rgba(4, 10, 16, 0.06) 100%);
    }

    &::after {
      inset: 32px 18px;
      background:
          radial-gradient(circle at 25% 35%, rgba(92, 219, 229, 0.2) 0%, transparent 32%),
          radial-gradient(circle at 72% 64%, rgba(18, 111, 255, 0.18) 0%, transparent 34%);
      filter: blur(8px);
      opacity: 0.9;
    }
  }

  .login-glow {
    z-index: 1;
    border-radius: 999px;
    filter: blur(22px);
    opacity: 0.75;
    pointer-events: none;
  }

  .login-glow-a {
    width: 28vw;
    height: 28vw;
    left: -6vw;
    top: 8vh;
    background: rgba(26, 106, 255, 0.2);
  }

  .login-glow-b {
    width: 24vw;
    height: 24vw;
    right: -4vw;
    bottom: 8vh;
    background: rgba(84, 199, 255, 0.12);
  }

  .login-shell {
    inset: 0;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(320px, 1.1fr) minmax(360px, 0.9fr);
    gap: 2rem;
    align-items: center;
    width: min(1200px, calc(100vw - 48px));
    margin: 0 auto;
  }

  .brand-panel,
  .login-box {
    position: relative;
    border: 1px solid $line;
    border-radius: 28px;
    background: linear-gradient(180deg, rgba(10, 23, 36, 0.7), rgba(5, 15, 25, 0.88));
    box-shadow:
        0 30px 80px rgba(0, 0, 0, 0.38),
        inset 0 1px 0 rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(18px);
    overflow: hidden;
  }

  .brand-panel {
    min-height: 620px;
    padding: 44px 44px 38px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    color: $text-main;

    &::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
          radial-gradient(circle at 18% 16%, rgba(84, 199, 255, 0.16), transparent 30%),
          linear-gradient(135deg, rgba(255, 255, 255, 0.03), transparent 50%);
      pointer-events: none;
    }
  }

  .logo {
    position: relative;
    width: 170px;
    max-width: 52vw;
    margin-bottom: 26px;
    z-index: 1;
    filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.24));
  }

  .brand-copy {
    position: relative;
    z-index: 1;

    .eyebrow {
      margin: 0 0 14px;
      font-size: 12px;
      letter-spacing: 0.28em;
      color: rgba(148, 203, 255, 0.78);
    }

    h1 {
      margin: 0;
      font-size: clamp(34px, 4vw, 56px);
      line-height: 1.06;
      letter-spacing: 0.02em;
      color: $text-main;
      text-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
    }

    .summary {
      max-width: 34ch;
      margin-top: 20px;
      font-size: 15px;
      line-height: 1.8;
      color: $text-soft;
    }
  }

  .brand-badges {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 28px;

    span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      padding: 0 16px;
      border: 1px solid rgba(138, 210, 255, 0.16);
      border-radius: 999px;
      background: rgba(7, 18, 29, 0.45);
      color: rgba(229, 247, 255, 0.88);
      font-size: 13px;
      letter-spacing: 0.08em;
      backdrop-filter: blur(10px);
    }
  }

  .login-box {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 620px;
    padding: 28px;
    background:
        linear-gradient(180deg, rgba(11, 28, 44, 0.86), rgba(7, 18, 28, 0.92)),
        radial-gradient(circle at top, rgba(84, 199, 255, 0.12), transparent 48%);
  }

  .login-form {
    width: 100%;
    max-width: 410px;
    padding: 18px 10px 10px;
    color: $text-main;
  }

  .form-head {
    margin-bottom: 24px;

    .title {
      margin: 0;
      text-align: left;
      color: $text-main;
      font-size: 30px;
      line-height: 1.1;
      letter-spacing: 0.02em;
    }

    .subtitle {
      margin-top: 10px;
      font-size: 13px;
      letter-spacing: 0.18em;
      color: rgba(160, 201, 228, 0.72);
      text-transform: uppercase;
    }
  }

  .el-input {
    display: inline-block;
    width: 100%;

    input {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid transparent;
      -webkit-appearance: none;
      border-radius: 16px;
      padding: 14px 16px 14px 14px;
      color: $light_gray;
      height: 52px;
      caret-color: $cursor;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
      transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;

      &:-webkit-autofill {
        box-shadow: 0 0 0 1000px #0d2030 inset !important;
        -webkit-text-fill-color: #fff !important;
        caret-color: #8be6ff;
      }

      &::-webkit-input-placeholder {
        color: rgba(173, 208, 229, 0.68);
      }

      &:focus {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(84, 199, 255, 0.42);
        box-shadow:
            0 0 0 4px rgba(84, 199, 255, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.02);
      }
    }
  }

  .el-form-item {
    display: flex;
    align-items: center;
    margin: 18px 0 0;
    border: 1px solid rgba(112, 177, 232, 0.16);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.04);
    color: #fff;
    overflow: hidden;
    transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;

    &:focus-within {
      border-color: rgba(84, 199, 255, 0.44);
      background: rgba(255, 255, 255, 0.06);
      box-shadow: 0 0 0 4px rgba(84, 199, 255, 0.08);
      transform: translateY(-1px);
    }

    .el-form-item__content {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 0 14px;
    }

    .svg-container {
      width: 18px;
      flex: 0 0 18px;
      opacity: 0.9;
      filter: saturate(0.95) brightness(1.05);
    }

    .show-pwd {
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 16px;
      color: rgba(191, 229, 247, 0.82);
      cursor: pointer;
      user-select: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      transition: color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;

      &:hover {
        color: rgba(234, 247, 255, 0.96);
        background: rgba(84, 199, 255, 0.12);
      }

      &.is-open {
        color: #7be0ff;
        background: rgba(84, 199, 255, 0.14);
        box-shadow: 0 0 0 1px rgba(84, 199, 255, 0.18);
      }
    }

    .pwd-icon {
      color: inherit;
      font-size: 16px;
    }
  }

  .LangSelect {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 18px;
    color: #fff;

    .remember {
      color: rgba(232, 245, 255, 0.88);
      line-height: 1;
    }

    .row-actions {
      display: inline-flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }

    .theme {
      color: rgba(148, 203, 255, 0.92);
      cursor: pointer;
      font-size: 13px;
      white-space: nowrap;
    }

    .lang {
      color: rgba(232, 245, 255, 0.96);
      white-space: nowrap;
    }
  }

  .el-checkbox {
    color: rgba(232, 245, 255, 0.88);
  }

  .el-checkbox__input.is-checked .el-checkbox__inner {
    background: linear-gradient(135deg, $accent 0%, $accent-2 100%);
    border-color: rgba(84, 199, 255, 0.78);
  }

  .el-checkbox__input.is-checked + .el-checkbox__label {
    color: rgba(244, 252, 255, 0.96);
  }

  .el-checkbox__label {
    color: rgba(232, 245, 255, 0.88);
  }

  .btn {
    margin-top: 24px;

    display: flex;
    .el-button {
      width: 100%;
      height: 52px;
      border: none;
      border-radius: 16px;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.16em;
      color: #effcff;
      background: linear-gradient(135deg, rgba(84, 199, 255, 1) 0%, rgba(11, 124, 255, 1) 100%);
      box-shadow:
          0 18px 40px rgba(11, 124, 255, 0.28),
          inset 0 1px 0 rgba(255, 255, 255, 0.12);

      &:hover,
      &:focus {
        background: linear-gradient(135deg, rgba(99, 208, 255, 1) 0%, rgba(21, 135, 255, 1) 100%);
      }
    }
  }

  .el-dropdown {
    color: rgba(232, 245, 255, 0.96);

    .international-icon {
      width: 25px;
      height: 25px;
    }
  }
}
</style>

<style lang="scss" scoped>
.login-container {
  .login-shell {
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
  }

  .login-box {
    .login-form {
      .el-form-item {
        .el-input {
          width: 100%;
        }
      }
    }
  }

  .textarea {
    margin-bottom: 20px;
  }

  .tip {
    margin-top: 30px;

    span {
      color: red;
    }
  }

  @media (max-width: 1100px) {
    .login-shell {
      width: min(920px, calc(100vw - 32px));
      grid-template-columns: 1fr;
      gap: 18px;
    }

    .brand-panel,
    .login-box {
      min-height: auto;
    }

    .brand-panel {
      padding: 32px 28px;
    }
  }

  @media (max-width: 760px) {
    min-height: 100dvh;

    .login-shell {
      position: relative;
      inset: auto;
      transform: none;
      width: calc(100vw - 20px);
      padding: 14px 0;
      gap: 12px;
    }

    .brand-panel,
    .login-box {
      border-radius: 20px;
    }

    .brand-panel {
      padding: 24px 20px;

      .logo {
        width: 150px;
        margin-bottom: 18px;
      }

      .brand-copy {
        h1 {
          font-size: 30px;
        }

        .summary {
          max-width: none;
        }
      }
    }

    .login-box {
      padding: 18px 14px 16px;
    }

    .login-form {
      padding: 6px 0 4px;
    }

    .LangSelect {
      flex-direction: column;
      align-items: flex-start;

      .row-actions {
        width: 100%;
        justify-content: space-between;
      }
    }

    .form-head {
      .title {
        font-size: 26px;
      }
    }

    .btn .el-button {
      height: 50px;
      font-size: 15px;
    }
  }
}
</style>
