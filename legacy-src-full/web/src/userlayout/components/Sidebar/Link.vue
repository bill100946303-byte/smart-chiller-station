
<template>
  <!-- eslint-disable vue/require-component-is -->
  <component v-bind="linkProps(to)">
    <slot />
  </component>
</template>

<script>
import { isExternal } from '@/utils/validate'

export default {
  props: {
    to: {
      type: String,
      required: true
    }
  },
  components:{

  },
  mounted() {

  },
  methods: {
    linkProps(url) {
      if(url == '/defaultpage'){
        return {
          is:"button",
          class:'btn',
          ref:'btn'
        }
      }
      if (isExternal(url)) {
        return {
          is: 'a',
          href: url,
          target: '_blank',
          rel: 'noopener'
        }
      }
      
      return {
        is: 'router-link',
        to: url
      }
    }
  }
}
</script>
<style scoped>
.btn{
  width:100%;
  padding:0;
  border:0;
  outline: none;
  text-align:left;
}
</style>
