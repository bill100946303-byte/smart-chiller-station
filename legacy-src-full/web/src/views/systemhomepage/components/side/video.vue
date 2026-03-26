<template>
  <div class="box_vide">
    <div class="dialog-main1">
      <canvas v-show="h2651" id="testCanvas1" class="testCanvas"></canvas>
      <div v-show="h2641">
        <video id="testVideo1" class="testCanvas"></video>
      </div>
    </div>

    <div class="dialog-main2">
      <canvas v-show="h2652" id="testCanvas2" class="testCanvas"></canvas>
      <div v-show="h2642">
        <video id="testVideo2" class="testCanvas"></video>
      </div>
    </div>

    <div class="dialog-main3">
      <canvas v-show="h2653" id="testCanvas3" class="testCanvas"></canvas>
      <div v-show="h2643">
        <video id="testVideo3" class="testCanvas"></video>
      </div>
    </div>

    <!--    <div class="dialog-main4">-->
    <!--      <canvas v-show="h2654" id="testCanvas4" class="testCanvas"></canvas>-->
    <!--      <div v-show="h2644">-->
    <!--        <video id="testVideo4" class="testCanvas"></video>-->
    <!--      </div>-->
    <!--    </div>-->
  </div>
</template>

<script>

export default {
  name: "video_box",
  components: {},
  data() {
    return {
      PlayerControl: null,
      player1: null,
      player2: null,
      emptyShow: true,
      h2651: false,
      h2641: false,
      h2652: false,
      h2642: false,
      h2653: false,
      h2643: false,
      h2654: false,
      h2644: false,
      // navlist: [
      //   {
      //     name: "开始播放",
      //     component: 'play'
      //   }, {
      //     name: "停止播放",
      //     component: 'stop'
      //   }, {
      //     name: "暂停播放",
      //     component: 'pause'
      //   }, {
      //     name: "继续播放",
      //     component: 'continue'
      //   }, {
      //     name: "抓图",
      //     component: 'capture'
      //   },
      // ]
    }
  },

  mounted() {
    this.PlayerControl1 = PlayerControl
    this.PlayerControl2 = PlayerControl
    this.PlayerControl3 = PlayerControl
    this.play1()
    this.play2()
    this.play3()
  },
  methods: {
    play1() {
      let that = this
      let canvas1 = document.getElementById('testCanvas1');
      let video1 = document.getElementById('testVideo1');
      let options1 = {
        wsURL: `ws://192.168.111.201/rtspoverwebsocket`,
        rtspURL: `rtsp://192.168.111.201:37777/cam/realmonitor?channel=1&subtype=0&proto=Private3`,
        username: 'admin',
        password: 'ln/123456'
      };
      this.player1 = new this.PlayerControl1(options1);
      this.player1.on('WorkerReady', function () {
        that.player1.connect();
      });
      this.player1.on('DecodeStart', function (rs) {
        console.log('开始解码');
        console.log(rs);
        if (rs.encodeMode === "h264") {
          that.h2641 = true
          that.h2651 = false
        } else {
          that.h2651 = true
          that.h2641 = false
        }
      });

      this.player1.on('PlayStart', function (rs) {
        console.log('开始播放');
        console.log(rs);
      });

      this.player1.on('Error', function (rs) {
        console.log('发生错误');
        console.log(rs);
        that.player1.close();
        if (rs.errorCode === 101) {
          that.play1()
        } else {
          that.emptyShow = false
        }
      });

      this.player1.init(canvas1, video1);
    },
    play2() {
      let that = this
      let canvas2 = document.getElementById('testCanvas2');
      let video2 = document.getElementById('testVideo2');
      let options2 = {
        wsURL: `ws://192.168.111.202/rtspoverwebsocket`,
        rtspURL: `rtsp://192.168.111.202:37777/cam/realmonitor?channel=1&subtype=0&proto=Private3`,
        username: 'admin',
        password: 'ln/123456'
      };
      this.player2 = new this.PlayerControl2(options2);
      this.player2.on('WorkerReady', function () {
        that.player2.connect();
      });
      this.player2.on('DecodeStart', function (rs) {
        console.log('开始解码');
        console.log(rs);
        if (rs.encodeMode === "h264") {
          that.h2642 = true
          that.h2652 = false
        } else {
          that.h2652 = true
          that.h2642 = false
        }
      });

      this.player2.on('PlayStart', function (rs) {
        console.log('开始播放');
        console.log(rs);
      });

      this.player2.on('Error', function (rs) {
        console.log('发生错误');
        console.log(rs);
        that.player2.close();
        if (rs.errorCode === 101) {
          that.play2()
        } else {
          that.emptyShow = false
        }
      });

      this.player2.init(canvas2, video2);
    },
    play3() {
      let that = this
      let canvas3 = document.getElementById('testCanvas3');
      let video3 = document.getElementById('testVideo3');
      let options3 = {
        wsURL: `ws://192.168.111.203/rtspoverwebsocket`,
        rtspURL: `rtsp://192.168.111.203:37777/cam/realmonitor?channel=1&subtype=0&proto=Private3`,
        username: 'admin',
        password: 'ln/123456'
      };
      this.player3 = new this.PlayerControl2(options3);
      this.player3.on('WorkerReady', function () {
        that.player3.connect();
      });
      this.player3.on('DecodeStart', function (rs) {
        console.log('开始解码');
        console.log(rs);
        if (rs.encodeMode === "h264") {
          that.h2643 = true
          that.h2653 = false
        } else {
          that.h2653 = true
          that.h2643 = false
        }
      });

      this.player3.on('PlayStart', function (rs) {
        console.log('开始播放');
        console.log(rs);
      });

      this.player3.on('Error', function (rs) {
        console.log('发生错误');
        console.log(rs);
        that.player3.close();
        if (rs.errorCode === 101) {
          that.play3()
        } else {
          that.emptyShow = false
        }
      });

      this.player3.init(canvas3, video3);
    },
  },
}
</script>

<style lang="scss" scoped>
.box_vide {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
}

.dialog-main1, .dialog-main2, .dialog-main3, .dialog-main4 {
  width: 49%;
  height: 50%;
  margin-bottom: 5px;
  border: 1px solid red;

  .testCanvas {
    width: 100%;
    height: 50vh;
  }
}
</style>