<template>
  <iframe :id="id" :src="mysrc"></iframe>
</template>
<script>
export default {
  props: ["id", "src"],
  data() {
    return {
      mysrc: ""
    };
  },
  created() {
    if (this.src != null) {
      this.mysrc = this.src;
    } else {
      this.mysrc = "http://www.baidu.com/";
    }
    console.log(this.mysrc);
  }
};
</script>