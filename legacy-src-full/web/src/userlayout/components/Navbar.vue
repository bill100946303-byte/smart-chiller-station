<template>
  <div id="navbar" class="navbar" ref="navbar">
    <hamburger
      id="hamburger-container"
      :is-active="sidebar.opened"
      class="hamburger-container"
      @toggleClick="toggleSideBar"
    />
    <div class="right-menu">
      <div
        class="logo"
        v-if="appLogo"
        :style="flag == 4 ? 'color:#000;' : 'color:#fff;'"
      >
        <p v-if="appLogo.applogotype === 1">{{ appLogo.applogotext }}</p>
        <img v-if="appLogo.applogotype === 2" :src="appLogo.applogoimg" />
      </div>
      <div
        :class="[
          colortheme == 'light' ? 'lighttheme' : 'darktheme',
          'right-flex',
        ]"
      >
        <div class="project-time">
          <div class="weather">
            <p>{{ this.city }}</p>
            <p style="margin-left: 10px">
              <!-- {{ weatherData == "" ? "晴" : weatherData.now.temperature }}
                {{ weatherData == "" ? "4" : weatherData.now.weather }}℃ -->
              <!-- {{ weatherData.now.temperature }}℃ -->
              {{ weather == "" ? "晴" : weather }}
              {{ temperature == "" ? "4" : temperature }}℃
            </p>
          </div>
          <div class="date">{{ nowDate }}&nbsp;&nbsp;&nbsp;</div>
        </div>

        <div class="message">
          <el-badge
            id="linkage"
            :value="linkageNum"
            :max="99"
            :class="[
              colortheme == 'light' ? 'lighttheme' : 'darktheme',
              'item',
            ]"
          >
            <svg-icon icon-class="newsa" class="svg" @click="selectLinkage" />
          </el-badge>
          <el-badge
            id="alarm"
            :value="alarmNum"
            :max="99"
            :class="[
              colortheme == 'light' ? 'lighttheme' : 'darktheme',
              ,
              'item',
            ]"
          >
            <svg-icon icon-class="alert" class="svg" @click="selectAlarm" />
            <!-- <audio id="audio" controls="controls" hidden>
                <source src="../../assets/music/alarm.mp3" type="audio/ogg" />
              </audio> -->
          </el-badge>
        </div>
        <el-popover placement="bottom" width="250" trigger="click">
          <div
            :class="[
              colortheme == 'light' ? 'lighttheme' : 'darktheme',
              'my-peeling',
            ]"
          >
            <p
              class="color-picker"
              v-for="(value, key) in colorlist"
              :key="key"
              :style="`backgroundColor:${colorlist[key].color}`"
              @click="changBackGround(key)"
            ></p>
          </div>

          <svg-icon
            icon-class="yifu"
            slot="reference"
            :class="[colortheme == 'light' ? 'lighttheme' : 'darktheme', 'svg']"
          />
        </el-popover>

        <el-dropdown
          class="avatar-container right-menu-item hover-effect"
          trigger="click"
        >
          <div
            :class="[
              colortheme == 'light' ? 'lighttheme' : 'darktheme',
              'avatar-wrapper',
            ]"
          >
            <svg-icon icon-class="useravar" class="user-avatar" />
            <span>{{ name }}</span>
          </div>
          <el-dropdown-menu slot="dropdown">
            <router-link to="/" v-if="appusergroup.length > 1">
              <el-dropdown-item>项目管理</el-dropdown-item>
            </router-link>
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
        <el-dialog
          :modal="false"
          title="修改密码"
          :visible.sync="updateVisible"
        >
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
  </div>
</template>

<script>
import axios from "axios";
import { mapGetters } from "vuex";
import Hamburger from "@/components/Hamburger/user";
import Screenfull from "@/components/Screenfull";
import { saveUserInfo } from "@/api/usersetting/userpagehome";
import { formatDate } from "@/utils/index";
import { changePass } from "@/api/user";
import { findApiInfo } from "@/api/basesetting/apimanage";
import { updateUser } from "@/api/user";
import Bus from "@/utils/bus";
import { theme } from "@/styles/style";
import { toggleClass } from "@/utils";
// import "@/assets/custom-theme/darkblue.css";

const themeStyleLoaders = {
  blue: () =>
    import(
      /* webpackChunkName: "user-theme-blue" */ "@/assets/custom-theme/blue.css"
    ),
  dark: () =>
    import(
      /* webpackChunkName: "user-theme-dark" */ "@/assets/custom-theme/dark.css"
    ),
  green: () =>
    import(
      /* webpackChunkName: "user-theme-green" */ "@/assets/custom-theme/green.css"
    ),
  purple: () =>
    import(
      /* webpackChunkName: "user-theme-purple" */ "@/assets/custom-theme/purple.css"
    ),
};

