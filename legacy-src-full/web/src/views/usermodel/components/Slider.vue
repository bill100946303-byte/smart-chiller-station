<template>
    <div class="block">
      <el-slider v-model="value" />
    </div>
</template>
<script>
export default {
  data() {
    return {
      value: ""
    };
  }
};
</script>