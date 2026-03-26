<template>
  <div class="default home-box">
    <el-scrollbar wrap-class="scrollbar-wrapper">
      <el-menu
          :default-active="activeMenu"
          background-color="#08739a"
          text-color="#fff"
          :unique-opened="false"
          active-text-color="#fff"
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
import SidebarItem from "./SidebarItem";

export default {
  inject: ["reload"],
  components: { SidebarItem },
  computed: {
    ...mapGetters(["permission_routes", "sidebar", "menuids", "leave"]),
    activeMenu () {
      const route = this.$route;
      const { meta, path } = route;
      // if set path, the sidebar will highlight the path you set
      if (meta.activeMenu) {
        return meta.activeMenu;
      }
      return path;
    },
  },

  data () {
    return {
      routes: [],
    };
  },
  created () {
    this.routes = this.permission_routes.filter((item) => {
      return item.meta && item.meta.front&&(!item.meta.hidden)
    })
    this.routes.sort((a,b)=>{
      return (b.meta.sort || 0) - (a.meta.sort ||0)
    })
  },
  methods: {
    handleMenuchange () {
      this.$store.commit("project/close", !this.leave);
    },
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
<style lang="scss" >
.el-menu-item__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  flex: 1;
  max-width: 100%;
  min-width: 0;
}
.home-box {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
  padding: 12px 10px 10px;
  background:
    radial-gradient(circle at top left, rgba(52, 149, 255, 0.18), transparent 30%),
    linear-gradient(180deg, rgba(7, 21, 35, 0.94) 0%, rgba(7, 24, 39, 0.9) 48%, rgba(9, 34, 50, 0.94) 100%);
  border-right: 1px solid rgba(125, 209, 255, 0.12);
  box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.02), 14px 0 38px rgba(0, 0, 0, 0.18);

  &::before,
  &::after {
    content: "";
    position: absolute;
    border-radius: 999px;
    pointer-events: none;
    filter: blur(4px);
  }

  &::before {
    width: 160px;
    height: 160px;
    top: -72px;
    right: -56px;
    background: rgba(61, 160, 255, 0.12);
  }

  &::after {
    width: 220px;
    height: 220px;
    bottom: -120px;
    left: -120px;
    background: rgba(47, 190, 222, 0.08);
  }

  .btn-ce {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 52px;
    border-bottom: 1px solid rgba(225, 240, 237, 0.1);

    img {
      width: 27px;
      margin-right: 20px;
    }
  }
  .el-submenu__title:hover {
    color: #fff !important;
  }
  .scrollbar-wrapper {
    flex: 1;
    margin-bottom: 0 !important;
    padding-right: 2px;
  }
  .el-menu {
    position: relative;
    z-index: 1;
    background: transparent !important;
    border-right: 0 !important;

    .svg-icon {
      margin-right: 10px;
      opacity: 0.9;
      font-size: 15px;
      width: 18px;
      height: 18px;
    }

    .el-menu-item, .el-submenu__title {
      position: relative;
      display: flex;
      align-items: center;
      gap: 10px;
      height: 46px;
      margin: 6px 0;
      padding: 0 14px !important;
      border-radius: 16px;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.015em;
      line-height: 1;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.05);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
      transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

      &::before {
        content: "";
        position: absolute;
        left: 10px;
        top: 50%;
        width: 4px;
        height: 16px;
        border-radius: 999px;
        background: linear-gradient(180deg, rgba(93, 225, 255, 0.98) 0%, rgba(54, 130, 255, 0.9) 100%);
        opacity: 0;
        transform: translateY(-50%);
        transition: opacity 0.2s ease;
      }

      .el-menu-item__title {
        font-size: 14px;
        font-weight: 600;
      }
    }

    .el-menu-item.is-active {
      color: #f7fdff !important;
      background: linear-gradient(90deg, rgba(39, 134, 255, 0.28) 0%, rgba(35, 202, 241, 0.14) 100%) !important;
      border-color: rgba(114, 217, 255, 0.3);
      box-shadow: 0 10px 20px rgba(0, 111, 190, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.07);
      transform: translateX(1px);

      &::before {
        opacity: 1;
      }
    }

    .el-menu-item:hover {
      color: #fff !important;
      background: rgba(255, 255, 255, 0.06) !important;
      border-color: rgba(255, 255, 255, 0.08);
      transform: translateX(1px);
    }

    .el-submenu__title:hover {
      color: #fff !important;
      background: rgba(255, 255, 255, 0.06) !important;
      border-color: rgba(255, 255, 255, 0.08);
    }
  }

  ::-webkit-scrollbar {
    width: 8px;
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(123, 200, 255, 0.28);
    border: 2px solid rgba(7, 21, 35, 0.82);
  }
}
</style>
