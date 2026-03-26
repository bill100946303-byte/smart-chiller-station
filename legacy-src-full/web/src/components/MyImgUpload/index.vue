<template>
  <div>
    <el-upload
      action
      accept="image/png, image/gif, image/jpg, image/jpeg"
      list-type="picture-card"
      :limit="1"
      :on-success="uploadSuccess"
      :on-error="uploadError"
      :before-upload="beforeAvatarUpload"
      :on-change="uploadChange"
      :on-preview="handlePictureCardPreview"
      :on-remove="handleRemove"
      :file-list="fileList"
      :auto-upload="false"
    >
      <i class="el-icon-plus"></i>
    </el-upload>
    <el-dialog :visible.sync="dialogVisible">
      <img width="100%" :src="dialogImageUrl" alt>
    </el-dialog>
  </div>
</template>
<script>
export default {
  name: "MyImgUpload",
  data() {
    return {
      fileList: [],
      editData: "",
      dialogImageUrl: "", // 图片上传
      dialogVisible: false
    };
  },
  methods: {
    uploadChange(file) {
      const isIMAGE =
        file.raw.type === "image/jpeg" ||
        file.raw.type === "image/png" ||
        file.raw.type === "image/jpg" ||
        file.raw.type === "image/gif";
      /*var isIMAGE = /^image\/(jpeg|png|jpg|gif)$/.test(file.type);*/
      const isLt5M = file.size / 1024 / 1024 < 10;

      if (!isIMAGE) {
        this.$message.error("上传文件只能是图片格式!");
        return false;
      }
      if (!isLt5M) {
        this.$message.error("上传文件大小不能超过 10MB!");
        return false;
      }
      this.$emit("upload", file.raw);
    },
    handleRemove(file, fileList) {
      console.log(file, fileList);
    },
    handlePictureCardPreview(file) {
      this.dialogImageUrl = file.url;
      this.dialogVisible = true;
    },
    // 上传之前的校验
    beforeAvatarUpload(file) {
      /*var reader = new FileReader();
      reader.readAsDataURL(file.raw);
      reader.onload = function(e) {
        console.log(this.result); //图片的base64数据
      };*/
    },
    // 上传成功
    uploadSuccess(res, file, fileList) {
      this.editData.topicPic = res;
      this.$message.success("上传成功");
    },
    // 上传失败
    uploadError(err, file) {
      this.$message.error("上传失败");
    }
  }
};
</script>
