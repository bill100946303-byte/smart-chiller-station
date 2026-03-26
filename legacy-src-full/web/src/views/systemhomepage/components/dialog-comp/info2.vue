<template>
  <div style="width: 100%; height: 100%">
    <iframe
        ref="iframe"
        :src="src"
        allowfullscreen
        frameborder="0"
        mozallowfullscreen
        style="width: 100%; height: 100%"
        webkitallowfullscreen
    ></iframe>
  </div>
</template>

<script>
export default {
  name: "info",
  props: ["device2Durl"],
  computed: {
    src() {
      return this.device2Durl;
    }
  },
}
</script>

<style scoped>

</style>