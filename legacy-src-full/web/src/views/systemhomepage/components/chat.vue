<template>
  <div>
    <div style="position:relative;">
      <div class="button-box" v-drag draggable="false">
        <div class="btn-bg-img" @dblclick="openBox" @click="clickBox"></div>
        <div class="font-box">{{ assistantCopy.floatLabel }}</div>
      </div>
    </div>
    <div id="box" :style=" flag ? 'display:none':'display:block'">
      <!-- 主体 -->
      <div class="container">
        <div id="header">
          <div class="chat-header-title">{{ assistantCopy.headerTitle }}</div>
          <p>
            <span
                @click="yc"
                class="chat-close"
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
                  <p>{{ assistantCopy.introTitle }}</p>
                  <p>{{ assistantCopy.introBody }}</p>
                </div>
              </div>
              <div class="quick-prompts">
                <div class="quick-prompts-title">{{ assistantCopy.quickPromptTitle }}</div>
                <div
                    v-for="group in assistantQuickPromptGroups"
                    :key="group.title"
                    class="quick-prompt-group"
                >
                  <div class="quick-prompt-group-title">{{ group.title }}</div>
                  <div class="quick-prompts-list">
                    <button
                        v-for="prompt in group.prompts"
                        :key="prompt"
                        type="button"
                        class="quick-prompt-chip"
                        :disabled="isLoading"
                        @click="sendSuggestedPrompt(prompt)"
                    >
                      {{ prompt }}
                    </button>
                  </div>
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
                  <div class="q" v-html="item.q" style="white-space:pre-line;"></div>
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
                        :placeholder="assistantCopy.inputPlaceholder"
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
import {deepseek, queryAssistant} from '@/api/usersetting/chat'
import {mapGetters} from "vuex";
import {
  buildQuickPromptGroups,
  buildUiCopy,
  mapAssistantLocale,
  renderErrorAnswer,
  renderFallbackAnswer,
  renderStructuredAnswer
} from './chatAssistantUtils'

export default {
  computed: {
    ...mapGetters(["path", "userid", "id", "template"]),
    assistantLocale() {
      return mapAssistantLocale(this.$i18n && this.$i18n.locale)
    },
    assistantCopy() {
      return buildUiCopy(this.$i18n && this.$i18n.locale)
    },
    assistantQuickPromptGroups() {
      return buildQuickPromptGroups(this.$i18n && this.$i18n.locale, this.lastAssistantPayload)
    }
  },
  data() {
    return {
      isOpen: false,
      isMove: false,
      msgs: [], //用来存放对话
      inputContent: '',
      flag: true,
      flag2: true,
      isDragging: false, // 添加 isDragging 状态
      isLoading: false,
      tempAnswer: null, // 用于临时保存回答内容
      lastAssistantPayload: null
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
      this.submitQuestion(this.inputContent, 'manual')
    },
    submitQuestion(question, promptOrigin = 'manual') {
      const normalizedQuestion = String(question || '').trim()
      if (!normalizedQuestion || this.isLoading) {
        return
      }
      this.msgs.push({
        content: normalizedQuestion,
        self: true,
      });
      this.getResult(normalizedQuestion, promptOrigin);
      setTimeout(() => {
        if (this.$refs.chattingContent) {
          this.$refs.chattingContent.scrollTop = this.$refs.chattingContent.scrollHeight;
        }
      }, 0);
      this.inputContent = '';
    },
    sendSuggestedPrompt(prompt) {
      this.submitQuestion(prompt, 'suggested')
    },
    replaceTempAnswer(html) {
      const nextAnswer = {
        q: html,
        self: false
      }
      const index = this.msgs.indexOf(this.tempAnswer)
      if (index > -1) {
        this.msgs.splice(index, 1, nextAnswer)
      } else {
        this.msgs.push(nextAnswer)
      }
      this.tempAnswer = null
    },
    buildAssistantRequest(question, promptOrigin = 'manual') {
      return {
        context: {
          siteId: this.path,
          surface: 'legacy-home-chat',
          locale: this.assistantLocale,
          promptOrigin,
          userId: this.userid,
          projectKey: this.path,
          template: this.template,
          legacyBaseUrl: process.env.VUE_APP_BASE_URL
        },
        query: {
          text: question
        }
      }
    },
    async requestFallbackAnswer(question) {
      const paramData = {
        userId: this.userid,
        model: 'deepseek-chat',
        content: question,
      }
      const res = await deepseek(this.path, paramData)
      const data = Array.isArray(res && res.data) ? res.data : []
      if (data.length === 0) {
        throw new Error(this.assistantCopy.fallbackUnavailable)
      }
      return renderFallbackAnswer(data.join('\n\n'), this.assistantLocale)
    },
    resolveAssistantError(error) {
      if (error && error.payload && error.payload.error) {
        return error.payload.error
      }
      if (error && error.message) {
        return error.message
      }
      return this.assistantCopy.requestFailed
    },
    async getResult(question, promptOrigin = 'manual') {
      this.isLoading = true; // 开始加载

      this.tempAnswer = {
        q: `<div class="loading-img"><img style="width: 50px;" src="${require('@/assets/loading.gif')}"></div>`,
        self: false
      };
      this.msgs.push(this.tempAnswer);
      try {
        if (!this.path) {
          this.replaceTempAnswer(renderErrorAnswer(this.assistantCopy.missingSite, this.assistantLocale))
          return
        }

        const payload = await queryAssistant(this.path, this.buildAssistantRequest(question, promptOrigin))
        this.lastAssistantPayload = payload
        this.replaceTempAnswer(renderStructuredAnswer(payload, this.assistantLocale))
      } catch (error) {
        this.lastAssistantPayload = null
        if (error && error.shouldFallback) {
          try {
            const fallbackHtml = await this.requestFallbackAnswer(question)
            this.replaceTempAnswer(fallbackHtml)
          } catch (fallbackError) {
            console.error(fallbackError)
            this.replaceTempAnswer(
                renderErrorAnswer(
                    fallbackError && fallbackError.message ? fallbackError.message : this.assistantCopy.fallbackUnavailable,
                    this.assistantLocale
                )
            )
          }
        } else {
          this.replaceTempAnswer(
              renderErrorAnswer(this.resolveAssistantError(error), this.assistantLocale)
          )
        }
      } finally {
        this.isLoading = false;
        this.$nextTick(() => {
          if (this.$refs.chattingContent) {
            this.$refs.chattingContent.scrollTop = this.$refs.chattingContent.scrollHeight;
          }
        });
      }
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

<style scoped lang="scss">
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
    color: rgba(95, 231, 255, 0.9);
    text-align: center;
  }

//.loading-img {
//  display: flex;
//  justify-content: center;
//  align-items: center;
//  padding: 10px;
//
//  img {
//    width: 20px;
//    height: 20px;
//    animation: spin 1.5s linear infinite;
//  }
//}
//
//@keyframes spin {
//  0% {
//    transform: rotate(0deg);
//  }
//  100% {
//    transform: rotate(360deg);
//  }
//}

///* 调整回答容器的最小高度 */
//.answerContent {
//  min-height: 60px;
//  min-width: 120px;
//  position: relative;
//}
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
  width: min(720px, calc(100vw - 48px));
  height: min(76vh, 760px);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 8888;
  display: none;
  overflow: hidden;
  border: 1px solid rgba(122, 210, 255, 0.14);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(8, 20, 34, 0.98) 0%, rgba(7, 18, 31, 0.98) 100%);
  box-shadow: 0 32px 72px rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(18px);
}

