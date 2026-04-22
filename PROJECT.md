# Buckshot Roulette - Web Game

基于 Three.js 的《恶魔轮盘》网页游戏，直接在浏览器中运行。

## 快速启动

```bash
cd buckshot-roulette
python3 -m http.server 8000
# 访问 http://localhost:8000/
```

需要本地 HTTP 服务器（ES Module + GLB 模型加载要求）。

## 项目结构

```
buckshot-roulette/
├── index.html          # 主页面，含 import map（three.js CDN）
├── style.css           # 所有样式（UI 叠加层、按钮、动画）
├── game.js             # 游戏核心逻辑（状态机、回合制、道具系统）
├── scene.js            # Three.js 3D 场景（灯光、模型加载、动画）
├── ai.js               # AI 决策逻辑（概率+道具优先级）
├── audio.js            # 音频系统（真实音频文件 + Web Audio API 合成 fallback）
├── audio/              # 音频文件（MP3 格式，CC0 / CC-BY 授权）
│   ├── shotgun_blast.mp3   # 霰弹枪射击（CC0, FreeFirearmsSFXLibrary）
│   ├── blank_shot.mp3      # 空弹点击（CC0, rse/soundfx）
│   ├── shell_load.mp3      # 装弹声（CC0, FreeFirearmsSFXLibrary）
│   ├── shotgun_pump.mp3    # 泵动上膛（CC0, FreeFirearmsSFXLibrary）
│   ├── item_use.mp3        # 道具使用提示音（CC0, rse/soundfx）
│   ├── hit.mp3             # 受伤（CC0, rse/soundfx）
│   ├── round_start.mp3     # 回合开始紧张音效（CC0, rse/soundfx）
│   ├── victory.mp3         # 胜利（CC0, rse/soundfx）
│   ├── game_over.mp3       # 失败（CC0, rse/soundfx）
│   └── bgm.mp3             # 背景音乐循环（CC-BY, Kevin MacLeod - Unseen Horrors）
├── models/             # 3D 模型文件（GLB 格式，来自 Poly Pizza）
│   ├── shotgun.glb     # 霰弹枪
│   ├── table.glb       # 桌子
│   ├── beer.glb        # 啤酒道具
│   ├── handsaw.glb     # 手锯道具
│   ├── handcuffs.glb   # 手铐道具
│   ├── cigarette.glb   # 香烟道具
│   ├── magnifying_glass.glb  # 放大镜道具
│   └── demon.glb       # 恶魔角色模型（Poly Pizza / Quaternius, CC0 1.0）
└── PROJECT.md          # 本文件
```

## 技术栈

| 依赖 | 来源 | 用途 |
|------|------|------|
| Three.js r160 | CDN (jsdelivr) | 3D 渲染 |
| GLTFLoader | Three.js examples | 加载 GLB 模型 |
| Web Audio API | 浏览器内置 | 音效合成 fallback |
| 真实音频文件 | audio/ 目录 (CC0/CC-BY) | 游戏音效和背景音乐 |
| Import Map | index.html | 解析 bare module specifier |

无 npm/构建步骤，纯静态文件。

## 游戏架构

### 状态机

```
MENU → ROUND_START → PLAYER_TURN ⇄ DEALER_TURN → (循环)
                                         ↓
                               GAME_OVER / VICTORY
```

关键状态：
- `ANIMATING` — 射击动画播放中，禁止操作
- `ROUND_START` — 装弹+发道具，2秒后进入 PLAYER_TURN

### 游戏数据结构 (gameData)

```javascript
{
    state: GameState.PLAYER_TURN,
    stage: 1,                          // 1-3 关
    player: { hp, maxHp, items[], handcuffed },
    dealer: { hp, maxHp, items[], handcuffed },
    shotgun: {
        shells: ['live','blank',...],  // 随机排列
        currentIndex: 0,               // 当前子弹位置
        sawedOff: false                // 手锯状态
    },
    shellInfo: { live: 2, blank: 3 },  // 剩余子弹数（UI用）
    lastTarget: null,                  // 上次射击目标（用于回合切换）
    aiKnownShell: null                 // AI通过放大镜获取的知识
}
```

### 核心游戏流程

1. **装弹** — 随机生成 2-4 发实弹 + 2-4 发空弹，随机排列
2. **发道具** — Stage 2+ 每人发 3-4 个随机道具
3. **玩家回合** — 可使用道具（不消耗回合），然后射击
4. **射击判定**：
   - 射自己 + 空弹 → 继续你的回合
   - 射自己 + 实弹 → 自己扣血，换对手回合
   - 射对手 + 实弹 → 对手扣血，换对手回合
   - 射对手 + 空弹 → 换对手回合
5. **手铐检查** — 回合切换时检查被铐方，跳过其回合
6. **弹药用完** → 重新装弹开始新回合
7. **某方血量归零** → 阶段结束或游戏结束

