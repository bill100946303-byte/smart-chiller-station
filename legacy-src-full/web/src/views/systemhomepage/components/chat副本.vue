<template>
  <div>
    <div style="position:relative;">
      <div class="button-box" v-drag draggable="false">
        <div class="btn-bg-img" @dblclick="openBox" @click="clickBox"></div>
        <div class="font-box">{{ text }}</div>
      </div>
    </div>
    <div id="box" :style=" flag ? 'display:none':'display:block'">
      <!-- 主体 -->
      <div class="container">
        <div id="header">
          <!--          <span style="display:inline-block">名字</span>-->
          <p>
            <!--            <span @click="changeSize" style="font-size:22px;cursor:pointer;color:#fff;display:inline-block">🔳</span>-->
            <!--这个方块是我懒得引入icon图标随便复制的，不要学我省事，因为有的浏览器可能不显示-->
            <span
                @click="yc"
                style="cursor: pointer;font-size:30px;display:inline-block;margin-left:10px;color:#fff;"
            >✖</span>
          </p>
        </div>
        <!-- 聊天内容显示区 -->
        <div class="cBox">
          <div class="contents" ref="chattingContent" id="chattingContents">
            <div class="contentsBg">
              <div class="chat-message">
                <img class="avatar" src="@/assets/home/gptBg.png" alt="机器人">
                <div class="message">
                  <p>我是你的智能助手</p>
                  <p>我能向你提供一定的帮助，快来向我提问吧！</p>
                </div>
              </div>
            </div>
            <div v-for="(item,index) in msgs" :key="index">
              <div class="userQuestion self" v-if="item.self">
                <p class="question">{{ item.content }}</p>
                <!--              我的对话框头像  <img :src="item.avatarUrl" alt class="uImg"/>-->
              </div>
              <div class="robotAnswer other clearfix" v-else>
                <!--                <img :src="item.avatarUrl" alt class="rImg"/>-->
                <img src="@/assets/home/gptBg.png" alt class="rImg"/>
                <div class="answerContent">
                  <p class="q" v-html="item.q" style="white-space:pre-line;"></p>
                  <!--                  <p class="q">{{ item.q }}</p>-->
                  <!--                  <p class="a">{{ item.a }}</p>-->
                </div>
              </div>
            </div>
          </div>
          <!-- 用户问题输入区 -->
          <div class="userInput">
            <div class="tBox">
                    <textarea
                        class="ipt"
                        placeholder="开始聊天"
                        @keydown.enter.prevent="sendMsgs"
                        v-model.trim="inputContent"
                    ></textarea>
            </div>
            <div @click="sendMsgs" class="sending">➥</div>
            <!--            <div>-->
            <!--              深度思考-->
            <!--            </div>-->
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {deepseek} from '@/api/usersetting/chat'
import {mapGetters} from "vuex";
import {marked} from 'marked';