.uImg,
.rImg {
  width: 40px;
  height: 40px;
}

.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
}

#header {
  height: 56px;
  padding: 0 18px;
  color: #fff;
  font-size: 18px;
  background: linear-gradient(90deg, rgba(67, 146, 255, 0.18) 0%, rgba(88, 227, 255, 0.08) 100%);
  border-bottom: 1px solid rgba(122, 210, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  user-select: text;
}

.cBox {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.contents {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-content: flex-start;
  padding: 14px 16px 128px;
  background:
    radial-gradient(circle at top, rgba(92, 200, 255, 0.06) 0%, transparent 28%),
    linear-gradient(180deg, rgba(7, 18, 31, 0.9) 0%, rgba(7, 18, 31, 0.98) 100%);
}

.contentsBg {
  flex: 1;
  padding: 8px 4px 16px;

  .chat-message {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .avatar {
    width: 56px;
    height: 56px;
    margin-right: 0;
    border-radius: 18px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  }

  .message {
    max-width: 70%;
    padding: 14px 16px;
    border: 1px solid rgba(122, 210, 255, 0.12);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(229, 240, 248, 0.88);
  }
}

.quick-prompts {
  margin: 16px 0 4px 68px;
}

.quick-prompts-title {
  margin-bottom: 14px;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: rgba(150, 206, 233, 0.74);
}

.quick-prompt-group {
  margin-bottom: 14px;
}

.quick-prompt-group-title {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(209, 237, 248, 0.88);
}

.quick-prompts-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.quick-prompt-chip {
  padding: 8px 14px;
  border: 1px solid rgba(122, 210, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(231, 243, 250, 0.9);
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(122, 210, 255, 0.34);
    background: rgba(80, 170, 255, 0.12);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
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
  display: table;
  max-width: calc(100% - 72px);
  padding: 10px 14px;
  line-height: 1.7;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(122, 210, 255, 0.1);
  border-radius: 18px;
  color: rgba(232, 241, 248, 0.9);
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
  display: inline-block;
  padding: 10px 14px;
  line-height: 1.7;
  background: linear-gradient(135deg, rgba(51, 138, 255, 0.9) 0%, rgba(70, 204, 255, 0.74) 100%);
  border-radius: 18px;
  color: #f8fcff;
  margin-right: 10px;
  min-width: 100px;
  box-shadow: 0 14px 30px rgba(29, 80, 145, 0.24);
}

img {
  display: inline-block;
}

.userQuestion {
  display: flex;
  justify-content: flex-start;
}

.userInput {
  position: absolute;
  right: 14px;
  bottom: 14px;
  left: 14px;
  padding: 10px;
  min-height: 96px;
  background: rgba(4, 12, 22, 0.78);
  border: 1px solid rgba(122, 210, 255, 0.12);
  border-radius: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  backdrop-filter: blur(16px);
}

.tBox {
  flex: 1;
  min-height: 76px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
}

.ipt {
  width: 100%;
  height: 100%;
  padding: 12px 14px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: rgba(245, 251, 255, 0.94);
}

.sending {
  width: 46px;
  height: 46px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 30px;
  color: #fdfeff;
  background: linear-gradient(135deg, #338aff 0%, #46ccff 100%);
  border-radius: 50%;
  box-shadow: 0 14px 30px rgba(37, 104, 181, 0.3);
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


.loading-img {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px;

  img {
    width: 20px;
    height: 20px;
    animation: spin 1.5s linear infinite;
  }
}

.chat-header-title {
  margin-right: auto;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(243, 251, 255, 0.94);
}

.chat-close {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-left: 10px;
  border-radius: 999px;
  color: rgba(243, 251, 255, 0.78);
  transition: background 0.2s ease, color 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

///* 调整回答容器的最小高度 */
//.answerContent {
//  min-height: 60px;
//  min-width: 120px;
//  position: relative;
//}
</style>