const loadedThemeStyles = {};
export default {
  inject: ["reload"],
  components: {
    Screenfull,
    Hamburger,
  },
  computed: {
    ...mapGetters([
      "path",
      "sidebar",
      "avatar",
      "device",
      "name",
      "city",
      "IP",
      "logo",
      "userid",
      "matureTime",
      "colortheme",
    ]),
  },
  watch: {
    colortheme: {
      async handler(val) {
        const nextTheme = val || "dark";
        await this.ensureThemeStyles(nextTheme);
        this.$nextTick(() => {
          this.$refs.navbar.style.backgroundColor =
            theme[nextTheme].color;
        });
        toggleClass(document.body, nextTheme);
      },
      immediate: true,
    },
  },
  data() {
    let validatePass = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("请输入密码"));
      } else {
        if (this.ruleForm.checkPass !== "") {
          this.$refs.ruleForm.validateField("checkPass");
        }
        callback();
      }
    };
    let validatePass2 = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("请再次输入密码"));
      } else if (value !== this.ruleForm.pass) {
        callback(new Error("两次输入密码不一致!"));
      } else {
        callback();
      }
    };
    return {
      colorlist: theme,
      ruleForm: {
        oldPass: "",
        pass: "",
        checkPass: "",
      },
      rules: {
        pass: [{ validator: validatePass, trigger: "blur" }],
        checkPass: [{ validator: validatePass2, trigger: "blur" }],
      },
      updateVisible: false, // 修改密码弹窗
      nowDate: "", // 当前时间
      weatherData: "", // 当前天气
      websock: null,
      wsuri: null,
      alarmNum: 0, // 报警数量
      linkageNum: 0, // 联动数量
      appLogo: null, // 项目logo
      code1: "", // 申请码
      code2: "", // 授权码
      appusergroup: [],
      flag: 0,

      temperature: "", //高德天气温度
      weather: "",
    };
  },
  destroyed() {
    // 离开路由之后断开websocket连接
    this.websock.close();
  },
  created() {
    this.$store
      .dispatch("user/getInfo")
      .then((res) => {
        this.appusergroup = res.appusergroup;
      })
      .catch(console.log);
    if (this.logo != null && this.logo != "null") {
      this.appLogo = JSON.parse(this.logo);
      console.log(this.appLogo);
      this.appLogo.applogoimg =
        // "http://" + window.location.host + this.appLogo.applogoimg;
        process.env.VUE_APP_BASE_URL+ this.appLogo.applogoimg;
        
    } else {
      this.appLogo = {
        applogotype: 1,
        applogotext: "设备运维管理平台",
      };
    }
    if (window.localStorage.getItem("alarmNum") != null) {
      this.alarmNum = window.localStorage.getItem("alarmNum");
    }
    if (window.localStorage.getItem("linkageNum") != null) {
      this.linkageNum = window.localStorage.getItem("linkageNum");
    }
    // 获取天气
    findApiInfo()
      .then((res) => {
        res.data.records.forEach((ele) => {
          if (ele.interfaceType == 2) {
            this.appid = ele.appid;
            this.secret = ele.key;
            // 查询天气
            let formData = new FormData();
            formData.append("showapi_timestamp", this.formatterDateTime());
            formData.append("showapi_appid", this.appid);
            formData.append("showapi_sign", this.secret);
            formData.append("area", this.city);
            formData.append("needMoreDay", 0);
            formData.append("needIndex", 0);
            formData.append("needHourData", 0);
            formData.append("need3HourForcast", 0);
            formData.append("needAlarm", 0);
            axios
              .get(
                "https://restapi.amap.com/v3/weather/weatherInfo?key=c920b755a608ad8536941c2a5cb5127a&city=330500"
              )
              .then((res) => {
                res.data.lives.forEach((ele) => {
                  this.temperature = ele.temperature;
                  this.weather = ele.weather;
                });
              })
              .catch(console.log);
          }
        });
      })
      .catch(console.log);

    // 获取报警消息
    this.wsuri = "ws://" + this.IP + "/accesslog/ws/" + this.userid;
    // this.wsuri = "ws://192.168.3.7:50271/accesslog/ws/" + this.userid;
    this.initWebSocket();
    this.websocketonopen();
  },
  mounted() {
    setInterval(() => {
      this.getNowTime();
    }, 1000);
  },
  methods: {
    ensureThemeStyles(themeName) {
      if (!themeName || themeName === "light") {
        return Promise.resolve();
      }
      if (!themeStyleLoaders[themeName]) {
        return Promise.resolve();
      }
      if (!loadedThemeStyles[themeName]) {
        loadedThemeStyles[themeName] = themeStyleLoaders[themeName]();
      }
      return loadedThemeStyles[themeName];
    },
    changBackGround(theme) {
      this.$store.commit("user/SET_THEME", theme);
      updateUser({ id: this.userid, skinColor: theme });
    },
    toggleSideBar() {
      this.$store.dispatch("app/toggleSideBar");
    },
    // 退出登录
    logout() {
      // 记录用户信息
      var formData = new FormData();
      formData.append("userid", this.userid);
      formData.append("username", this.name);
      formData.append("state", 0);
      saveUserInfo(this.path, formData).then().catch(console.log);
      setTimeout(() => {
        // logout().then().catch(console.log);
        // this.$store.dispatch("user/logout");
        // this.$router.push("/login");
        this.$store.dispatch("user/logout");
        this.$router.push("/login");
        window.location.reload();
      }, 1000);
    },
    // 获取当前时间
    getNowTime() {
      this.nowDate = formatDate(new Date().getTime());
    },
    formatterDateTime() {
      var date = new Date();
      var month = date.getMonth() + 1;
      var datetime =
        date.getFullYear() +
        "" + // "年"
        (month >= 10 ? month : "0" + month) +
        "" + // "月"
        (date.getDate() < 10 ? "0" + date.getDate() : date.getDate()) +
        "" +
        (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) +
        "" +
        (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) +
        "" +
        (date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds());
      return datetime;
    },
    // 修改密码
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

    initWebSocket() {
      console.log("this.websock", this.websock);
      //初始化weosocket
      try {
        this.websock = new WebSocket(this.wsuri);
        this.websock.onmessage = this.websocketonmessage;
        this.websock.onopen = this.websocketonopen;
        this.websock.onerror = this.websocketonerror;
        this.websock.onclose = this.websocketclos;
      } catch (error) {
        console.log("erro");
      }
    },
    websocketonopen() {
      //连接建立之后执行send方法发送数据
      if (this.websock.readyState === 1) {
        let actions = { test: "12345" };
        this.websocketsend(JSON.stringify(actions));
      }
    },
    websocketonerror() {
      //连接建立失败重连
      console.log("err");
      // this.initWebSocket();
    },
    websocketonmessage(e) {
      //数据接收
      let redata;
      try {
        redata = JSON.parse(e.data);
      } catch (error) {
        console.log(redata, "+-+-+-+-+-+-+-");
      }

      console.log(redata, "1");
      if (redata && redata.type === "0") {
        if (redata.alarmType === "0") {
          this.$nextTick(function () {
            let audio = document.getElementById("audio"); //获取audio元素
            audio.play(); //播放
          });
          this.alarmNum++;
          window.localStorage.setItem("alarmNum", this.alarmNum);
        } else {
          if (this.alarmNum != 0) {
            this.alarmNum--;
          }
        }
      } else if (redata && redata.type === "1") {
        if (redata.alarmType === "0") {
          // this.$nextTick(function () {
          //   let audio = document.getElementById("audio"); //获取audio元素
          //   audio.play(); //播放
          // });
          this.linkageNum++;
          window.localStorage.setItem("linkageNum", this.linkageNum);
        } else {
          this.linkageNum--;
        }
      } else if (redata && redata.type === "2") {
        if (redata.picid == "-1") {
          // 视频联动页面
          let msg = redata.value.split(",");
          let url =
            this.global.baseUrl +
            "/static/video/previewvideo.html?" +
            msg[0] +
            "&" +
            msg[1] +
            "&" +
            msg[2] +
            "&" +
            msg[3];
          console.log(url);
          window.open(url);
        } else {
          this.$router.push({
            path: "/devicemonitor/usermodel/Model" + redata.modeid,
            query: { id: redata.picid, status: 1 },
          });
        }
      } else if (redata && redata.type === "4") {
        let info = JSON.parse(redata.value);
        this.$notify.info({
          title: "定期维护信息",
          dangerouslyUseHTMLString: true,
          message:
            "您有" +
            info.length +
            '条设备维护信息未处理<a style="color:blue;">查看</a>',
          position: "bottom-right",
          onClick: (res) => {
            this.$router.push("/deviceoperation/devicemanage/fixdefend");
          },
        });
        console.log(info);
      }
    },
    websocketsend(Data) {
      //数据发送
      this.websock.send(Data);
    },
    websocketclose(e) {
      this.websock.close();
      //关闭
      console.log("断开连接", e);
    },
    // 点击报警
    selectAlarm() {
      console.log(8888);
      this.alarmNum = 0;
      window.localStorage.setItem("alarmNum", this.alarmNum);
      this.$router.push("/alarmlog/timealarm");
    },
    // 点击联动
    selectLinkage() {
      this.linkageNum = 0;
      window.localStorage.setItem("linkageNum", this.linkageNum);
      this.$router.push({
        path: "/linkagemanage/LinkageLog",
        query: { state: 0 },
      });
    },
  },
};
</script>

