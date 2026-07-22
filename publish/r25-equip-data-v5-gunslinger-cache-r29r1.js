'use strict';
window.GameModules = window.GameModules || {};
window.GameModules.equipData = (() => {
  // === 装备数据定义 v1 (暗黑4乘区体系) ===
  // 暗金：5固定属性 + 1[x]威能 | 套装：4固定属性/件 + 3/6件套效果
  const SACRIFICES = [
    ['sacrifice-laoyang-5090','老杨的5090','sacrifice',null,{fearMax:300,critDmg:.50,bossDmgReduce:.12},{shadow:.30},'恐惧转嫁：受到生命伤害时改为消耗恐惧承担，单次消耗上限为最大生命；命中与击杀敌人回复恐惧，被命中敌人陷入恐惧，周围恐惧敌人使恐惧消耗降低。','不知从何处流传到幸存者大陆，被发现的地点只有一张不知发往何处的快递单跟一些塑料玻璃制品，而这个是从一块板子上拔下来的','./assets/generated/laoyang-5090.e37e4947.webp'],
    ['sacrifice-hard-drive','一个硬盘','sacrifice',null,{setReqReduce:3},{arcane:.30},'套装残响：装备后所有已穿戴套装的6件套构成需求减少3件；3件套仍必须真实穿戴3件，穿3件即可触发6件效果。','里面装着一个永远不能升级的版本的comfyui，还存储大量成人绘画，被哥布林修特捡到，视若珍宝，但因其最近缺钱，转卖给奥术商店老板Tomkk','./assets/generated/hard-drive-sacrifice.77268ef6.webp'],
  ];
  const UNIQUES = [
    ['unique-saint-nail','暗金·圣钉战槌','weapon','paladin',{critDmg:.36,armor:.14,attrDmg:{holy:.28},eliteDmg:.22,skillFreq:.12},{},'天谴重击：大蒜光环转为天谴重击，每秒引爆[总护甲×爆伤%]神圣伤害，秘境进度每10%连乘[x]5%'],
    ['unique-thunder-bow','暗金·雷鸣长弓','weapon','ranger',{atkSpeed:.20,crit:.10,attrDmg:{physical:.26},rangeDmg:.16,critDmg:.24},{},'雷链分裂：回旋飞斧命中20%概率分裂雷链锁定精英，附加35%雷链伤害，并施加3秒易伤[x]35%'],
    ['unique-star-tome','暗金·星陨秘典','weapon','mage',{crit:.12,cooldown:.10,critDmg:.28,attrDmg:{arcane:.30},attrCapBonus:.04},{},'微型黑洞：魔法飞弹穿透时撕裂黑洞吸附怪物，造成30%奥术伤害'],
    ['unique-plague-bell','暗金·瘟疫铃','weapon','scytheMaiden',{dotDmg:.32,cooldown:.10,attrDmg:{shadow:.26},eliteDmgReduce:.06,crit:.08},{},'疫病加速：幽魂刃舞对DoT目标暴击伤害[x]55%，击杀精英后短暂加速DoT跳字100%'],
    ['unique-blaze-core','暗金·爆燃核心','weapon','mage',{critDmg:.30,attrDmg:{fire:.30},atkSpeed:.12,healthyDmg:.22,cooldown:.07},{},'无限火海：陨星碎片火海可叠加，Boss在火海中每秒火焰伤害提高8%，最高[x]60%'],
    ['unique-void-lantern','暗金·虚空提灯','amulet',null,{cooldown:.10,crit:.06,allRes:.10,eliteDmg:.16,move:.10},{},'虚空超载：秘境进度每10%获[x]8%独立攻速与移速，最高5层[x]40%'],
    ['unique-dragon-heart','暗金·龙心余烬','chest',null,{hp:.24,armor:.14,eliteDmgReduce:.05,allRes:.08,thorns:1600},{},'龙心殉爆：击杀精英引发大范围殉爆，杂兵死亡有概率额外推进少量秘境进度'],
    ['unique-elite-boots','暗金·精英猎手长靴','boots',null,{move:.18,armor:.10,crit:.06,slowResist:.30,bossDmgReduce:.05},{},'猎手增幅：全伤害随秘境进度提高，每10%进度获得[x]4%独立乘区，最高[x]40%'],
    ['unique-moon-crown','暗金·霜月王冠','helm',null,{cooldown:.10,critDmg:.18,hp:.16,skillDmgAdd:{iceorb:.12,crystalSpike:.12}},{frost:.22},'寒月护盾：冰霜法球暴击提供4%生命护盾(叠满100%)，护盾期免疫控制+飞行速度+50%'],
    ['unique-blood-plate','暗金·血契重甲','chest',null,{hp:.28,armor:.14,atkSpeed:.08,crit:.05},{physical:.20},'血契反击：生命每降低10%进化技能全伤害[x]5%(最高6层)，低于35%时全屏弹幕附带45%真吸血'],
    ['unique-clock-gloves','暗金·逆时针环','ring',null,{cooldown:.12,atkSpeed:.10,crit:.06,critDmg:.16},{arcane:.16},'逆时冷却：弹幕暴击时8%概率使冷却中技能CD减1秒，最短间隔0.25秒'],
    ['unique-rose-mirror','暗金·蔷薇镜','amulet',null,{hp:.20,crit:.06,healBonus:.16,cooldown:.06},{lust:.20},'欲念蓄池：吸收28%承伤存入欲念池(上限1.6倍生命)，下次攻击以[x]160%喷溅；蔷薇镜像6件联动吸收42%、上限2.5倍生命、喷溅[x]220%'],
    ['unique-abyss-mask','暗金·深渊假面','helm',null,{critDmg:.24,crit:.08,skillDmgAdd:{scytheArc:.16,wraithBlade:.16},move:.08},{shadow:.22},'深渊斩杀：普通怪<25%/精英<15%/Boss<10%血量必定致命暴击斩杀'],
    ['unique-golem-soul','暗金·巨像魂核','ring',null,{armor:.12,hp:.20,thorns:2000,allRes:.06},{physical:.10},'岩盾守护：站立释放进化技能时获得全减伤，最高35%，总荆棘以150%加算到弹幕'],
    ['unique-demon-horn','暗金·魔王断角','helm',null,{critDmg:.24,bossDmg:.20,eliteDmgReduce:.05,atkSpeed:.06},{fire:.10},'魔王降临：Boss激活瞬间弹幕翻倍，对Boss独立连乘[x]35%'],
    ['unique-pale-ring','暗金·苍白轮戒','ring',null,{cooldown:.10,move:.10,critDmg:.16,crit:.05,allRes:.08},{},'苍白相位：致命伤害免死进入2.5秒无敌隐形，期间技能独立伤害[x]60%(每场限1次)'],
    ['unique-faith-boots','暗金·朝圣者遗步','boots',null,{move:.18,armor:.10,regen:.12,hp:.12},{holy:.20},'黎明道路：圣光长枪落地圣痕连成道路，踩上移速+40%且技能攻速[x]30%'],
    ['unique-hunt-quiver','暗金·无尽箭匣','amulet',null,{atkSpeed:.16,crit:.08,skillDmgAdd:{daggerRain:.18,windCutter:.18},critDmg:.16},{physical:.16},'弹幕分裂：匕首雨/风裂刃按攻速乘算分裂，每10%额外攻速弹幕+20%(最多+60%)'],
  ];
  const SET_FAMILIES = [
    ['paladin','aureate-guardian','辉金守护','setPaladin',{armor:.16,hp:.18,allRes:.14,skillDmgAdd:{garlic:.28}}],
    ['paladin','thorn-bulwark','荆棘壁垒','setPaladin',{armor:.20,physical:.22,thorns:1800,hp:.16,skillDmgAdd:{bloodNova:.26}}],
    ['paladin','dawn-judgment','黎明审判','setPaladin',{skillDmgAdd:{holyLance:.30},cooldown:.12,crit:.08,dodge:.10}],
    ['mage','astral-missile','星界飞弹','setMage',{atkSpeed:.15,arcane:.18,crit:.09,cooldown:.10,skillDmgAdd:{missile:.28}}],
    ['mage','ember-meteor','余烬陨星','setMage',{skillDmgAdd:{meteorShard:.30},fire:.24,critDmg:.32,hp:.15}],
    ['mage','storm-sigil','风暴符印','setMage',{atkSpeed:.18,arcane:.20,crit:.08,skillDmgAdd:{thunderChain:.28}}],
    ['ranger','cyclone-axe','旋风飞斧','setRanger',{move:.18,physical:.18,atkSpeed:.14,crit:.09,skillDmgAdd:{axe:.26}}],
    ['ranger','moon-hunter','月影猎手','setRanger',{crit:.11,critDmg:.38,frost:.24,skillDmgAdd:{moonSlash:.30}}],
    ['ranger','venom-shadow','毒影伏击','setRanger',{dotDmg:.38,shadow:.22,hp:.20,armor:.14,skillDmgAdd:{poisonCloud:.24,shadowBlade:.20}}],
    ['lewdSaintess','crimson-vessel','绯红圣器','setSaintess',{hp:.28,lustMaxBonus:32,crit:.10,cooldown:.14,skillDmgAdd:{lustSplash:.24}}],
    ['lewdSaintess','violet-hymn','紫罗兰圣歌','setSaintess',{skillDmgAdd:{lustPrayer:.30},lustMaxBonus:22,regen:.22,healBonus:.18}],
    ['lewdSaintess','rose-mirror','蔷薇镜像','setSaintess',{armor:.18,hp:.25,crit:.10,skillDmgAdd:{lustKiss:.30}}],
    ['scytheMaiden','reaper-waltz','冥月圆舞','setScythe',{dotDmg:.40,shadow:.22,critDmg:.32,move:.14,skillDmgAdd:{scytheArc:.28}}],
    ['scytheMaiden','blood-reaping','血镰誓约','setScythe',{skillDmgAdd:{bloodReap:.30},atkSpeed:.16,armor:.15,crit:.09}],
    ['scytheMaiden','soul-shadow','断魂影镰','setScythe',{crit:.12,critDmg:.35,cooldown:.12,move:.16,skillDmgAdd:{wraithBlade:.30}}],
    ['gunslinger','silver-barrage','银星弹幕','setGunslinger',{atkSpeed:.18,crit:.10,physical:.22,skillDmgAdd:{quickShot:.30}}],
    ['gunslinger','ricochet-gambit','跳弹赌局','setGunslinger',{crit:.12,critDmg:.34,physical:.20,skillDmgAdd:{ricochetBullet:.30}}],
    ['gunslinger','scorched-powder','焦土火药','setGunslinger',{fire:.24,cooldown:.12,critDmg:.28,skillDmgAdd:{fireBomb:.30,shotgunRoll:.18}}],
  ];
  const SET_BONUS = {
    'aureate-guardian':{n:'辉金守护',s:'3件 暴击+10% 精英免伤+6%；6件 [x]大蒜光环获黑洞属性，全屏吸附，护甲1:2融入光环暴击。',b3:{crit:.10,eliteDmgReduce:.06},b6:{skill:'garlic',skillDmg:4.5,special:'blackhole'}},
    'thorn-bulwark':{n:'荆棘壁垒',s:'3件 暴击伤害+25% Boss免伤+6%；6件 [x]反伤触发血色新星逆流爆发，对Boss[x]450%独立连乘。',b3:{critDmg:.25,bossDmgReduce:.06},b6:{skill:'bloodNova',skillDmg:4.5,special:'thornsNova'}},
    'dawn-judgment':{n:'黎明审判',s:'3件 暴击伤害+30% 移速+15%；6件 [x]圣光长枪留光标，位移触发折线圣光裁决[x]300%。',b3:{critDmg:.30,move:.15},b6:{skill:'holyLance',skillDmg:4.0,special:'holyJudgment'}},
    'astral-missile':{n:'星界飞弹',s:'3件 暴击伤害+30% 移速+12%；6件 [x]魔法飞弹暴击25%触发幸运内爆，100%重置闪现CD。',b3:{critDmg:.30,move:.12},b6:{skill:'missile',skillDmg:4.5,special:'luckyImplode'}},
    'ember-meteor':{n:'余烬陨星',s:'3件 冷却+12% 暴击+8%；6件 [x]陨星碎片火海无上限重叠，Boss在火海每秒DoT[x]150%独立连乘。',b3:{cooldown:.12,crit:.08},b6:{skill:'meteorShard',skillDmg:4.5,special:'fireOverlap'}},
    'storm-sigil':{n:'风暴符印',s:'3件 冷却+10% 暴击伤害+25%；6件 [x]连锁雷弧无限弹射，暴击[x]8%连乘(最高50层)。',b3:{cooldown:.10,critDmg:.25},b6:{skill:'thunderChain',skillDmg:4.0,special:'infiniteChain'}},
    'cyclone-axe':{n:'旋风飞斧',s:'3件 暴击伤害+30% 闪避+10% 移速+8%；6件 [x]回旋飞斧伤害+470%，飞回时100%重置风裂刃CD，并在位移路径留下切割风暴。',b3:{critDmg:.30,dodge:.10,move:.08},b6:{skill:'axe',skillDmg:4.7,special:'resetDash'}},
    'moon-hunter':{n:'月影猎手',s:'3件 冷却+12% 移速+10% 暴击+8%；6件 [x]月牙斩伤害+450%，暴击引发二级冰爆，破片继承额外暴伤并留下霜月猎痕。',b3:{cooldown:.12,move:.10,crit:.08},b6:{skill:'moonSlash',skillDmg:4.5,special:'iceBurst'}},
    'venom-shadow':{n:'毒影伏击',s:'3件 精英免伤+6% 攻速+12% 持续伤害+18%；6件 [x]毒雾伤害+450%，毒雾扩至全屏并召影刃引爆毒层，雾中敌人物理/暗影抗性归零，游侠获得20%全减伤。',b3:{eliteDmgReduce:.06,atkSpeed:.12,dotDmg:.18},b6:{skill:'poisonCloud',skillDmg:4.5,special:'zeroPoisonResist'}},
    'crimson-vessel':{n:'绯红圣器',s:'3件 暴击伤害+32% 全抗+14% 淫荡获取+15%；6件 [x]欲液反涌伤害+480%，反涌/飞吻击杀使附近小怪狂暴自爆冲向精英；每次自爆返还淫荡值并溅射二段欲液。',b3:{critDmg:.32,allRes:.14,lustGainBonus:.15},b6:{skill:'lustSplash',skillDmg:4.8,special:'kamikaze'}},
    'violet-hymn':{n:'紫罗兰圣歌',s:'3件 抗性上限+8% 冷却+12% 治疗效果+20%；6件 [x]献媚祈祷伤害+450%，重复释放刷新祈祷领域，满血治疗1:3.6转化惩戒脉冲，精英/Boss被持续祈祷后易伤最高[x]50%。',b3:{attrCapBonus:.08,cooldown:.12,healBonus:.20},b6:{skill:'lustPrayer',skillDmg:4.5,special:'healPulse'}},
    'rose-mirror':{n:'蔷薇镜像',s:'3件 精英免伤+6% 暴击伤害+30% 闪避+8%；6件 [x]媚心飞吻伤害+520%，承伤40%写入镜池并减免本次伤害，飞吻命中精英/Boss释放反冲光束，护盾越高反击越强。',b3:{eliteDmgReduce:.06,critDmg:.30,dodge:.08},b6:{skill:'lustKiss',skillDmg:5.2,special:'mirrorReflect'}},
    'reaper-waltz':{n:'冥月圆舞',s:'3件 暴击+10% 护甲+14% 暗影抗性+12%；6件 [x]残月镰舞伤害+450%，每命中1名敌人获得1%最大生命护盾，命中精英/Boss额外获得2%/3%护盾(上限100%)；每10%护盾使残月镰舞最终伤害+3%(最高+30%)；护盾满时进入5秒死神状态：受伤降低20%，残月镰舞范围+20%、最终伤害额外+25%、命中回血，命中精英/Boss延长0.3秒(最高8秒)。',b3:{crit:.10,armor:.14,shadow:.12},b6:{skill:'scytheArc',skillDmg:4.5,special:'deathShield'}},
    'blood-reaping':{n:'血镰誓约',s:'3件 暴击伤害+26% Boss免伤+5% 恐惧上限+100；6件 [x]血镰收割伤害+450%，血镰命中使敌人陷入恐惧并回复恐惧值，命中精英/Boss回复更多；受到生命伤害时优先消耗恐惧承担，单次消耗上限为最大生命，周围恐惧敌人使恐惧消耗降低(最高70%)；周围恐惧敌人使血镰收割最终伤害提高(最高+40%)，恐惧高于50%时额外+15%，低于35%时血镰回恐惧提升；击杀恐惧敌人回复大量恐惧。',b3:{critDmg:.26,bossDmgReduce:.05,fearMax:100},b6:{skill:'bloodReap',skillDmg:4.5,special:'splitImplode'}},
    'soul-shadow':{n:'断魂影镰',s:'3件 精英伤害+20% 攻速+12% 暗影抗性+18%；6件 [x]幽魂刃舞伤害+450%，击杀提供1秒全技能无CD并叠+15%最终伤害(最高+75%)；命中精英/Boss生成2.5%/3.5%最大生命影盾(上限45%)；魂甲每层4%减伤(最高8层32%)，低血时魂甲化盾并减免本次伤害45%；有护盾时最终伤害额外+12%。',b3:{eliteDmg:.20,atkSpeed:.12,shadow:.18},b6:{skill:'wraithBlade',skillDmg:4.5,special:'shadowGuard'}},
    'silver-barrage':{n:'银星弹幕',s:'3件 攻速+12% 暴击+8%；6件 [x]速射伤害+450%，速射额外连射并对精英/Boss叠加银星标记，6层引爆处决弹并溅射周围敌人。',b3:{atkSpeed:.12,crit:.08},b6:{skill:'quickShot',skillDmg:4.5,special:'silverBarrage'}},
    'ricochet-gambit':{n:'跳弹赌局',s:'3件 暴击伤害+30% 移速+10%；6件 [x]跳弹伤害+450%，弹射次数提高并优先寻找精英目标，幸运跳弹有概率不消耗跳数，单体战剩余跳数折算为Boss伤害。',b3:{critDmg:.30,move:.10},b6:{skill:'ricochetBullet',skillDmg:4.5,special:'ricochetGambit'}},
    'scorched-powder':{n:'焦土火药',s:'3件 冷却+12% 火焰伤害+18%；6件 [x]燃烧弹伤害+450%，火场持续更久且Boss火场灼烧更强，霰弹翻滚穿过火场会复制小火场并额外引爆火花。',b3:{cooldown:.12,fire:.18},b6:{skill:'fireBomb',skillDmg:4.5,special:'scorchedPowder'}},
  };
  const STAT_CN = {hp:'最大生命提高',hpBase:'最大生命',hpFlat:'最大生命',weaponDamagePct:'本武器白字伤害提高',damage:'全伤害提高',armor:'总护甲提高',move:'移动速度提高',cooldown:'冷却缩减',atkSpeed:'攻击速度提高',range:'技能范围提高',pickup:'拾取范围提高',gold:'金币获取提高',regen:'生命回复提高',crit:'暴击率',critDmg:'暴击伤害提高',eliteDmg:'对精英伤害提高',bossDmg:'对Boss伤害提高',dotDmg:'持续伤害提高',dodge:'闪避率',eliteDmgReduce:'受到精英伤害降低',bossDmgReduce:'受到Boss伤害降低',skillFreq:'技能释放频率提高',projectileSpeed:'技能飞行速度提高',extraProjectile:'弹幕数量提高',splitChance:'弹幕分裂概率',riftBossDmg:'秘境Boss伤害提高',riftEliteDmg:'秘境精英伤害提高',shieldBreak:'对护盾伤害提高',executeDmg:'对低血敌人伤害提高',dotTickRate:'持续伤害生效频率提高',progressBonus:'秘境进度获取提高',slowResist:'受到减速效果降低',healBonus:'治疗效果提高',fearMax:'恐惧上限提高',lustMaxBonus:'淫荡上限提高',lustGainBonus:'淫荡获取提高',setReqReduce:'套装需求减少',thorns:'荆棘伤害',allRes:'所有属性抗性',attrCapBonus:'全抗性上限提高',rangeDmg:'远距离伤害提高',healthyDmg:'对高血量敌人伤害提高'};
  return { SACRIFICES, UNIQUES, SET_FAMILIES, SET_BONUS, STAT_CN };
})();
