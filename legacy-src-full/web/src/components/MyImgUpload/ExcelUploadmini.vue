<template>
  <div>
    <el-upload
      class="image-uploader"
      :multiple="false"
      :auto-upload="false"
      list-type="text"
      :show-file-list="false"
      :on-change="uploadChange"
      action
      :limit="1"
      :on-exceed="handleExceed"
      :http-request="uploadFile"
    >
      <el-button size="mini" type="primary">导入</el-button>
    </el-upload>
  </div>
</template>
<script>
export default {
  methods: {
    // 上传文件之前的钩子
    uploadChange(file) {
      const isText = file.raw.name.slice(-3) === "xls";
      if (!isText) {
        this.$message.error("上传文件只能Excel文件!");
        return false;
      }
      this.$emit("excelUpload", file.raw);
    },
    // 上传文件个数超过定义的数量
    handleExceed(files, fileList) {
      this.$message.warning(`当前限制选择 1 个文件，请删除后继续上传`);
    },
    // 上传文件
    uploadFile(item) {
      const fileObj = item.file;
      // FormData 对象
      const form = new FormData();
      // 文件对象
      form.append("file", fileObj);
      form.append("comId", this.comId);
      console.log(JSON.stringify(form));
      // let formTwo = JSON.stringify(form)
      EnterAPI.iExcel(form).then(response => {
        console.log("MediaAPI.upload");
        console.log(response);
        this.$message.info("文件：" + fileObj.name + "上传成功");
      });
    }
  }
};
</script>
<style lang="scss" scoped>
</style>