export default {
  computed: {
    ...mapGetters(["path", "userid", "id"]),
  },
  data() {
    return {
      text: '',
      isOpen: false,
      isMove: false,
      msgs: [], //用来存放对话
      inputContent: '',
      oContent: {},
      flag: true,
      flag2: true,
      isDragging: false, // 添加 isDragging 状态c
    }
  },
  methods: {
    yc() {
      let box = document.getElementById('box');
      box.style.display = 'none';
      this.flag = !this.flag;
    },
    changeSize() {
      if (this.flag2) {
        let box = document.getElementById('box');
        box.style.width = '100%';
        box.style.height = '100%';
        box.style.left = '0';
        box.style.top = '0';
        this.flag2 = !this.flag2;
      } else {
        let box = document.getElementById('box');
        box.style.width = '500px';
        box.style.height = '450px';
        box.style.left = '33%';
        box.style.top = '20%';
        this.flag2 = !this.flag2;
      }
    },
    // 发送消息
    sendMsgs() {
      this.oContent.scrollTop = this.oContent.scrollHeight;
      if (this.inputContent === '') {
        return;
      }
      this.msgs.push({
        content: this.inputContent,
        self: true,
      });
      this.getResult();
      setTimeout(() => {
        this.$refs.chattingContent.scrollTop = this.$refs.chattingContent.scrollHeight;
      }, 0);
      this.inputContent = '';
    },
    // 智能机器人回复
    getResult() {
      let that = this;
      let paramData = {
        //一些需要的参数
        userId: this.userid,
        model: 'deepseek-chat',
        content: this.inputContent,
      };
      console.log('发送', paramData)

      // let arr = "**中央空调冷却塔**是中央空调系统中的重要设备，" +
      //     "主要用于**冷却空调系统中的循环水**。" +
      //     "它的核心功能是将空调系统中吸收的热量通过冷却水散发到大气中，" +
      //     "从而保证空调系统的正常运行。\n\n---\n\n ### **冷却塔的作用**\n1. **散热**：将中央空调主机产生的热量通过冷却水传递到大气中。" +
      //     "\n2. **节能**：通过高效的散热，降低空调系统的能耗。\n3. **保护设备**：防止空调系统因过热而损坏，延长设备使用寿命。" +
      //     "\n\n---\n\n### **冷却塔的工作原理**\n1. **热交换**：中央空调系统中的冷却水在吸收热量后，温度升高，被输送到冷却塔中。\n2. **散热**：冷却塔通过风机将空气引入塔内，与高温冷却水进行热交换。冷却水通过喷淋装置均匀分布，形成水膜或水滴，增加与空气的接触面积。\n3. **蒸发冷却**：部分冷却水蒸发，带走大量热量，从而降低冷却水的温度。\n4. **循环利用**：冷却后的水被重新输送到空调系统中，继续吸收热量，形成循环。\n\n---\n\n### **冷却塔的主要类型**\n1. **开式冷却塔**：\n   - 冷却水直接与空气接触，散热效率高。\n   - 容易受到外界污染，需定期清理。\n2. **闭式冷却塔**：\n   - 冷却水在封闭的管道中流动，不与空气直接接触。\n   - 避免了污染，但散热效率相对较低。\n3. **横流式冷却塔**：\n   - 空气水平流动，与垂直下落的冷却水进行热交换。\n4. **逆流式冷却塔**：\n   - 空气垂直向上流动，与下落的冷却水逆向接触，热交换效率更高。\n\n---\n\n### **冷却塔的主要组成部分**\n1. **风机**：用于强制通风，增加空气流动，提高散热效率。\n2. **填料**：增加冷却水与空气的接触面积，提高热交换效率。\n3. **喷淋系统**：将冷却水均匀分布到填料上。\n4. **水箱**：用于收集冷却后的水。\n5. **水泵**：将冷却水输送到空调系统中。\n\n---\n\n### **冷却塔的应用场景**\n- **大型商业建筑**：如商场、办公楼、酒店等。\n- **工业设施**：如工厂、数据中心等。\n- **公共设施**：如医院、学校、体育馆等。\n\n---\n\n### **冷却塔的维护**\n1. **定期清洗**：清除填料和水箱中的污垢，防止堵塞。\n2. **检查风机**：确保风机正常运行，避免散热效率下降。\n3. **水质管理**：定期检测冷却水水质，防止腐蚀和结垢。\n4. **检查水泵**：确保水泵运行正常，保证冷却水循环。\n\n---\n\n### **冷却塔与中央空调主机的关系**\n- 冷却塔通常与**水冷式中央空调主机**配套使用。\n- 主机产生的热量通过冷却水传递到冷却塔，冷却塔将热量散发到大气中，从而完成整个制冷循环。\n\n---\n\n### **总结**\n中央空调冷却塔是中央空调系统中不可或缺的一部分，通过高效的散热功能，确保空调系统的稳定运行。它的主要作用是将空调系统中的热量散发到大气中，从而保证空调系统的高效性和可靠性。";

      // marked.setOptions({
      //   breaks: true
      // });
      // let parsedContent = marked.parse(arr.trim()); // 解析 Markdown 格式的文本
      // let parsedContent = marked.parse(arr).replace(/\s+/g, ' ');
      // let parsedContent = marked
      //     .parse(arr)
      //     .replace(/\n\n---\n\n/g, '\n')  // 替换 `\n\n---\n\n` 为 `\n`
      //     .replace(/<hr\s*\/?>/g, '')     // 去掉 `<hr>` 标签
      //     .replace(/\s+/g, ' ');          // 替换多余的空格
      // parsedContent = marked.parse(arr).replace(/\n\n---\n\n/g, '\n')

      // let parsedContent = marked
      //     .parse(arr)
      //     .replace(/\n\n---\n\n/g, '\n')  // 替换 `\n\n---\n\n` 为 `\n`
      //     .replace(/<hr\s*\/?>/g, '')     // 去掉 `<hr>` 标签
      //     .replace(/\s+/g, ' ');          // 替换多余的空格
      // this.msgs.push({
      //   q: parsedContent,
      //   self: false,
      // });
      // return
      deepseek(this.path, paramData).then(res => {
        console.log('机器人的消息', res)

        let data = res.data;
        // 原
        // for (let i = 0; i < data.length; i++) {
        //   let arr = data[i];
        //   let q = arr.q;
        //   let a = arr.a;
        //   this.msgs.push({
        //     q: q,
        //     a: a,
        //     self: false,
        //   });
        //   console.log('aa',this.msgs)
        // }
        // this.$refs.chattingContent.scrollTop = this.$refs.chattingContent.scrollHeight;

        for (let i = 0; i < data.length; i++) {
          let arr = data[i];
          // let parsedContent = marked.parse(arr); // 解析 Markdown 格式的文本
          // let parsedContent = this.parseMarkdown(arr); // 解析 Markdown 格式的文本
          let parsedContent = marked
              .parse(arr)
              .replace(/\n\n---\n\n/g, '\n')  // 替换 `\n\n---\n\n` 为 `\n`
              .replace(/<hr\s*\/?>/g, '')     // 去掉 `<hr>` 标签
              .replace(/\s+/g, ' ');          // 替换多余的空格
          this.msgs.push({
            q: parsedContent,
            self: false,
          });
        }
        this.$nextTick(() => {
          this.$refs.chattingContent.scrollTop = this.$refs.chattingContent.scrollHeight;
        });
      }).catch(err => {
        console.log(err);
      });
    },
    clickBox() {
      if (this.isDragging) {
        return; // 如果正在拖动，则不执行
      }
      this.flag = !this.flag;
      // let box = document.getElementById('box');
      // box.style.width = '500px';
      // box.style.height = '450px';
      // box.style.left = '33%';
      // box.style.top = '20%';
    },
    openBox() {
      console.log('双击')
    },
  },
  directives: {
    drag(el, binding, vnode) {
      let oDiv = el;
      let vm = vnode.context; // 获取 Vue 组件实例
      // document.onselectstart = () => false;

      oDiv.onmousedown = function (e) {
        vm.isDragging = false; // 按下时初始化拖动状态
        let disX = e.clientX - oDiv.offsetLeft;
        let disY = e.clientY - oDiv.offsetTop;
        // 只在非文本区域阻止默认行为
        if (e.target.tagName.toLowerCase() !== 'p' && e.target.tagName.toLowerCase() !== 'div') {
          e.preventDefault();
        }
        document.onmousemove = function (e) {
          vm.isDragging = true; // 发生拖动
          let l = e.clientX - disX;
          let t = e.clientY - disY;
          oDiv.style.left = l + 'px';
          oDiv.style.top = t + 'px';
        };

        document.onmouseup = function (e) {
          document.onmousemove = null;
          document.onmouseup = null;
          setTimeout(() => {
            vm.isDragging = false; // 延迟清除，确保 click 不会误触发
          }, 1);
        };

        return false;
      };
    }
  }


}
</script>

