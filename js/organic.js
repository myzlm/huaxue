/* ============================================================
 *  js/organic.js —— 有机天地
 *  官能团与同系物 / 有机反应库 / 分子式分析 / 不饱和度 / 同分异构
 * ============================================================ */
(function () {
    'use strict';
    const CHEM = window.CHEM;
    const UI = CHEM.ui;
    const esc = CHEM.util.esc, fmt = CHEM.util.fmt;

    const TABS = [
        ['group', '官能团与同系物'],
        ['reaction', '有机反应库'],
        ['formula', '分子式分析'],
        ['isomer', '同分异构'],
        ['basics', '基础概念']
    ];

    CHEM.pages.organic = function () {
        const st = CHEM.state.org = CHEM.state.org || { tab: 'group' };
        const body = ({ group: groupHtml, reaction: reactionHtml, formula: formulaHtml, isomer: isomerHtml, basics: basicsHtml })[st.tab] || groupHtml;
        UI.panel('有机天地', '· 碳的骨架 ·', UI.tabBar(TABS, st.tab, 'CHEM.orgTab') + body());

        if (st.tab === 'formula') { CHEM.orgCalc(); }
        if (st.tab === 'reaction') {
            const el = document.getElementById('orgKw');
            if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.orgSearch(); });
        }
    };

    CHEM.orgTab = function (t) { CHEM.state.org.tab = t; CHEM.pages.organic(); };

    /* ============================================================
     *  一、官能团与同系物
     * ============================================================ */
    function groupHtml() {
        const rows = CHEM.DB.organics;
        if (!rows.length) return UI.note('未加载 有机物.txt', 'err');
        return `
        <div class="tbl-wrap"><table class="tbl"><thead><tr>
            <th>类别</th><th>代表物</th><th>化学式</th><th>官能团</th><th>通式</th><th>性质与用途</th>
        </tr></thead><tbody>
        ${rows.map(r => `<tr>
            <td style="color:#eace9f;white-space:nowrap;">${esc(r.klass)}</td>
            <td>${esc(r.example)}</td>
            <td class="mono">${esc(CHEM.prettySafe(r.formula))}</td>
            <td class="mono" style="color:#f5d98a;">${esc(CHEM.prettySafe(r.group))}</td>
            <td class="mono">${esc(r.general)}</td>
            <td class="muted">${esc(r.props)}</td>
        </tr>`).join('')}
        </tbody></table></div>
        <div class="divider"></div>
        <div class="gold" style="font-size:.95rem;">同系物与通式小结</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>系列</th><th>通式</th><th>官能团</th><th>代表物</th></tr></thead><tbody>
            <tr><td>烷烃</td><td class="mono">CₙH₂ₙ₊₂</td><td>无（C—C 单键）</td><td>CH₄</td></tr>
            <tr><td>烯烃</td><td class="mono">CₙH₂ₙ</td><td>C=C</td><td>CH₂=CH₂</td></tr>
            <tr><td>炔烃</td><td class="mono">CₙH₂ₙ₋₂</td><td>C≡C</td><td>CH≡CH</td></tr>
            <tr><td>苯的同系物</td><td class="mono">CₙH₂ₙ₋₆</td><td>苯环</td><td>C₆H₆</td></tr>
            <tr><td>饱和一元醇</td><td class="mono">CₙH₂ₙ₊₂O</td><td>—OH</td><td>C₂H₅OH</td></tr>
            <tr><td>饱和一元醛</td><td class="mono">CₙH₂ₙO</td><td>—CHO</td><td>CH₃CHO</td></tr>
            <tr><td>饱和一元羧酸</td><td class="mono">CₙH₂ₙO₂</td><td>—COOH</td><td>CH₃COOH</td></tr>
            <tr><td>饱和一元酯</td><td class="mono">CₙH₂ₙO₂</td><td>—COO—</td><td>CH₃COOC₂H₅</td></tr>
        </tbody></table></div>
        <div class="note">通式只对<b>同系物</b>成立：结构相似（官能团相同、数目相同）、分子组成相差若干个 CH₂ 的一系列物质互称同系物。</div>`;
    }

    /* ============================================================
     *  二、有机反应库
     * ============================================================ */
    function reactionHtml() {
        const rows = CHEM.DB.organicReactions;
        if (!rows.length) return UI.note('未加载 有机反应.txt', 'err');
        const st = CHEM.state.orgRe = CHEM.state.orgRe || { type: '全部', kw: '' };
        const types = ['全部'].concat(Array.from(new Set(rows.map(r => r.type))));
        const list = rows.filter(r =>
            (st.type === '全部' || r.type === st.type) &&
            (!st.kw || (r.equation + r.type + r.condition + r.desc).toLowerCase().includes(st.kw.toLowerCase())));

        const TYPE_STYLE = {
            '取代反应': '#e08a4a', '加成反应': '#4a9ae0', '消去反应': '#b06ae0',
            '氧化反应': '#d95a5a', '水解反应': '#4ac0a0', '加聚反应': '#c9a86a',
            '缩聚反应': '#a0a04a', '燃烧反应': '#e06a4a', '裂解反应': '#8a8a8a'
        };

        return `
        <div class="field">
            <input type="text" id="orgKw" placeholder="搜索反应物、条件或说明 …" value="${esc(st.kw)}" style="flex:2;min-width:180px;">
            <button class="btn btn-primary btn-sm" onclick="CHEM.orgSearch()">检索</button>
            <span class="muted" style="font-size:.82rem;">命中 ${list.length} / ${rows.length}</span>
        </div>
        <div class="chip-row" style="margin-bottom:12px;">
            ${types.map(t => `<span class="chip" style="border-color:${t === st.type ? '#c9a86a' : '#5a3f22'};color:${t === st.type ? '#eace9f' : '#d4c09a'}" onclick="CHEM.orgType('${t}')">${t}</span>`).join('')}
        </div>
        <div class="list">
        ${list.map(r => {
            const c = TYPE_STYLE[r.type] || '#8a7a5a';
            return `<div class="item" style="border-left-color:${c}88">
                <div class="item-head">
                    <span class="mono" style="color:#f5d98a;font-size:.98rem;">${esc(r.equation)}</span>
                    <span class="tag" style="border-color:${c}88;color:${c}">${esc(r.type)}</span>
                </div>
                <div class="item-desc"><b style="color:#a6885a;">条件</b> ${esc(r.condition)}　·　${esc(r.desc)}</div>
            </div>`;
        }).join('')}
        </div>
        ${list.length === 0 ? UI.note('没有匹配的反应', 'warn') : ''}
        <div class="note">有机物反应的主线是<b>官能团的转化</b>：烷烃 →（取代）卤代烃 →（消去）烯烃 →（加成）醇 →（氧化）醛 →（氧化）羧酸 →（酯化）酯。</div>`;
    }
    CHEM.orgSearch = function () {
        CHEM.state.orgRe.kw = document.getElementById('orgKw').value.trim();
        CHEM.pages.organic();
    };
    CHEM.orgType = function (t) { CHEM.state.orgRe.type = t; CHEM.pages.organic(); };

    /* ============================================================
     *  三、分子式分析
     * ============================================================ */
    function formulaHtml() {
        return `
        <div class="note">
            输入分子式（如 C4H10、C2H6O、C6H6、C2H4O2），可得元素组成、不饱和度、通式归属与燃烧耗氧量。
            结构简式不受支持，请转换为分子式（CₙHₘOₓ）。
        </div>
        ${UI.formulaToolbar('orgFormula')}
        <div class="field">
            <label>分子式</label>
            <input type="text" id="orgFormula" placeholder="如 C4H10" style="flex:2;min-width:180px;">
            <button class="btn btn-primary" onclick="CHEM.orgCalc()">分析</button>
            <button class="btn btn-sm" onclick="CHEM.orgDemo('C4H10')">C4H10</button>
            <button class="btn btn-sm" onclick="CHEM.orgDemo('C2H6O')">C2H6O</button>
            <button class="btn btn-sm" onclick="CHEM.orgDemo('C6H6')">C6H6</button>
            <button class="btn btn-sm" onclick="CHEM.orgDemo('C2H4O2')">C2H4O2</button>
        </div>
        <div class="output" id="orgOut"></div>`;
    }
    CHEM.orgDemo = function (f) {
        document.getElementById('orgFormula').value = f;
        CHEM.orgCalc();
    };

    CHEM.orgCalc = function () {
        const out = document.getElementById('orgOut');
        if (!out) return;
        const f = document.getElementById('orgFormula').value.trim();
        if (!f) { out.innerHTML = '<span class="muted">请输入分子式</span>'; return; }
        let parsed, mm;
        try {
            parsed = CHEM.parseFormula(f);
            mm = CHEM.molarMass(f, true);
        } catch (e) {
            out.innerHTML = `<span class="err-text">${esc(e.message)}</span>`;
            return;
        }
        const c = parsed.counts;
        const C = c.C || 0, H = c.H || 0, O = c.O || 0;
        if (!C) { out.innerHTML = `<div class="note warn">该分子不含碳，不属于有机物范畴。</div>`; return; }

        const dbe = CHEM.dbe(c);
        const sat = 2 * C + 2;

        /* 通式归属 */
        const guesses = [];
        const hasN = c.N || 0, hasX = (c.F || 0) + (c.Cl || 0) + (c.Br || 0) + (c.I || 0);
        if (!hasN && !hasX) {
            if (O === 0) {
                if (H === sat) guesses.push('烷烃 CₙH₂ₙ₊₂');
                else if (H === 2 * C) guesses.push('烯烃 / 环烷烃 CₙH₂ₙ');
                else if (H === 2 * C - 2) guesses.push('炔烃 / 二烯烃 CₙH₂ₙ₋₂');
                else if (H === 2 * C - 6) guesses.push('苯的同系物 CₙH₂ₙ₋₆');
            } else if (O === 1) {
                if (H === sat) guesses.push('饱和一元醇 / 醚 CₙH₂ₙ₊₂O');
                else if (H === 2 * C) guesses.push('饱和一元醛 / 酮 CₙH₂ₙO');
            } else if (O === 2) {
                if (H === 2 * C) guesses.push('饱和一元羧酸 / 酯 CₙH₂ₙO₂');
                else if (H === sat) guesses.push('饱和二元醇 / 醚类 CₙH₂ₙ₊₂O₂');
            }
        }

        const o2 = C + H / 4 - O / 2;
        const ratio = H / C;

        let h = `<div class="gold" style="font-size:1.15rem;font-weight:700;">${CHEM.pretty(f)}</div>
            <div class="field" style="margin-top:6px;">
                <span class="tag tag-gold">相对分子质量 ${fmt(mm.mass, 2)}</span>
                <span class="tag">不饱和度 Ω = ${fmt(dbe, 2)}</span>
                <span class="tag">H/C = ${fmt(ratio, 2)}</span>
                <span class="tag">碳质量分数 ${fmt(C * 12 / mm.mass * 100, 2)}%</span>
            </div>`;
        h += `<div class="divider"></div>` + UI.kv([
            ['元素组成', Object.keys(c).map(k => `${k}×${c[k]}`).join('　')],
            ['可能类别', guesses.length ? guesses.join(' ／ ') : '需结合结构式判断'],
            ['不饱和度含义', dbe === 0 ? '全部为单键（饱和）' : `含 ${fmt(dbe, 0)} 个“双键或环”当量（1 个三键 = 2 个双键，1 个苯环 = 4）`],
            ['完全燃烧耗氧', `${fmt(o2, 2)} mol O₂ / mol（${fmt(o2 * 32, 2)} g）`],
            ['燃烧方程式', `C${C}H${H}${O ? 'O' + O : ''} + ${fmt(o2, 2)}O₂ → ${C}CO₂ + ${fmt(H / 2, 2)}H₂O`]
        ]);

        if (dbe < 0) h += `<div class="note err">不饱和度为负，说明该分子式不可能存在。</div>`;
        if (dbe >= 0 && Math.abs(dbe - Math.round(dbe)) > 1e-9) h += `<div class="note warn">不饱和度不是整数，分子式可能写错（注意 N、卤素的奇偶规则）。</div>`;

        /* 已知物质匹配 */
        const hit = CHEM.DB.molecules.find(m => {
            try { return CHEM.speciesSig(m.formula) === CHEM.speciesSig(f); } catch (e) { return false; }
        });
        if (hit) h += `<div class="note ok">数据库中有该分子式：<b>${esc(hit.name)}</b>（${esc(hit.formula)}）— ${esc(hit.desc)}</div>`;

        out.innerHTML = h;
    };

    /* ============================================================
     *  四、同分异构
     * ============================================================ */
    const ALKANE_ISOMERS = [1, 1, 1, 2, 3, 5, 9, 18, 35, 75, 159, 355];
    const MONO_CL = [1, 1, 2, 2, 3, 4, 4];

    function isomerHtml() {
        return `
        <div class="gold" style="font-size:.95rem;">烷烃的同分异构体数目（碳架异构）</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>碳原子数 n</th><th>分子式</th><th>同分异构体数</th><th>一氯代物数</th><th>代表</th></tr></thead><tbody>
            ${ALKANE_ISOMERS.slice(0, 8).map((n, i) => {
            const k = i + 1;
            const name = ['甲烷', '乙烷', '丙烷', '丁烷', '戊烷', '己烷', '庚烷', '辛烷'][i] || ('C' + k + '烷');
            const mono = k <= MONO_CL.length ? MONO_CL[k - 1] : '—';
            return `<tr><td class="num">${k}</td><td class="mono">C${k}H${2 * k + 2}</td>
                    <td class="num gold">${n}</td><td class="num">${mono}</td><td>${name}</td></tr>`;
        }).join('')}
        </tbody></table></div>
        <div class="note">记忆：C4 有 2 种（正丁烷、异丁烷），C5 有 3 种（正、异、新戊烷），C6 有 5 种，C7 有 9 种。</div>
        <div class="divider"></div>
        <div class="gold" style="font-size:.95rem;">书写同分异构体的顺序（碳架异构法）</div>
        <div class="list">
            <div class="item"><div class="head"><span class="item-title">① 主链由长到短</span></div>
                <div class="item-desc">先写最长碳链，再依次缩短主链，把取下的碳作为支链挂上。</div></div>
            <div class="item"><div class="item-head"><span class="item-title">② 支链由整到散</span></div>
                <div class="item-desc">支链先作为一个整体（如—C₂H₅），再拆成两个甲基分挂。</div></div>
            <div class="item"><div class="item-head"><span class="item-title">③ 位置由心到边</span></div>
                <div class="item-desc">支链从碳链中部向两端移动，注意<b>不重复、不遗漏</b>（等价位置要合并）。</div></div>
            <div class="item"><div class="item-head"><span class="item-title">④ 官能团异构不能忘</span></div>
                <div class="item-desc">
                    C₂H₆O：乙醇 / 甲醚；C₃H₆O：丙醛 / 丙酮 / 烯丙醇；
                    C₂H₄O₂：乙酸 / 甲酸甲酯；C₄H₈：烯烃与环烷烃互为同分异构。
                </div></div>
        </div>
        <div class="divider"></div>
        <div class="gold" style="font-size:.95rem;">一氯代物数目快速判断</div>
        <div class="note">
            一氯代物数目 = 分子中<b>不同化学环境的氢</b>的种数。找对称面/对称轴，处于对称位置的氢等价。
            例如：新戊烷 C(CH₃)₄ 只有 1 种氢 → 1 种一氯代物；苯 C₆H₆ 也只有 1 种。
        </div>`;
    }

    /* ============================================================
     *  五、基础概念
     * ============================================================ */
    function basicsHtml() {
        return `
        <div class="list">
            <div class="item">
                <div class="item-head"><span class="item-title">有机物的共同特征</span></div>
                <div class="item-desc">
                    都含碳（CO、CO₂、碳酸盐、氰化物、碳化物等少数含碳物质按无机物处理）；
                    多数可燃、熔点低、难溶于水、易溶于有机溶剂；反应<b>速率慢、副反应多</b>，常需催化剂与加热。
                </div>
            </div>
            <div class="item">
                <div class="item-head"><span class="item-title">碳原子的成键特点</span></div>
                <div class="item-desc">
                    碳有 4 个价电子，可形成 4 个共价键；碳原子间能形成<b>单键、双键、三键</b>，
                    也能连接成<b>链状或环状</b>骨架——这是有机物种类繁多（数千万种）的根本原因。
                </div>
            </div>
            <div class="item">
                <div class="item-head"><span class="item-title">同分异构体的三类</span></div>
                <div class="item-desc">
                    ① 碳架异构（正丁烷 / 异丁烷）；② 位置异构（1-丙醇 / 2-丙醇）；
                    ③ 官能团异构（乙醇 / 甲醚、乙酸 / 甲酸甲酯）。
                </div>
            </div>
            <div class="item">
                <div class="item-head"><span class="item-title">系统命名三原则</span></div>
                <div class="item-desc">
                    ① 选<b>最长碳链</b>为主链；② 从<b>靠近支链（或官能团）</b>的一端开始编号；
                    ③ 支链位置与名称写在母体前，相同基团合并（2,2-二甲基），数字与汉字间用“-”连接。
                </div>
            </div>
            <div class="item">
                <div class="item-head"><span class="item-title">检验方法速查</span></div>
                <div class="item-desc">
                    溴水（或酸性 KMnO₄）：不饱和键（烯、炔）褪色；
                    银氨溶液 / 新制 Cu(OH)₂：醛基（—CHO）；
                    石蕊或 Na₂CO₃：羧酸（—COOH）；
                    FeCl₃ 溶液：酚羟基（显紫色）；
                    碘水：淀粉（变蓝）。
                </div>
            </div>
        </div>`;
    }
})();
