/* ============================================================
 *  js/alloy.js —— 合金天地（总论 / 合金大全 / 相图初探 / 成分计算）
 * ============================================================ */
(function () {
    'use strict';
    const CHEM = window.CHEM;
    const UI = CHEM.ui;
    const esc = CHEM.util.esc;

    const TABS = [
        ['theory', '合金总论'],
        ['table', '合金大全'],
        ['phase', '相图初探'],
        ['calc', '成分计算']
    ];

    function state() {
        return CHEM.state.alloy = CHEM.state.alloy || {
            tab: 'theory', cat: '全部', kw: '', phase: 'Pb-Sn', calcMode: 'mass'
        };
    }

    /* ------------------------------------------------------------
     *  入口
     * ---------------------------------------------------------- */
    CHEM.pages.alloy = function () {
        const st = state();
        const total = CHEM.stats().reduce((a, s) => a + s.n, 0);
        UI.panel('合金天地', `· ${total} 条数据 ·`,
            UI.tabBar(TABS, st.tab, 'CHEM.alloyTab') + render(st));

        const kw = document.getElementById('alloyKw');
        if (kw) kw.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.alloySearch(); });
        if (st.tab === 'phase') drawPhase();
    };

    CHEM.alloyTab = function (t) { state().tab = t; CHEM.pages.alloy(); };

    function render(st) {
        if (st.tab === 'theory') return theoryHtml();
        if (st.tab === 'table') return tableHtml(st);
        if (st.tab === 'phase') return phaseHtml(st);
        return calcHtml(st);
    }

    /* ------------------------------------------------------------
     *  一、合金总论
     * ---------------------------------------------------------- */
    function theoryHtml() {
        const contrast = [
            ['熔点', '固定熔点', '一般低于任一组成金属的熔点（共晶处最低）'],
            ['硬度 / 强度', '较软、强度低', '硬度和强度通常更高'],
            ['导电导热', '优良', '一般下降（固溶体散射电子）'],
            ['塑性', '较好', '可调范围大，从高塑性到高硬度'],
            ['铸造性', '流动性差、收缩大', '流动性好、可铸造成复杂件'],
            ['耐蚀性', '因金属而异', '可通过合金化显著提高（如加铬、镍）']
        ];
        const structures = [
            ['固溶体', '一种元素的原子溶入另一种金属的晶格', '置换固溶体（Cu-Ni）／间隙固溶体（C 溶于 Fe）', '保持溶剂晶格；固溶强化'],
            ['金属间化合物', '组元按一定比例形成新相', 'Fe₃C、CuZn、Ni₃Al', '硬而脆；高温强度来源'],
            ['机械混合物', '两相机械混合、各自保持晶格', 'Pb-Sn 共晶组织', '性能介于两相之间']
        ];
        const strengthen = [
            ['固溶强化', '溶质原子引起晶格畸变，阻碍位错运动', '加硅、锰、镁'],
            ['细晶强化', '晶粒越细，晶界越多，强度与韧性同时提高', '加钛、钒、铌；快速冷却'],
            ['析出强化', '过饱和固溶体析出细小第二相，钉扎位错', '硬铝时效、高温合金 γ′ 相'],
            ['加工硬化', '冷变形使位错密度增加', '冷轧钢板、冷拔钢丝']
        ];
        const families = [
            ['钢铁材料', '铁碳合金：低碳钢、不锈钢、铸铁、高速钢', '建筑、机械、刀具'],
            ['铝合金', '硬铝、超硬铝、锻铝、铸铝', '飞机、门窗、汽车'],
            ['铜合金', '黄铜、青铜、白铜', '水暖、弹性件、冷凝管'],
            ['钛 / 镁合金', '钛铝钒、镁铝合金', '航空、植入器械、轻量化'],
            ['镍基 / 特种合金', '高温合金、形状记忆合金、硬质合金', '涡轮叶片、支架、刀具']
        ];
        return `
        <div class="note">
            合金是由<b>两种或两种以上元素</b>（其中至少一种是金属）组成、并具有金属特性的物质。
            人类文明正是从青铜（铜锡合金）走向铁器（铁碳合金）的——纯金属往往太软或太贵，
            合金化让我们能按需"定制"材料。
        </div>
        <div class="sec-title" style="margin-top:18px;">合金与纯金属的差异</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>性质</th><th>纯金属</th><th>合金</th></tr></thead><tbody>
            ${contrast.map(r => `<tr><td style="color:#eace9f;font-weight:700;">${r[0]}</td><td class="muted">${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="sec-title" style="margin-top:20px;">合金的三种组织结构</div>
        <div class="fcard-grid">
            ${structures.map((s, i) => `<div class="fcard">
                <div class="fc-top"><span class="fc-icon">${['🧱', '🔷', '🧩'][i]}</span><span class="fc-title">${s[0]}</span></div>
                <div class="fc-desc">${s[1]}<br><span class="gold">例：</span>${s[2]}<br><span class="muted">${s[3]}</span></div>
            </div>`).join('')}
        </div>
        <div class="sec-title" style="margin-top:20px;">四种强化机制</div>
        <div class="list">
            ${strengthen.map(s => `<div class="item">
                <div class="item-head"><span class="item-title">${s[0]}</span></div>
                <div class="item-desc">${s[1]}　<span class="tag tag-gold">${s[2]}</span></div>
            </div>`).join('')}
        </div>
        <div class="sec-title" style="margin-top:20px;">常见合金家族</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>家族</th><th>代表</th><th>典型用途</th></tr></thead><tbody>
            ${families.map(r => `<tr><td style="color:#eace9f;font-weight:700;">${r[0]}</td><td>${r[1]}</td><td class="muted">${r[2]}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="note" style="margin-top:16px;">
            <b>相图</b>是理解合金的钥匙：横轴为成分、纵轴为温度，液相线以上全是液体、固相线以下全是固体。
            切到「相图初探」可交互查看共晶点与组织。想知道某个元素起什么作用，看「合金元素」类数据或直接检索元素符号。
        </div>`;
    }

    /* ------------------------------------------------------------
     *  二、合金大全
     * ---------------------------------------------------------- */
    function tableHtml(st) {
        const rows = CHEM.DB.alloys || [];
        if (!rows.length) return UI.note('未加载 合金.txt', 'err');
        const cats = ['全部'].concat(Array.from(new Set(rows.map(r => r.klass))));
        const kw = st.kw.toLowerCase();
        const list = rows.filter(r =>
            (st.cat === '全部' || r.klass === st.cat) &&
            (!kw || [r.name, r.composition, r.grade, r.feature, r.use].some(v => String(v).toLowerCase().includes(kw))));
        return `
        <div class="field">
            <input type="text" id="alloyKw" placeholder="名称 / 成分 / 牌号 / 用途 … 如 不锈钢、钛、黄铜" value="${esc(st.kw)}" style="flex:3;min-width:200px;">
            <button class="btn btn-primary btn-sm" onclick="CHEM.alloySearch()">检索</button>
            <button class="btn btn-sm" onclick="CHEM.alloyReset()">重置</button>
            <span class="muted" style="font-size:.82rem;">命中 <b class="gold">${list.length}</b> / ${rows.length}</span>
        </div>
        <div class="chip-row" style="margin-bottom:12px;">
            ${cats.map(c => `<span class="chip ${c === st.cat ? 'on' : ''}" onclick="CHEM.alloyCat('${esc(c)}')">${esc(c)} <span class="muted">${c === '全部' ? rows.length : rows.filter(r => r.klass === c).length}</span></span>`).join('')}
        </div>
        <div class="tbl-wrap tbl-scroll"><table class="tbl tbl-rich"><thead><tr>
            <th>名称</th><th>类别</th><th>主要成分</th><th>典型牌号</th><th>密度</th><th>熔点</th><th>特性</th><th>用途</th><th></th>
        </tr></thead><tbody>
            ${list.length ? list.map(r => `<tr class="clickable" onclick="CHEM.alloyDetail('${esc(r.name)}')">
                <td style="color:#f0e4c8;font-weight:700;">${esc(r.name)}</td>
                <td><span class="tag tag-gold">${esc(r.klass)}</span></td>
                <td class="mono" style="font-size:.8rem;">${esc(r.composition)}</td>
                <td class="mono muted" style="font-size:.8rem;">${esc(r.grade)}</td>
                <td class="num" style="font-size:.8rem;">${esc(r.density)}</td>
                <td class="mono muted" style="font-size:.8rem;">${esc(r.melting)}</td>
                <td class="muted" style="font-size:.8rem;">${esc(r.feature)}</td>
                <td class="muted" style="font-size:.8rem;">${esc(r.use)}</td>
                <td style="width:36px;" onclick="event.stopPropagation()">${CHEM.favBtn('合金', r.name, `${r.klass}　${r.composition}　${r.feature}`, 'alloy')}</td>
            </tr>`).join('')
            : `<tr><td colspan="9" class="muted" style="text-align:center;padding:24px;">没有匹配的合金，试试更短的关键词</td></tr>`}
        </tbody></table></div>
        <div class="note">密度单位 g/cm³，熔点单位 ℃。成分中的百分数为质量分数近似值；点击任意行查看完整档案。</div>`;
    }

    CHEM.alloySearch = function () {
        const el = document.getElementById('alloyKw');
        state().kw = el ? el.value.trim() : '';
        CHEM.pages.alloy();
    };
    CHEM.alloyReset = function () { CHEM.state.alloy = { tab: 'table', cat: '全部', kw: '', phase: state().phase, calcMode: state().calcMode }; CHEM.pages.alloy(); };
    CHEM.alloyCat = function (c) { state().cat = c; CHEM.pages.alloy(); };

    CHEM.alloyDetail = function (name) {
        const r = (CHEM.DB.alloys || []).find(x => x.name === name);
        if (!r) return;
        UI.modal(`
            <div class="panel-title" style="font-size:1.32rem;">${esc(r.name)}<span class="sub">${esc(r.klass)}</span></div>
            ${UI.kv([
                ['主要成分', `<span class="mono">${esc(r.composition)}</span>`],
                ['典型牌号', `<span class="mono">${esc(r.grade)}</span>`],
                ['密度', `${esc(r.density)} g/cm³`],
                ['熔点', `${esc(r.melting)} ℃`],
                ['特性', esc(r.feature)],
                ['用途', esc(r.use)]
            ])}
            <div class="field" style="margin-top:16px;">
                ${CHEM.favBtn('合金', r.name, `${r.klass}　${r.composition}　${r.feature}`, 'alloy')}
                <button class="btn btn-sm" onclick="CHEM.ui.closeModal()">关闭</button>
            </div>`);
    };

    /* ------------------------------------------------------------
     *  三、相图初探（Canvas 绘制）
     * ---------------------------------------------------------- */
    function phaseHtml(st) {
        const rows = CHEM.DB.phaseDiagrams || [];
        if (!rows.length) return UI.note('未加载 合金相图.txt', 'err');
        const sys = rows.find(r => r.system === st.phase) || rows[0];
        st.phase = sys.system;
        const types = Array.from(new Set(rows.map(r => r.type)));
        return `
        <div class="note">
            相图横轴为<b>成分</b>（B 的质量分数）、纵轴为<b>温度</b>。液相线以上为液态，固相线以下为固态，
            两线之间液固共存。共晶点上液体同时结晶出两种固相，熔点低于任一纯组元——这正是焊锡能低温熔化焊接的原因。
        </div>
        <div class="chip-row" style="margin:12px 0;">
            ${types.map(t => `<span class="tag ${sys.type === t ? 'tag-gold' : ''}">${esc(t)}</span>`).join('')}
        </div>
        <div class="field">
            <label>选择体系</label>
            <select id="phaseSel" onchange="CHEM.phasePick(this.value)" style="flex:2;min-width:180px;">
                ${rows.map(r => `<option value="${esc(r.system)}" ${r.system === st.phase ? 'selected' : ''}>${esc(r.system)}（${esc(r.type)}）</option>`).join('')}
            </select>
            <span class="muted" style="font-size:.82rem;">共 ${rows.length} 个体系</span>
        </div>
        <div class="phase-wrap" style="border:1px solid var(--line-soft);border-radius:12px;padding:8px;background:rgba(0,0,0,.18);">
            <canvas id="phaseCanvas" style="width:100%;height:360px;display:block;"></canvas>
        </div>
        <div style="margin-top:14px;">${UI.kv([
            ['体系', `<b class="gold">${esc(sys.system)}</b>　${esc(sys.a)} — ${esc(sys.b)}`],
            ['类型', esc(sys.type)],
            ['纯组元熔点', `${esc(sys.a)} ${esc(sys.mpA)} ℃ ／ ${esc(sys.b)} ${esc(sys.mpB)} ℃`],
            ['共晶温度', sys.eutecticT !== '—' ? `<b class="gold">${esc(sys.eutecticT)} ℃</b>` : '—（无共晶点）'],
            ['共晶成分', esc(sys.eutecticC)],
            ['说明', esc(sys.desc)]
        ])}</div>
        <div class="field" style="margin-top:14px;">
            ${CHEM.favBtn('相图', sys.system, `${sys.a}—${sys.b}　${sys.type}　共晶 ${sys.eutecticT}`, 'alloy')}
        </div>`;
    }

    CHEM.phasePick = function (sys) { state().phase = sys; CHEM.pages.alloy(); };

    /* 根据体系数据生成相图曲线（归一化坐标：x=组元B质量分数0..100，y=温度℃） */
    function curvesFor(p) {
        const mpA = parseFloat(p.mpA) || 1000;
        const mpB = parseFloat(p.mpB) || 1000;
        const eT = parseFloat(p.eutecticT);
        const eC = parseFloat(String(p.eutecticC).replace(/[^\d.]/g, '')) || 50;
        const hasEutectic = !isNaN(eT) && p.eutecticT !== '—';

        if (hasEutectic) {
            const solA = Math.max(2, eC * 0.32);
            const solB = Math.min(98, eC + (100 - eC) * 0.32);
            const liquidL = [], liquidR = [];
            for (let i = 0; i <= 20; i++) {
                const c = eC * i / 20;
                const t = eT + (mpA - eT) * Math.pow(1 - i / 20, 1.55);
                liquidL.push([c, t]);
            }
            for (let i = 0; i <= 20; i++) {
                const c = eC + (100 - eC) * i / 20;
                const t = eT + (mpB - eT) * Math.pow(i / 20, 1.55);
                liquidR.push([c, t]);
            }
            return {
                kind: 'eutectic', liquid: [liquidL, liquidR],
                solids: [
                    [[0, mpA], [solA * 0.5, eT + (mpA - eT) * 0.5], [solA, eT]],
                    [[100, mpB], [solB + (100 - solB) * 0.5, eT + (mpB - eT) * 0.5], [solB, eT]]
                ],
                eutectic: { t: eT, c: eC, solA: solA, solB: solB }
            };
        }
        if (/完全固溶/.test(p.type)) {
            const liquid = [], solid = [];
            const amp = Math.min(70, Math.abs(mpA - mpB) * 0.18 + 25);
            for (let i = 0; i <= 24; i++) {
                const f = i / 24, c = f * 100;
                const base = mpA + (mpB - mpA) * f;
                const bulge = amp * Math.sin(Math.PI * f);
                liquid.push([c, base + bulge]);
                solid.push([c, base - bulge]);
            }
            return { kind: 'solid', liquid: [liquid], solids: [solid] };
        }
        /* 包晶型：简化的液相线 + 包晶水平线 + 中间相区 */
        const perT = eT && !isNaN(eT) ? eT : (mpA + mpB) / 2;
        const liquid = [];
        for (let i = 0; i <= 24; i++) {
            const f = i / 24, c = f * 100;
            liquid.push([c, mpA + (mpB - mpA) * Math.pow(f, 1.25)]);
        }
        return { kind: 'peritectic', liquid: [liquid], peritectic: { t: perT, c: eC || 40 } };
    }

    function drawPhase() {
        const canvas = document.getElementById('phaseCanvas');
        if (!canvas || !canvas.getContext) return;
        const st = state();
        const p = (CHEM.DB.phaseDiagrams || []).find(r => r.system === st.phase) || (CHEM.DB.phaseDiagrams || [])[0];
        if (!p) return;
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth || 640, H = canvas.clientHeight || 360;
        canvas.width = W * dpr; canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const pad = { l: 56, r: 22, t: 22, b: 48 };
        const x0 = pad.l, x1 = W - pad.r, y0 = pad.t, y1 = H - pad.b;
        const mpA = parseFloat(p.mpA) || 1000, mpB = parseFloat(p.mpB) || 1000;
        const eT = parseFloat(p.eutecticT);
        const tMax = Math.ceil(Math.max(mpA, mpB, isNaN(eT) ? 0 : eT) * 1.08 / 100) * 100;
        const tMin = isNaN(eT) ? Math.floor(Math.min(mpA, mpB) * 0.55 / 100) * 100 : Math.max(0, Math.floor(eT * 0.55 / 100) * 100);
        const X = c => x0 + (x1 - x0) * c / 100;
        const Y = t => y1 - (y1 - y0) * (t - tMin) / (tMax - tMin);

        /* 网格与刻度 */
        ctx.font = '11px sans-serif';
        ctx.strokeStyle = 'rgba(217,184,119,.10)';
        ctx.fillStyle = '#8a785a';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const yy = y0 + (y1 - y0) * i / 5;
            ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
            const t = Math.round(tMax - (tMax - tMin) * i / 5);
            ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.fillText(String(t), x0 - 8, yy);
        }
        for (let i = 0; i <= 5; i++) {
            const xx = x0 + (x1 - x0) * i / 5;
            ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y1); ctx.stroke();
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(String(i * 20) + '%', xx, y1 + 8);
        }
        ctx.fillStyle = '#a4884f';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(`${esc(p.b)} 的质量分数 →`, (x0 + x1) / 2, H - 6);
        ctx.save();
        ctx.translate(14, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
        ctx.textBaseline = 'top'; ctx.fillText('温度 / ℃', 0, 0);
        ctx.restore();

        const cv = curvesFor(p);

        /* 相区填充 */
        ctx.fillStyle = 'rgba(120,170,210,.07)';
        ctx.fillRect(x0, y0, x1 - x0, 0);
        const drawBand = (pts, color) => {
            if (!pts.length) return;
            ctx.beginPath();
            pts.forEach((pt, i) => { i ? ctx.lineTo(X(pt[0]), Y(pt[1])) : ctx.moveTo(X(pt[0]), Y(pt[1])); });
            ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.stroke();
        };
        cv.liquid.forEach(l => drawBand(l, '#e9cd94'));
        cv.solids.forEach(s => drawBand(s, '#b9a06a'));

        /* 共晶水平线 */
        if (cv.kind === 'eutectic') {
            const ey = Y(cv.eutectic.t);
            ctx.beginPath();
            ctx.moveTo(X(cv.eutectic.solA), ey); ctx.lineTo(X(cv.eutectic.solB), ey);
            ctx.strokeStyle = '#e9cd94'; ctx.lineWidth = 2; ctx.stroke();
            const ecx = X(cv.eutectic.c);
            ctx.beginPath(); ctx.arc(ecx, ey, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = '#e07a5f'; ctx.fill();
            ctx.fillStyle = '#f2d79b'; ctx.font = '12px sans-serif';
            ctx.textAlign = cv.eutectic.c > 60 ? 'right' : 'left'; ctx.textBaseline = 'bottom';
            ctx.fillText(`共晶 ${cv.eutectic.t}℃ / ${esc(p.eutecticC)}`, ecx + (cv.eutectic.c > 60 ? -8 : 8), ey - 8);
            /* 纯组元熔点标注 */
            ctx.fillStyle = '#8a785a'; ctx.font = '11px sans-serif';
            ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
            ctx.fillText(`${esc(p.a)} ${p.mpA}℃`, X(1), Y(mpA) - 6);
            ctx.textAlign = 'right';
            ctx.fillText(`${esc(p.b)} ${p.mpB}℃`, X(99), Y(mpB) - 6);
        } else if (cv.kind === 'peritectic') {
            const py = Y(cv.peritectic.t);
            ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(x1, py);
            ctx.strokeStyle = 'rgba(233,205,148,.6)'; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = '#a4884f'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
            ctx.fillText(`包晶温度约 ${cv.peritectic.t}℃`, x0 + 6, py - 6);
        }

        /* 图例 */
        ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const legend = [['#e9cd94', '液相线'], ['#b9a06a', '固相线 / 溶解度线']];
        legend.forEach((g, i) => {
            const lx = x0 + 10 + i * 130, ly = y0 + 12;
            ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 22, ly);
            ctx.strokeStyle = g[0]; ctx.lineWidth = 2.4; ctx.stroke();
            ctx.fillStyle = '#a4884f'; ctx.fillText(g[1], lx + 28, ly);
        });
    }

    /* ------------------------------------------------------------
     *  四、成分计算
     * ---------------------------------------------------------- */
    const CALC_MODES = [
        ['mass', '质量分数 → 各组分质量'],
        ['percent', '各组分质量 → 质量分数'],
        ['density', '合金密度估算']
    ];

    function calcHtml(st) {
        const mode = st.calcMode || 'mass';
        return `
        <div class="note">
            合金成分通常用<b>质量分数</b>表示。质量分数 → 质量：mᵢ = m总 × wᵢ；
            质量 → 质量分数：wᵢ = mᵢ / Σm；密度按体积加和估算：1/ρ合金 = Σ(wᵢ / ρᵢ)。
        </div>
        <div class="chip-row" style="margin:12px 0;">
            ${CALC_MODES.map(([k, label]) => `<span class="chip ${k === mode ? 'on' : ''}" onclick="CHEM.calcMode('${k}')">${label}</span>`).join('')}
        </div>
        ${mode === 'mass' ? calcMass() : mode === 'percent' ? calcPercent() : calcDensity()}
        <div class="note" style="margin-top:16px;">
            密度估算假设混合前后体积可加和，对形成固溶体或化合物的合金只是近似；
            精密数值请查实测手册（「合金大全」列出了常见合金的实测密度）。
        </div>`;
    }

    function calcMass() {
        return `
        <div class="field">
            <label>合金总质量</label>
            <input type="number" id="cmTotal" value="1000" min="0" step="any" style="width:150px;">
            <label>单位</label>
            <select id="cmUnit"><option value="g">g</option><option value="kg">kg</option></select>
        </div>
        <div class="field"><label>各组分质量分数（%）</label></div>
        <div id="cmRows"></div>
        <div class="field" style="margin-top:10px;">
            <button class="btn btn-sm" onclick="CHEM.cmAdd()">+ 添加组分</button>
            <button class="btn btn-primary btn-sm" onclick="CHEM.cmRun()">计算各组分质量</button>
        </div>
        <div id="cmOut"></div>`;
    }

    function calcPercent() {
        return `
        <div class="field"><label>各组分质量</label></div>
        <div id="cpRows"></div>
        <div class="field" style="margin-top:10px;">
            <button class="btn btn-sm" onclick="CHEM.cpAdd()">+ 添加组分</button>
            <button class="btn btn-primary btn-sm" onclick="CHEM.cpRun()">计算质量分数</button>
        </div>
        <div id="cpOut"></div>`;
    }

    function calcDensity() {
        return `
        <div class="field"><label>各组分：质量分数 w（%）与纯组元密度 ρ（g/cm³）</label></div>
        <div id="cdRows"></div>
        <div class="field" style="margin-top:10px;">
            <button class="btn btn-sm" onclick="CHEM.cdAdd()">+ 添加组分</button>
            <button class="btn btn-primary btn-sm" onclick="CHEM.cdRun()">估算合金密度</button>
        </div>
        <div id="cdOut"></div>`;
    }

    CHEM.calcMode = function (k) { state().calcMode = k; CHEM.pages.alloy(); };

    function ensureRows(id, defaults, cols) {
        const box = document.getElementById(id);
        if (!box) return null;
        if (!box.children.length) {
            defaults.forEach(d => box.insertAdjacentHTML('beforeend', rowHtml(cols, d)));
        }
        return box;
    }

    function rowHtml(cols, d) {
        if (cols === 1) return `<div class="field calc-row">
            <input type="text" placeholder="组分名称" value="${esc(d[0])}" style="width:130px;" class="cname">
            <input type="number" placeholder="数值" value="${d[1]}" step="any" min="0" class="cval" style="width:110px;">
            <button class="btn btn-sm btn-ghost" onclick="CHEM.calcDel(this)">×</button>
        </div>`;
        return `<div class="field calc-row">
            <input type="text" placeholder="组分名称" value="${esc(d[0])}" style="width:130px;" class="cname">
            <input type="number" placeholder="w%" value="${d[1]}" step="any" min="0" class="cw" style="width:92px;">
            <input type="number" placeholder="ρ g/cm³" value="${d[2]}" step="any" min="0" class="crho" style="width:110px;">
            <button class="btn btn-sm btn-ghost" onclick="CHEM.calcDel(this)">×</button>
        </div>`;
    }

    function initCalcRows() {
        ensureRows('cmRows', [['铁', 99], ['碳', 1]], 1);
        ensureRows('cpRows', [['铜', 62], ['锌', 38]], 1);
        ensureRows('cdRows', [['铜', 70, 8.96], ['锌', 30, 7.14]], 2);
    }

    /* 在页面渲染后由 core 的 tab 切换触发；这里挂到 pages.alloy 之后 */
    const _origPage = CHEM.pages.alloy;
    CHEM.pages.alloy = function () {
        _origPage();
        initCalcRows();
    };
    if (CHEM.state && CHEM.state.alloy) initCalcRows();

    CHEM.calcDel = function (btn) {
        const row = btn.closest('.calc-row');
        if (row) row.remove();
    };
    CHEM.cmAdd = function () { document.getElementById('cmRows').insertAdjacentHTML('beforeend', rowHtml(1, ['', ''])); };
    CHEM.cpAdd = function () { document.getElementById('cpRows').insertAdjacentHTML('beforeend', rowHtml(1, ['', ''])); };
    CHEM.cdAdd = function () { document.getElementById('cdRows').insertAdjacentHTML('beforeend', rowHtml(2, ['', '', ''])); };

    function readRows(id, cols) {
        const box = document.getElementById(id);
        if (!box) return [];
        return Array.from(box.querySelectorAll('.calc-row')).map(row => {
            const name = row.querySelector('.cname').value.trim() || '组分';
            if (cols === 1) return { name: name, v: parseFloat(row.querySelector('.cval').value) };
            return { name: name, w: parseFloat(row.querySelector('.cw').value), rho: parseFloat(row.querySelector('.crho').value) };
        });
    }

    function out(html, id) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    CHEM.cmRun = function () {
        const total = parseFloat(document.getElementById('cmTotal').value);
        const unit = document.getElementById('cmUnit').value;
        const rows = readRows('cmRows', 1);
        if (!isFinite(total) || total < 0) { out(UI.note('请输入有效的总质量', 'err'), 'cmOut'); return; }
        const sum = rows.reduce((a, r) => a + (isFinite(r.v) ? r.v : 0), 0);
        if (!rows.length || sum <= 0) { out(UI.note('请至少填写一个大于 0 的质量分数', 'err'), 'cmOut'); return; }
        const norm = Math.abs(sum - 100) > 0.01;
        let h = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>组分</th><th>质量分数</th><th>质量（${unit}）</th></tr></thead><tbody>`;
        rows.forEach(r => {
            const w = (isFinite(r.v) ? r.v : 0) / sum;
            h += `<tr><td>${esc(r.name)}</td><td class="num">${(w * 100).toFixed(2)}%</td><td class="num gold">${(total * w).toFixed(4)} ${unit}</td></tr>`;
        });
        h += `</tbody></table></div>`;
        h += UI.note(`质量分数合计 ${sum.toFixed(2)}%${norm ? '，已按比例归一化到 100% 再计算。' : '。'}`, norm ? 'warn' : 'ok');
        out(h, 'cmOut');
    };

    CHEM.cpRun = function () {
        const rows = readRows('cpRows', 1);
        const sum = rows.reduce((a, r) => a + (isFinite(r.v) ? r.v : 0), 0);
        if (!rows.length || sum <= 0) { out(UI.note('请至少填写一个大于 0 的质量', 'err'), 'cpOut'); return; }
        let h = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>组分</th><th>质量</th><th>质量分数</th></tr></thead><tbody>`;
        rows.forEach(r => {
            h += `<tr><td>${esc(r.name)}</td><td class="num">${(isFinite(r.v) ? r.v : 0).toFixed(4)}</td><td class="num gold">${((isFinite(r.v) ? r.v : 0) / sum * 100).toFixed(2)}%</td></tr>`;
        });
        h += `<tr><td style="font-weight:700;">合计</td><td class="num">${sum.toFixed(4)}</td><td class="num">100.00%</td></tr></tbody></table></div>`;
        out(h, 'cpOut');
    };

    CHEM.cdRun = function () {
        const rows = readRows('cdRows', 2).filter(r => isFinite(r.w) && isFinite(r.rho) && r.rho > 0);
        const sumW = rows.reduce((a, r) => a + r.w, 0);
        if (!rows.length || sumW <= 0) { out(UI.note('请填写各组分的质量分数与正的密度值', 'err'), 'cdOut'); return; }
        const term = rows.reduce((a, r) => a + (r.w / sumW) / r.rho, 0);
        const rho = 1 / term;
        let h = `<div class="note ok" style="font-size:1rem;">估算密度 <b class="gold" style="font-size:1.3rem;">${rho.toFixed(3)} g/cm³</b></div>`;
        h += `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>组分</th><th>质量分数（归一后）</th><th>纯组元密度</th><th>w/ρ</th></tr></thead><tbody>`;
        rows.forEach(r => {
            const w = r.w / sumW;
            h += `<tr><td>${esc(r.name)}</td><td class="num">${(w * 100).toFixed(2)}%</td><td class="num">${r.rho.toFixed(2)}</td><td class="num muted">${(w / r.rho).toFixed(4)}</td></tr>`;
        });
        h += `</tbody></table></div>`;
        if (Math.abs(sumW - 100) > 0.01) h += UI.note(`输入的质量分数合计 ${sumW.toFixed(2)}%，已归一化。`, 'warn');
        out(h, 'cdOut');
    };
})();
