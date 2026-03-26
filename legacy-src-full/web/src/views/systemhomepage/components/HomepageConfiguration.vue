<template>
  <div class="homepage-configuration">
    <div v-if="data.length > 0" class="config-stack">
      <section v-for="(item, index) in data" :key="index" class="config-card">
        <div class="config-card__header">
          <div>
            <div class="config-card__eyebrow">Homepage control</div>
            <div class="config-card__title">{{ item.title }}</div>
          </div>
          <div class="config-card__count">{{ item.formItem.length }} groups</div>
        </div>

        <div class="config-card__body">
          <div v-for="(formItem, formIndex) in item.formItem" :key="formIndex" class="config-row">
            <div class="config-row__label">{{ formItem.name }}</div>
            <div class="config-row__content">
              <div v-for="(cascader, cascaderIndex) in formItem.cascaderFor" :key="cascaderIndex" class="config-field">
                <div class="config-field__top">
                  <span class="config-field__name">{{ cascader.tagName || formItem.name }}</span>
                  <span v-if="cascader.units" class="config-field__unit">{{ cascader.units }}</span>
                </div>

                <div v-if="hasOptions(cascader)" class="chip-group">
                  <button
                    v-for="option in cascader.value"
                    :key="option.value"
                    :class="['chip-button', isCurrentValue(cascader, option) ? 'is-active' : '']"
                    :disabled="isCurrentValue(cascader, option)"
                    type="button"
                    @click="sendClick(cascader, option)"
                  >
                    <span class="chip-button__label">{{ option.label }}</span>
                    <span v-if="isCurrentValue(cascader, option)" class="chip-button__state">Active</span>
                  </button>
                </div>

                <div v-else class="config-field__summary">
                  <span class="config-field__value">{{ cascader.tagValue }}</span>
                  <span v-if="cascader.units" class="config-field__unit">{{ cascader.units }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-else class="empty-state">
      <div class="empty-state__title">No controls yet</div>
      <div class="empty-state__desc">首页配置正在等待设备数据。</div>
    </div>
  </div>
</template>

<script>
import { findMainPageByDrTypeIdAndDrId } from "@/api/contentsetting/information";
import { operationRegs } from "@/api/usersetting/devicemonitor/model1";
import { mapGetters } from "vuex";

export default {
  name: "HomepageConfiguration",
  props: ["loadshow"],
  data() {
    return {
      data: [],
      timer: null,
    };
  },
  computed: {
    ...mapGetters(["path", "userid", "id", "logo"]),
  },
  watch: {
    path: {
      handler() {
        this.loadConfig();
      },
      immediate: true,
    },
  },
  beforeDestroy() {
    this.clearTimer();
  },
  methods: {
    clearTimer() {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    },
    setupTimer() {
      this.clearTimer();
      this.timer = setTimeout(() => {
        this.loadConfig();
      }, 10000);
    },
    normalizeData(list) {
      return (list || []).map((item) => {
        return {
          ...item,
          formItem: (item.formItem || []).map((formItem) => {
            return {
              ...formItem,
              cascaderFor: (formItem.cascaderFor || []).map((cascader) => {
                const tagValue = cascader.tagValue || "";
                const hasPipe = typeof tagValue === "string" && tagValue.includes("|");
                const options = hasPipe
                  ? tagValue.split("|").map((pair) => {
                      const [value, label] = pair.split(":");
                      return {
                        label: label || value,
                        value,
                      };
                    })
                  : [];
                return {
                  ...cascader,
                  value: options,
                };
              }),
            };
          }),
        };
      });
    },
    hasOptions(cascader) {
      return Array.isArray(cascader.value) && cascader.value.length > 0;
    },
    isCurrentValue(cascader, option) {
      return String(cascader.currentValue) === String(option.value);
    },
    loadConfig() {
      this.clearTimer();
      findMainPageByDrTypeIdAndDrId(this.path)
        .then((res) => {
          if (res.status === 20000 && res.data) {
            this.data = this.normalizeData(res.data);
          } else {
            this.data = [];
          }
        })
        .catch(() => {
          this.data = [];
        })
        .finally(() => {
          this.setupTimer();
        });
    },
    sendClick(formItem, cascaderBtn) {
      const info = {
        userId: this.userid,
        appId: this.id,
        drTypeId: formItem.drTypeId,
        drId: formItem.drId,
        msg: `${formItem.name}|${cascaderBtn.value}|${formItem.tagName}`,
      };
      const message = `您确定要修改 “${formItem.name}” 的值为 “${cascaderBtn.label || cascaderBtn.value}” 吗?`;
      const title = this.logo && this.logo.applogotext ? `提示：${this.logo.applogotext}` : "提示";
      this.$confirm(message, title, {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
      })
        .then(() => {
          operationRegs(this.path, info)
            .then((res) => {
              if (res.status === 20000) {
                this.$message.success("修改成功！");
              }
            })
            .catch(console.log);
        })
        .catch(() => {});
    },
  },
};
</script>

<style scoped lang="scss">
.homepage-configuration {
  position: absolute;
  z-index: 6;
  left: 100%;
  top: 0;
  width: clamp(320px, 30vw, 560px);
  min-width: 320px;
  color: #fff;
}

.config-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.config-card {
  padding: 16px 16px 14px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(8, 23, 38, 0.94) 0%, rgba(13, 35, 54, 0.88) 100%);
  border: 1px solid rgba(122, 210, 255, 0.12);
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(12px);
}

