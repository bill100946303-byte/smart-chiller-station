<template>
  <div class="progress-box">
    <el-progress :id="id" :stroke-width="10" :percentage="70" />
  </div>
</template>
<script>
export default {
  props: ["id"],
  data() {
    return {
      value: ""
    };
  }
};
</script>
<style lang="scss" scoped>
.progress-box {
  width: 500px;
}
</style>
<style lang="scss">
.el-progress-bar__outer {
  background-color: transparent;
}
.el-progress__text {
  color: #44f0e9;
}
.el-progress-bar__inner {
  background: linear-gradient(to right, #0055a4, #44f0e9);
}
</style>