<script setup lang="ts">
const axes = [
  'M1585.5 541L1565.5 552.5V529.5L1585.5 541ZM743 543C741.9 543 741 542.1 741 541C741 539.9 741.9 539 743 539V541V543ZM1567.5 541V543H743V541V539H1567.5V541Z',
  'M743 42L731.5 62L754.5 62L743 42ZM741 541C741 542.1 741.9 543 743 543C744.1 543 745 542.1 745 541L743 541L741 541ZM743 541L745 541L745 60L743 60L741 60L741 541L743 541Z',
  'M980 754L972.8 732L957.4 749.2L980 754ZM744.3 539.5C743.5 538.8 742.3 538.8 741.5 539.7C740.8 540.5 740.8 541.7 741.7 542.5L743 541L744.3 539.5ZM966.6 742L967.9 740.5L744.3 539.5L743 541L741.7 542.5L965.3 743.5L966.6 742Z',
]

// Faces of the bottom stand and of the top part
const stand = [
  'M132 421L1355 421V541H132V421Z',
  'M1355 421L1555 601V721L1355 541V421Z',
  'M132 541H1355L1555 721H332L132 541Z',
  'M332 601L1555 601V721H332V601Z',
  'M132 421L1355 421L1555 601H332L132 421Z',
  'M132 421L332 601V721L132 541V421Z',
]
// In drawing order: back, bottom, right side, left side, top. The slanted front
// face has no path of its own - all four of its edges belong to the others.
const box = [
  'M132 91H1355V421.1H132L132 91Z',
  'M132 421H1355L1555 599H332L132 421Z',
  'M1355 91L1385 119L1555 599L1355 421L1355 91Z',
  'M132 91L162 120.9L332 599L132 421L132 91Z',
  'M132 91H1355L1385 119L162 120.9L132 91Z',
]

// Front faces of the letters (n, p, m, x). The back faces are the same outlines
// shifted by the extrusion depth, and `depthEdges` joins the two at every corner.
const letters = [
  'M335.8 532.3V264.3H395.8V276.3C410.8 268.6 427.7 264.3 445.8 264.3C463.8 264.3 480.7 268.6 495.8 276.3C531.4 294.5 555.8 331.6 555.8 374.3V532.3H495.8V374.3C495.8 346.7 473.4 324.3 445.8 324.3C418.1 324.3 395.8 346.7 395.8 374.3V532.3H335.8Z',
  'M595.8 264.3H655.8V282.1C673 270.8 693.6 264.3 715.8 264.3C737.9 264.3 758.5 270.8 775.8 282.1C805.9 301.7 825.8 335.7 825.8 374.3C825.8 412.9 805.9 446.9 775.8 466.5C758.5 477.8 737.9 484.3 715.8 484.3C693.6 484.3 673 477.8 655.8 466.5V532.3H595.8V264.3ZM715.8 314.3C748.9 314.3 775.8 341.2 775.8 374.3C775.8 407.4 748.9 434.3 715.8 434.3C682.6 434.3 655.8 407.4 655.8 374.3C655.8 341.2 682.6 314.3 715.8 314.3Z',
  'M1075.8 532.3V338.3C1075.8 327.3 1066.8 318.3 1055.8 318.3C1044.7 318.3 1035.8 327.3 1035.8 338.3V532.3H975.8V338.3C975.8 327.3 966.8 318.3 955.8 318.3C944.7 318.3 935.8 327.3 935.8 338.3V532.3H875.8V264.3H935.8V266.8C942.1 265.2 948.8 264.3 955.8 264.3C962.7 264.3 969.4 265.2 975.8 266.8C986.9 269.7 997.1 274.9 1005.8 281.8C1014.5 274.9 1024.6 269.7 1035.8 266.8C1042.1 265.2 1048.8 264.3 1055.8 264.3C1062.7 264.3 1069.4 265.2 1075.8 266.8C1110.3 275.7 1135.8 307 1135.8 344.3V532.3H1075.8Z',
  'M1399.8 532.3L1322.4 398.3L1399.8 264.3H1330.5L1287.8 338.3L1245 264.3H1175.8L1253.1 398.3L1175.8 532.3H1245L1287.8 458.3L1330.5 532.3H1399.8Z',
]
const depthEdges =
  'M335.8 264.3l-58.8-54.3M335.8 532.3l-58.8-54.3M395.8 264.3l-58.8-54.3M395.8 276.3l-58.8-54.3M395.8 374.3l-58.8-54.3M395.8 532.3l-58.8-54.3M445.8 264.3l-58.8-54.3M445.8 324.3l-58.8-54.3M478.9 336.8l-58.8-54.3M495.8 276.3l-58.8-54.3M495.8 374.3l-58.8-54.3M495.8 532.3l-58.8-54.3M521 294.1l-58.8-54.3M555.8 374.3l-58.8-54.3M555.8 532.3l-58.8-54.3M595.8 264.3l-58.8-54.3M595.8 532.3l-58.8-54.3M655.8 264.3l-58.8-54.3M655.8 282.1l-58.8-54.3M655.8 374.3l-58.8-54.3M655.8 466.5l-58.8-54.3M655.8 532.3l-58.8-54.3M676 419.2l-58.8-54.3M715.8 264.3l-58.8-54.3M715.8 314.3l-58.8-54.3M715.8 434.3l-58.8-54.3M715.8 484.3l-58.8-54.3M755.5 329.3l-58.8-54.3M775.8 282.1l-58.8-54.3M775.8 374.3l-58.8-54.3M775.8 466.5l-58.8-54.3M791 294l-58.8-54.3M825.8 374.3l-58.8-54.3M875.8 264.3l-58.8-54.3M875.8 532.3l-58.8-54.3M935.8 264.3l-58.8-54.3M935.8 266.8l-58.8-54.3M935.8 338.3l-58.8-54.3M935.8 532.3l-58.8-54.3M955.8 264.3l-58.8-54.3M955.8 318.3l-58.8-54.3M969 323.3l-58.8-54.3M975.8 266.8l-58.8-54.3M975.8 338.3l-58.8-54.3M975.8 532.3l-58.8-54.3M1005.8 281.8l-58.8-54.3M1035.8 266.8l-58.8-54.3M1035.8 338.3l-58.8-54.3M1035.8 532.3l-58.8-54.3M1055.8 264.3l-58.8-54.3M1055.8 318.3l-58.8-54.3M1069 323.3l-58.8-54.3M1075.8 266.8l-58.8-54.3M1075.8 338.3l-58.8-54.3M1075.8 532.3l-58.8-54.3M1110.3 285.8l-58.8-54.3M1135.8 344.3l-58.8-54.3M1135.8 532.3l-58.8-54.3M1175.8 264.3l-58.8-54.3M1175.8 532.3l-58.8-54.3M1245 264.3l-58.8-54.3M1245 532.3l-58.8-54.3M1253.1 398.3l-58.8-54.3M1287.8 338.3l-58.8-54.3M1287.8 458.3l-58.8-54.3M1322.4 398.3l-58.8-54.3M1330.5 264.3l-58.8-54.3M1330.5 532.3l-58.8-54.3M1399.8 264.3l-58.8-54.3M1399.8 532.3l-58.8-54.3'
