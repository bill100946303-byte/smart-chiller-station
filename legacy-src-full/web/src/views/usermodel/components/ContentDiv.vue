<template>
  <el-tooltip class="item" effect="dark" placement="right" :disabled="!tip">
    <div slot="content">
      <p>{{tip}}</p>
    </div>
    <div :id="id"></div>
  </el-tooltip>
</template>
<script>
export default {
  props: ["id", "tip"],
  data() {
    return {};
  }
};
</script>