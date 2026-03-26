<template>
  <div :class="{ 'has-logo': showLogo }">
    <logo v-if="showLogo" :collapse="isCollapse" />
    <el-scrollbar wrap-class="scrollbar-wrapper">
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
import { getcolor } from '@/styles/style'

export default {
  inject: ["reload"],
  components: { SidebarItem, Logo },
  computed: {
    ...mapGetters(["permission_routes", "sidebar", "project"]),
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
    }
  },
  data () {
    return {
      routes: [],
      variables: getcolor('dark')
    };
  },
  created () {
    this.$store
      .dispatch("user/getInfo")
      .then(response => {
        const { appusergroup } = response;
      })
      .catch(console.log);
    if (this.project == undefined) {
      this.routes = this.permission_routes.slice(3, 6);
      console.log(this.routes)
    } else {
      console.log('this.permission_routes',this.permission_routes)
      this.routes = this.permission_routes.slice(
        6,
        this.permission_routes.length - 1
      );
     this.routes = this.routes.filter(item=>!(item.meta.front)) 
     this.routes = this.routes.filter(item=>!(item.meta.title === '系统首页')) 
     console.log('this.routes',this.routes)
    }
  },
  mounted () {
    document.getElementsByTagName('body')[0].style.setProperty('--textcolor', '#fff')
    document.getElementsByTagName('body')[0].style.setProperty('--theme-color', '#fff')
    document.getElementsByTagName('body')[0].style.setProperty('--start-primary', this.variables.startbg)
    document.getElementsByTagName('body')[0].style.setProperty('--end-primary', this.variables.endbg)
  }
};
</script>
