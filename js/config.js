window.SS = window.SS || {};
(function (SS) {
  'use strict';

  SS.CFG = {
    W: 480,
    H: 270,
    TILE: 16,
    SPEED: 72,
    BASE_RATE: 1.6,
    HERB: { qi: 20, stone: 3, respawn: 40 },
    BOOK: { firstDelay: 18, minGap: 55, maxGap: 105, life: 75, pickDist: 26 },
    BOOKS: [
      { title: '道德经', text: '道可道，非常道；名可名，非常名。', rare: false },
      { title: '论语', text: '学而时习之，不亦说乎。', rare: false },
      { title: '南华经', text: '天地与我并生，万物与我为一。', rare: false },
      { title: '清静经', text: '人能常清静，天地悉皆归。', rare: false },
      { title: '阴符经', text: '观天之道，执天之行，尽矣。', rare: false },
      { title: '坐忘论', text: '坐忘者，长存不亡也。', rare: false },
      { title: '黄庭经', text: '上有黄庭下关元，后有幽阙前命门。', rare: false },
      { title: '心经', text: '照见五蕴皆空，度一切苦厄。', rare: true },
      { title: '金刚经', text: '凡所有相，皆是虚妄。', rare: true },
      { title: '坛经', text: '本来无一物，何处惹尘埃。', rare: true }
    ],
    OFFLINE_CAP_H: 5,
    OFFLINE_EFF: 0.3,
    SAVE_KEY: 'shangshan-save-v1',
    NAME_KEY: 'shangshan-name',
    REALMS: [
      { name: '凡人',       need: 0,      mult: 1.0,  sky: 'morning',   aura: '#e8e0d0', belt: '#8a6a5a' },
      { name: '练气一层',   need: 360,    mult: 1.26, sky: 'morning',   aura: '#b8cdc0', belt: '#8a6a5a' },
      { name: '练气二层',   need: 525,    mult: 1.53, sky: 'morning',   aura: '#b8cdc0', belt: '#8a6a5a' },
      { name: '练气三层',   need: 765,    mult: 1.79, sky: 'morning',   aura: '#b8cdc0', belt: '#8a6a5a' },
      { name: '练气四层',   need: 1110,   mult: 2.05, sky: 'morning',   aura: '#b8cdc0', belt: '#8a6a5a' },
      { name: '练气五层',   need: 1605,   mult: 2.32, sky: 'morning',   aura: '#b8cdc0', belt: '#8a6a5a' },
      { name: '练气六层',   need: 2325,   mult: 2.58, sky: 'morning',   aura: '#b8cdc0', belt: '#8a6a5a' },
      { name: '练气七层',   need: 3375,   mult: 2.84, sky: 'morning',   aura: '#b8cdc0', belt: '#8a6a5a' },
      { name: '练气八层',   need: 4890,   mult: 3.11, sky: 'morning',   aura: '#b8cdc0', belt: '#8a6a5a' },
      { name: '练气九层',   need: 7095,   mult: 3.37, sky: 'morning',   aura: '#b8cdc0', belt: '#8a6a5a' },
      { name: '筑基初期',   need: 10290,  mult: 3.63, sky: 'noon',      aura: '#d8c8a0', belt: '#8a6a5a' },
      { name: '筑基中期',   need: 14925,  mult: 3.89, sky: 'noon',      aura: '#d8c8a0', belt: '#8a6a5a' },
      { name: '筑基后期',   need: 21645,  mult: 4.16, sky: 'noon',      aura: '#d8c8a0', belt: '#8a6a5a' },
      { name: '金丹初期',   need: 31380,  mult: 4.42, sky: 'afternoon', aura: '#c8a878', belt: '#8a6a5a' },
      { name: '金丹中期',   need: 45510,  mult: 4.68, sky: 'afternoon', aura: '#c8a878', belt: '#8a6a5a' },
      { name: '金丹后期',   need: 66000,  mult: 4.95, sky: 'afternoon', aura: '#c8a878', belt: '#8a6a5a' },
      { name: '元婴初期',   need: 95700,  mult: 5.21, sky: 'dusk',      aura: '#b0a0c8', belt: '#8a6a5a' },
      { name: '元婴中期',   need: 138750, mult: 5.47, sky: 'dusk',      aura: '#b0a0c8', belt: '#8a6a5a' },
      { name: '元婴后期',   need: 201180, mult: 5.74, sky: 'dusk',      aura: '#b0a0c8', belt: '#8a6a5a' },
      { name: '化神',       need: 291720, mult: 6.0,  sky: 'night',     aura: '#88c0b0', belt: '#8a6a5a' }
    ],
    UPGRADES: [
      { id: 'tuna',    name: '吐纳诀', desc: '打坐效率 +20% / 级', max: 5, costs: [5, 10, 20, 40, 80] },
      { id: 'jingxin', name: '静心诀', desc: '顿悟来得更勤',       max: 3, costs: [8, 16, 32] },
      { id: 'caiyao',  name: '采药诀', desc: '灵草灵石 +1 / 级',   max: 3, costs: [10, 20, 40] }
    ],
    SHOP: {
      name: '义桥义起奔富',
      x: 424, y: 214,
      items: [
        { id: 'cha',    name: '寺坞岭高山云雾茶', desc: '一盏清神，三分钟内打坐修为翻倍', cost: 6, kind: 'buff', time: 180, tag: '时效' },
        { id: 'sun',    name: '云峰山勒笋',       desc: '山间鲜笋，食后得当前境界八分修为', cost: 10, kind: 'qi', ratio: 0.08, tag: '修为' },
        { id: 'coffee', name: '麒麟kirin coffee', desc: '一杯入喉，得当前境界一成半修为，并在一分半内修为翻倍', cost: 18, kind: 'both', ratio: 0.15, time: 90, tag: '奇效' }
      ]
    },
    STORY: {
      hidden: {
        title: '红　光',
        tag: '隐 藏 剧 情',
        lines: [
          '你掌风落下，镇山炉应声而碎。',
          '炉底没有灰，只有一道被封了千年的裂缝。',
          '红光自殿中直冲夜空，山风忽然停了。',
          '一个声音在你识海里响起——',
          '「守着这炉的人走了，你来了。」'
        ]
      }
    },
    INSIGHT: { qiGain: 30, buffMult: 2, buffTime: 30, minGap: 22, maxGap: 38 },
    SKY: {
      deepnight: { top: '#0c0f1a', mid: '#1c2238', low: '#2e3652', far: '#1a2040', near: '#10142a', sun: '#e8e4d8', stars: 1, tint: 'rgba(40,50,80,0.22)', cloud: '#3a425e', celestial: 'moon', cx: 128, cy: 44 },
      dawn:      { top: '#4a4550', mid: '#8a7f80', low: '#c8b8a8', far: '#6e6870', near: '#524c50', sun: '#f0e6d2', stars: 0, tint: 'rgba(180,150,130,0.08)', cloud: '#b0a898', celestial: 'sun',  cx: 142, cy: 112, rays: 1 },
      morning:   { top: '#d8d4cc', mid: '#ebe7e0', low: '#f6f2ea', far: '#b8b4ac', near: '#9a968e', sun: '#f8f4ec', stars: 0, tint: 'rgba(240,235,225,0.03)', cloud: '#ffffff', celestial: 'sun',  cx: 388, cy: 44 },
      noon:      { top: '#ece8e0', mid: '#f4f0e8', low: '#faf8f2', far: '#c8c4bc', near: '#a8a49c', sun: '#fffef8', stars: 0, tint: 'rgba(250,248,240,0.02)', cloud: '#ffffff', celestial: 'sun',  cx: 388, cy: 44 },
      afternoon: { top: '#d0ccc4', mid: '#e4e0d8', low: '#f2eee4', far: '#b0aca4', near: '#908c84', sun: '#f4f0e4', stars: 0, tint: 'rgba(220,210,195,0.04)', cloud: '#f0ece4', celestial: 'sun',  cx: 402, cy: 62 },
      dusk:      { top: '#3a3240', mid: '#6e5e60', low: '#a89888', far: '#5a4e58', near: '#443a48', sun: '#e8d8b8', stars: 0, tint: 'rgba(120,90,80,0.10)', cloud: '#8a7e78', celestial: 'sun',  cx: 398, cy: 96, rays: 1 },
      night:     { top: '#1a1e30', mid: '#2e3450', low: '#4a5070', far: '#262a48', near: '#181c34', sun: '#f0ecd8', stars: 1, tint: 'rgba(50,60,90,0.18)', cloud: '#4a5070', celestial: 'moon', cx: 382, cy: 52 },
      aurora:    { top: '#16202e', mid: '#2a3e4a', low: '#4a6870', far: '#243040', near: '#162028', sun: '#c8e0d8', stars: 1, tint: 'rgba(60,100,110,0.10)', cloud: '#5a7078', celestial: 'moon', cx: 400, cy: 44 }
    },
    SCENE: {
      name: '道院 · 清修坪',
      spawn: { x: 308, y: 258 },
      seats: [
        { x: 132, y: 220 },
        { x: 196, y: 220 },
        { x: 284, y: 220 },
        { x: 348, y: 220 },
        { x: 108, y: 252 },
        { x: 172, y: 252 },
        { x: 308, y: 252 },
        { x: 372, y: 252 }
      ],
      npc: { x: 84, y: 246, name: '道友' },
      herbs: [
        { x: 30, y: 226 },
        { x: 450, y: 232 },
        { x: 34, y: 258 }
      ],
      bounds: { x0: 18, x1: 462, y0: 204, y1: 260 },
      solids: [
        { x: 218, y: 194, w: 40, h: 32 },
        { x: 74, y: 234, w: 20, h: 18 }
      ]
    },
    TEXT: {
      npcFirst: '道友，坐下便是。道院无门，坐得住便算入门。这五枚灵石，拿去换本册子。',
      npcByRealm: [
        '道友，坐便是。气从静里生，不从急里来。',
        '练气如添柴，火不可断。灵石可换功法，去翻翻那本册子。',
        '筑基之后，坐一日抵得从前十日。别贪快。',
        '金丹在腹，道院在眼前。你还是你。',
        '元婴出窍，莫忘了回来吃饭。',
        '化神了？那便替我看看，云上头有没有人。'
      ],
      npcReady: '气足了。按 E 冲关，山不会自己让路。',
      insight: [
        { key: 'qi',   title: '心台澄澈', text: '修为 +30' },
        { key: 'buff', title: '灵气入体', text: '三十息内打坐效率翻倍' }
      ],
      ending: ['你成了山的一部分。', '风来，你坐；雪落，你坐。', '山门无锁，来去由心。']
    }
  };
})(window.SS);
