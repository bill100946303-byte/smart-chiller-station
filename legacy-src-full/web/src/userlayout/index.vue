<template>
  <div :class="classObj" class="app-wrapper">
    <navbar />
    <sidebar class="sidebar-container" :style="`backgroundColor:${variables.menuBg}`"/>
    <div
      v-if="device === 'mobile' && sidebar.opened"
      class="drawer-bg"
      @click="handleClickOutside"
    />
    <div :class="{ hasTagsView: needTagsView }" class="main-container main-pre">
      <el-scrollbar class="scrollbar-wrapper-box" v-if="visible">
        <div :class="{ 'fixed-header': fixedHeader }">
          <div class="navbars" :style="'background:' + variables.menuBg">
            <el-menu
              default-active="1"
              class="el-menu-demo"
              :background-color="variables.menuBg"
              :text-color="variables.menuText"
              :active-text-color="variables.menuActiveText"
              @select="handleSelect"
            >
              <template v-for="menu in menuList">
                <el-menu-item
                  v-show="!menu.children.length"
                  :index="
                    menu.picid +
                    '/devicemonitor/usermodel/Model' +
                    menu.picmodeid
                  "
                  :key="'el-menu-item' + menu.picid"
                  >{{ menu.picname }}</el-menu-item
                >
                <el-submenu
                  v-show="menu.children.length"
                  :index="'el-submenu' + menu.picid"
                  :key="'el-submenu' + menu.picid"
                >
                  <template slot="title">{{ menu.picname }}</template>
                  <el-submenu
                    v-show="submenu.children.length"
                    :index="
                      submenu.picid +
                      '/devicemonitor/usermodel/Model' +
                      submenu.picmodeid
                    "
                    v-for="submenu in menu.children"
                    :key="'el-submenu-item1' + submenu.picid"
                  >
                    <template slot="title">{{ submenu.picname }}</template>
                    <el-menu-item
                      :index="
                        submenu1.picid +
                        '/devicemonitor/usermodel/Model' +
                        submenu1.picmodeid
                      "
                      v-for="submenu1 in submenu.children"
                      :key="'el-submenu-item2' + submenu1.picid"
                      >{{ submenu1.picname }}</el-menu-item
                    >
                  </el-submenu>
                  <el-menu-item
                    v-show="!submenu.children.length"
                    :index="
                      submenu.picid +
                      '/devicemonitor/usermodel/Model' +
                      submenu.picmodeid
                    "
                    v-for="submenu in menu.children"
                    :key="'el-submenu-item3' + submenu.picid"
                    >{{ submenu.picname }}</el-menu-item
                  >
                </el-submenu>
              </template>
            </el-menu>
          </div>
        </div>
      </el-scrollbar>
      <app-main />
    </div>
  </div>
</template>

<script>
import RightPanel from "@/components/RightPanel";
import { AppMain, Navbar, Settings, Sidebar } from "./components";
import ResizeMixin from "./mixin/ResizeHandler";
import { mapState, mapGetters } from "vuex";
import { getMenu } from "@/api/usersetting/devicemonitor";
import { findPageById } from "@/api/contentsetting/baseinformation/pagemanage";
import {getcolor} from '@/styles/style'


