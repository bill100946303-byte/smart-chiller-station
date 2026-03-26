<template>
  <div class="container"></div>
</template>
<script>
import { mapGetters } from "vuex";
import {
  findDeviceTypeInfo,
  findPicByMenuId,
} from "@/api/usersetting/devicemonitor/devicemonitor";

export default {
  computed: {
    ...mapGetters(["path", "id"]),
  },
  data () {
    return {};
  },
  created () {
    findPicByMenuId(this.path, this.$route.meta.id)
      .then((res) => {
        if (res.data != null) {
          this.$router.push({
            path: "/devicemonitor/usermodel/Model" + res.data.picmodeid,
            query: { id: res.data.picid, status: 0 },
          });
        } else {
          window.localStorage.setItem(
            "appinfo",
            JSON.stringify(this.$route.query.appinfo)
          );

          this.$router.push({
            name: 'defaultpage', //默认首页
          });
        }
      })
      .catch(console.log);
  },
  methods: {},
};
</script>
<style lang="scss" scoped>
.container {
  padding: 20px;
  height: 1030px;
  background:
      radial-gradient(circle at 20% 20%, rgba(84, 199, 255, 0.14) 0%, transparent 24%),
      radial-gradient(circle at 80% 18%, rgba(11, 124, 255, 0.14) 0%, transparent 26%),
      linear-gradient(180deg, #091320 0%, #0b1a2a 100%);
  background-attachment: fixed;
}
</style>
