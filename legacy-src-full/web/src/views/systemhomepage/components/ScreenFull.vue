<template>
  <div class="screen-full">
    <div
      class="screen-full__button"
      :title="isFullscreen ? '退出全屏' : '进入全屏'"
      @click="handleFullScreen"
    >
      <!--      <img title="切换全屏" src="../../../assets/home/11.png" alt="" />-->
      <!--      <i class="al_element-icons2 al_icon2chuangkouzuidahua" style="font-size: 55px;"></i>-->
      <i class="al_element-icons2 al_icon2AIgaitu-chuangkouzuidahua-114x1151 screen-full__icon"></i>
    </div>
  </div>
</template>
<script>
import screenfull from "screenfull"; //引入依赖

export default {
  name: "ScreenFull",
  data() {
    return {
      isFullscreen: false, //是否全屏
      istilte: "",
    };
  },
  mounted() {
    this.init();
  },
  beforeDestroy() {
    this.destroy();
  },
  methods: {
    handleFullScreen() {
      if (!screenfull.isEnabled) {
        if (this.$message) {
          this.$message.info("当前浏览器不支持全屏模式");
        }
        return false;
      }
      screenfull.toggle();
    },
    change() {
      this.isFullscreen = screenfull.isFullscreen;
    },
    init() {
      if (screenfull.isEnabled) {
        screenfull.on("change", this.change);
      }
    },
    destroy() {
      if (screenfull.isEnabled) {
        screenfull.off("change", this.change);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.screen-full__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.screen-full__icon {
  font-size: 24px;
  color: currentColor;
}
</style>
