<template>
  <section class="app-main">
    <transition name="fade-transform" mode="out-in">
      <keep-alive :include="cachedViews">
        <router-view :key="key" />
      </keep-alive>
    </transition>
  </section>
</template>

<script>
import Cookies from "js-cookie";
import { mapGetters } from "vuex";
export default {
  name: "AppMain",
  computed: {
    ...mapGetters(["permission_routes", "project"]),
    cachedViews () {
      return this.$store.state.tagsView.cachedViews;
    },
    key () {
      return this.$route.fullPath;
    }
  },
  methods: {
    goBack () {
      Cookies.remove("projectName");
      this.$router.push({ path: "/basesetting/objectmanage" });
      window.location.reload();
    }
  }
};
</script>

<style lang="scss" scoped>
.app-main {
  /* 50= navbar  50  */
  width: 100%;
  position: relative;
  overflow-y: hidden;
  overflow-x: hidden;
}

.fixed-header + .app-main {
  padding-top: 50px;
}

.hasTagsView {
  // .app-main {
  //   /* 84 = navbar + tags-view = 50 + 34 */
  //   min-height: calc(100vh - 84px);
  // }

  .fixed-header + .app-main {
    padding-top: 84px;
  }
}
</style>

<style lang="scss">
// fix css style bug in open el-dialog
.el-popup-parent--hidden {
  .fixed-header {
    padding-right: 15px;
  }
}
</style>
