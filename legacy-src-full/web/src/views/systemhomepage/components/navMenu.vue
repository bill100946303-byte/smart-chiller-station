<template>
  <div class="scrollbar-wrapper">
      <el-menu
        :default-active="activeMenu"
       class="el-menu-demo" 
        mode="horizontal"
        @select="handleSelect"
      >
        <sidebar-item
          v-for="(route,i) in deviceTypeInfo"
          :key="i"
          :item="route"
          :base-path="route.path"
        />
      </el-menu>
    </div>
</template>

<script>
import SidebarItem from "./Sidebaritem";
import { getMenu } from "@/api/usersetting/devicemonitor";
import { mapGetters } from "vuex";
export default {
 components: { SidebarItem },
  computed: {
    ...mapGetters(["path",'userid'])
  },
  data(){
    return{
      deviceTypeInfo:[],
      activeMenu:'/devicemonitor/usermodel/Model3'
    }
  },
 created() {
   getMenu(this.path, this.userid)
            .then(res => {
              this.deviceTypeInfo = [];
              res.data.forEach(ele => {
                if(ele.pictype==0){
                  if(ele.children&&ele.children.length){
                    ele.children = ele.children.filter(item=>{
                      return item.pictype == 0
                    })
                  }
                  this.deviceTypeInfo.push(ele)
                }
              });
              
              this.$store.commit('project/SET_SIDELIST',this.deviceTypeInfo)
            })
            .catch(console.log);
        
 },
 methods: {
   handleSelect(index,indexPath){
      this.$emit('menuselect',indexPath)
   }
 }
}
</script>

<style lang="scss">
.btom-sys{
.el-scrollbar{
   width:100%;
  height:65px;
}
.scrollbar-wrapper{
  margin-bottom:0  !important;
  scrollbar-width: none; /* Firefox */
    &::-webkit-scrollbar {
   display: none; /* Chrome Safari */
  }
  .el-menu-demo{
        width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap-reverse;
    background:transparent !important;
    li{
      float: none;
    }
  }
  .el-submenu{
    color:var(--theme-color) !important;

  }
  .el-menu-item,.el-submenu{
    flex-shrink: 0;
     display: flex;
      align-items: center;
      justify-content: center;
      width:213px;
      height:72px;
font-size: 20px;
font-weight: 500;
&:last-child{
  margin-right:0;
}
 background:url('../../../assets/back_2.png') 0px 0px no-repeat;
 &:hover,&.is-active{
   background:url('../../../assets/back_1.png') 0px 0px no-repeat !important;
    .title{
      background: linear-gradient(0deg, rgba(111, 236, 255, 0.75) 30%, #f4f7fd 100%);
      -webkit-background-clip: text;
-webkit-text-fill-color: transparent;
 }
 }

  }
  .el-submenu__title,.title{
     margin-top:10px;
    font-size: 20px;
font-weight: 500;
text-shadow: 0px 5px 7px rgba(0, 0, 0, 0.75);

// -webkit-text-stroke: 1px #000000;
// text-stroke: 1px #000000;

background: linear-gradient(0deg, #F2FFFE 50%, #4F6CA1 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
    &:hover{
      background: linear-gradient(0deg, rgba(111, 236, 255, 0.75) 30%, #f4f7fd 100%);
      -webkit-background-clip: text;
-webkit-text-fill-color: transparent;
    }
  }
}
}
.el-menu--popup{
  width:199px;
  position:relative;
  border: 1px solid #4590ED;
  max-height:400px;
  overflow-y: scroll;
  scrollbar-width: none; /* Firefox */
    &::-webkit-scrollbar {
   display: none; /* Chrome Safari */
  }
 

//  .el-submenu__title{
// width:199px;
// overflow:hidden;
//  }


background:rgba(13, 30, 69, .6) !important;
  .el-menu-item,.el-submenu{
    background:transparent !important;
&.is-active,&:hover{
  background: linear-gradient(269deg, rgba(0, 167, 254, 0) 0%, rgba(0, 126, 255, 0.71) 100%) !important;
}
.title,.el-submenu__title{
background: linear-gradient(0deg, #F2FFFE 40%, #4F6CA1 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
.el-icon-arrow-right{
  color:var(--theme-color);
}
&:hover{
      background: linear-gradient(0deg, rgba(111, 236, 255, 0.75) 30%, #f4f7fd 100%);
      -webkit-background-clip: text;
-webkit-text-fill-color: transparent;
    }
}


  }
}
</style>