<template>
  <iframe :id="id" :src="mysrc"></iframe>
</template>
<script>
export default {
  props: ["id", "src"],
  data() {
    return {
      mysrc: "",
    };
  },
  created() {
    if (this.src != null) {
      let params = this.src.split(",");
      console.log(params);
      this.mysrc =
        // "http://" +
        // window.location.host +
        process.env.VUE_APP_BASE_URL +
        "/static/remotedesktop/vnc_auto.html?host=" +
        params[0] +
        "&port=5901&encrypt=0&true_color=1&password=" +
        params[1];
    } else {
      this.mysrc = "http://www.baidu.com/";
    }
    console.log(this.mysrc);
  },
};
</script>