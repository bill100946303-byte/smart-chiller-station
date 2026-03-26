<template>
  <div class="tabchar-box">
    <el-tabs v-model="activeName" type="card" @tab-click="handleClick">
    <el-tab-pane label="日用量" name="first">
      <Doublechar :datas="data1" id="char1"/>
    </el-tab-pane>
    <el-tab-pane label="月负荷" name="second">
       <Doublechar :datas="data2" id="char2"/>
    </el-tab-pane>
    <el-tab-pane label="年需量" name="third">
       <Doublechar :datas="data3" id="char3"/>
    </el-tab-pane>
  </el-tabs>
  </div>
</template>

<script>
import Doublechar from './Doublechar';
export default {
  data(){
    return {
      activeName: 'first',
      data1:[
            {product: '1', '2015': 43.3, '2016': 85.8, },
            {product: '2', '2015': 83.1, '2016': 73.4, },
            {product: '3', '2015': 86.4, '2016': 65.2, },
            {product: '4', '2015': 72.4, '2016': 53.9,},
            {product: '5', '2015': 43.3, '2016': 85.8, },
            {product: '6', '2015': 83.1, '2016': 73.4, },
            {product: '7', '2015': 86.4, '2016': 65.2, },
            {product: '8', '2015': 72.4, '2016': 53.9,},
            {product: '9', '2015': 43.3, '2016': 85.8, },
            {product: '10', '2015': 83.1, '2016': 73.4, },
            {product: '11', '2015': 86.4, '2016': 65.2, },
            {product: '12', '2015': 72.4, '2016': 53.9,}
        ],
        data2:[
          {product: '1', '2015': 43.3, '2016': 85.8, },
            {product: '2', '2015': 80, '2016': 73.4, },
            {product: '3', '2015': 90.4, '2016': 65.2, },
            {product: '4', '2015': 72.4, '2016': 53.9,},
            {product: '5', '2015': 60.3, '2016': 85.8, },
            {product: '6', '2015': 83.1, '2016': 73.4, },
            {product: '7', '2015': 66.4, '2016': 65.2, },
            {product: '8', '2015': 72.4, '2016': 53.9,},
            {product: '9', '2015': 63.3, '2016': 85.8, },
            {product: '10', '2015': 83.1, '2016': 73.4, },
            {product: '11', '2015': 96.4, '2016': 65.2, },
            {product: '12', '2015': 72.4, '2016': 53.9,}
        ],
        data3:[
          {product: '1', '2015': 43.3, '2016': 85.8, },
            {product: '2', '2015': 80, '2016': 53.4, },
            {product: '3', '2015': 90.4, '2016': 95.2, },
            {product: '4', '2015': 72.4, '2016': 33.9,},
            {product: '5', '2015': 60.3, '2016': 75.8, },
            {product: '6', '2015': 83.1, '2016': 23.4, },
            {product: '7', '2015': 66.4, '2016': 75.2, },
            {product: '8', '2015': 72.4, '2016': 43.9,},
            {product: '9', '2015': 63.3, '2016': 65.8, },
            {product: '10', '2015': 83.1, '2016': 73.4, },
            {product: '11', '2015': 96.4, '2016': 85.2, },
            {product: '12', '2015': 72.4, '2016': 93.9,}
        ]

    }
  },
  components:{Doublechar},
   methods: {
      handleClick(tab, event) {
        this.activeName = tab.name;
      }
    }
}
</script>

<style lang="scss">
.tabchar-box{
.el-tabs__header{
  border:none !important;
}
.el-tabs__content{
  overflow: hidden;
}
.el-tabs__nav{
  border:none !important;
}
.el-tabs__item{
  background:rgba(115, 174, 233, 0.35);
  border-radius:0 0 5px 5px;
  border:none;
  border-left:none !important;
  &.is-active{
    background:rgba(32, 99, 168, 1);
    color:var(--theme-color);
    border:none;
  }
}
}

</style>