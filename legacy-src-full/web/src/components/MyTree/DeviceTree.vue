<template>
  <el-tree
    ref="rootData"
    :data="treeData"
    :props="defaultProps"
    node-key="id"
    @node-click="handleNodeClick"
  />
</template>
<script>
export default {
  props: ["treeData"],
  data() {
    return {
      defaultProps: {
        children: "children",
        label: "menuName"
      }
    };
  },

  methods: {
    handleNodeClick(data) {
      this.$emit("more", data);
    }
  }
};
</script>