.config-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.config-card__eyebrow {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(194, 221, 236, 0.7);
}

.config-card__title {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
  color: #f7fbff;
}

.config-card__count {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #82e6ff;
  background: rgba(130, 230, 255, 0.09);
  border: 1px solid rgba(130, 230, 255, 0.12);
}

.config-card__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-row {
  display: grid;
  grid-template-columns: minmax(120px, 160px) 1fr;
  gap: 14px;
  align-items: flex-start;
}

.config-row__label {
  min-height: 38px;
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: rgba(236, 245, 252, 0.95);
}

.config-row__content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.config-field {
  padding: 12px 12px 11px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(122, 210, 255, 0.08);
}

.config-field__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.config-field__name {
  font-size: 13px;
  font-weight: 600;
  color: rgba(244, 249, 253, 0.96);
}

.config-field__unit {
  font-size: 12px;
  color: rgba(154, 201, 227, 0.88);
}

.config-field__summary {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(130, 230, 255, 0.09);
  border: 1px solid rgba(130, 230, 255, 0.12);
}

.config-field__value {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-button {
  appearance: none;
  border: 1px solid rgba(130, 210, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(238, 246, 251, 0.96);
  border-radius: 999px;
  padding: 8px 12px;
  min-height: 36px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.chip-button:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(130, 230, 255, 0.34);
  background: rgba(130, 230, 255, 0.1);
}

.chip-button:disabled,
.chip-button.is-active {
  cursor: default;
  background: linear-gradient(135deg, rgba(96, 240, 255, 0.22) 0%, rgba(61, 134, 255, 0.18) 100%);
  border-color: rgba(128, 226, 255, 0.34);
  color: #ffffff;
}

.chip-button__label {
  font-size: 13px;
  font-weight: 600;
}

.chip-button__state {
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #06131d;
  background: linear-gradient(135deg, #91f7ff 0%, #5cb7ff 100%);
}

.empty-state {
  padding: 20px 18px;
  border-radius: 18px;
  background: rgba(8, 23, 38, 0.72);
  border: 1px solid rgba(122, 210, 255, 0.1);
  color: rgba(233, 243, 249, 0.9);
}

.empty-state__title {
  font-size: 16px;
  font-weight: 600;
}

.empty-state__desc {
  margin-top: 6px;
  font-size: 13px;
  color: rgba(194, 221, 236, 0.75);
}

@media (max-width: 1280px) {
  .homepage-configuration {
    width: min(90vw, 520px);
  }

  .config-row {
    grid-template-columns: 1fr;
  }
}
</style>
