/* ============================================================
 *  js/basics.js —— 卷首 / 周期表 / 方程式库 / 分子查询 / 分子量 / 原子团 / 关于
 * ============================================================ */
(function () {
    'use strict';
    const CHEM = window.CHEM;
    const UI = CHEM.ui;
    const esc = CHEM.util.esc, fmt = CHEM.util.fmt;

    CHEM.state = CHEM.state || {};

    /* ============================================================
     *  卷首
     * ============================================================ */
    const FEATURES = [
        ['🧫', '酸碱世界', 'pH 精算 · 滴定曲线 · 缓冲与水解', 'acidbase', 'acids'],
        ['🧬', '有机天地', '官能团 · 反应库 · 不饱和度 · 同分异构', 'organic', 'organics'],
        ['⚡', '化学式配平', '有理数消元 · 多解自动消歧', 'balance', 'equations'],
        ['📚', '速查手册', '俗名 · 溶解性 · 离子检验 · 常数 · 实验', 'refs', 'aliases'],
        ['🗄', '数据库', '跨库统一检索 · 收藏夹 · 错题本', 'database', null],
        ['📝', '练一练', '难度分级 · 计时 · 错题自动归档', 'practice', 'questions'],
        ['⚗', '元素周期表', '118 种元素全档 · 化合价与发现者', 'periodic', 'elements'],
        ['⚖', '分子量计算', '水合物 · 离子 · 燃烧耗氧', 'weight', null]
    ];

    const QUICK = ['硫酸钡', 'pH', '酯化', '胆矾', 'Fe3+', '缓冲', '银镜', '不饱和度'];

    CHEM.pages.home = function () {
        const stats = CHEM.stats();
        const total = CHEM.totalRecords();
        const maxN = Math.max.apply(null, stats.map(s => s.n)) || 1;
        const sorted = stats.slice().sort((a, b) => b.n - a.n);

        const html = `
        <div class="hero-block">
            <div class="hero-eyebrow">卷 首 语</div>
            <div class="hero-title">格物 · 致知</div>
            <div class="hero-sub">
                <b>${stats.length}</b> 类 · <b>${total}</b> 条化学数据　可查可算可练<br>
                纯前端 · 无后端 · 断网可用 · 数据可自行扩充
            </div>
            <div class="quick-search">
                <input type="text" id="homeKw" placeholder="想查什么？硫酸钡 / pH / 酯化 / 胆矾 …"
                       onkeydown="if(event.key==='Enter')CHEM.quickGo()">
                <button class="qs-btn" onclick="CHEM.quickGo()">检索</button>
            </div>
            <div class="quick-tags">
                ${QUICK.map((k, i) => `<span class="tag" style="animation-delay:${(i * .02).toFixed(2)}s" onclick="CHEM.homeTag('${k}')">${k}</span>`).join('')}
            </div>
        </div>

        <div class="sec-title">分 篇 导 览</div>
        <div class="fcard-grid">
            ${FEATURES.map(([icon, title, desc, page, key], i) => {
                const n = key ? (stats.find(s => s.key === key) || {}).n : null;
                return `<div class="fcard" style="animation-delay:${(i * .02).toFixed(2)}s" onclick="CHEM.go('${page}')">
                    <div class="fc-top">
                        <span class="fc-icon">${icon}</span>
                        <span class="fc-title">${title}</span>
                    </div>
                    ${n ? `<span class="fc-n">${n}</span>` : ''}
                    <div class="fc-desc">${desc}</div>
                </div>`;
            }).join('')}
        </div>

        <div class="sec-title">典 藏 分 布</div>
        <div class="bar-list">
            ${sorted.map(s => `<div class="bar-row" onclick="CHEM.homeBar('${s.cat}')" title="点击进入「${s.label}」分类检索">
                <span class="bl">${s.label}</span>
                <span class="bar-track"><span class="bar-fill" style="width:${Math.max(2, s.n / maxN * 100).toFixed(1)}%"></span></span>
                <span class="bn">${s.n}</span>
            </div>`).join('')}
        </div>

        <div class="note" style="margin-top:18px;">
            <b>数据来源</b>：仓库根目录的 txt 数据文件，共 ${total} 条。
            以 http 方式打开时实时读取 txt；直接双击打开（file://）时自动使用
            <span class="mono">db.js</span> 离线快照——二者内容一致，改完 txt 后执行
            <span class="mono">node tools/build_db.js</span> 即可刷新快照。
        </div>`;
        UI.panel('卷 首', '· 化学世界 v' + CHEM.version + ' ·', html);
    };

    /* 首页快捷检索：直接跳到数据库并带上关键词 */
    CHEM.quickGo = function () {
        const el = document.getElementById('homeKw');
        const kw = el ? el.value.trim() : '';
        CHEM.state.db = { tab: 'search', cat: '全部', kw: kw };
        CHEM.go('database');
    };
    CHEM.homeTag = function (kw) {
        CHEM.state.db = { tab: 'search', cat: '全部', kw: kw };
        CHEM.go('database');
    };
    CHEM.homeBar = function (cat) {
        CHEM.state.db = { tab: 'search', cat: cat, kw: '' };
        CHEM.go('database');
    };

    /* ============================================================
     *  元素周期表
     * ============================================================ */
    const COLORS = {
        '非金属': '#FF9800', '碱金属': '#F44336', '碱土金属': '#FF5722', '过渡金属': '#2196F3',
        '类金属': '#009688', '卤素': '#4CAF50', '惰性气体': '#9C27B0', '贫金属': '#607D8B', '其他': '#795548'
    };

    function buildLayout() {
        const L = {};
        const add = (s, r, c) => { L[s] = [r, c]; };
        add('H', 1, 1); add('He', 1, 18);
        ['Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne'].forEach((s, i) => add(s, 2, i < 2 ? i + 1 : i + 11));
        ['Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar'].forEach((s, i) => add(s, 3, i < 2 ? i + 1 : i + 11));
        ['K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr'].forEach((s, i) => add(s, 4, i + 1));
        ['Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe'].forEach((s, i) => add(s, 5, i + 1));
        ['Cs', 'Ba', 'La', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn'].forEach((s, i) => add(s, 6, i + 1));
        ['Fr', 'Ra', 'Ac', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds', 'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og'].forEach((s, i) => add(s, 7, i + 1));
        ['La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu'].forEach((s, i) => add(s, 9, i + 3));
        ['Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr'].forEach((s, i) => add(s, 10, i + 3));
        return L;
    }

    CHEM.pages.periodic = function () {
        if (!CHEM.DB.elements.length) { UI.panel('⚗ 周期表', '', UI.note('未加载元素数据，请检查 原子.txt', 'err')); return; }
        const layout = buildLayout();
        const map = {};
        CHEM.DB.elements.forEach(e => { map[e.symbol] = e; });

        let grid = '';
        for (let r = 1; r <= 10; r++) {
            for (let c = 1; c <= 18; c++) {
                let sym = null;
                for (const k in layout) if (layout[k][0] === r && layout[k][1] === c) { sym = k; break; }
                if (sym && map[sym]) {
                    const el = map[sym];
                    const color = COLORS[el.type] || '#795548';
                    grid += `<div class="el" style="background:${color}22;border-color:${color}99" onclick="CHEM.showElement('${sym}')" title="${esc(el.name)} ${esc(el.mass)}">
                        <span class="sym">${sym}</span><span class="num">${el.num}</span></div>`;
                } else if (sym) {
                    grid += `<div class="el" style="opacity:.15;border-color:#2f1f0e"><span class="sym">${sym}</span></div>`;
                } else {
                    grid += `<div class="empty"></div>`;
                }
            }
        }
        const legend = Object.keys(COLORS).filter(k => k !== '其他').map(k =>
            `<span class="tag" style="background:${COLORS[k]}22;border-color:${COLORS[k]}88">${k}</span>`).join('');

        UI.panel('⚗ 元素周期表', `· ${CHEM.DB.elements.length} 种元素 ·`,
            `<div class="ptable">${grid}</div>
             <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:6px;">${legend}</div>
             <div class="note">点击任意元素查看原子量、化合价、电子排布、发现者与特性。镧系与锕系单独排在下方两行。</div>`);
    };

    CHEM.showElement = function (symbol) {
        const el = CHEM.DB.elements.find(e => e.symbol === symbol);
        if (!el) { UI.modal('<div class="note err">未找到该元素数据</div>'); return; }
        const color = COLORS[el.type] || '#795548';
        const fields = [['原子序数', el.num], ['原子量', el.mass], ['常见化合价', el.valence], ['类别', el.type],
        ['族', el.group], ['周期', el.period], ['电子排布', el.electron], ['发现年份', el.year],
        ['发现者', el.discoverer], ['特性', el.props]];
        UI.modal(`<div style="text-align:center;margin-bottom:14px;">
                <span style="font-size:2.8rem;font-weight:700;color:${color};text-shadow:0 0 24px ${color}66">${esc(el.symbol)}</span>
                <div style="font-size:1.3rem;color:#d4c09a;margin-top:2px;">${esc(el.name)}</div>
                <div style="font-size:.8rem;color:#8a7a5a;">${esc(el.type)}</div>
            </div>
            ${UI.kv(fields.map(([k, v]) => [k, esc(v)]))}
            <div class="field" style="margin-top:16px;padding-top:12px;border-top:1px solid #2c2216;">
                ${CHEM.favBtn('元素', `${el.symbol}　${el.name}`, `原子序数 ${el.num}　原子量 ${el.mass}　${el.type}`, 'periodic')}
                <span class="muted" style="font-size:.8rem;">收藏这个元素，方便在「数据库 · 收藏夹」里回看</span>
            </div>`);
    };

    /* ============================================================
     *  方程式库
     * ============================================================ */
    const PAGE_EQ = 60;

    CHEM.pages.equations = function () {
        const rows = CHEM.DB.equations;
        if (!rows.length) { UI.panel('📜 方程式库', '', UI.note('未加载方程式数据，请检查 方程式.txt', 'err')); return; }
        const types = ['全部'].concat(Array.from(new Set(rows.map(r => r.type))));
        const st = CHEM.state.eq = CHEM.state.eq || { type: '全部', kw: '', limit: PAGE_EQ };

        const filtered = rows.filter(r =>
            (st.type === '全部' || r.type === st.type) &&
            (!st.kw || (r.equation + r.type + r.desc).toLowerCase().includes(st.kw.toLowerCase())));

        UI.panel('📜 方程式库', `· 共 ${rows.length} 条 ·`,
            `<div class="field">
                <input type="text" id="eqKw" placeholder="搜索物质、条件或说明 …" value="${esc(st.kw)}" style="flex:2;min-width:180px;">
                <button class="btn btn-primary btn-sm" onclick="CHEM.eqSearch()">检索</button>
                <button class="btn btn-sm" onclick="CHEM.eqReset()">重置</button>
                <span class="muted" style="font-size:.82rem;">命中 ${filtered.length} 条</span>
             </div>
             <div class="chip-row" style="margin-bottom:12px;">
                ${types.map(t => `<span class="chip ${t === st.type ? 'on' : ''}" onclick="CHEM.eqType('${t}')">${t}</span>`).join('')}
             </div>
             <div class="list">
                ${filtered.slice(0, st.limit).map(r => `
                    <div class="item">
                        <div class="item-head">
                            <span class="mono" style="color:#f5d98a;font-size:1rem;">${esc(r.equation)}</span>
                            <span class="tag">${esc(r.type)}</span>
                            <span style="margin-left:auto;display:flex;flex:none;">${CHEM.favBtn('方程式', r.equation, `${r.type}　${r.desc}`, 'equations')}</span>
                        </div>
                        <div class="item-desc">${esc(r.desc)}</div>
                    </div>`).join('')}
             </div>
             ${filtered.length > st.limit ? `<div style="text-align:center;margin-top:12px;"><button class="btn" onclick="CHEM.eqMore()">继续展开（还有 ${filtered.length - st.limit} 条）</button></div>` : ''}
             ${filtered.length === 0 ? UI.note('没有匹配的方程式', 'warn') : ''}
             <div class="note">数据来自 方程式.txt。点击「化学式配平」可对任意式子重新配平并校验守恒。</div>`);

        const input = document.getElementById('eqKw');
        if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.eqSearch(); });
    };
    CHEM.eqSearch = function () {
        CHEM.state.eq.kw = document.getElementById('eqKw').value.trim();
        CHEM.state.eq.limit = PAGE_EQ;
        CHEM.pages.equations();
    };
    CHEM.eqType = function (t) {
        CHEM.state.eq.type = t;
        CHEM.state.eq.limit = PAGE_EQ;
        CHEM.pages.equations();
    };
    CHEM.eqReset = function () {
        CHEM.state.eq = { type: '全部', kw: '', limit: PAGE_EQ };
        CHEM.pages.equations();
    };
    CHEM.eqMore = function () {
        CHEM.state.eq.limit += PAGE_EQ;
        CHEM.pages.equations();
    };

    /* ============================================================
     *  分子查询
     * ============================================================ */
    const PAGE_MOL = 60;

    CHEM.pages.molecules = function () {
        const rows = CHEM.DB.molecules;
        if (!rows.length) { UI.panel('🧪 分子查询', '', UI.note('未加载分子数据，请检查 分子.txt', 'err')); return; }
        const types = ['全部', '有机化合物', '无机化合物'];
        const st = CHEM.state.mol = CHEM.state.mol || { type: '全部', kw: '', limit: PAGE_MOL };

        const filtered = rows.filter(r =>
            (st.type === '全部' || r.type === st.type) &&
            (!st.kw || (r.name + r.formula + r.desc).toLowerCase().includes(st.kw.toLowerCase())));

        UI.panel('🧪 分子查询', `· 共 ${rows.length} 条 ·`,
            `<div class="field">
                <input type="text" id="molKw" placeholder="名称 / 化学式 / 用途 …" value="${esc(st.kw)}" style="flex:2;min-width:180px;">
                <button class="btn btn-primary btn-sm" onclick="CHEM.molSearch()">检索</button>
                <button class="btn btn-sm" onclick="CHEM.molReset()">重置</button>
                <span class="muted" style="font-size:.82rem;">命中 ${filtered.length} 条</span>
             </div>
             <div class="chip-row" style="margin-bottom:12px;">
                ${types.map(t => `<span class="chip ${t === st.type ? 'on' : ''}" onclick="CHEM.molType('${t}')">${t === '全部' ? '全部' : t.replace('化合物', '')} ${t === '全部' ? '' : '(' + rows.filter(r => r.type === t).length + ')'}</span>`).join('')}
             </div>
             <div class="list">
                ${filtered.slice(0, st.limit).map(r => `
                    <div class="item">
                        <div class="item-head">
                            <span class="item-title">${esc(r.name)}</span>
                            <span class="tag tag-gold mono">${esc(CHEM.prettySafe(r.formula))}</span>
                            <span class="muted" style="font-size:.8rem;">Mr = ${esc(r.weight)}</span>
                            <span class="tag">${esc(r.type)}</span>
                            <span style="margin-left:auto;display:flex;flex:none;">${CHEM.favBtn('分子', r.name, `${r.formula}　Mr ${r.weight}　${r.desc}`, 'molecules')}</span>
                        </div>
                        <div class="item-desc">${esc(r.desc)}</div>
                    </div>`).join('')}
             </div>
             ${filtered.length > st.limit ? `<div style="text-align:center;margin-top:12px;"><button class="btn" onclick="CHEM.molMore()">继续展开（还有 ${filtered.length - st.limit} 条）</button></div>` : ''}
             ${filtered.length === 0 ? UI.note('没有匹配的分子', 'warn') : ''}`);
        const input = document.getElementById('molKw');
        if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.molSearch(); });
    };
    CHEM.molSearch = function () {
        CHEM.state.mol.kw = document.getElementById('molKw').value.trim();
        CHEM.state.mol.limit = PAGE_MOL;
        CHEM.pages.molecules();
    };
    CHEM.molType = function (t) { CHEM.state.mol.type = t; CHEM.state.mol.limit = PAGE_MOL; CHEM.pages.molecules(); };
    CHEM.molReset = function () { CHEM.state.mol = { type: '全部', kw: '', limit: PAGE_MOL }; CHEM.pages.molecules(); };
    CHEM.molMore = function () { CHEM.state.mol.limit += PAGE_MOL; CHEM.pages.molecules(); };

    /* ============================================================
     *  分子量计算
     * ============================================================ */
    CHEM.pages.weight = function () {
        UI.panel('⚖ 分子量计算', '· 精确 / 近似 ·',
            `<div class="note">支持 H2O、Ca(OH)2、CuSO4·5H2O、MnO4-、Fe3+ 等写法；可反推元素质量组成。</div>
             ${UI.formulaToolbar('wtFormula')}
             <div class="field">
                <label>化学式</label>
                <input type="text" id="wtFormula" placeholder="如 CuSO4·5H2O" style="flex:2;min-width:200px;">
             </div>
             <div class="field">
                <label>原子量</label>
                <select id="wtApprox"><option value="1">教材近似值</option><option value="0">精确值</option></select>
                <label>模式</label>
                <select id="wtMode" onchange="CHEM.wtModeChange()">
                    <option value="only">仅计算分子量</option>
                    <option value="total">由总质量求各元素质量</option>
                    <option value="element">由某元素质量求总质量</option>
                    <option value="burn">有机物燃烧耗氧</option>
                </select>
                <button class="btn btn-primary" onclick="CHEM.wtCalc()">计算</button>
             </div>
             <div id="wtExtra" class="field"></div>
             <div class="output" id="wtOut"><span class="muted">输入化学式后点击计算</span></div>`);
        const input = document.getElementById('wtFormula');
        if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.wtCalc(); });
        CHEM.wtModeChange();
    };

    CHEM.wtModeChange = function () {
        const mode = document.getElementById('wtMode').value;
        const box = document.getElementById('wtExtra');
        if (mode === 'total') {
            box.innerHTML = `<label>总质量 (g)</label><input type="number" id="wtTotal" step="any" style="width:130px;">`;
        } else if (mode === 'element') {
            box.innerHTML = `<label>元素</label><input type="text" id="wtEl" style="width:70px;" placeholder="O">
                <label>该元素质量 (g)</label><input type="number" id="wtElMass" step="any" style="width:130px;">`;
        } else {
            box.innerHTML = '';
        }
    };

    CHEM.wtCalc = function () {
        const out = document.getElementById('wtOut');
        const formula = document.getElementById('wtFormula').value.trim();
        if (!formula) { out.innerHTML = '<span class="warn-text">请输入化学式</span>'; return; }
        const approx = document.getElementById('wtApprox').value === '1';
        const mode = document.getElementById('wtMode').value;
        try {
            const { mass, counts, parts } = CHEM.molarMass(formula, approx);
            let h = `<div class="gold" style="font-size:1.05rem;font-weight:700;">${CHEM.pretty(formula)} 的相对分子质量 = ${fmt(mass, 4)}</div>`;
            h += `<div class="divider" style="margin:10px 0;"></div>`;
            h += `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>元素</th><th>原子个数</th><th>原子量</th><th>质量贡献</th><th>质量分数</th></tr></thead><tbody>`;
            parts.forEach(p => {
                h += `<tr><td>${p.el}</td><td class="num">${p.count}</td><td class="num">${p.weight}</td>
                      <td class="num">${fmt(p.sub, 3)}</td><td class="num">${fmt(p.sub / mass * 100, 2)}%</td></tr>`;
            });
            h += `</tbody></table></div>`;

            if (mode === 'total') {
                const v = parseFloat(document.getElementById('wtTotal').value);
                if (v > 0) {
                    const k = v / mass;
                    h += `<div class="divider"></div><div class="gold">总质量 ${fmt(v, 4)} g 时各元素质量：</div><div class="tbl-wrap"><table class="tbl"><tbody>`;
                    parts.forEach(p => { h += `<tr><td>${p.el}</td><td class="num">${fmt(p.sub * k, 4)} g</td></tr>`; });
                    h += `</tbody></table></div>`;
                }
            } else if (mode === 'element') {
                const sym = (document.getElementById('wtEl').value || '').trim();
                const v = parseFloat(document.getElementById('wtElMass').value);
                if (sym && v > 0) {
                    if (!counts[sym]) {
                        h += `<div class="note err">元素 ${esc(sym)} 不在该化学式中</div>`;
                    } else {
                        const k = v / (CHEM.WEIGHTS[sym] * counts[sym]);
                        h += `<div class="divider"></div><div class="gold">由 ${esc(sym)} 的质量 ${fmt(v, 4)} g 反推：总质量 = ${fmt(mass * k, 4)} g</div>`;
                        h += `<div class="tbl-wrap"><table class="tbl"><tbody>`;
                        parts.forEach(p => { h += `<tr><td>${p.el}</td><td class="num">${fmt(p.sub * k, 4)} g</td></tr>`; });
                        h += `</tbody></table></div>`;
                    }
                }
            } else if (mode === 'burn') {
                if (!counts.C) {
                    h += `<div class="note warn">该物质不含碳，不适用燃烧耗氧估算</div>`;
                } else {
                    const C = counts.C, H = counts.H || 0, O = counts.O || 0;
                    const o2 = C + H / 4 - O / 2;
                    h += `<div class="divider"></div>
                        <div class="gold">完全燃烧：C${C}H${H}${O ? 'O' + O : ''} 的耗氧量</div>
                        ${UI.kv([
                        ['化学方程式', `C${C}H${H}${O ? 'O' + O : ''} + ${fmt(o2, 2)} O₂ → ${C} CO₂ + ${fmt(H / 2, 2)} H₂O`],
                        ['1 mol 耗氧', `${fmt(o2, 2)} mol（${fmt(o2 * 32, 2)} g）`],
                        ['1 mol 生成 CO₂', `${C} mol（${fmt(C * 44, 2)} g）`],
                        ['1 mol 生成 H₂O', `${fmt(H / 2, 2)} mol（${fmt(H / 2 * 18, 2)} g）`],
                        ['耗氧质量比', `1 g 该物质需 ${fmt(o2 * 32 / mass, 3)} g O₂`]
                    ])}`;
                }
            }
            out.innerHTML = h;
        } catch (e) {
            out.innerHTML = `<span class="err-text">错误：${esc(e.message)}</span>`;
        }
    };

    /* ============================================================
     *  原子团
     * ============================================================ */
    CHEM.pages.radicals = function () {
        const rows = CHEM.DB.radicals;
        if (!rows.length) { UI.panel('🔮 原子团', '', UI.note('未加载原子团数据，请检查 原子团.txt', 'err')); return; }
        UI.panel('🔮 原子团（根）', `· ${rows.length} 种 ·`,
            `<div class="field"><input type="text" id="radKw" placeholder="名称 / 化学式 / 电荷 …" style="flex:2;min-width:200px;">
                <button class="btn btn-primary btn-sm" onclick="CHEM.radSearch()">检索</button></div>
             <div class="tbl-wrap"><table class="tbl"><thead><tr><th>名称</th><th>化学式</th><th>电荷</th><th>说明</th><th></th></tr></thead>
             <tbody id="radBody">${radRows(rows)}</tbody></table></div>`);
        const input = document.getElementById('radKw');
        if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.radSearch(); });
    };
    function radRows(rows) {
        return rows.map(r => `<tr><td style="color:#eace9f;">${esc(r.name)}</td>
            <td class="mono">${esc(CHEM.prettySafe(r.formula))}</td>
            <td><span class="tag tag-gold">${esc(r.charge)}</span></td>
            <td class="muted">${esc(r.desc)}</td>
            <td style="width:36px;">${CHEM.favBtn('原子团', `${r.name}　${r.formula}`, `电荷 ${r.charge}　${r.desc}`, 'radicals')}</td></tr>`).join('');
    }
    CHEM.radSearch = function () {
        const kw = document.getElementById('radKw').value.trim().toLowerCase();
        const rows = CHEM.DB.radicals.filter(r =>
            !kw || (r.name + r.formula + r.charge + r.desc).toLowerCase().includes(kw));
        document.getElementById('radBody').innerHTML = radRows(rows) || '<tr><td colspan="5" class="muted">没有匹配项</td></tr>';
    };

    /* ============================================================
     *  关于
     * ============================================================ */
    CHEM.pages.about = function () {
        const stats = CHEM.stats();
        UI.panel('📖 关于', '· v' + CHEM.version + ' ·',
            `<div style="text-align:center;margin-bottom:14px;">
                <div style="font-family:'Ma Shan Zheng',cursive;font-size:2rem;color:#eace9f;letter-spacing:6px;">化学世界 · 雅集</div>
                <div class="muted" style="font-size:.85rem;margin-top:4px;letter-spacing:2px;">纯前端 · 无后端 · 数据可自行扩充</div>
            </div>
            ${UI.kv([
                ['版本', CHEM.version + '（酸碱 · 有机 · 配平 · 速查四修）'],
                ['数据', `${CHEM.totalRecords()} 条 / ${CHEM.stats().length} 类，来源：根目录 txt`],
                ['加载方式', CHEM.source === 'files' ? '实时读取 txt 文件' : CHEM.source === 'snapshot' ? '离线快照 db.js（fetch 不可用）' : '数据缺失'],
                ['配平算法', '精确有理数高斯消元 + 零空间搜索；多解时比对方程式库'],
                ['分子量', '教材近似值 / 精确值；支持水合物与离子'],
                ['检索', '跨库关键词检索 · 高亮命中 · 结果可导出 CSV'],
                ['风格', '古风卷轴 · 墨韵 · 雅致']
            ])}
            <div class="divider"></div>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>数据文件</th><th>类别</th><th>条数</th></tr></thead><tbody>
                ${stats.map(s => `<tr><td class="mono">${s.file}</td><td>${s.label}</td><td class="num">${s.n}</td></tr>`).join('')}
            </tbody></table></div>
            <div class="divider"></div>
            <div id="changelog" class="muted" style="font-size:.88rem;line-height:1.9;">正在读取更新日志 …</div>`);

        CHEM.getText('更新日志.txt')
            .then(t => {
                const el = document.getElementById('changelog');
                if (el) el.innerHTML = `<div class="gold" style="margin-bottom:6px;">更新日志</div>` +
                    t.split(/\r?\n/).filter(Boolean).map(l => `<div>${esc(l)}</div>`).join('');
            })
            .catch(e => {
                const el = document.getElementById('changelog');
                if (el) el.innerHTML = `<span class="warn-text">无法加载 更新日志.txt（${esc(e.message)}）</span>`;
            });
    };

    /* 兼容旧版调用 */
    CHEM.pages.moleculesSearch = CHEM.pages.molecules;
})();