export default {
  name: "Layout",
  watch: {
    $route (to, from) {
      if (to.query.status != 0) {
        this.visible = to.path.search("devicemonitor") != -1;
        if (this.visible) {
          this.handleClickOutside();
        }
      }
    },
    colortheme:{
      handler(val,olde){
        this.variables = getcolor(val)
      },
      immediate: true
    }
  },
  components: {
    AppMain,
    Navbar,
    RightPanel,
    Settings,
    Sidebar,
  },
  mixins: [ResizeMixin],
  computed: {
    ...mapState({
      sidebar: (state) => state.app.sidebar,
      device: (state) => state.app.device,
      showSettings: (state) => state.settings.showSettings,
      needTagsView: (state) => state.settings.tagsView,
      fixedHeader: (state) => state.settings.fixedHeader,
    }),
    ...mapGetters(["path", "userid","colortheme"]),
    classObj () {
      return {
        hideSidebar: !this.sidebar.opened,
        openSidebar: this.sidebar.opened,
        withoutAnimation: this.sidebar.withoutAnimation,
        mobile: this.device === "mobile",
      };
    },
  },
  data () {
    return {
      visible: false,
      menuList: [],
      variables:{}
    };
  },
  created () {
    if (this.$route.query.status != "0") {
      this.visible = this.$route.path.search("devicemonitor") != -1;
    }

    getMenu(this.path, this.userid)
      .then((res) => {
        res.data.forEach((ele) => {
          if (ele.pictype === 0) {
            this.menuList.push(ele);
          }
          if (ele.children != null) {
            let children = [];
            ele.children.forEach((subEle) => {
              if (subEle.pictype === 0) {
                children.push(subEle);
              }
              if (subEle.children != null) {
                let children1 = [];
                subEle.children.forEach((item) => {
                  if (item.pictype === 0) {
                    children1.push(item);
                  }
                });
                subEle.children = children1;
              }
            });
            ele.children = children;
          }
        });
      })
      .catch(console.log);
  },
  methods: {
    handleSelect (key) {
      const picid = parseInt(key);
      findPageById(this.path, picid)
        .then((res) => {
          if (res.data.rootPath != null && res.data.rootPath != "") {
            this.$router.push({ path: res.data.rootPath });
          } else {
            let path = key.split("/").filter((val, index, arr) => {
              return index !== 0;
            });
            console.log(path);
            path = "/" + path.join("/");
            this.$router.push({ path: path, query: { id: picid, status: 1 } });
          }
        })
        .catch(console.log);
    },
    handleClickOutside () {
      this.$store.dispatch("app/closeSideBar", { withoutAnimation: false });
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/mixin.scss";
@import "~@/styles/variables.scss";
$mainColor: var(--mainContaner-bg);
$textcolor: var(--textcolor);
.app-wrapper {
  @include clearfix;
  position: relative;
  height: 100%;
  width: 100%;

  &.mobile.openSidebar {
    position: fixed;
    top: 0;
  }
}

.drawer-bg {
  background: #000;
  opacity: 0.3;
  width: 100%;
  top: 0;
  height: 100%;
  position: absolute;
  z-index: 999;
}

.main-container {
  height: calc(100vh - 50px);
  overflow: auto;
  background:$mainColor;
  color:$textcolor;
  
  .fixed-header {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 9;
    width: calc(100% - #{$sideBarWidth});
    transition: width 0.28s;

    .el-scrollbar .el-scrollbar__wrap .el-scrollbar__view {
      white-space: nowrap;
      overflow-y: hidden;

      .el-menu-item {
        display: inline-block;
      }
    }
  }

  .hideSidebar .fixed-header {
    width: calc(100% - 54px);
  }

  .mobile .fixed-header {
    width: 100%;
  }
}
</style>
<style lang="scss">
$textcolor: var(--textcolor);
#app
  .hideSidebar
  .navbars
  .el-submenu
  > .el-submenu__title
  .el-submenu__icon-arrow {
  display: inline-table;
}
.main-pre{
 button{
    color:$textcolor;
  }
}
.main-container {
  position: relative;
 
  .scrollbar-wrapper-box {
    z-index: 100000;
    overflow-x: hidden !important;
    width: 200px;
    height: 1030px;
    & + .app-main {
      margin-left: 200px;
    }
  }
}
.openSidebar {
  .scrollbar-wrapper-box {
    position: fixed;
    top: 50px;
    left: 210px;
    // & + .app-main {
    //   margin-left: 410px;
    // }
  }
}
.hideSidebar {
  .scrollbar-wrapper-box {
    position: fixed;
    top: 50px;
    left: 0px;
  }
}
</style>