<style scoped>
.button-box {
  width: 80px;
  border-radius: 50%;
  position: fixed;
  bottom: 80px;
  right: 50px;
  padding-left: 15px;
  padding-top: 8px;
  cursor: pointer;
  /*opacity: 0.7;*/
  z-index: 888;
}

.btn-bg-img {
  width: 80px;
  height: 80px;
  /*background-image: url('../../../assets/404_images/404.png');*/
  background: url('../../../assets/home/gpt.png') 0 0 / 100% 100% no-repeat;
  /*background-size: cover;*/
}

.button-box:hover {
  /*color: white;*/
  /*opacity: 1;*/
}

.font-box {
  width: 80px;
  color: #3193ef;
  text-align: center;
}
</style>

<style lang="scss" scoped>
//#box {
//  position: absolute;
//  //width: 160vw;
//  //height: 100vh;
//  min-width: 700px;
//  min-height: 600px;
//  top: 20%;
//  left: 33%;
//  z-index: 8888;
//  background: rgb(195, 218, 226);
//  border-radius: 5px;
//  display: none;
//}
#box {
  position: fixed;
  width: 50vw; /* 宽度占据视口的60% */
  height: 70vh; /* 高度占据视口的60% */
  top: 50%; /* 距离顶部50%的位置 */
  left: 50%; /* 距离左侧50%的位置 */
  transform: translate(-50%, -50%); /* 使用transform来确保居中对齐 */
  z-index: 8888;
  //background: rgb(195, 218, 226);
  background: #fff;
  border-radius: 5px;
  display: none; /* 初始时设置为不可见，点击后通过JS控制显示 */
  //max-width: calc(100% - 40px); /* 保证宽度不会超出屏幕 */
  //max-height: calc(100% - 40px); /* 保证高度不会超出屏幕 */
}

