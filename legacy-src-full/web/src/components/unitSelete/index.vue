<template>
  <div class="unit-switch" role="group" aria-label="单位切换">
    <button
      type="button"
      :class="['unit-switch__item', currentUnit === 'KW' ? 'is-active' : '']"
      @click="unitSeleteClick('KW')"
    >
      <span class="unit-switch__value">KW</span>
    </button>
    <button
      type="button"
      :class="['unit-switch__item', currentUnit === 'RT' ? 'is-active' : '']"
      @click="unitSeleteClick('RT')"
    >
      <span class="unit-switch__value">RT</span>
    </button>
  </div>
</template>

<script>
export default {
  computed: {
    currentUnit() {
      return this.$store.getters.unitSelete;
    },
  },
  methods: {
    unitSeleteClick(unit) {
      if (this.currentUnit === unit) {
        return;
      }
      this.$store.dispatch("app/setUnitSelete", unit);
    },
  },
};
</script>

<style lang="scss" scoped>
.unit-switch {
  display: inline-flex;
  align-items: center;
  padding: 4px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(7, 24, 37, 0.94) 0%, rgba(15, 50, 72, 0.82) 100%);
  border: 1px solid rgba(122, 210, 255, 0.16);
  box-shadow: 0 12px 24px rgba(2, 10, 18, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.unit-switch__item {
  appearance: none;
  border: 0;
  background: transparent;
  color: rgba(206, 226, 238, 0.84);
  min-width: 74px;
  padding: 11px 16px 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.unit-switch__item:hover {
  transform: translateY(-1px);
  color: #f5fbff;
}

.unit-switch__item.is-active {
  background: linear-gradient(135deg, #60f0ff 0%, #3d86ff 100%);
  color: #06131d;
  box-shadow: 0 10px 18px rgba(61, 134, 255, 0.22);
}

.unit-switch__value {
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.06em;
}
</style>
