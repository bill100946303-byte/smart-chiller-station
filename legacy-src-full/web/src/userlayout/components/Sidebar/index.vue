<template>
  <div :class="{ 'has-logo': showLogo }" >
    <logo v-if="showLogo" :collapse="isCollapse" />
    <el-scrollbar
      wrap-class="scrollbar-wrapper scrollbar-boxx"
      style="height: 100%"
    >
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        :background-color="variables.menuBg"
        :text-color="variables.menuText"
        :unique-opened="false"
        :active-text-color="variables.menuActiveText"
        :collapse-transition="false"
        mode="vertical"
      >
        <sidebar-item
          v-for="(route, i) in routes"
          :key="i"
          :item="route"
          :base-path="route.path"
        />
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import Logo from "./Logo";
import SidebarItem from "./SidebarItem";
import {getcolor} from '@/styles/style'


export default {
  inject: ["reload"],
  components: { SidebarItem, Logo },
  computed: {
    ...mapGetters(["permission_routes", "sidebar", "menuids",'colortheme']),
    activeMenu () {
      const route = this.$route;
      const { meta, path } = route;
      // if set path, the sidebar will highlight the path you set
      if (meta.activeMenu) {
        return meta.activeMenu;
      }
      return path;
    },
    showLogo () {
      return this.$store.state.settings.sidebarLogo;
    },
    isCollapse () {
      return !this.sidebar.opened;
    },
  },
  data () {
    return {
      routes: [],
      variables:{},
      myBackgroundColor: "#0D2239"
    };
  },
  watch: {
    colortheme:{
      handler(val,olde){
        this.variables = getcolor(val)

        document.getElementsByTagName('body')[0].style.setProperty('--start-primary', this.variables.startbg)
        document.getElementsByTagName('body')[0].style.setProperty('--end-primary', this.variables.endbg)
        document.getElementsByTagName('body')[0].style.setProperty('--active-primary', this.variables.menuActiveText)
        document.getElementsByTagName('body')[0].style.setProperty('--mainContaner-bg', this.variables.mainContanerBg)
         document.getElementsByTagName('body')[0].style.setProperty('--theme-color', this.variables.contanterBg)
         document.getElementsByTagName('body')[0].style.setProperty('--textcolor', this.variables.textColor)
         document.getElementsByTagName('body')[0].style.setProperty('--nav-shadow', this.variables.shadow)
      },
      immediate: true
    }
  },
  created () {
    this.routes = this.permission_routes.slice(
      4,
      this.permission_routes.length - 1
    );
    let menuids = [];
    if (this.menuids.length > 0) {
      let flag = this.menuids instanceof Array;
      if (!flag) {
        menuids = this.menuids.slice(1, this.menuids.length - 1).split(",");
      } else {
        this.menuids.forEach(ele => {
          menuids.push(ele.toString())
        })
      }
    } else {
      menuids = JSON.parse(this.menuids);

    }
    this.routes.forEach((menu) => {
      if (menu.meta.id) {
        if (menuids.indexOf(menu.meta.id.toString()) != -1) {
          menu.hidden = false;
          if (menu.children) {
            menu.children.forEach((menu) => {
              if (menu.meta.id && menuids.indexOf(menu.meta.id.toString()) != -1) {
                menu.hidden = false;
                if (menu.children) {
                  menu.children.forEach((menu) => {
                    if (menu.meta.id && menuids.indexOf(menu.meta.id.toString()) != -1) {
                      menu.hidden = false;
                    }
                  });
                }
              }
            });
          }
        } else {
          menu.hidden = true;
        }
      }
    });
  },
  methods: {
    getChildren (menuids, menu) {
      if (menu.children) {
        menu.children.forEach((menu) => {
          if (menuids.indexOf(menu.meta.id) != -1) {
            menu.hidden = false;
          }
        });
      }
    },
  },
};
</script>
<style lang="scss">
$varStart: var(--start-primary);
$varEnd: var(--end-primary);
$varActive: var(--active-primary);
@mixin menuitem-hover{
  color:$varActive !important;
  background:linear-gradient(to right, $varStart, $varEnd);
}
.el-menu {
  .el-menu-item {
    background-color: transparent;
  }
  .el-menu-item:hover {
    @include menuitem-hover;
    .svgitem{
      color:$varActive
    }
  }
  .el-menu-item.is-active {
    @include menuitem-hover;
  }
  .submenu-title-noDropdown,
  .el-submenu__title {
    &:hover {
      @include menuitem-hover;
    }
  }
}
.navbars {
  width: 200px;
  height: 1030px;
  .el-menu-demo {
    .el-menu-item {
      min-width: 0;
      background-color: transparent;
    }
    .el-menu-item.is-active {
      @include menuitem-hover;
    }
    .el-submenu__title {
      height: 50px;
      background-color: transparent !important;
    }
    .el-submenu__title:hover {
      @include menuitem-hover;
    }
  }
}
</style>
