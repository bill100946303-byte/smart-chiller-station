
<template>
  <!-- eslint-disable vue/require-component-is -->
  <component v-bind="linkProps(to)">
    <slot />
  </component>
  <!-- <div @click="handleRoute">
    <slot />
  </div> -->
</template>

<script>
import { isExternal } from "@/utils/validate";

export default {
  props: {
    to: {
      type: String,
      required: true,
    },
  },
  methods: {
    // handleRoute(path){
    //   if(this.$route.name === 'defaultpage'){
    //     window.open(window.location.origin+'/#'+this.to)
    //   }else{
    //     this.$router.push({
    //       path:this.to
    //     })
    //   }
    // }

    linkProps(url) {
      if (isExternal(url)) {
        return {
          is: "a",
          href: url,
          target: "_blank",
          rel: "noopener",
        };
      }
      return {
        is: "router-link",
        to: url,
      };
    },
  },
};
</script>
