<template>
  <el-tree
    ref="rootData"
    :data="treeData"
    :props="defaultProps"
    node-key="id"
    default-expand-all
    :expand-on-click-node="false"
    :render-content="renderContent"
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
      this.$emit("more", data.id);
    },
    update(node, data) {
      this.$emit("update", node, data);
    },
    remove(node, data) {
      const parent = node.parent;
      const children = parent.data.children || parent.data;
      const index = children.findIndex(d => d.id === data.id);
      const tip = confirm("该目录下的子目录将全部删除，确定要删除吗？");
      if (tip) {
        children.splice(index, 1);
        this.$emit("delete", data);
      }
    },

    renderContent(h, { node, data, store }) {
      return (
        <span style="flex: 1; display: flex; align-items: center; justify-content: space-between; font-size: 14px; padding-right: 8px;">
          <span>
            <span>{node.label}</span>
          </span>
          <span>
            <el-button
              style="font-size: 12px;"
              type="text"
              on-click={() => this.update(node, data)}
            >
              修改
            </el-button>
            <el-button
              style="font-size: 12px;"
              type="text"
              on-click={() => this.remove(node, data)}
            >
              删除
            </el-button>
          </span>
        </span>
      );
    }
  }
};
</script>