<style lang="scss" >
$shadow: var(--nav-shadow);
.navbar {
  height: 50px;
  overflow: hidden;
  position: relative;
  z-index: 12;
  box-shadow: 0 1px 4px $shadow;

  .hamburger-container {
    line-height: 50px;
    height: 100%;
    float: left;
    cursor: pointer;
    transition: background 0.3s;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      background: rgba(0, 0, 0, 0.025);
    }
  }

  .breadcrumb-container {
    float: left;
  }

  .errLog-container {
    display: inline-block;
    vertical-align: top;
  }
  .right-menu {
    display: flex;
    justify-content: space-between;
    height: 100%;

    &:focus {
      outline: none;
    }

    .logo {
      p {
        margin-right: 100px;
        font-size: 18px;

        // overflow: hidden; //超出部分隐藏
        // font-style: oblique; //倾斜
        // text-align: left;
        // line-height: 3rem; //垂直居中
        // background-image: -webkit-linear-gradient(
        //   left,
        //   green,
        //   yellow,
        //   pink,
        //   blue,
        //   red 25%,
        //   green 35%,
        //   blue 50%,
        //   yellow 60%,
        //   red 75%,
        //   pink 85%,
        //   blue 100%
        // ); //括号内可添加多种颜色，多种百分比   线性渐变
        // -webkit-text-fill-color: transparent; //颜色填充 透明
        // -webkit-background-clip: text; //背景颜色绘制区域
        // animation: stream 15s infinite linear; //流动 15秒 循环 直线
        // background-size: 200% 100%;
      }
      // @keyframes stream {
      //   //匀速流动
      //   0% {
      //     background-position: 0 0;
      //   }
      //   100% {
      //     background-position: -100% 0;
      //   }
      // }
    }

    .right-flex {
      display: flex;
      align-items: center;
      &.lighttheme {
        color: rgba(0, 0, 0, 0.85);
      }
      &.darktheme {
        color: rgba(255, 255, 255, 1);
      }
      .svg {
        cursor: pointer;
        font-size: 24px;
      }
    }

    .message {
      display: flex;
      alig-items: center;
      justify-content: center;
      cursor: pointer;
      .item {
        margin-right: 40px;
        .el-badge__content {
          top: 6px;
          right: 0;
        }
        .svg {
          font-size: 24px;
        }
        &.lighttheme {
          .svg {
            color: rgba(0, 0, 0, 0.85);
          }
        }
        &.darktheme {
          .svg {
            color: rgba(255, 255, 255, 1);
          }
        }
      }
    }

    .peeling {
      margin-top: 13px;
      margin-right: 10px;
      width: 25px;
      height: 25px;
      cursor: pointer;
    }

    .project-time {
      padding-right: 15px;
      height: 100%;
      display: flex;
      justify-content: center;
      text-align: center;
      flex-direction: column;
      p {
        margin: 0;
        padding: 0;
        line-height: 25px;
      }
      .date,
      .weather {
        line-height: 20px;
      }

      .weather {
        display: flex;
        justify-content: center;
        font-size: 12px;
      }

      .date {
        font-size: 12px;
        text-align: center;
      }
    }

    .right-menu-item {
      display: flex;
      align-items: center;
      padding: 0 8px 0 15px;
      height: 100%;
      font-size: 18px;
      color: var(--theme-color);
      vertical-align: text-bottom;

      &.hover-effect {
        cursor: pointer;
        transition: background 0.3s;

        &:hover {
          background: rgba(0, 0, 0, 0.025);
        }
      }
    }

    .avatar-container {
      margin-right: 30px;

      .avatar-wrapper {
        cursor: pointer;
        position: relative;
        display: flex;
        align-items: center;
        font-size: 14px;
        .user-avatar {
          font-size: 24px;
          cursor: pointer;
          margin-right: 5px;
        }

        &.lighttheme {
          .user-avatar {
            color: rgba(0, 0, 0, 0.85);
          }
          span {
            color: rgba(0, 0, 0, 0.85);
          }
        }
        &.darktheme {
          .user-avatar {
            color: rgba(255, 255, 255, 1);
          }
          span {
            color: rgba(255, 255, 255, 1);
          }
        }
      }
    }
  }
}
</style>
<style lang="scss">
.message {
  .item {
    .el-badge__content {
      border: 1px solid #ff4949;
    }
  }
}
.my-peeling {
  display: flex;
  justify-content: space-between;
  background: #efefef;
  .color-picker {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }
  &.lighttheme {
    .svg {
      color: rgba(0, 0, 0, 0.85);
    }
  }
  &.darktheme {
    .svg {
      color: rgba(255, 255, 255, 1);
    }
  }
}
</style>