.uImg,
.rImg {
  width: 40px;
  height: 40px;
}

.container {
  height: 100%;
  border-radius: 5px;
}

#header {
  height: 35px;
  line-height: 30px;
  padding: 6px 15px;
  color: #fff;
  font-size: 20px;
  background: linear-gradient(to right, #90dbf9, #64abec);
  border-top-right-radius: 5px;
  border-top-left-radius: 5px;
  display: flex;
  justify-content: flex-end;
  //justify-content: space-between;
  user-select: text;
}

.cBox {
  height: 80%;
}

.contents {
  height: 90%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-content: flex-start;
  padding: 4px 10px;
  background: #fff;
}

.contentsBg {
  flex: 1;
  padding: 15px;
  //overflow-y: auto;

  .chat-message {
    display: flex;
    align-items: center;
  }

  .avatar {
    width: 100px;
    height: 100px;
    margin-right: 10px;
  }

  .message {
    background: #f1f1f1;
    padding: 10px;
    border-radius: 10px;
    color: #2e78c2;
  }
}

.self {
  float: right;
  //height: 40px;
  height: auto;
  margin-bottom: 20px;
}

.other {
  position: relative;
}

.clearfix::before {
  display: block;
  content: '';
  clear: both;
}

.answerContent {
  display: table; /* 让容器宽度随内容变化 */
  //display: block; /* 让容器宽度随内容变化 */
  max-width: 80%; /* 限制最大宽度，避免撑满 */
  padding: 0 6px;
  line-height: 30px;
  //background: rgb(80, 126, 164);
  //background:rgba(137, 206, 234,.5);
  background: #e3ebf7;
  border-radius: 6px;
  color: #000;
  margin-left: 50px;
  margin-bottom: 10px;
}

//.answerContent p {
//  color: #000;
//}

.rImg {
  position: absolute;
  left: 0;
  top: 0;
}

.question {
  //padding: 0 6px;
  //height: 40px;
  //line-height: 40px;
  //background: rgb(245, 225, 152);
  //border-radius: 6px;
  //color: #333;
  //margin-right: 10px;
  display: inline-block; /* 让容器宽度随内容变化 */
  padding: 0 6px;
  line-height: 30px;
  //background: rgb(245, 225, 152);
  background: #76bff2;
  border-radius: 6px;
  color: #333;
  margin-right: 10px;
  //white-space: nowrap; /* 强制内容不换行 */
  min-width: 100px; /* 设置最小宽度 */
}

img {
  display: inline-block;
}

.userQuestion {
  display: flex;
  justify-content: flex-start;
}

.userInput {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 98%;
  padding: 10px 10px;
  height: 20%;
  background: #f3f4f6;
  border-radius: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tBox {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  background: rgb(242, 245, 242);
}

.ipt {
  width: 100%;
  //padding-left: 10px;
  height: 100%;
  //line-height: 30px;
  resize: none;
  border: none;
  outline: none;
  background: #f3f4f6;
}

.sending {
  width: 40px;
  height: 40px;
  display: flex;
  justify-content: center; /* 水平居中 */
  align-items: center; /* 垂直居中 */
  font-size: 30px;
  color: #fdfeff;
  background-color: #007bff;
  border-radius: 50%;
}

#chattingContents, .answerContent, .question {
  user-select: text !important;
}

.bold {
  font-weight: bold;
}

.heading {
  margin-top: 10px;
  margin-bottom: 5px;
  padding-left: 20px;
}
</style>
