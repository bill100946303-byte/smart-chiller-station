<template>
  <div id="app">
    <router-view v-if="isRouterAlive" />
  </div>
</template>

<script>
export default {
  name: "App",
  provide() {
    return {
      reload: this.reload,
    };
  },
  data() {
    return {
      isRouterAlive: true,
      transitionName: "",
     
    };
  },
  watch: {
    $route(to, from) {
      if (to.meta.id > from.meta.id) {
        this.transitionName = "slide-left";
      } else {
        this.transitionName = "slide-right";
      }
    },
  },
  created() {
    
  },
  methods: {


    reload() {
      this.isRouterAlive = false;
      this.$nextTick(function () {
        this.isRouterAlive = true;
      });
    },
  },
};
</script>
<style lang="scss" >
body{
  --legacy-page-zoom: 0.9;
  margin: 0;
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  overflow-x: hidden !important;
  -ms-overflow-style: none !important;
  /*火狐下隐藏滚动条*/
  overflow: -moz-scrollbars-none !important;
  ::-webkit-scrollbar {
    display: none !important;
  }
}
html{
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}
.slide-right-enter-active,
.slide-right-leave-active,
.slide-left-enter-active,
.slide-left-leave-active {
  will-change: transform;
  transition: all 500ms;
  position: absolute;
}
.slide-right-enter {
  opacity: 0;
  transform: translate3d(-100%, 0, 0);
}
.slide-right-leave-active {
  opacity: 0;
  transform: translate3d(100%, 0, 0);
}
.slide-left-enter {
  opacity: 0;
  transform: translate3d(100%, 0, 0);
}
.slide-left-leave-active {
  opacity: 0;
  transform: translate3d(-100%, 0, 0);
}
#app{
  background: #000;
  width: calc(100% / var(--legacy-page-zoom));
  min-width: 100%;
  max-width: 100%;
  min-height: calc(100vh / var(--legacy-page-zoom));
  overflow-x: hidden;
  zoom: var(--legacy-page-zoom);
  ul{
    padding: 0;
    margin: 0;
    li{
      
    }
  }

}
.el-dropdown-menu{
  border: none !important;
  
}
.el-dropdown-menu__item--divided{
   border: transparent !important;
}
// .popper__arrow{
//     border-bottom-color: #011123 !important;
// }
</style>

