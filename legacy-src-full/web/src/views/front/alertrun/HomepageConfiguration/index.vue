<template>
  <!-- 主页显示 -->
  <div class="homepage-configuration">
    <div v-if="data.length > 0" class="content-wrapper">
      <div v-for="(item,index) in data" :key="index" class="config-item">
        <div class="config-title"> {{ item.title }}</div>
        <div v-for="formItem in item.formItem" class="form-group">
          <div class="form-label"> {{ formItem.name }}：</div>
          <div v-for="cascader in formItem.cascaderFor" class="tag-container">
            <el-button v-for="cascaderBtn in cascader.value"
                       v-if="cascader.value"
                       class="tag-item"
                       size="mini"
                       :disabled="cascader.currentValue == cascaderBtn.value"
                       :type="cascader.currentValue == cascaderBtn.value ? 'primary' : ''"
                       @click="sendClick(cascader,cascaderBtn)"
            >
              {{ cascaderBtn.label }}
            </el-button>
            <div v-if="!cascader.tagValue.includes('|')">
              {{ cascader.tagValue }}  {{cascader.units}}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {findMainPageByDrTypeIdAndDrId} from "@/api/contentsetting/information";
import {operationRegs} from "@/api/usersetting/devicemonitor/model1";

import {mapGetters} from "vuex";

export default {
  name: "HomepageConfiguration",
  props: ['loadshow'],
  data() {
    return {
      data: [],
      timer: null
    }
  },
  computed: {
    ...mapGetters(["path", "userid", "id", "logo"])
  },
  watch: {
    'path': {
      handler(val) {
        // console.log('改变项目了')
        this.clearTimer()
        this.requestQuery()
        this.setupTimer()
      },
      deep: true,
      immediate: true,
    },
  },
  created() {
    this.requestQuery()
    this.setupTimer()
  },
  beforeDestroy() {
    this.clearTimer();
  },
  methods: {
    clearTimer() {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    },
    setupTimer() {
      this.timer = setTimeout(() => {
        this.requestQuery();
      }, 10000);
    },
    requestQuery() {
      findMainPageByDrTypeIdAndDrId(this.path).then(res => {
        // console.log('首页东西', res)
        if (res.status === 20000 && res.data) {
          for (const re of res.data) {
            for (const formItem of re.formItem) {
              for (const formItemElement of formItem.cascaderFor) {
                // console.log('333', formItemElement)
                // formItemElement.value =
                if (formItemElement.tagValue.indexOf('|') !== -1) {
                  // 执行分割逻辑
                  formItemElement.value = formItemElement.tagValue.split('|').map(pair => {
                    const [value, label] = pair.split(':');
                    return {
                      label: label,
                      value: value
                    };
                  })
                }
              }
            }
          }
          this.data = res.data
          console.log(this.data)
        } else {
          this.data = []
        }
      }).finally(() => { // 使用 .finally 确保无论请求成功失败都会执行
        // 重新启动定时器，实现循环调用
        this.clearTimer(); // 在设置新定时器前先清除旧的
        this.setupTimer();
      });
    },
    sendClick(formItem, cascaderBtn) {
      // console.log(formItem, cascaderBtn)
      let info = {
        userId: this.userid,
        appId: this.id,
        drTypeId: formItem.drTypeId,
        drId: formItem.drId,
        msg: `${formItem.name}|${cascaderBtn.value}|${formItem.tagName}`,
      }
      console.log(info)
      let message = '您确定要修改  “' + formItem.name + '”  的值为  “' + cascaderBtn.value + '“  吗?'
      let title = '提示：' + this.logo.applogotext
      this.$confirm(message, title, {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        // type: 'warning'
      }).then(() => {
        operationRegs(this.path, info)
            .then((res) => {
              if (res.status === 20000) {
                // console.log(this.path, info)
                this.$message.success("修改成功！");
              }
            })
            .catch(console.log);
      }).catch(() => {
      })
    }
  }
}
</script>


<!--<style scoped lang="scss">
.HomepageConfigurationClass {
  z-index: 6;
  position: relative;
  top: 15%;
  left: 20%;
  //font-size: 80px;
  color: #000;
  width: auto;
  display: inline-block;

  .item {
    margin-top: 20px;
  }

  .itemTitle {
    margin-bottom: 20px;
  }

  .cascader-tag {
    display: flex;

  }
}
</style>-->
<style scoped lang="scss">
.homepage-configuration {
  position: relative;
  z-index: 6;
  top: 15%;
  left: 20%;
  color: #333;
  width: auto;
  display: inline-block;
  min-width: 300px;

  .content-wrapper {
    max-width: 800px;
  }

  .config-item {
    margin-top: 24px;
    padding: 16px;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);

    &:first-child {
      margin-top: 0;
    }
  }

  .config-title {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: #1a1a1a;
    padding-bottom: 8px;
    border-bottom: 1px solid #f0f0f0;
  }

  .form-section {
    .form-group {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }

  .form-label {
    font-size: 14px;
    font-weight: 500;
    color: #666;
    margin-bottom: 8px;
  }

  .tag-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tag-item {
    margin: 0 !important;
    border-radius: 16px;
    //background: #f5f7fa;
    //border-color: #e4e7ed;
    //color: #606266;

    //&:hover {
    //  background: #ecf5ff;
    //  border-color: #c6e2ff;
    //  color: #409eff;
    //}
  }
}
</style>