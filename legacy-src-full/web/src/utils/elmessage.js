// ---------------------------------------------element-ui组件的封装-----ui-----------------------------------

import Message from "element-ui/lib/message";
import MessageBox from "element-ui/lib/message-box";

export function showDelBox(msg = "你确定要删除吗?") {
  return MessageBox.confirm(msg, {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
  });
}

export function showOkMsg(msg) {
  Message({
      type: "success",
      message: msg,
      duration: 1500
  });
}

export function showErrorMsg(msg) {
  Message({
      type: "error",
      message: msg,
      duration: 1500
  });
}