const depthEdgesCount = 70
</script>

<template>
  <svg
    width="1675"
    height="784"
    viewBox="0 0 1675 784"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-label="$t('alt_logo')"
    class="noodle-blender-art"
  >
    <g class="noodle-blender-axes" fill="#828282">
      <path v-for="(d, index) in axes" :key="index" :d="d" />
    </g>
    <g
      class="noodle-blender-lines"
      stroke="currentColor"
      stroke-width="4"
      stroke-linejoin="round"
      stroke-dasharray="1 1"
    >
      <g class="noodle-blender-base">
        <path v-for="(d, index) in stand" :key="index" :d="d" pathLength="1" />
      </g>
      <g class="noodle-blender-box">
        <path v-for="(d, index) in box" :key="index" :d="d" pathLength="1" />
      </g>
      <g class="noodle-blender-letters" stroke-linejoin="miter">
        <path v-for="(d, index) in letters" :key="index" :d="d" pathLength="1" />
      </g>
      <g class="noodle-blender-depth">
        <g class="noodle-blender-back" transform="translate(-58.751 -54.298)">
          <path v-for="(d, index) in letters" :key="index" :d="d" pathLength="1" />
        </g>
        <path :d="depthEdges" :pathLength="depthEdgesCount" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .noodle-blender-lines path {
    animation: noodle-blender-draw var(--duration, 1.2s) ease-in-out var(--delay, 0s) both;
  }

  .noodle-blender-axes path {
    /* the point where the three axes meet, in viewBox units */
    transform-origin: 743px 541px;
    animation: noodle-blender-grow 0.8s cubic-bezier(0.22, 1, 0.36, 1) var(--delay, 0s) both;
  }
  .noodle-blender-axes path:nth-child(2) {
    --delay: 0.15s;
  }
  .noodle-blender-axes path:nth-child(3) {
    --delay: 0.3s;
  }

  /* 1. axes: 0s → 1.1s (rules above) */

  /* 2. bottom stand: 1.1s → 2.3s */
  .noodle-blender-base {
    --delay: 1.1s;
  }

  /* 3. top part, face by face: 2.3s → 4.7s */
  .noodle-blender-box {
    --duration: 0.6s;
    /* back */
    --delay: 2.3s;
  }
  /* bottom */
  .noodle-blender-box path:nth-child(2) {
    --delay: 2.9s;
  }
  /* both sides */
  .noodle-blender-box path:nth-child(3),
  .noodle-blender-box path:nth-child(4) {
    --delay: 3.5s;
  }
  /* top */
  .noodle-blender-box path:nth-child(5) {
    --delay: 4.1s;
  }

  /* 4. 2D letters: 4.7s → 6.5s */
  .noodle-blender-letters {
    --delay: 4.7s;
  }
  .noodle-blender-letters path:nth-child(2) {
    --delay: 4.9s;
  }
  .noodle-blender-letters path:nth-child(3) {
    --delay: 5.1s;
  }
  .noodle-blender-letters path:nth-child(4) {
    --delay: 5.3s;
  }

  /* 5. side edges, from the front letters to the back: 6.5s → 7.1s */
  .noodle-blender-depth {
    --delay: 6.5s;
  }
  .noodle-blender-depth > path {
    --duration: 0.6s;
  }

  /* 6. back letters: 7.1s → 8.3s */
  .noodle-blender-back {
    --delay: 7.1s;
  }
}

@keyframes noodle-blender-draw {
  from {
    stroke-dashoffset: 1;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes noodle-blender-grow {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}
</style>
