<template>
  <div class="info-shell" :class="{ 'four-items': isFourItems }">
    <section class="info-shell__grid">
      <article
        v-for="(item, index) in infoBlocks"
        :key="index"
        :class="contentClass(index)"
        class="info-card"
      >
        <div class="info-card__header">
          <div class="info-card__eyebrow">Device Block</div>
          <div class="info-card__title">{{ item.title }}</div>
        </div>
        <div class="info-card__list">
          <div v-for="item2 in item.formItem" :key="item2.name" class="info-row">
            <div class="info-row__label">{{ item2.name }}</div>
            <div class="info-row__value">{{ item2.tagValue || '--' }}</div>
            <div v-if="item2.units" class="info-row__unit">{{ item2.units }}</div>
          </div>
        </div>
      </article>
    </section>

    <aside class="info-sidebar">
      <section class="nameplate-card">
        <div class="nameplate-card__head">
          <div>
            <div class="nameplate-card__eyebrow">Nameplate</div>
            <div class="nameplate-card__title">基本信息</div>
          </div>
          <div class="nameplate-card__metric">
            <strong>{{ nameplateItems.length }}</strong>
            <span>items</span>
          </div>
        </div>
        <div class="nameplate-card__list">
          <div v-for="item in nameplateItems" :key="item.name" class="nameplate-item">
            <span class="nameplate-item__label">{{ item.name }}</span>
            <span class="nameplate-item__value">{{ item.value || '--' }}</span>
          </div>
        </div>
      </section>

      <section class="image-card">
        <div v-if="!deviceImage" class="image-card__empty">
          <div class="image-card__placeholder"></div>
          <p>{{ imageLoadFailed ? '暂无设备图片' : '加载中...' }}</p>
        </div>
        <img v-else :src="deviceImage" class="image-card__image" @error="handleImageError" />
        <div v-if="loadPercentage !== null" class="image-card__progress">
          <el-progress
            :percentage="loadPercentage"
            :stroke-width="18"
            :text-inside="true"
            color="#10e1ff"
            stroke-linecap="square"
          />
          <div class="image-card__progress-label">机组电流比</div>
        </div>
        <div v-if="deviceImage" class="image-card__caption">{{ drId }}</div>
      </section>
    </aside>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import { findByDrTypeIdAndDrId, findByDrId } from "@/api/contentsetting/information";
import globalData from "@/utils/global";

export default {
  props: ["drTypeId", "drId"],
  name: "Info",
  computed: {
    ...mapGetters(["path", "id"]),
    isFourItems() {
      return this.infoBlocks.length === 4;
    },
    infoBlocks() {
      return this.data && this.data.data && this.data.data.data ? this.data.data.data : [];
    },
    nameplateItems() {
      return this.nameplate && this.nameplate.data && this.nameplate.data.data ? this.nameplate.data.data : [];
    },
    deviceImage() {
      if (this.imageLoadFailed) {
        return "";
      }
      if (this.nameplate && this.nameplate.data && this.nameplate.data.deviceImg) {
        return this.baseurl + this.nameplate.data.deviceImg;
      }
      return "";
    },
    loadPercentage() {
      if (!this.nameplate || !this.nameplate.data || this.nameplate.data.load === null || this.nameplate.data.load === undefined) {
        return null;
      }
      return Math.min(Number(this.nameplate.data.load) || 0, 100);
    },
  },
  data() {
    return {
      baseurl: globalData.baseUrl,
      data: {},
      nameplate: {},
      imageLoadFailed: false,
    };
  },
  methods: {
    contentClass(index) {
      if (index < 3) {
        return "first-row";
      }
      return index % 2 === 0 ? "right" : "left";
    },
    handleImageError() {
      this.imageLoadFailed = true;
    },
  },
  mounted() {
    findByDrTypeIdAndDrId(this.path, { drId: this.drId }).then((res) => {
      if (res.status !== 20000) this.$message.error(res.msg);
      this.data = res;
    });
    findByDrId(this.path, this.drId).then((res) => {
      this.imageLoadFailed = false;
      this.nameplate = res;
    });
  },
};
</script>

<style lang="scss">
.el-progress {
  .el-progress-bar__outer {
    background-color: rgba(176, 245, 255, 0.14);

    .el-progress-bar__innerText {
      color: #06131d;
      font-size: 14px;
    }
  }
}
</style>

<style lang="scss" scoped>
.info-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.9fr);
  gap: 18px;
  min-height: 100%;
}

.info-shell__grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-card,
.nameplate-card,
.image-card {
  border-radius: 20px;
  border: 1px solid rgba(124, 202, 255, 0.12);
  background: linear-gradient(180deg, rgba(12, 26, 41, 0.96) 0%, rgba(9, 20, 33, 0.92) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.info-card {
  padding: 18px;
}

.info-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.info-card__eyebrow,
.nameplate-card__eyebrow {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(181, 212, 231, 0.68);
}

.info-card__title,
.nameplate-card__title {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
  color: rgba(245, 250, 255, 0.98);
}

.info-card__list {
  display: grid;
  gap: 10px;
}

.info-row {
  display: grid;
  grid-template-columns: minmax(130px, 1fr) auto auto;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(124, 202, 255, 0.08);
}

.info-row__label {
  color: rgba(220, 234, 243, 0.82);
  font-size: 13px;
}

.info-row__value {
  justify-self: end;
  color: #76e7ff;
  font-size: 15px;
  font-weight: 600;
}

.info-row__unit {
  color: rgba(188, 216, 232, 0.72);
  font-size: 12px;
}

.info-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.nameplate-card {
  padding: 18px;
}

.nameplate-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.nameplate-card__metric {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: rgba(196, 220, 239, 0.72);
  font-size: 12px;
}

.nameplate-card__metric strong {
  font-size: 28px;
  line-height: 1;
  color: #76e7ff;
}

.nameplate-card__list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.nameplate-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(124, 202, 255, 0.08);
}

.nameplate-item__label {
  color: rgba(220, 234, 243, 0.82);
  font-size: 13px;
}

.nameplate-item__value {
  color: #f5fbff;
  font-size: 14px;
  font-weight: 600;
}

.image-card {
  position: relative;
  overflow: hidden;
  min-height: 360px;
  padding: 18px;
}

.image-card__empty {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: rgba(196, 221, 236, 0.76);
}

.image-card__placeholder {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(96, 240, 255, 0.18) 0%, rgba(61, 134, 255, 0.08) 46%, transparent 70%);
}

.image-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.image-card__progress {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 18px;
}

.image-card__progress-label {
  margin-top: 8px;
  color: rgba(188, 216, 232, 0.76);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.image-card__caption {
  position: absolute;
  left: 18px;
  bottom: 66px;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(4, 15, 25, 0.8);
  border: 1px solid rgba(124, 202, 255, 0.12);
  color: rgba(220, 234, 243, 0.82);
  font-size: 12px;
}

@media (max-width: 1280px) {
  .info-shell {
    grid-template-columns: 1fr;
  }
}

.four-items .info-shell__grid {
  grid-auto-rows: minmax(0, auto);
}
</style>
