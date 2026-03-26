<template>
  <div>
    <div class="navs-wrapper">
      <div class="navs">
        <div v-if="drTitleName" class="drName">{{ drTitleName }}</div>
        <div
            v-for="(item, index) in navlist"
            :key="index"
            :class="[nav == index ? 'active' : '', 'nav-item']"
            @click="changenav(item.name, item.component,index)"
        >
          {{ item.name }}
        </div>
      </div>
      <i class="el-icon-error close" @click="close"></i>
    </div>

    <div v-if="emptyShow" class="dialog-main">
      <canvas v-show="h265" id="testCanvas"></canvas>
      <div v-show="h264">
        <video id="testVideo"></video>
      </div>
    </div>
    <el-empty v-else description="暂无数据"></el-empty>
  </div>
</template>

<script>
export default {
  name: "monitor",
  props: ['drName', 'drId', 'runningid', 'drTitleName'],
  data() {
    return {
      PlayerControl: null,
      player: null,
      nav: 0,
      emptyShow: true,
      h265: false,
      h264: false,
      navlist: [
        {
          name: "开始播放",
          component: 'play'
        }, {
          name: "停止播放",
          component: 'stop'
        }, {
          name: "暂停播放",
          component: 'pause'
        }, {
          name: "继续播放",
          component: 'continue'
        }, {
          name: "抓图",
          component: 'capture'
        },
      ]
    }
  },
  mounted() {
    console.log('mounted')
    this.PlayerControl = PlayerControl
    this.play()
  },
  methods: {
    changenav(name, component, index) {

      this.nav = index;
      this[component]()
      // console.log('name', name, index)
    },
    play() {
      console.log('开始播放', this.runningid)
      let that = this
      let canvas = document.getElementById('testCanvas');
      let video = document.getElementById('testVideo');
      let options = {
        wsURL: `ws://192.168.111.${this.runningid}/rtspoverwebsocket`,
        rtspURL: `rtsp://192.168.111.${this.runningid}:37777/cam/realmonitor?channel=1&subtype=0&proto=Private3`,
        username: 'admin',
        password: 'ln/123456'
      };

      this.player = new this.PlayerControl(options);
      this.player.on('WorkerReady', function () {
        that.player.connect();
      });
      this.player.on('DecodeStart', function (rs) {
        console.log('开始解码');
        console.log(rs);
        if (rs.encodeMode === "h264") {
          that.h264 = true
        } else {
          that.h265 = true
        }
      });
      this.player.on('PlayStart', function (rs) {
        console.log('开始播放');
        console.log(rs);
      });

      this.player.on('Error', function (rs) {
        console.log('发生错误');
        console.log(rs);
        that.player.close();
        if (rs.errorCode === 101) {
          that.play()
        } else {
          that.emptyShow = false
        }
      });
      this.player.on('FileOver', function (rs) {
        console.log('回放播放完成');
        console.log(rs);
      });
      this.player.on('MSEResolutionChanged', function (rs) {
        console.log('分辨率改变');
        console.log(rs);
      });
      this.player.on('FrameTypeChange', function (rs) {
        console.log('编码模式改变');
        console.log(rs);
      });
      this.player.on('audioChange', function (rs) {
        console.log('音频编码改变');
        console.log(rs);
      });
      this.player.init(canvas, video);
    },
    pause() {
      this.player.pause();
      console.log('暂停播放')
    },
    continue() {
      this.player.play()
      console.log('继续播放')
    },
    stop() {
      this.player.close()
      console.log('停止播放')
    },
    capture() {
      this.player.capture()
      console.log('抓图')
    },
    close() {
      this.stop()
      this.emptyShow = true
      setTimeout(() => {
        this.$emit("close");
      }, 100)
    },
  }
}
</script>

<style lang="scss" scoped>
.navs-wrapper {
  position: relative;
  box-sizing: border-box;
  height: 40px;
  flex-shrink: 0;
  background: rgba(143, 203, 248, 0.7);
  border-radius: 4px 4px 0px 0px;

  .close {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: 10px;
    font-size: 25px;
    cursor: pointer;
    color: rgba(5, 11, 13, 0.7);
  }
}

.navs {
  display: flex;
  height: 100%;
  align-items: flex-end;
  opacity: 1;

  .nav-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 104px;
    height: 37px;
    margin: 0 1.5px;
    cursor: pointer;
    background: rgba(51, 123, 177, 0.6);
    font-size: 17px;
    font-family: Alibaba PuHuiTi;
    font-weight: 400;
    color: #fff;
    border-radius: 5px 5px 0 0;

    &.active {
      background: rgba(53, 159, 237, 1);
    }
  }
}

.dialog-main {
  flex: 1;
  overflow: auto;
  color: #9c9c9c;
  background-color: #000;
  padding: 0px 30px 0 43px;
  margin-top: 10px;

  #testCanvas {
    width: 100%;
    //height: 800px;
  }

  #testVideo {
    width: 100%;
    //height: 800px;
  }
}
</style>