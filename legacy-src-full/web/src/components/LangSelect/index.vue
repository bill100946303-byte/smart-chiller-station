<template>
  <div>
    <!--    <div class="language">
          <div v-if="language" @click="languageClick('zh')">中文</div>
          <div v-else @click="languageClick('en')">English</div>
        </div>-->
    <el-dropdown class="international" trigger="click" popper-class="lang-select-popper user-avatar-popper shell-float-popper" @command="handleSetLanguage">
      <div class="lang-select-trigger">
        <i class="al_element-icons al_iconzhongyingqiehuan"></i>
      </div>
      <el-dropdown-menu slot="dropdown" class="lang-select-menu">
        <el-dropdown-item :disabled="language==='zh'" command="zh">
          中文
        </el-dropdown-item>
        <el-dropdown-item :disabled="language==='en'" command="en">
          English
        </el-dropdown-item>
        <el-dropdown-item :disabled="language==='vi'" command="vi">
          Vietnam
        </el-dropdown-item>
        <!--        <el-dropdown-item :disabled="language==='es'" command="es">
                  Español
                </el-dropdown-item>
                 <el-dropdown-item :disabled="language==='ja'" command="ja">
                  日本語
                </el-dropdown-item>-->
      </el-dropdown-menu>
    </el-dropdown>
  </div>
</template>

<script>
export default {
  data() {
    return {
      language: this.$store.getters.language || 'zh',
    }
  },
  // computed: {
  //   language() {
  //     return this.$store.getters.language
  //   }
  // },
  methods: {
    languageClick(lang) {
      this.language = lang
      this.$i18n.locale = lang
      this.$store.dispatch('app/setLanguage', lang)
    },
    handleSetLanguage(lang) {
      this.language = lang
      this.$i18n.locale = lang
      this.$store.dispatch('app/setLanguage', lang)
      this.$message({
        message: '语言已切换',
        type: 'success'
      })
    }
  }
}
</script>
<style lang="scss">
.language {
  cursor: pointer;
  color: #feffff;
}

.lang-select-trigger {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(126, 212, 255, 0.16);
  background: linear-gradient(135deg, rgba(7, 26, 40, 0.96) 0%, rgba(15, 47, 70, 0.82) 100%);
  box-shadow: 0 14px 28px rgba(2, 10, 18, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  cursor: pointer;
}

.lang-select-trigger i {
  font-size: 22px;
  color: #eef8ff;
}

body > .el-popper.lang-select-popper,
.el-popper.lang-select-popper {
  min-width: 154px;
  padding: 7px !important;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(6, 19, 31, 0.99) 0%, rgba(13, 33, 50, 0.98) 100%) !important;
  border: 1px solid rgba(116, 211, 255, 0.16) !important;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
}

body > .el-popper.lang-select-popper[x-placement^="bottom"] .popper__arrow,
.el-popper.lang-select-popper[x-placement^="bottom"] .popper__arrow {
  border-bottom-color: rgba(116, 211, 255, 0.16);
}

body > .el-popper.lang-select-popper[x-placement^="bottom"] .popper__arrow::after,
.el-popper.lang-select-popper[x-placement^="bottom"] .popper__arrow::after {
  border-bottom-color: rgba(6, 19, 31, 0.99);
}

body > .lang-select-popper .el-dropdown-menu,
.lang-select-popper .el-dropdown-menu,
body > .lang-select-popper .lang-select-menu,
.lang-select-popper .lang-select-menu {
  padding: 0;
  border: 0;
  background: linear-gradient(180deg, rgba(6, 19, 31, 0.99) 0%, rgba(13, 33, 50, 0.98) 100%) !important;
  background-color: rgba(6, 19, 31, 0.99) !important;
  box-shadow: none !important;
}

body > .lang-select-popper .el-dropdown-menu__item,
.lang-select-popper .el-dropdown-menu__item {
  margin-bottom: 4px;
  border-radius: 12px;
  color: rgba(241, 248, 255, 0.96) !important;
  line-height: 38px;
  background: transparent !important;
  font-size: 15px;
}

body > .lang-select-popper .el-dropdown-menu__item:last-child,
.lang-select-popper .el-dropdown-menu__item:last-child {
  margin-bottom: 0;
}

body > .lang-select-popper .el-dropdown-menu__item:not(.is-disabled):hover,
body > .lang-select-popper .el-dropdown-menu__item:not(.is-disabled):focus,
.lang-select-popper .el-dropdown-menu__item:not(.is-disabled):hover,
.lang-select-popper .el-dropdown-menu__item:not(.is-disabled):focus {
  background: rgba(102, 186, 255, 0.14);
  color: rgba(248, 251, 255, 0.99);
}

body > .lang-select-popper .el-dropdown-menu__item.is-disabled,
.lang-select-popper .el-dropdown-menu__item.is-disabled {
  color: rgba(141, 175, 198, 0.56) !important;
  background: rgba(255, 255, 255, 0.04) !important;
}
</style>