### 阶段系统

| 阶段 | 双方HP | 道具数 | 特点 |
|------|--------|--------|------|
| Stage 1 | 2 | 0 | 教学关，无道具 |
| Stage 2 | 4 | 3 | 引入道具 |
| Stage 3 | 5 | 4 | 全部道具，高难度 |

### 6种道具

| 道具 | ID | 效果 | 消耗回合 |
|------|-----|------|---------|
| 🔍 放大镜 | magnifying_glass | 查看当前子弹类型 | 否 |
| 🍺 啤酒 | beer | 退出当前子弹（并显示类型） | 否 |
| 🪚 手锯 | handsaw | 下次射击伤害翻倍 | 否 |
| 🚬 香烟 | cigarette | 恢复1HP（不超过上限） | 否 |
| ⛓️ 手铐 | handcuffs | 对手跳过下一回合 | 否 |
| 💊 过期药物 | expired_medicine | 40%恢复2HP / 60%扣1HP | 否 |

所有道具使用不消耗回合，使用后可继续射击或使用其他道具。

### AI 决策逻辑 (ai.js)

优先级链：
1. 使用手铐（控制对手）
2. 使用放大镜（获取信息，如果还没看过）
3. 根据已知的子弹类型行动（有知识时）
   - 实弹 → 用手锯（如有）→ 射击玩家
   - 空弹 → 射自己（保留回合）
4. 使用香烟（受伤时）
5. 使用过期药物（低血量时）
6. 概率决策（无知识时）
   - 实弹概率 > 60% → 射击玩家
   - 空弹概率 > 60% → 射自己
   - 50/50 → 射击玩家

**AI 不作弊**：只能通过放大镜道具获取子弹信息，使用后记住直到下次射击。

### 3D 场景 (scene.js)

- **Fallback 机制**：始终创建几何体 fallback，GLB 模型加载成功后替换
- **灯光**：环境光 + 红色点光源 + 黄色点光源 + 顶部方向光
- **色调映射**：ACES Filmic，曝光度 1.2
- **霰弹枪动画**：缓慢旋转展示、射击后坐力
- **受伤动画**：屏幕红色闪烁 + CSS shake

### 音效系统 (audio.js)

全部通过 Web Audio API 程序化生成，零外部依赖：

| 函数 | 效果 |
|------|------|
| playShotgunBlast() | 白噪声爆发 + 低频轰鸣 + 中频冲击 |
| playBlankShot() | 短促方波点击 + 微弱噪声 |
| playShellLoad() | 3个高频正弦波金属碰撞声 |
| playItemUse() | 三角波上行提示音 |
| playHit() | 噪声 + 锯齿波衰减 |
| playRoundStart() | 3个正弦波递增和弦 |
| playVictory() | C-E-G-C 琶音 |
| playGameOver() | 锯齿波 400→40Hz 下行 |
| startBGMusic() | 低频无人机 + LFO 脉动 + 不和谐高音 + 随机嘎吱声 |
| stopBGMusic() | 停止所有背景音乐节点 |

## 已修复的 Bug 列表

| # | Bug | 修复方案 |
|---|-----|---------|
| 1 | 回合切换错误：不跟踪实际射击目标 | 添加 `lastTarget` 字段记录实际目标 |
| 2 | AI 作弊：始终知道当前子弹 | 改为只有使用放大镜后才知道 |
| 3 | 手铐无效：flag 设置但从未检查 | checkGameEnd 中检查 handcuffed 状态 |
| 4 | 剩余子弹数不更新 | 添加 `updateShellInfo()` 每次射击/退弹后调用 |
| 5 | 玩家可在非自己回合使用道具 | useItem 中添加状态检查 |
| 6 | AI 放大镜知识丢失 | 添加 `aiKnownShell` 字段在 gameData 中持久化 |
| 7 | 啤酒退弹无边界检查 | 添加 currentIndex < shells.length 检查 |
| 8 | 过期药物定义但不在道具池 | 添加到 generateItems 的 itemPool |
| 9 | 射击期间无操作保护 | 添加 ANIMATING 状态，射击时锁定按钮 |
| 10 | HP 显示负数 | updateUI 中 Math.max(0, hp) |

## 待开发功能

- [ ] 多人模式（WebSocket）
- [x] 更多道具（逆转器 Inverter、一次性手机 Burner Phone、肾上腺素 Adrenaline）
- [x] Double or Nothing 模式
- [x] 更精细的 3D 模型和动画
- [x] 移动端触摸优化
- [x] 成就系统

## 已知问题

- Three.js import map 在旧浏览器中不支持（需要 Chrome 89+, Firefox 108+, Safari 16.4+）
- 背景音乐在某些浏览器中需要用户交互才能播放（Autoplay policy）
- GLB 模型来自 Poly Pizza（CC Attribution），使用时需保留署名
