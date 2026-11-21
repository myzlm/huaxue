/* ============================================================
 *  js/lab.js —— 实验室
 *  虚拟实验台（试剂混合现象） / 实验流程（分步演示） / 虚拟滴定
 * ============================================================ */
(function () {
    'use strict';
    const CHEM = window.CHEM;
    const UI = CHEM.ui;
    const esc = CHEM.util.esc, fmt = CHEM.util.fmt;

    const KW = 1e-14;

    const TABS = [
        ['bench', '虚拟实验台'],
        ['flow', '实验流程'],
        ['titrate', '虚拟滴定']
    ];

    CHEM.pages.lab = function () {
        const st = CHEM.state.lab = CHEM.state.lab || { tab: 'bench' };
        const body = ({ bench: benchHtml, flow: flowHtml, titrate: titrateHtml })[st.tab] || benchHtml;
        UI.panel('实验室', '· 现象 · 步骤 · 滴定 ·',
            UI.tabBar(TABS, st.tab, 'CHEM.labTab') + body());
        if (st.tab === 'bench') benchBind();
        if (st.tab === 'flow') flowBind();
        if (st.tab === 'titrate') tiInit();
    };

    CHEM.labTab = function (t) {
        CHEM.state.lab.tab = t;
        CHEM.pages.lab();
    };

    /* ============================================================
     *  工具
     * ============================================================ */
    function rows() { return CHEM.DB.reactions || []; }

    /* 现象文字 → 溶液颜色 */
    const COLOR_RULES = [
        [/红褐/, '#8b3a2a'],
        [/砖红/, '#b5502e'],
        [/深蓝|深蓝色溶液/, '#1e4a8a'],
        [/蓝色/, '#3a7bd5'],
        [/紫色|变紫/, '#7a4fa8'],
        [/粉红|变红|红色/, '#c0504a'],
        [/黄色|变黄|棕黄/, '#d8b83a'],
        [/绿色|浅绿/, '#4a8a5a'],
        [/黑色/, '#2a2622'],
        [/银镜|银白/, '#cfd4d8'],
        [/白色|浑浊/, '#d8d2c0'],
        [/褪|无色|澄清/, 'rgba(255,255,255,.08)']
    ];
    function phenomColor(text) {
        const s = String(text || '');
        for (const [re, c] of COLOR_RULES) if (re.test(s)) return c;
        return 'rgba(217,184,119,.28)';
    }
    function hasGas(text) { return /气泡|冒气|气体|白烟|烟雾/.test(String(text || '')); }

    /* 试剂清单（分组的 select） */
    function reagentGroups() {
        const set = new Set();
        rows().forEach(r => { if (r.a) set.add(r.a); if (r.b) set.add(r.b); });
        const g = { acid: [], ind: [], sol: [], solid: [] };
        Array.from(set).forEach(n => {
            if (/酚酞|石蕊|甲基橙|试纸/.test(n)) g.ind.push(n);
            else if (/盐酸|硫酸|硝酸|乙酸|氢氧化|氨水/.test(n)) g.acid.push(n);
            else if (/溶液|水$/.test(n)) g.sol.push(n);
            else g.solid.push(n);
        });
        const zh = (a, b) => a.localeCompare(b, 'zh');
        Object.keys(g).forEach(k => g[k].sort(zh));
        return g;
    }
    function reagentSelect(id, groups, cur) {
        const opt = (label, arr) => arr.length
            ? `<optgroup label="${label}">${arr.map(n => `<option value="${esc(n)}"${n === cur ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`
            : '';
        return `<select id="${id}" style="min-width:150px;flex:1;">
            <option value=""${cur ? '' : ' selected'}>— 请选择 —</option>
            ${opt('酸 / 碱', groups.acid)}
            ${opt('指示剂', groups.ind)}
            ${opt('溶液与试剂', groups.sol)}
            ${opt('单质与固体', groups.solid)}
        </select>`;
    }
    function findPair(a, b) {
        if (!a || !b) return null;
        return rows().find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a)) || null;
    }

    /* ============================================================
     *  一、虚拟实验台
     * ============================================================ */
    function benchHtml() {
        const st = CHEM.state.lab = CHEM.state.lab || { tab: 'bench' };
        if (!rows().length) return UI.note('未加载 反应现象.txt', 'err');
        /* 首次进入先摆一组示例，避免空白 */
        if (!st.a && !st.b && !st.last) {
            st.a = '硫酸铜溶液'; st.b = '氢氧化钠溶液';
            st.last = { a: st.a, b: st.b, anim: false };
        }
        const groups = reagentGroups();
        const last = st.last || {};
        const hit = last.a ? findPair(last.a, last.b) : null;

        return `
        <div class="note">
            选两种试剂，看会发生什么。<b>现象、方程式、危险性</b>都来自反应现象库
            （共 ${rows().length} 组），选错了也能看到相关推荐。
        </div>
        <div class="field" style="margin-top:12px;">
            <label>试剂 A</label>${reagentSelect('labA', groups, st.a)}
            <span class="muted" style="font-weight:700;">+</span>
            <label>试剂 B</label>${reagentSelect('labB', groups, st.b)}
        </div>
        <div class="field">
            <button class="btn btn-primary" onclick="CHEM.mixRun()">混 合</button>
            <button class="btn btn-sm" onclick="CHEM.mixRandom()">🎲 随机一组</button>
            <button class="btn btn-sm" onclick="CHEM.mixClear()">清空</button>
        </div>
        <div class="chip-row" style="margin-bottom:4px;">
            <span class="muted" style="font-size:.78rem;align-self:center;">常做：</span>
            ${[['稀盐酸', '氢氧化钠溶液'], ['硫酸铜溶液', '氢氧化钠溶液'], ['氯化铁溶液', '硫氰化钾溶液'],
                ['碳酸钠溶液', '稀盐酸'], ['硫酸铵溶液', '氢氧化钠溶液'], ['淀粉溶液', '碘水']]
                .map(([a, b]) => `<span class="chip" style="font-size:.76rem;" onclick="CHEM.mixPreset('${a}','${b}')">${a} + ${b}</span>`).join('')}
        </div>
        <div id="labOut">${hit ? resultHtml(hit, last.anim) : (st.a && st.b ? missHtml(st.a, st.b) : '')}</div>
        ${st.log && st.log.length ? `<div class="sec-title" style="margin:20px 0 10px;">实 验 记 录</div>
        <div class="chip-row">
            ${st.log.map((l, i) => `<span class="chip" style="font-size:.76rem;" onclick="CHEM.mixAgain(${i})">${esc(l.a)} + ${esc(l.b)}</span>`).join('')}
        </div>
        <div class="muted" style="font-size:.75rem;margin-top:8px;">点上面的记录可重做上一次混合。</div>` : ''}`;
    }

    function resultHtml(r, anim) {
        const c = phenomColor(r.phenomenon);
        const danger = r.danger === '高' ? 'tag-err' : r.danger === '中' ? 'tag-warn' : 'tag-ok';
        const bubbles = hasGas(r.phenomenon)
            ? `<span class="bubbles">${Array.from({ length: 5 }, (_, i) =>
                `<span class="bubble" style="left:${12 + i * 17}%;animation-delay:${i * .22}s"></span>`).join('')}</span>` : '';
        return `<div class="lab-result">
            <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">
                <div class="beaker${anim ? ' mixing' : ''}">
                    <div class="liquid" style="background:${c};"></div>
                    ${bubbles}
                    <span class="swirl"></span>
                </div>
                <div style="flex:1;min-width:200px;">
                    <div class="item-head" style="margin-bottom:6px;">
                        <span style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;">
                            <span class="tag tag-gold">${esc(r.a)}</span>
                            <span class="muted">+</span>
                            <span class="tag tag-gold">${esc(r.b)}</span>
                        </span>
                        <span class="tag ${danger}">危险度 ${esc(r.danger)}</span>
                        ${CHEM.favBtn('反应现象', `${r.a} + ${r.b}`, `${r.phenomenon}　${r.equation}`, 'lab')}
                    </div>
                    <div class="phenom">${esc(r.phenomenon)}</div>
                    ${r.equation && r.equation !== '—' ? `<div class="eq mono">${esc(r.equation)}</div>` : ''}
                    ${r.desc ? `<div class="muted" style="font-size:.82rem;margin-top:8px;line-height:1.8;">${esc(r.desc)}</div>` : ''}
                </div>
            </div>
            ${r.danger === '高' ? `<div class="note err" style="margin-top:12px;">危险度较高：涉及有毒气体、强腐蚀或剧烈放热，实际实验须在通风橱内并佩戴防护。</div>` : ''}
        </div>`;
    }

    function missHtml(a, b) {
        const related = rows().filter(r => r.a === a || r.b === a || r.a === b || r.b === b).slice(0, 6);
        return `<div class="lab-result">
            <div class="phenom">库中暂无「${esc(a)} + ${esc(b)}」的现象记录。</div>
            <div class="muted" style="font-size:.82rem;margin-top:8px;">
                可能是这一组在本库里没有收录，也可能两者混合确实无明显现象（如两种钠盐溶液）。
                可换一组试剂，或从下面的相关组合里挑一个。
            </div>
            ${related.length ? `<div class="chip-row" style="margin-top:12px;">
                ${related.map(r => `<span class="chip" style="font-size:.76rem;"
                    onclick="CHEM.mixPreset('${esc(r.a)}','${esc(r.b)}')">${esc(r.a)} + ${esc(r.b)}</span>`).join('')}
            </div>` : ''}
        </div>`;
    }

    function benchBind() {
        ['labA', 'labB'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => {
                CHEM.state.lab[id === 'labA' ? 'a' : 'b'] = el.value;
            });
        });
    }

    CHEM.mixRun = function () {
        const st = CHEM.state.lab;
        const a = (document.getElementById('labA') || {}).value || st.a;
        const b = (document.getElementById('labB') || {}).value || st.b;
        if (!a || !b) { CHEM.toast('请先选择两种试剂'); return; }
        st.a = a; st.b = b;
        st.last = { a: a, b: b, anim: true };
        st.log = [{ a: a, b: b }].concat((st.log || []).filter(x => !(x.a === a && x.b === b))).slice(0, 6);
        CHEM.pages.lab();
    };
    CHEM.mixPreset = function (a, b) {
        const st = CHEM.state.lab;
        st.a = a; st.b = b; st.last = { a: a, b: b, anim: true };
        st.log = [{ a: a, b: b }].concat((st.log || []).filter(x => !(x.a === a && x.b === b))).slice(0, 6);
        CHEM.pages.lab();
    };
    CHEM.mixAgain = function (i) {
        const l = (CHEM.state.lab.log || [])[i];
        if (l) CHEM.mixPreset(l.a, l.b);
    };
    CHEM.mixRandom = function () {
        const list = rows();
        if (!list.length) return;
        const r = list[Math.floor(Math.random() * list.length)];
        CHEM.mixPreset(r.a, r.b);
    };
    CHEM.mixClear = function () {
        const st = CHEM.state.lab;
        st.a = ''; st.b = ''; st.last = null;
        CHEM.pages.lab();
    };

    /* ============================================================
     *  二、实验流程
     * ============================================================ */
    function flowHtml() {
        const list = CHEM.DB.procedures || [];
        if (!list.length) return UI.note('未加载 实验步骤.txt', 'err');
        const st = CHEM.state.lab;
        if (st.idx === undefined || !list[st.idx]) st.idx = 0;
        if (!st.shown) st.shown = 1;
        const p = list[st.idx];
        const steps = String(p.steps || '').split(/[；|]/).filter(s => s.trim());
        const klass = Array.from(new Set(list.map(x => x.klass)));
        st.klass = st.klass || '全部';

        const shown = Math.min(st.shown, steps.length);
        return `
        <div class="chip-row" style="margin-bottom:10px;">
            <span class="chip ${st.klass === '全部' ? 'on' : ''}" onclick="CHEM.flowCat('全部')">全部 ${list.length}</span>
            ${klass.map(k => `<span class="chip ${st.klass === k ? 'on' : ''}" onclick="CHEM.flowCat('${k}')">${esc(k)}</span>`).join('')}
        </div>
        <div class="field">
            <select style="flex:2;min-width:220px;" onchange="CHEM.flowPick(this.value)">
                ${list.map((x, i) => (st.klass === '全部' || x.klass === st.klass)
            ? `<option value="${i}"${i === st.idx ? ' selected' : ''}>${esc(x.name)}　·　${esc(x.klass)}</option>` : '').join('')}
            </select>
            <span class="tag tag-gold">${esc(p.klass)}</span>
        </div>
        <div class="progress-line"><i style="width:${(shown / steps.length * 100).toFixed(1)}%"></i></div>
        <div class="muted" style="font-size:.78rem;">步骤 ${shown} / ${steps.length}</div>
        <div class="step-list">
            ${steps.slice(0, shown).map((s, i) => `<div class="step-row done"><span class="no">${i + 1}</span><span>${esc(s.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, ''))}</span></div>`).join('')}
        </div>
        <div class="field" style="margin-top:12px;">
            ${shown < steps.length ? `<button class="btn btn-primary" onclick="CHEM.flowNext()">下一步 ▸</button>` : ''}
            ${shown < steps.length ? `<button class="btn btn-sm" onclick="CHEM.flowAll()">全部展开</button>` : ''}
            <button class="btn btn-sm" onclick="CHEM.flowReset()">从头再看</button>
        </div>
        ${shown >= steps.length ? `
        <div class="divider"></div>
        <div class="list">
            <div class="item"><div class="item-head"><span class="item-title">现象</span></div>
                <div class="item-desc">${esc(p.phenomenon)}</div></div>
            <div class="item"><div class="item-head"><span class="item-title">结论 / 原理</span></div>
                <div class="item-desc">${esc(p.conclusion)}</div></div>
            <div class="item" style="border-left-color:rgba(224,120,92,.5)"><div class="item-head"><span class="item-title">安全提示</span></div>
                <div class="item-desc">${esc(p.safety)}</div></div>
        </div>
        <div class="divider"></div>
        <div class="gold" style="font-size:.92rem;">所需器材</div>
        <div class="chip-row" style="margin-top:8px;">
            ${String(p.tools || '').split('|').filter(t => t.trim()).map(t => {
                const found = (CHEM.DB.labware || []).find(w => w.name === t.trim());
                return `<span class="chip" style="font-size:.78rem;" title="${esc(found ? found.use : '')}">${esc(t.trim())}</span>`;
            }).join('')}
        </div>` : `<div class="note" style="margin-top:12px;">按「下一步」逐步展开操作，做完全部步骤后给出该实验的现象、原理与安全提示。</div>`}`;
    }

    function flowBind() { /* select 用 onchange，无需额外绑定 */ }

    CHEM.flowPick = function (i) {
        const st = CHEM.state.lab;
        st.idx = parseInt(i, 10) || 0;
        st.shown = 1;
        CHEM.pages.lab();
    };
    CHEM.flowCat = function (k) {
        const st = CHEM.state.lab;
        st.klass = k;
        const list = CHEM.DB.procedures;
        if (k !== '全部') {
            const i = list.findIndex(x => x.klass === k);
            if (i >= 0) { st.idx = i; st.shown = 1; }
        }
        CHEM.pages.lab();
    };
    CHEM.flowNext = function () {
        CHEM.state.lab.shown = (CHEM.state.lab.shown || 1) + 1;
        CHEM.pages.lab();
    };
    CHEM.flowAll = function () {
        const p = CHEM.DB.procedures[CHEM.state.lab.idx];
        CHEM.state.lab.shown = String(p.steps || '').split(/[；|]/).filter(s => s.trim()).length;
        CHEM.pages.lab();
    };
    CHEM.flowReset = function () {
        CHEM.state.lab.shown = 1;
        CHEM.pages.lab();
    };

    /* ============================================================
     *  三、虚拟滴定
     * ============================================================ */
    const IND = {
        '酚酞': { from: 'rgba(255,255,255,.07)', range: [8.2, 10.0], note: '无色 → 浅粉红' },
        '甲基橙': { from: '#e8c96b', range: [3.1, 4.4], note: '黄 → 橙红' },
        '石蕊': { from: '#7a5aa8', range: [5.0, 8.0], note: '紫 → 蓝' }
    };

    function indicatorColor(ind, pH) {
        if (ind === '酚酞') {
            if (pH < 8.2) return 'rgba(186,214,232,.18)';
            if (pH < 10) return 'rgba(224,138,176,.55)';
            return 'rgba(192,80,138,.7)';
        }
        if (ind === '甲基橙') {
            if (pH < 3.1) return '#d84a3a';
            if (pH < 4.4) return '#e08a4a';
            return '#e8c96b';
        }
        if (pH < 5) return '#c0504a';
        if (pH < 8) return '#7a5aa8';
        return '#3a6ac0';
    }

    function hOf(ca, cb) {
        /* 电荷平衡：[H+] + [Na+] = [OH-] + [Cl-] */
        const f = h => h + cb - KW / h - ca;
        let lo = 1e-16, hi = 10;
        for (let i = 0; i < 300; i++) {
            const mid = Math.sqrt(lo * hi);
            if (f(mid) > 0) hi = mid; else lo = mid;
        }
        return Math.sqrt(lo * hi);
    }

    function tiState() {
        const st = CHEM.state.lab;
        if (!st.ti) {
            st.ti = {
                cTrue: Math.round((0.06 + Math.random() * 0.09) * 10000) / 10000,
                v0: 20.00, cb: 0.1000, v: 0,
                ind: '酚酞', done: false, result: null
            };
        }
        return st.ti;
    }

    function tiPH(t) {
        const nacid = t.cTrue * t.v0 / 1000;
        const nbase = t.cb * t.v / 1000;
        const V = (t.v0 + t.v) / 1000;
        const ca = nacid / V, cb = nbase / V;
        return -Math.log10(hOf(ca, cb));
    }

    function titrateHtml() {
        const t = tiState();
        const pH = tiPH(t);
        const col = indicatorColor(t.ind, pH);
        return `
        <div class="note">
            用 <b>0.1000 mol/L NaOH</b> 滴定 <b>20.00 mL 未知浓度盐酸</b>。
            每点一次「滴加」真实计算一次 pH，溶液颜色按所选指示剂的变色范围变化——
            颜色一变就该停手了。
        </div>
        <div class="field" style="margin-top:12px;">
            <label>指示剂</label>
            <select id="tiInd" onchange="CHEM.tiIndChange(this.value)">
                ${Object.keys(IND).map(k => `<option value="${k}"${t.ind === k ? ' selected' : ''}>${k}（${IND[k].note}）</option>`).join('')}
            </select>
            <button class="btn btn-sm" onclick="CHEM.tiReset()">重新开始</button>
        </div>
        <div class="titrator">
            <div class="burette-wrap">
                <div class="burette" id="tiBurette">
                    <div class="lvl" id="tiLvl" style="height:${(1 - t.v / 50) * 100}%"></div>
                    ${Array.from({ length: 10 }, (_, i) => `<span class="scale-mark" style="top:${i * 10}%"></span>`).join('')}
                </div>
                <div class="tip"></div>
                <div class="muted" style="text-align:center;font-size:.72rem;margin-top:6px;">NaOH<br>0.1000 M</div>
            </div>
            <div class="flask-wrap">
                <svg viewBox="0 0 120 130" width="120" height="130" style="display:block;">
                    <defs>
                        <clipPath id="tiFlaskClip">
                            <path d="M46 8 H74 V40 L108 108 Q112 122 98 122 H22 Q8 122 12 108 L46 40 Z" />
                        </clipPath>
                        <linearGradient id="tiGlass" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stop-color="rgba(255,255,255,.10)" />
                            <stop offset="45%" stop-color="rgba(255,255,255,.02)" />
                            <stop offset="100%" stop-color="rgba(255,255,255,.08)" />
                        </linearGradient>
                    </defs>
                    <g clip-path="url(#tiFlaskClip)">
                        <rect x="0" y="0" width="120" height="130" fill="url(#tiGlass)" />
                        <rect id="tiSol" x="0" y="66" width="120" height="58" style="fill:${col};transition:fill .5s ease;" />
                        <rect x="0" y="66" width="120" height="3" fill="rgba(255,255,255,.22)" />
                    </g>
                    <path d="M46 8 H74 V40 L108 108 Q112 122 98 122 H22 Q8 122 12 108 L46 40 Z"
                          fill="none" stroke="rgba(217,184,119,.5)" stroke-width="2" stroke-linejoin="round" />
                    <line x1="44" y1="8" x2="76" y2="8" stroke="rgba(217,184,119,.7)" stroke-width="3" stroke-linecap="round" />
                </svg>
                <div class="muted" style="text-align:center;font-size:.72rem;margin-top:2px;">待测盐酸 + 指示剂</div>
            </div>
            <div class="readout">
                <div class="gold" style="font-size:1.25rem;font-weight:700;">pH = <span id="tiPH">${fmt(pH, 2)}</span></div>
                <div class="field" style="margin-top:8px;">
                    <span class="tag tag-gold">读数 <b id="tiRead">${fmt(t.v, 2)}</b> mL</span>
                    <span class="tag">已加 <b id="tiVol">${fmt(t.v, 2)}</b> mL</span>
                    <span class="tag" id="tiState">${pH < 7 ? '酸性' : pH > 7 ? '碱性' : '中性'}</span>
                </div>
                <div class="field" style="margin-top:10px;">
                    <button class="btn btn-primary" onclick="CHEM.tiAdd(0.05)">加 1 滴（0.05 mL）</button>
                    <button class="btn btn-sm" onclick="CHEM.tiAdd(0.5)">+0.50 mL</button>
                    <button class="btn btn-sm" onclick="CHEM.tiAdd(1)">+1.00 mL</button>
                    <button class="btn btn-sm" onclick="CHEM.tiAdd(5)">+5.00 mL</button>
                </div>
                <div class="field" style="margin-top:4px;">
                    <button class="btn" onclick="CHEM.tiJudge()">判定终点并计算</button>
                </div>
                <div class="muted" style="font-size:.75rem;line-height:1.7;">
                    实际实验中半滴约 0.025 mL，是控制终点的关键；这里按 1 滴 0.05 mL 计。
                </div>
            </div>
        </div>
        <div id="tiResult">${t.result || ''}</div>
        <div class="divider"></div>
        <div class="gold" style="font-size:.92rem;">为什么不能用 pH 试纸代替指示剂？</div>
        <div class="muted" style="font-size:.85rem;line-height:1.9;margin-top:6px;">
            滴定终点要求「半滴即变、半分钟不褪」，pH 试纸只能读到整数，且取样会损失待测液、破坏体系。
            指示剂变色点落在滴定突跃范围内，才能保证终点与等当点足够接近。
        </div>`;
    }

    function tiInit() { tiState(); }

    function tiRender() {
        const t = tiState();
        const pH = tiPH(t);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('tiPH', fmt(pH, 2));
        set('tiRead', fmt(t.v, 2));
        set('tiVol', fmt(t.v, 2));
        const stEl = document.getElementById('tiState');
        if (stEl) stEl.textContent = pH < 6.9 ? '酸性' : pH > 7.1 ? '碱性' : '中性';
        const lvl = document.getElementById('tiLvl');
        if (lvl) lvl.style.height = Math.max(0, (1 - t.v / 50) * 100) + '%';
        const sol = document.getElementById('tiSol');
        if (sol) sol.style.fill = indicatorColor(t.ind, pH);
        return pH;
    }

    function dropAnim() {
        const wrap = document.querySelector('.burette-wrap');
        if (!wrap) return;
        const d = document.createElement('span');
        d.className = 'drop';
        wrap.appendChild(d);
        setTimeout(() => d.remove(), 620);
    }

    CHEM.tiAdd = function (dv) {
        const t = tiState();
        if (t.v + dv > 50) { CHEM.toast('滴定管里没那么多液体了'); return; }
        t.v = Math.round((t.v + dv) * 1000) / 1000;
        t.done = false; t.result = null;
        const box = document.getElementById('tiResult');
        if (box) box.innerHTML = '';
        dropAnim();
        tiRender();
    };

    CHEM.tiIndChange = function (ind) {
        tiState().ind = ind;
        CHEM.pages.lab();
    };

    CHEM.tiReset = function () {
        CHEM.state.lab.ti = null;
        CHEM.pages.lab();
    };

    CHEM.tiJudge = function () {
        const t = tiState();
        const pH = tiRender();
        const box = document.getElementById('tiResult');
        if (!box) return;
        const [lo, hi] = IND[t.ind].range;
        /* 各指示剂的「刚变色」判据 */
        let inRange;
        if (t.ind === '酚酞') inRange = pH >= lo;
        else if (t.ind === '甲基橙') inRange = pH <= hi;
        else inRange = pH <= lo || pH >= hi;

        if (!t.done && !inRange) {
            box.innerHTML = `<div class="note warn">
                现在 pH = ${fmt(pH, 2)}，${t.ind}还没有变色（变色范围 ${lo} ~ ${hi}）。
                继续滴加再看看，或者换一种指示剂。
            </div>`;
            return;
        }
        const cCalc = t.cb * t.v / t.v0;
        const err = (cCalc - t.cTrue) / t.cTrue * 100;
        const absErr = Math.abs(err);
        const grade = absErr < 0.5 ? ['tag-ok', '非常准确', '半滴之内控制到位']
            : absErr < 2 ? ['tag-ok', '合格', '常见实验水平']
                : absErr < 5 ? ['tag-warn', '偏差偏大', '再练几次就能压到 1% 以内']
                    : ['tag-err', '偏差过大', '多半是滴过头了——记住「先快后慢、半滴定终」'];
        t.done = true;
        box.innerHTML = `<div class="lab-result" style="margin-top:14px;">
            <div class="item-head" style="margin-bottom:8px;">
                <span class="tag tag-gold">滴定结果</span>
                <span class="tag ${grade[0]}">${grade[1]}</span>
                <span class="muted" style="font-size:.76rem;">${grade[2]}</span>
            </div>
            <div class="gold" style="font-size:1.5rem;font-weight:700;">c(HCl) = ${cCalc.toFixed(4)} mol/L</div>
            <div class="eq mono" style="margin-top:8px;">
                c(待测) = c(标准) × V(标准) / V(待测) = 0.1000 × ${fmt(t.v, 2)} / 20.00
            </div>
            <div class="divider"></div>
            ${UI.kv([
            ['终点 pH', fmt(pH, 2) + `（${t.ind} 变色点 ${lo} ~ ${hi}）`],
            ['消耗 NaOH', fmt(t.v, 2) + ' mL'],
            ['真实浓度', t.cTrue.toFixed(4) + ' mol/L（实验前随机给定）'],
            ['相对误差', (err >= 0 ? '+' : '') + fmt(err, 2) + '%']
        ])}
            <div class="note" style="margin-top:12px;">
                误差来源：<b>读数</b>（平视凹液面）、<b>终点判断</b>（半滴控制）、<b>滴定管未润洗</b>（标准液被稀释）、
                <b>锥形瓶内残留蒸馏水</b>（不影响结果，因为不改变溶质的量）。
            </div>
        </div>`;
        CHEM.toast(`滴定完成：c = ${cCalc.toFixed(4)} mol/L`);
    };
})();
