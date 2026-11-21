/* ============================================================
 *  js/acidbase.js —— 酸碱世界
 *  理论 / 常见酸碱表 / pH 计算器 / 滴定曲线 / 指示剂 / 盐类水解 / 缓冲溶液
 * ============================================================ */
(function () {
    'use strict';
    const CHEM = window.CHEM;
    const UI = CHEM.ui;
    const esc = CHEM.util.esc, fmt = CHEM.util.fmt;

    const KW = 1e-14;

    const TABS = [
        ['theory', '三大理论'],
        ['table', '常见酸碱'],
        ['ph', 'pH 计算'],
        ['titration', '滴定曲线'],
        ['indicator', '指示剂'],
        ['hydrolysis', '盐类水解'],
        ['buffer', '缓冲溶液']
    ];

    /* pK 字符串 → 数值 */
    function parsePk(s) {
        if (!s) return null;
        const m = String(s).match(/(-?\d+(?:\.\d+)?)/);
        return m ? parseFloat(m[1]) : null;
    }

    /* 给定电荷平衡条件，二分法求 [H+] */
    function solveH(c) {
        const f = h => h + (c.cation || 0) - KW / h - (c.strongAcid || 0)
            - (c.weakAcid ? c.weakAcid * (c.Ka || 1e-5) / ((c.Ka || 1e-5) + h) : 0);
        let lo = 1e-16, hi = 10;
        for (let i = 0; i < 300; i++) {
            const mid = Math.sqrt(lo * hi);
            if (f(mid) > 0) hi = mid; else lo = mid;
        }
        return Math.sqrt(lo * hi);
    }

    function phOf(h) { return -Math.log10(h); }

    /* ============================================================
     *  pH 估算：给定「酸碱表中的一条记录 + 浓度」求 pH
     *  —— 强酸/强碱按化学式判断元数，弱酸/弱碱用 pK 精确求解
     * ============================================================ */
    function leadH(formula) {
        const m = String(formula || '').match(/^H(\d*)/);
        if (!m) return 1;
        return m[1] ? parseInt(m[1], 10) : 1;
    }
    function ohCount(formula) {
        const s = String(formula || '');
        const m = s.match(/\(OH\)(\d+)/);
        if (m) return parseInt(m[1], 10);
        const n = (s.match(/OH/g) || []).length;
        return n || 1;
    }
    /* 弱碱：[BH+] + [H+] = [OH-] */
    function weakBaseH(c, kb) {
        const f = h => {
            const oh = KW / h;
            return c * oh / (kb + oh) + h - oh;
        };
        let lo = 1e-16, hi = 10;
        for (let i = 0; i < 300; i++) {
            const mid = Math.sqrt(lo * hi);
            if (f(mid) > 0) hi = mid; else lo = mid;
        }
        return Math.sqrt(lo * hi);
    }

    function acidPH(r, c) {
        const pk = parsePk(r.pk);
        /* 只有「强酸 / 强碱」按完全电离处理；中强酸仍按 pK 解离 */
        const strong = r.strength === '强酸' || r.strength === '强碱';
        if (r.kind === '中性') return { pH: 7, h: 1e-7, mode: 'neutral', n: 0 };
        if (r.kind === '酸') {
            if (strong) {
                const n = leadH(r.formula);
                const h = solveH({ strongAcid: n * c });
                return { pH: phOf(h), h: h, mode: 'strong', n: n };
            }
            const ka = pk === null ? 1e-5 : Math.pow(10, -pk);
            const h = solveH({ weakAcid: c, Ka: ka });
            return { pH: phOf(h), h: h, mode: 'weak', n: 1, k: ka, alpha: ka / (ka + h) * 100 };
        }
        if (strong) {
            const n = ohCount(r.formula);
            const h = solveH({ cation: n * c });
            return { pH: phOf(h), h: h, mode: 'strong', n: n, isBase: true };
        }
        const kb = pk === null ? 1e-5 : Math.pow(10, -pk);
        const h = weakBaseH(c, kb);
        const oh = KW / h;
        return { pH: phOf(h), h: h, mode: 'weak', n: 1, k: kb, isBase: true, alpha: kb / (kb + oh) * 100 };
    }

    /* pH → 颜色（近似万能指示剂色谱） */
    function phColor(p) {
        if (!isFinite(p)) return '#8a7a5a';
        if (p < 2.5) return '#e0503c';
        if (p < 5) return '#e08a4a';
        if (p < 6.8) return '#d9c46a';
        if (p < 7.6) return '#79c48d';
        if (p < 10.5) return '#5aa0d8';
        return '#9a72d8';
    }
    function phPill(p) {
        return `<span class="ph-pill" style="--pc:${phColor(p)}">${isFinite(p) ? fmt(p, 2) : '—'}</span>`;
    }

    CHEM.pages.acidbase = function () {
        const st = CHEM.state.acid = CHEM.state.acid || { tab: 'theory' };
        const body = ({
            theory: theoryHtml,
            table: tableHtml,
            ph: phHtml,
            titration: titrationHtml,
            indicator: indicatorHtml,
            hydrolysis: hydrolysisHtml,
            buffer: bufferHtml
        })[st.tab] || theoryHtml;

        UI.panel('酸碱世界', '· 电离 · 中和 · 水解 ·',
            UI.tabBar(TABS, st.tab, 'CHEM.acidTab') + body());

        if (st.tab === 'ph') { phBind(); CHEM.phCalc(); }
        if (st.tab === 'titration') titrationDraw();
        if (st.tab === 'buffer') CHEM.bufferCalc();
        if (st.tab === 'hydrolysis') CHEM.hydCalc();
        if (st.tab === 'table') tableBind();
    };

    CHEM.acidTab = function (t) {
        CHEM.state.acid.tab = t;
        CHEM.pages.acidbase();
    };

    /* 供数据库等其它模块引用 */
    CHEM.acidPH = acidPH;
    CHEM.phColor = phColor;

    /* ============================================================
     *  一、三大理论
     * ============================================================ */
    function theoryHtml() {
        return `
        <div class="list">
            <div class="item">
                <div class="item-head"><span class="item-title">① 阿伦尼乌斯电离理论（1887）</span><span class="tag">水中电离</span></div>
                <div class="item-desc">
                    酸：在水中电离出的阳离子<b>全部是 H⁺</b> 的物质（HCl、H₂SO₄、CH₃COOH）。<br>
                    碱：在水中电离出的阴离子<b>全部是 OH⁻</b> 的物质（NaOH、NH₃·H₂O）。<br>
                    局限：无法解释 NH₃ 使石蕊变蓝、Na₂CO₃ 溶液显碱性等现象——它们并不含 OH。
                </div>
            </div>
            <div class="item">
                <div class="item-head"><span class="item-title">② 布朗斯特-劳里质子理论（1923）</span><span class="tag">给出 / 接受质子</span></div>
                <div class="item-desc">
                    酸 = <b>质子（H⁺）给体</b>，碱 = <b>质子受体</b>。酸碱通过<b>共轭关系</b>相互转化：<br>
                    <span class="mono">CH₃COOH ⇌ CH₃COO⁻ + H⁺</span>（醋酸是酸，醋酸根是它的共轭碱）<br>
                    <span class="mono">NH₃ + H₂O ⇌ NH₄⁺ + OH⁻</span>（NH₃ 是碱，NH₄⁺ 是其共轭酸）<br>
                    同一物质既可作酸又可作碱者称<b>两性物质</b>（H₂O、HCO₃⁻、Al(OH)₃）。<br>
                    中和反应实质：<span class="mono">H⁺ + OH⁻ → H₂O</span>，即质子转移。
                </div>
            </div>
            <div class="item">
                <div class="item-head"><span class="item-title">③ 路易斯电子理论</span><span class="tag">电子对</span></div>
                <div class="item-desc">
                    酸 = <b>电子对接受体</b>（BF₃、AlCl₃、Fe³⁺、H⁺），碱 = <b>电子对给予体</b>（NH₃、H₂O、F⁻）。<br>
                    可解释没有质子的酸性物质，是有机反应与配位化学的核心语言。
                </div>
            </div>
        </div>
        <div class="divider"></div>
        <div class="list">
            <div class="item">
                <div class="item-head"><span class="item-title">水的电离与离子积</span></div>
                <div class="item-desc">
                    <span class="mono">H₂O ⇌ H⁺ + OH⁻</span>　25 ℃ 时 <b>K<sub>w</sub> = c(H⁺)·c(OH⁻) = 1.0×10⁻¹⁴</b>。<br>
                    中性：c(H⁺) = c(OH⁻) = 10⁻⁷ mol/L，pH = 7。<br>
                    <b>升温促进电离</b>，100 ℃ 时 K<sub>w</sub> ≈ 10⁻¹²，此时 pH = 6 仍为中性。
                </div>
            </div>
            <div class="item">
                <div class="item-head"><span class="item-title">强弱电解质与电离度</span></div>
                <div class="item-desc">
                    强电解质（强酸、强碱、大多数盐）在水中<b>完全电离</b>，用 → ；弱电解质用 ⇌ 。<br>
                    电离度 α = 已电离浓度 ÷ 初始浓度 × 100%，<b>稀释会促进电离</b>（α 增大），
                    但 c(H⁺) 反而减小。
                </div>
            </div>
        </div>`;
    }

    /* ============================================================
     *  二、常见酸碱表
     * ============================================================ */
    function tableHtml() {
        const rows = CHEM.DB.acids;
        if (!rows.length) return UI.note('未加载 酸碱.txt', 'err');
        const st = CHEM.state.acidTable = CHEM.state.acidTable || { kind: '全部', strength: '全部', kw: '', c: 0.1 };
        if (!st.c) st.c = 0.1;
        const kinds = ['全部', '酸', '碱', '中性'];
        const strengths = ['全部', '强酸', '中强酸', '弱酸', '极弱酸', '强碱', '中强碱', '弱碱', '极弱碱', '中性'];
        const list = rows.filter(r =>
            (st.kind === '全部' || r.kind === st.kind) &&
            (st.strength === '全部' || r.strength === st.strength) &&
            (!st.kw || (r.name + r.formula + r.desc).toLowerCase().includes(st.kw.toLowerCase())));
        CHEM.state.acidTable._list = list;

        const concs = [1, 0.1, 0.01, 0.001];
        let h = `<div class="field">
            <input type="text" id="acidKw" placeholder="名称 / 化学式 / 用途 …" value="${esc(st.kw)}" style="flex:2;min-width:180px;">
            <button class="btn btn-primary btn-sm" onclick="CHEM.acidSearch()">检索</button>
            <span class="muted" style="font-size:.82rem;">命中 ${list.length} / ${rows.length}</span>
        </div>
        <div class="chip-row" style="margin-bottom:8px;">
            ${kinds.map(k => `<span class="chip ${k === st.kind ? 'on' : ''}" onclick="CHEM.acidKind('${k}')">${k}</span>`).join('')}
        </div>
        <div class="chip-row" style="margin-bottom:10px;">
            ${strengths.map(k => `<span class="chip ${k === st.strength ? 'on' : ''}" style="font-size:.78rem;" onclick="CHEM.acidStrength('${k}')">${k}</span>`).join('')}
        </div>
        <div class="field" style="margin-bottom:4px;">
            <label>计算 pH 所用浓度</label>
            ${concs.map(c => `<span class="chip ${Math.abs(st.c - c) < 1e-12 ? 'on' : ''}" onclick="CHEM.acidConc(${c})">${c} mol/L</span>`).join('')}
            <input type="number" id="acidC" step="any" min="1e-6" value="${st.c}" style="width:110px;">
            <button class="btn btn-sm" onclick="CHEM.acidConcCustom()">按此浓度重算</button>
        </div>
        ${phRuler(list, st.c)}
        <div class="tbl-wrap"><table class="tbl"><thead><tr>
            <th>名称</th><th>化学式</th><th>类别</th><th>强弱</th><th>pK</th>
            <th title="按当前浓度计算的理论 pH">pH<span class="muted" style="font-size:.68rem;"> @${esc(String(st.c))}M</span></th>
            <th>共轭</th><th>特性与用途</th><th></th>
        </tr></thead><tbody>
        ${list.map((r, i) => {
            const e = acidPH(r, st.c);
            return `<tr>
            <td style="color:#eace9f;cursor:pointer;" onclick="CHEM.acidDetail(${i})">${esc(r.name)}</td>
            <td class="mono">${esc(CHEM.prettySafe(r.formula))}</td>
            <td>${esc(r.kind)}</td>
            <td><span class="tag ${/强/.test(r.strength) ? 'tag-gold' : ''}">${esc(r.strength)}</span></td>
            <td class="num mono">${esc(r.pk)}</td>
            <td>${phPill(e.pH)}</td>
            <td class="mono">${esc(r.conjugate)}</td>
            <td class="muted">${esc(r.desc)}</td>
            <td style="width:36px;">${CHEM.favBtn('酸碱', `${r.name}　${r.formula}`, `${r.kind}·${r.strength}　${r.pk}　pH ${fmt(e.pH, 2)}　${r.desc}`, 'acidbase')}</td>
        </tr>`;
        }).join('')}
        </tbody></table></div>
        <div class="note">
            pH 值按 <b>${esc(String(st.c))} mol/L</b> 水溶液、25 ℃ 由 pK 精确求解（弱酸弱碱解离方程，非近似公式）。
            强酸按化学式中氢原子数计元数，弱酸只计第一步电离；碱按 OH 数目计。
            <b>点击名称</b>可看该物质在 1 / 0.1 / 0.01 / 0.001 mol/L 下的 pH 与电离度。
        </div>`;
        return h;
    }

    /* pH 标尺：把当前筛选结果按 pH 落在 0~14 的色带上 */
    function phRuler(list, c) {
        const marks = list.map((r, i) => {
            const e = acidPH(r, c);
            return { i: i, name: r.name, pH: e.pH };
        }).filter(m => isFinite(m.pH));
        marks.sort((a, b) => a.pH - b.pH);
        const lastInLane = [];
        marks.forEach(m => {
            const left = Math.max(0, Math.min(14, m.pH)) / 14 * 100;
            m.left = left;
            let lane = 0;
            while (lane < 3 && lastInLane[lane] !== undefined && lastInLane[lane] > left - 3.4) lane++;
            lastInLane[lane] = left;
            m.lane = Math.min(lane, 3);
        });
        return `<div class="ph-ruler">
            <div class="ph-scale"></div>
            <div class="ph-marks">
                ${marks.slice(0, 60).map(m => `<span class="ph-dot" style="left:${m.left.toFixed(2)}%;top:${m.lane * 15}px;background:${phColor(m.pH)}"
                    title="${esc(m.name)} pH ${fmt(m.pH, 2)}" onclick="CHEM.acidDetail(${m.i})"></span>`).join('')}
            </div>
            <div class="ph-axis">${Array.from({ length: 15 }, (_, i) => `<span style="left:${(i / 14 * 100).toFixed(2)}%">${i}</span>`).join('')}</div>
        </div>`;
    }

    CHEM.acidConc = function (c) {
        CHEM.state.acidTable.c = c;
        CHEM.pages.acidbase();
    };
    CHEM.acidConcCustom = function () {
        const el = document.getElementById('acidC');
        const v = el ? parseFloat(el.value) : NaN;
        if (!(v > 0)) { CHEM.toast('请输入大于 0 的浓度'); return; }
        CHEM.state.acidTable.c = v;
        CHEM.pages.acidbase();
    };

    /* 点击物质：查看不同浓度下的 pH 与电离度 */
    CHEM.acidDetail = function (i) {
        const list = (CHEM.state.acidTable || {})._list || [];
        const r = list[i];
        if (!r) return;
        const cs = [1, 0.1, 0.01, 0.001];
        const rows = cs.map(c => {
            const e = acidPH(r, c);
            return `<tr>
                <td class="num mono">${c}</td>
                <td>${phPill(e.pH)}</td>
                <td class="mono">${e.h.toExponential(2)}</td>
                <td class="mono">${(KW / e.h).toExponential(2)}</td>
                <td class="muted">${e.mode === 'strong' ? '完全电离（' + e.n + ' 元）' :
                    e.mode === 'neutral' ? '不水解' :
                        `${e.isBase ? 'Kb' : 'Ka'} = ${e.k.toExponential(2)}　α = ${fmt(e.alpha, 2)}%`}</td>
            </tr>`;
        }).join('');
        UI.modal(`<div class="panel-title" style="font-size:1.35rem;">${esc(r.name)}<span class="sub">${esc(r.kind)} · ${esc(r.strength)}</span></div>
            <div class="field" style="margin-bottom:10px;">
                <span class="tag tag-gold mono" style="font-size:1rem;">${esc(CHEM.prettySafe(r.formula))}</span>
                <span class="tag">${esc(r.pk)}</span>
                <span class="tag">共轭 ${esc(r.conjugate)}</span>
            </div>
            <div class="tbl-wrap"><table class="tbl"><thead><tr>
                <th>浓度 mol/L</th><th>pH</th><th>c(H⁺)</th><th>c(OH⁻)</th><th>说明</th>
            </tr></thead><tbody>${rows}</tbody></table></div>
            <div class="note" style="margin-top:12px;">${esc(r.desc)}</div>
            <div class="note warn" style="margin-top:8px;">
                稀释 10 倍时 pH 向 7 靠近约 0.5~1，越稀越接近中性；这是水的电离不可忽略所致。
            </div>`);
    };

    function tableBind() {
        const el = document.getElementById('acidKw');
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.acidSearch(); });
    }
    CHEM.acidSearch = function () {
        CHEM.state.acidTable.kw = document.getElementById('acidKw').value.trim();
        CHEM.pages.acidbase();
    };
    CHEM.acidKind = function (k) { CHEM.state.acidTable.kind = k; CHEM.pages.acidbase(); };
    CHEM.acidStrength = function (k) { CHEM.state.acidTable.strength = k; CHEM.pages.acidbase(); };

    /* ============================================================
     *  三、pH 计算器
     * ============================================================ */
    function phHtml() {
        return `
        <div class="field">
            <label>情形</label>
            <select id="phMode" onchange="CHEM.phModeChange()">
                <option value="strongAcid">强酸溶液</option>
                <option value="strongBase">强碱溶液</option>
                <option value="weakAcid">弱酸溶液</option>
                <option value="weakBase">弱碱溶液</option>
                <option value="mix">强酸与强碱混合</option>
                <option value="dilute">稀释 / 浓缩</option>
            </select>
        </div>
        <div id="phFields"></div>
        <div class="field"><button class="btn btn-primary" onclick="CHEM.phCalc()">计算</button>
            <span class="muted" style="font-size:.8rem;">未特别说明均按 25 ℃（Kw = 1×10⁻¹⁴）</span></div>
        <div class="output" id="phOut"></div>
        <div class="divider"></div>
        <div class="gold" style="font-size:.95rem;">常用结论</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>情形</th><th>近似公式</th><th>备注</th></tr></thead><tbody>
            <tr><td>强酸</td><td class="mono">pH = −lg c(H⁺) = −lg(n·c)</td><td>c 为酸的浓度，n 为几元酸</td></tr>
            <tr><td>强碱</td><td class="mono">pOH = −lg(n·c)，pH = 14 − pOH</td><td>—</td></tr>
            <tr><td>弱酸</td><td class="mono">c(H⁺) ≈ √(Ka·c)</td><td>当 c/Ka &gt; 500 时可用</td></tr>
            <tr><td>弱碱</td><td class="mono">c(OH⁻) ≈ √(Kb·c)</td><td>同上</td></tr>
            <tr><td>混合</td><td class="mono">比较 n(H⁺) 与 n(OH⁻)</td><td>谁过量算谁，等量则 pH=7</td></tr>
            <tr><td>稀释 10ⁿ 倍</td><td class="mono">pH 变化 ≈ n（趋近 7 但不过 7）</td><td>无限稀释时 pH → 7</td></tr>
        </tbody></table></div>`;
    }

    CHEM.phModeChange = function () {
        const mode = document.getElementById('phMode').value;
        const box = document.getElementById('phFields');
        const acids = CHEM.DB.acids.filter(a => a.kind === '酸');
        const bases = CHEM.DB.acids.filter(a => a.kind === '碱');
        const opt = arr => arr.map(a => `<option value="${esc(a.formula)}" data-pk="${esc(a.pk)}">${esc(a.name)}（${esc(a.formula)}）</option>`).join('');
        if (mode === 'strongAcid') {
            box.innerHTML = `<div class="field"><label>浓度 c (mol/L)</label><input type="number" id="phC" step="any" value="0.1" style="width:130px;">
                <label>几元酸</label><input type="number" id="phN" value="1" min="1" max="4" style="width:80px;"></div>`;
        } else if (mode === 'strongBase') {
            box.innerHTML = `<div class="field"><label>浓度 c (mol/L)</label><input type="number" id="phC" step="any" value="0.1" style="width:130px;">
                <label>几元碱</label><input type="number" id="phN" value="1" min="1" max="4" style="width:80px;"></div>`;
        } else if (mode === 'weakAcid' || mode === 'weakBase') {
            box.innerHTML = `<div class="field"><label>浓度 c (mol/L)</label><input type="number" id="phC" step="any" value="0.1" style="width:130px;">
                <label>选择物质</label><select id="phPick" onchange="CHEM.phPickChange()">${opt(mode === 'weakAcid' ? acids : bases)}</select>
                <label>${mode === 'weakAcid' ? 'Ka' : 'Kb'}</label><input type="number" id="phKa" step="any" value="1.8e-5" style="width:150px;"></div>`;
            setTimeout(() => { CHEM.phPickChange(); }, 0);
        } else if (mode === 'mix') {
            box.innerHTML = `<div class="field"><label>酸 c₁ (mol/L)</label><input type="number" id="phC1" step="any" value="0.1" style="width:110px;">
                <label>V₁ (mL)</label><input type="number" id="phV1" step="any" value="50" style="width:90px;">
                <label>碱 c₂ (mol/L)</label><input type="number" id="phC2" step="any" value="0.1" style="width:110px;">
                <label>V₂ (mL)</label><input type="number" id="phV2" step="any" value="50" style="width:90px;"></div>`;
        } else {
            box.innerHTML = `<div class="field"><label>原 pH</label><input type="number" id="phP0" step="any" value="3" style="width:100px;">
                <label>稀释倍数</label><input type="number" id="phK" step="any" value="100" style="width:110px;">
                <span class="muted" style="font-size:.8rem;">输入 0.01 表示浓缩 100 倍</span></div>`;
        }
        CHEM.phCalc();
    };

    CHEM.phPickChange = function () {
        const sel = document.getElementById('phPick');
        if (!sel) return;
        const o = sel.options[sel.selectedIndex];
        const pk = parsePk(o.getAttribute('data-pk'));
        const ka = document.getElementById('phKa');
        if (pk !== null && ka) {
            ka.value = Math.pow(10, -pk).toExponential(2);
        }
    };

    function phBind() { CHEM.phModeChange(); }

    CHEM.phCalc = function () {
        const out = document.getElementById('phOut');
        if (!out) return;
        const mode = document.getElementById('phMode').value;
        const num = id => parseFloat((document.getElementById(id) || {}).value);
        let h = null, extra = [];

        try {
            if (mode === 'strongAcid') {
                const c = num('phC'), n = num('phN') || 1;
                h = solveH({ strongAcid: n * c });
                extra.push(['c(H⁺)', `${fmt(n * c, 4)} mol/L（近似）`]);
            } else if (mode === 'strongBase') {
                const c = num('phC'), n = num('phN') || 1;
                h = solveH({ cation: n * c });
                extra.push(['c(OH⁻)', `${fmt(n * c, 4)} mol/L（近似）`]);
            } else if (mode === 'weakAcid') {
                const c = num('phC'), ka = num('phKa');
                h = solveH({ weakAcid: c, Ka: ka });
                const alpha = ka / (ka + h) * 100;
                extra.push(['Ka', ka.toExponential(2)], ['电离度 α', fmt(alpha, 3) + '%'],
                    ['近似式', `c(H⁺) ≈ √(Ka·c) = ${fmt(Math.sqrt(ka * c), 4)}`]);
            } else if (mode === 'weakBase') {
                const c = num('phC'), kb = num('phKa');
                /* 弱碱：电荷平衡 [BH⁺] + [H⁺] = [OH⁻] */
                const f = hh => {
                    const oh = KW / hh;
                    return c * oh / (kb + oh) + hh - KW / hh;
                };
                let lo = 1e-16, hi = 10;
                for (let i = 0; i < 300; i++) { const mid = Math.sqrt(lo * hi); if (f(mid) > 0) hi = mid; else lo = mid; }
                h = Math.sqrt(lo * hi);
                const oh = KW / h;
                extra.push(['Kb', kb.toExponential(2)], ['c(OH⁻)', `${fmt(oh, 4)} mol/L`],
                    ['近似式', `c(OH⁻) ≈ √(Kb·c) = ${fmt(Math.sqrt(kb * c), 4)}`]);
            } else if (mode === 'mix') {
                const c1 = num('phC1'), v1 = num('phV1'), c2 = num('phC2'), v2 = num('phV2');
                const nAcid = c1 * v1 / 1000, nBase = c2 * v2 / 1000;
                const V = (v1 + v2) / 1000;
                const diff = nAcid - nBase;
                extra.push(['n(H⁺)', nAcid.toExponential(3) + ' mol'], ['n(OH⁻)', nBase.toExponential(3) + ' mol']);
                if (Math.abs(diff) < 1e-12) {
                    h = 1e-7;
                    extra.push(['结论', '恰好完全中和，室温下 pH = 7']);
                } else if (diff > 0) {
                    h = solveH({ strongAcid: diff / V });
                    extra.push(['过量', `酸过量 ${diff.toExponential(3)} mol`]);
                } else {
                    h = solveH({ cation: -diff / V });
                    extra.push(['过量', `碱过量 ${(-diff).toExponential(3)} mol`]);
                }
            } else {
                const p0 = num('phP0'), k = num('phK');
                if (!(k > 0)) throw new Error('稀释倍数必须大于 0');
                const h0 = Math.pow(10, -p0);
                let h1;
                if (h0 > 1e-7) {
                    /* 酸性：按强酸近似，稀释后仍按电荷平衡修正 */
                    h1 = solveH({ strongAcid: h0 / k });
                } else if (h0 < 1e-7) {
                    h1 = solveH({ cation: (KW / h0) / k });
                } else {
                    h1 = 1e-7;
                }
                h = h1;
                extra.push(['稀释后 c(H⁺)', `${fmt(h1, 3)} mol/L`]);
            }

            const pH = phOf(h), pOH = 14 - pH;
            let html = `<div class="gold" style="font-size:1.3rem;font-weight:700;">pH = ${fmt(pH, 2)}</div>
                <div class="field" style="margin-top:8px;">
                    <span class="tag tag-gold">c(H⁺) = ${h.toExponential(2)} mol/L</span>
                    <span class="tag">c(OH⁻) = ${(KW / h).toExponential(2)} mol/L</span>
                    <span class="tag">pOH = ${fmt(pOH, 2)}</span>
                    <span class="tag ${pH < 6.9 ? 'tag-err' : pH > 7.1 ? 'tag-ok' : ''}">${pH < 6.9 ? '酸性' : pH > 7.1 ? '碱性' : '中性'}</span>
                </div>`;
            if (extra.length) html += `<div class="divider"></div>` + UI.kv(extra.map(([k, v]) => [k, esc(String(v))]));
            out.innerHTML = html;
        } catch (e) {
            out.innerHTML = `<span class="err-text">计算失败：${esc(e.message)}</span>`;
        }
    };

    /* ============================================================
     *  四、滴定曲线
     * ============================================================ */
    function titrationHtml() {
        return `
        <div class="field">
            <label>体系</label>
            <select id="tiType" onchange="CHEM.tiChange()">
                <option value="strong">强酸滴定（HCl ← NaOH）</option>
                <option value="weak">弱酸滴定（CH₃COOH ← NaOH）</option>
                <option value="strongbase">强碱滴定（NaOH ← HCl）</option>
            </select>
        </div>
        <div id="tiFields"></div>
        <div style="position:relative;background:#160e06;border:1px solid #3d2b18;border-radius:14px;padding:8px;">
            <canvas id="tiCanvas" style="width:100%;height:340px;display:block;"></canvas>
        </div>
        <div id="tiInfo" style="margin-top:12px;"></div>
        <div class="note">
            曲线的<b>突跃范围</b>决定指示剂选择：强酸强碱滴定突跃约 pH 4～10，可选甲基橙、酚酞；
            弱酸强碱滴定突跃变窄（约 pH 7～10），应选<b>酚酞</b>；强酸弱碱滴定选<b>甲基橙</b>。
        </div>`;
    }

    CHEM.tiChange = function () {
        const type = document.getElementById('tiType').value;
        const box = document.getElementById('tiFields');
        if (type === 'weak') {
            box.innerHTML = `<div class="field">
                <label>c(酸) mol/L</label><input type="number" id="tiCa" step="any" value="0.1" style="width:110px;">
                <label>V(酸) mL</label><input type="number" id="tiVa" step="any" value="20" style="width:90px;">
                <label>c(NaOH) mol/L</label><input type="number" id="tiCb" step="any" value="0.1" style="width:120px;">
                <label>Ka</label><input type="number" id="tiKa" step="any" value="1.8e-5" style="width:140px;"></div>`;
        } else {
            box.innerHTML = `<div class="field">
                <label>c(酸) mol/L</label><input type="number" id="tiCa" step="any" value="0.1" style="width:110px;">
                <label>V(酸) mL</label><input type="number" id="tiVa" step="any" value="20" style="width:90px;">
                <label>c(碱) mol/L</label><input type="number" id="tiCb" step="any" value="0.1" style="width:120px;"></div>`;
        }
        box.querySelectorAll('input').forEach(i => i.addEventListener('input', titrationDraw));
        titrationDraw();
    };

    function phAtV(Vb, cfg) {
        const Va = cfg.Va, Ca = cfg.Ca, Cb = cfg.Cb;
        const V = (Va + Vb) / 1000;                 /* L */
        const cNa = Cb * Vb / 1000 / V;
        if (cfg.type === 'weak') {
            return phOf(solveH({ weakAcid: Ca * Va / 1000 / V, Ka: cfg.Ka, cation: cNa }));
        }
        if (cfg.type === 'strongbase') {
            /* 用酸滴碱：把 Na 换成酸根 */
            const cAcid = Cb * Vb / 1000 / V;       /* 滴定剂 HCl */
            const cOH = Ca * Va / 1000 / V;
            return phOf(solveH({ strongAcid: cAcid, cation: cOH }));
        }
        return phOf(solveH({ strongAcid: Ca * Va / 1000 / V, cation: cNa }));
    }

    function titrationDraw() {
        const canvas = document.getElementById('tiCanvas');
        if (!canvas) return;
        const type = document.getElementById('tiType').value;
        const num = (id, d) => {
            const el = document.getElementById(id);
            const v = el ? parseFloat(el.value) : NaN;
            return isNaN(v) ? d : v;
        };
        const cfg = {
            type,
            Ca: num('tiCa', 0.1),
            Va: num('tiVa', 20),
            Cb: num('tiCb', 0.1),
            Ka: num('tiKa', 1.8e-5)
        };
        const Veq = cfg.Ca * cfg.Va / cfg.Cb;
        const Vmax = Veq * 2;

        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth || 700, H = 340;
        canvas.width = W * dpr; canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const pad = { l: 46, r: 18, t: 16, b: 34 };
        const px = v => pad.l + (W - pad.l - pad.r) * (v / Vmax);
        const py = p => pad.t + (H - pad.t - pad.b) * (1 - p / 14);

        /* 网格 */
        ctx.strokeStyle = 'rgba(122,90,50,.28)';
        ctx.fillStyle = '#8a7a5a';
        ctx.font = '11px "Noto Serif SC", serif';
        ctx.lineWidth = 1;
        for (let p = 0; p <= 14; p += 2) {
            const y = py(p);
            ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
            ctx.textAlign = 'right'; ctx.fillText(String(p), pad.l - 6, y + 4);
        }
        for (let i = 0; i <= 5; i++) {
            const v = Vmax * i / 5;
            const x = px(v);
            ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
            ctx.textAlign = 'center'; ctx.fillText(fmt(v, 0), x, H - pad.b + 16);
        }
        ctx.fillStyle = '#a6885a'; ctx.textAlign = 'right';
        ctx.fillText('pH', pad.l - 6, pad.t - 2);
        ctx.textAlign = 'center';
        ctx.fillText('V(滴定剂) / mL', W - pad.r - 40, H - 6);

        /* pH=7 参考线 */
        ctx.strokeStyle = 'rgba(201,168,106,.35)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pad.l, py(7)); ctx.lineTo(W - pad.r, py(7)); ctx.stroke();
        ctx.setLineDash([]);

        /* 曲线 */
        const pts = [];
        const N = 420;
        for (let i = 0; i <= N; i++) {
            const v = Vmax * i / N;
            pts.push([px(v), py(Math.max(0, Math.min(14, phAtV(v, cfg))))]);
        }
        const grad = ctx.createLinearGradient(pad.l, 0, W - pad.r, 0);
        grad.addColorStop(0, '#eace9f');
        grad.addColorStop(.6, '#c9a86a');
        grad.addColorStop(1, '#d97a5a');
        ctx.strokeStyle = grad; ctx.lineWidth = 2.2;
        ctx.beginPath();
        pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.stroke();

        /* 等当点 */
        const pEq = phAtV(Veq, cfg);
        ctx.fillStyle = '#d97a5a';
        ctx.beginPath(); ctx.arc(px(Veq), py(pEq), 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#eace9f'; ctx.textAlign = 'left';
        ctx.fillText(`等当点 pH ${fmt(pEq, 2)}`, px(Veq) + 8, py(pEq) - 6);

        /* 突跃范围：±0.1% */
        const p1 = phAtV(Veq * 0.999, cfg), p2 = phAtV(Veq * 1.001, cfg);
        ctx.fillStyle = 'rgba(201,168,106,.13)';
        ctx.fillRect(px(Veq * 0.999), py(p2), px(Veq * 1.001) - px(Veq * 0.999), py(p1) - py(p2));

        /* 指示剂色带 */
        const bands = [['甲基橙', 3.1, 4.4, '#e08a4a'], ['酚酞', 8.2, 10.0, '#c060a0']];
        bands.forEach(([n, a, b, c]) => {
            ctx.fillStyle = c + '33';
            ctx.fillRect(pad.l, py(b), W - pad.l - pad.r, py(a) - py(b));
            ctx.fillStyle = c; ctx.textAlign = 'right'; ctx.font = '11px "Noto Serif SC", serif';
            ctx.fillText(n, W - pad.r - 4, py(b) - 3);
        });

        /* 信息 */
        const pStart = phAtV(0, cfg);
        const pHalf = phAtV(Veq / 2, cfg);
        const info = document.getElementById('tiInfo');
        if (info) {
            const rows = [
                ['初始 pH', ' ' + fmt(pStart, 2)],
                ['等当点体积', fmt(Veq, 2) + ' mL'],
                ['等当点 pH', fmt(pEq, 2) + (Math.abs(pEq - 7) < 0.3 ? '（近中性）' : pEq < 7 ? '（显酸性）' : '（显碱性）')],
                ['突跃范围', `pH ${fmt(Math.min(p1, p2), 2)} ~ ${fmt(Math.max(p1, p2), 2)}`]
            ];
            if (type === 'weak') rows.push(['半等当点 pH', fmt(pHalf, 2) + '（≈ pKa = ' + fmt(-Math.log10(cfg.Ka), 2) + '）']);
            rows.push(['推荐指示剂', type === 'weak' ? '酚酞' : type === 'strongbase' ? '甲基橙' : '甲基橙或酚酞']);
            info.innerHTML = UI.kv(rows);
        }
    }
    CHEM.tiDraw = titrationDraw;

    /* ============================================================
     *  五、指示剂
     * ============================================================ */
    function indicatorHtml() {
        const rows = CHEM.DB.indicators;
        if (!rows.length) return UI.note('未加载 指示剂.txt', 'err');
        return `
        <div class="tbl-wrap"><table class="tbl"><thead><tr>
            <th>指示剂</th><th>变色范围 (pH)</th><th>酸色</th><th>碱色</th><th>典型用途</th></tr></thead><tbody>
            ${rows.map(r => `<tr>
                <td style="color:#eace9f;">${esc(r.name)}</td>
                <td class="mono">${esc(r.range)}</td>
                <td><span class="tag" style="background:#c0504a22;border-color:#c0504a88;color:#e8968a">${esc(r.acidColor)}</span></td>
                <td><span class="tag" style="background:#4a7ac022;border-color:#4a7ac088;color:#8ab0e8">${esc(r.baseColor)}</span></td>
                <td class="muted">${esc(r.use)}</td>
            </tr>`).join('')}
        </tbody></table></div>
        <div class="divider"></div>
        <div class="gold" style="font-size:.95rem;">指示剂选择原则</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>滴定类型</th><th>等当点 pH</th><th>宜选指示剂</th><th>终点颜色变化</th></tr></thead><tbody>
            <tr><td>强酸 → 强碱</td><td class="num">7</td><td>甲基橙 / 酚酞</td><td>黄→橙 / 无色→粉红</td></tr>
            <tr><td>强碱 → 强酸</td><td class="num">7</td><td>甲基橙 / 酚酞</td><td>黄→橙 / 红→无色</td></tr>
            <tr><td>弱酸 → 强碱</td><td class="num">&gt;7</td><td><b>酚酞</b></td><td>无色→浅粉红</td></tr>
            <tr><td>强酸 → 弱碱</td><td class="num">&lt;7</td><td><b>甲基橙</b></td><td>黄→橙色</td></tr>
        </tbody></table></div>
        <div class="note">口诀：<b>谁强显谁性</b>——强酸弱碱盐显酸性，强碱弱酸盐显碱性，强酸强碱盐显中性。指示剂的变色点应落在滴定突跃范围之内。</div>`;
    }

    /* ============================================================
     *  六、盐类水解
     * ============================================================ */
    const HYD_TABLE = [
        ['NaCl、KNO₃、Na₂SO₄', '强酸 + 强碱', '不水解', '中性', 'pH = 7'],
        ['CH₃COONa、Na₂CO₃', '强碱 + 弱酸', '酸根水解', '碱性', 'CO₃²⁻ + H₂O ⇌ HCO₃⁻ + OH⁻'],
        ['NH₄Cl、FeCl₃、AlCl₃', '强酸 + 弱碱', '阳离子水解', '酸性', 'NH₄⁺ + H₂O ⇌ NH₃·H₂O + H⁺'],
        ['CH₃COONH₄、NH₄HCO₃', '弱酸 + 弱碱', '双水解（程度相近）', '近中性', '取决于 Ka 与 Kb 的相对大小'],
        ['Al₂S₃、Al(HCO₃)₃', '弱酸 + 弱碱', '完全双水解', '—', '2Al³⁺ + 3S²⁻ + 6H₂O → 2Al(OH)₃↓ + 3H₂S↑']
    ];

    function hydrolysisHtml() {
        return `
        <div class="tbl-wrap"><table class="tbl"><thead><tr>
            <th>盐的类型</th><th>组成</th><th>水解情况</th><th>溶液性质</th><th>典型实例</th></tr></thead><tbody>
            ${HYD_TABLE.map(r => `<tr>${r.map((c, i) => `<td class="${i === 0 ? 'mono' : i === 4 ? 'muted' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
        <div class="divider"></div>
        <div class="gold" style="font-size:.95rem;">水解常数计算</div>
        <div class="field">
            <label>弱酸 Ka</label><input type="number" id="hydKa" step="any" value="1.8e-5" style="width:150px;">
            <label>或 弱碱 Kb</label><input type="number" id="hydKb" step="any" value="1.8e-5" style="width:150px;">
            <button class="btn btn-primary btn-sm" onclick="CHEM.hydCalc()">计算 Kh</button>
        </div>
        <div class="output" id="hydOut"></div>
        <div class="divider"></div>
        <div class="gold" style="font-size:.95rem;">水解规律与影响因素</div>
        <div class="list">
            <div class="item"><div class="item-head"><span class="item-title">有弱才水解，无弱不水解</span></div>
                <div class="item-desc">盐中只要有弱酸根或弱碱阳离子就会水解；强酸强碱盐不水解。</div></div>
            <div class="item"><div class="item-head"><span class="item-title">越弱越水解</span></div>
                <div class="item-desc">对应弱酸（碱）越弱，其酸根（阳离子）水解程度越大。Kh = Kw / Ka（或 Kw / Kb）。</div></div>
            <div class="item"><div class="item-head"><span class="item-title">谁强显谁性</span></div>
                <div class="item-desc">强碱弱酸盐显碱性，强酸弱碱盐显酸性；弱酸弱碱盐由 Ka、Kb 相对大小决定。</div></div>
            <div class="item"><div class="item-head"><span class="item-title">升温促进、稀释促进、加酸/碱抑制</span></div>
                <div class="item-desc">水解吸热，升温促进；加水稀释促进水解；加入同离子（如向 CH₃COONa 中加 NaOH）抑制水解。</div></div>
        </div>`;
    }

    CHEM.hydCalc = function () {
        const out = document.getElementById('hydOut');
        if (!out) return;
        const ka = parseFloat(document.getElementById('hydKa').value);
        const kb = parseFloat(document.getElementById('hydKb').value);
        let h = '';
        if (ka > 0) {
            const kh = KW / ka;
            h += `<div class="gold">弱酸根水解：Kh = Kw / Ka = ${kh.toExponential(2)}</div>
                  <div class="muted" style="font-size:.85rem;">Kh 越大，水解程度越大，溶液碱性越强（对应的酸越弱）。</div>`;
        }
        if (kb > 0) {
            const kh2 = KW / kb;
            h += `<div class="gold" style="margin-top:8px;">弱碱阳离子水解：Kh = Kw / Kb = ${kh2.toExponential(2)}</div>
                  <div class="muted" style="font-size:.85rem;">Kh 越大，水解越彻底，溶液酸性越强（对应的碱越弱）。</div>`;
        }
        out.innerHTML = h || '<span class="muted">请输入 Ka 或 Kb</span>';
    };

    /* ============================================================
     *  七、缓冲溶液
     * ============================================================ */
    function bufferHtml() {
        return `
        <div class="note">
            缓冲溶液由<b>弱酸及其共轭碱</b>（如 CH₃COOH / CH₃COO⁻）或<b>弱碱及其共轭酸</b>（如 NH₃ / NH₄⁺）组成，
            外加少量强酸强碱时 pH 几乎不变。计算用亨德森-哈塞尔巴赫方程：
            <span class="mono">pH = pKa + lg( c(共轭碱) / c(弱酸) )</span>
        </div>
        <div class="field">
            <label>体系</label>
            <select id="bufType" onchange="CHEM.bufTypeChange()">
                <option value="acid">弱酸及其盐（如 CH₃COOH / CH₃COONa）</option>
                <option value="base">弱碱及其盐（如 NH₃ / NH₄Cl）</option>
            </select>
            <label>pK<sub>a</sub>（共轭酸）</label><input type="number" id="bufPk" step="any" value="4.76" style="width:110px;">
        </div>
        <div class="field">
            <label>c(弱酸 或 弱碱)</label><input type="number" id="bufCa" step="any" value="0.1" style="width:130px;">
            <label>c(共轭碱 或 共轭酸)</label><input type="number" id="bufCb" step="any" value="0.1" style="width:150px;">
        </div>
        <div class="field"><button class="btn btn-primary" onclick="CHEM.bufferCalc()">计算 pH</button>
            <button class="btn btn-sm" onclick="CHEM.bufPreset('4.76','0.1','0.1')">醋酸体系</button>
            <button class="btn btn-sm" onclick="CHEM.bufPreset('9.25','0.1','0.1')">氨体系</button>
            <button class="btn btn-sm" onclick="CHEM.bufPreset('6.35','0.1','0.1')">碳酸体系</button>
            <button class="btn btn-sm" onclick="CHEM.bufPreset('7.20','0.05','0.1')">磷酸体系</button>
        </div>
        <div class="output" id="bufOut"></div>
        <div class="divider"></div>
        <div class="gold" style="font-size:.95rem;">常见缓冲体系</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>体系</th><th>缓冲对</th><th>pKa</th><th>缓冲范围</th><th>生理/应用</th></tr></thead><tbody>
            <tr><td>醋酸体系</td><td class="mono">CH₃COOH / CH₃COO⁻</td><td class="num">4.76</td><td class="mono">3.76 ~ 5.76</td><td>实验室常用</td></tr>
            <tr><td>碳酸体系</td><td class="mono">H₂CO₃ / HCO₃⁻</td><td class="num">6.35</td><td class="mono">5.35 ~ 7.35</td><td>人体血液 pH 稳定在 7.35~7.45</td></tr>
            <tr><td>磷酸体系</td><td class="mono">H₂PO₄⁻ / HPO₄²⁻</td><td class="num">7.20</td><td class="mono">6.20 ~ 8.20</td><td>细胞内液与培养液</td></tr>
            <tr><td>氨体系</td><td class="mono">NH₄⁺ / NH₃</td><td class="num">9.25</td><td class="mono">8.25 ~ 10.25</td><td>碱性缓冲</td></tr>
        </tbody></table></div>`;
    }

    CHEM.bufPreset = function (pk, a, b) {
        document.getElementById('bufPk').value = pk;
        document.getElementById('bufCa').value = a;
        document.getElementById('bufCb').value = b;
        CHEM.bufferCalc();
    };
    CHEM.bufTypeChange = function () { CHEM.bufferCalc(); };

    CHEM.bufferCalc = function () {
        const out = document.getElementById('bufOut');
        if (!out) return;
        const type = document.getElementById('bufType').value;
        const pk = parseFloat(document.getElementById('bufPk').value);
        const ca = parseFloat(document.getElementById('bufCa').value);
        const cb = parseFloat(document.getElementById('bufCb').value);
        if (!(pk === pk) || !(ca > 0) || !(cb > 0)) {
            out.innerHTML = '<span class="warn-text">请输入有效的 pK 与两种浓度</span>';
            return;
        }
        /* pk 一律指共轭酸的 pKa；碱体系用 pOH = (14 − pKa) + lg(c盐 / c碱) */
        let pH, ratio;
        if (type === 'acid') {
            ratio = cb / ca;                       /* 盐 / 酸 */
            pH = pk + Math.log10(ratio);
        } else {
            ratio = cb / ca;                       /* 盐 / 碱 */
            const pOH = (14 - pk) + Math.log10(ratio);
            pH = 14 - pOH;
        }
        out.innerHTML = `<div class="gold" style="font-size:1.25rem;font-weight:700;">pH = ${fmt(pH, 2)}</div>
            <div class="field" style="margin-top:8px;">
                <span class="tag tag-gold">碱/酸 = ${fmt(ratio, 3)}</span>
                <span class="tag">c(H⁺) = ${Math.pow(10, -pH).toExponential(2)} mol/L</span>
                <span class="tag">缓冲范围 ${fmt(pk - 1, 2)} ~ ${fmt(pk + 1, 2)}</span>
            </div>
            <div class="divider"></div>
            <div class="muted" style="font-size:.85rem;">
                ${type === 'acid'
                ? `pH = pKa + lg(c盐 / c酸) = ${pk} + lg(${cb} / ${ca}) = ${fmt(pH, 2)}`
                : `pOH = (14 − pKa) + lg(c盐 / c碱) = ${fmt(14 - pH, 2)}，pH = 14 − pOH = ${fmt(pH, 2)}`}
            </div>
            ${Math.abs(Math.log10(ratio)) > 1 ? '<div class="note warn">酸碱比超出 1:10，缓冲能力已很弱，通常认为失去缓冲作用。</div>' : ''}`;
    };
})();
