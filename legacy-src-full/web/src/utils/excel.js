// 用于上传和下载excel文件

// 下载excel
export function exportExcel(file, fileName) {
  const blob = new Blob([file]);
  const elink = document.createElement("a");
  elink.download = fileName;// 文件名
  elink.style.display = "none"; // 隐藏a标签
  elink.href = URL.createObjectURL(blob); // 返回一个URL 对象表示指定的 File 对象（生成blob:http://www.xxxx.com/xx的链接，可以直接在网页上打开File内容）或 Blob 对象（用于下载）
  // elink.href = URL.createObjectURL(blob);  简单讲就是将下载链接放到a标签的href里面
  document.body.appendChild(elink); // 将a标签添加到body的最后面
  elink.click(); // 不加导致下载不了
  URL.revokeObjectURL(elink.href); // 释放URL 对象，就是将这个文件内存地址给处理掉，告诉浏览器这个文件我不用了
  document.body.removeChild(elink); // 删除a标签 ，删除节点
}
