/* ============================================================
 *  js/refs.js —— 速查手册（俗名 / 溶解性 / 离子检验 / 化学常数 / 实验现象）
 * ============================================================ */
(function () {
    'use strict';
    const CHEM = window.CHEM;
    const UI = CHEM.ui;
    const esc = CHEM.util.esc;

    const TABS = [
        ['alias', '俗名对照'],
        ['solubility', '溶解性'],
        ['ions', '离子检验'],
        ['constants', '化学常数'],
        ['experiments', '实验现象']
    ];

    /* 每个分表的列定义与检索范围 */
    const CFG = {
        alias: {
            key: 'aliases', title: '俗名对照', hint: '烧碱、胆矾、小苏打、福尔马林 …', cat: '俗名',
            favTitle: r => `${r.alias}　→　${r.chem}`, favSub: r => `${r.formula}　${r.desc}`,
            note: '同一物质常有多个名字，考题里用俗名、资料里用学名，这里做统一对照。',
            cols: [
                { h: '俗名', k: 'alias', cls: 'strong' },
                { h: '化学名称', k: 'chem', cls: 'goldc' },
                { h: '化学式', k: 'formula', mono: true, pretty: true },
                { h: '说明', k: 'desc', cls: 'muted' }
            ],
            facet: null,
            search: ['alias', 'chem', 'formula', 'desc']
        },
        solubility: {
            key: 'solubility', title: '溶解性表', hint: '白色沉淀、微溶、黄绿色气体 …', cat: '溶解性',
            favTitle: r => `${r.name}　${r.formula}`, favSub: r => `${r.color}　${r.solubility}　${r.klass}　${r.desc}`,
            note: '「不溶」指难溶；判断沉淀生成要同时看溶解性与溶液浓度。',
            cols: [
                { h: '名称', k: 'name', cls: 'strong' },
                { h: '化学式', k: 'formula', mono: true, pretty: true },
                { h: '颜色', k: 'color' },
                { h: '溶解性', k: 'solubility', cls: 'tag' },
                { h: '类别', k: 'klass', cls: 'tag' },
                { h: '说明', k: 'desc', cls: 'muted' }
            ],
            facet: { field: 'solubility', label: '溶解性' },
            search: ['name', 'formula', 'color', 'solubility', 'klass', 'desc']
        },
        ions: {
            key: 'ions', title: '离子检验', hint: 'Cl⁻、SO₄²⁻、Fe³⁺、NH₄⁺ …', cat: '离子检验',
            favTitle: r => r.ion, favSub: r => `${r.method}　→　${r.phenomenon}　${r.desc}`,
            note: '检验题的关键是「试剂 + 现象 + 排除干扰」三件套，缺一不可。',
            cols: [
                { h: '离子', k: 'ion', cls: 'ionc' },
                { h: '检验方法', k: 'method' },
                { h: '现象', k: 'phenomenon', cls: 'goldc' },
                { h: '说明', k: 'desc', cls: 'muted' }
            ],
            facet: null,
            search: ['ion', 'method', 'phenomenon', 'desc']
        },
        constants: {
            key: 'constants', title: '化学常数', hint: '阿伏加德罗、Ksp、燃烧热 …', cat: '常数',
            favTitle: r => `${r.name}${r.symbol && r.symbol !== '—' ? '　' + r.symbol : ''}`,
            favSub: r => `${r.value} ${r.unit}　${r.klass}　${r.desc}`,
            note: '数值随温度略有变化，中学计算一般取这里的近似值。',
            cols: [
                { h: '类别', k: 'klass', cls: 'tag' },
                { h: '名称', k: 'name', cls: 'strong' },
                { h: '符号', k: 'symbol', mono: true, cls: 'goldc' },
                { h: '数值', k: 'value', mono: true, cls: 'num' },
                { h: '单位', k: 'unit', mono: true, cls: 'muted' },
                { h: '说明', k: 'desc', cls: 'muted' }
            ],
            facet: { field: 'klass', label: '类别' },
            search: ['klass', 'name', 'symbol', 'value', 'unit', 'desc']
        },
        experiments: {
            key: 'experiments', title: '实验现象', hint: '燃烧、沉淀、银镜、焰色 …', cat: '实验',
            favTitle: r => r.name, favSub: r => `${r.phenomenon}　${r.conclusion}`,
            note: '现象描述要准确：颜色、状态、气味、发光放热，少一个都可能失分。',
            cols: [
                { h: '实验', k: 'name', cls: 'strong' },
                { h: '现象', k: 'phenomenon', cls: 'goldc' },
                { h: '结论 / 方程式', k: 'conclusion', mono: true, cls: 'eqc' },
                { h: '注意事项', k: 'caution', cls: 'muted' }
            ],
            facet: null,
            search: ['name', 'phenomenon', 'conclusion', 'caution']
        }
    };

    function state() {
        const s = CHEM.state.refs = CHEM.state.refs || { tab: 'alias', kw: '', facet: '' };
        return s;
    }

    CHEM.pages.refs = function () {
        const st = state();
        const cfg = CFG[st.tab] || CFG.alias;
        const rows = CHEM.DB[cfg.key] || [];
        if (!rows.length) {
            UI.panel('速查手册', '', UI.note(`未加载 ${cfg.title} 数据，请检查对应 txt 文件。`, 'err'));
            return;
        }
        const total = CHEM.stats().reduce((a, s) => a + s.n, 0);
        UI.panel('速查手册', `· ${total} 条速查 ·`,
            UI.tabBar(TABS, st.tab, 'CHEM.refTab') + body(cfg, rows));

        const input = document.getElementById('refKw');
        if (input) {
            input.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.refSearch(); });
        }
    };

    function body(cfg, rows) {
        const st = state();
        const kw = st.kw.toLowerCase();
        const facetField = cfg.facet ? cfg.facet.field : null;

        const facets = facetField
            ? Array.from(new Set(rows.map(r => r[facetField]).filter(Boolean)))
            : [];

        let list = rows;
        if (facetField && st.facet) list = list.filter(r => r[facetField] === st.facet);
        if (kw) list = list.filter(r => cfg.search.some(k => String(r[k] || '').toLowerCase().includes(kw)));

        return `
        <div class="field">
            <input type="text" id="refKw" placeholder="${esc(cfg.hint)}" value="${esc(st.kw)}" style="flex:3;min-width:200px;">
            <button class="btn btn-primary btn-sm" onclick="CHEM.refSearch()">检索</button>
            <button class="btn btn-sm" onclick="CHEM.refReset()">重置</button>
            <span class="muted" style="font-size:.82rem;">共 <b class="gold">${list.length}</b> / ${rows.length} 条</span>
        </div>
        ${facets.length ? `<div class="chip-row" style="margin-bottom:12px;">
            <span class="chip ${!st.facet ? 'on' : ''}" onclick="CHEM.refFacet('')">全部</span>
            ${facets.map(f => `<span class="chip ${st.facet === f ? 'on' : ''}" onclick="CHEM.refFacet('${esc(f)}')">${esc(f)} <span class="muted">${rows.filter(r => r[facetField] === f).length}</span></span>`).join('')}
        </div>` : ''}
        <div class="tbl-wrap tbl-scroll">
            <table class="tbl tbl-rich">
                <thead><tr>${cfg.cols.map(c => `<th>${c.h}</th>`).join('')}<th></th></tr></thead>
                <tbody>
                    ${list.length ? list.map(r => `<tr>${cfg.cols.map(c => cell(c, r[c.k])).join('')}
                        <td style="width:36px;">${CHEM.favBtn(cfg.cat, cfg.favTitle(r), cfg.favSub(r), 'refs')}</td></tr>`).join('')
                : `<tr><td colspan="${cfg.cols.length + 1}" class="muted" style="text-align:center;padding:24px;">没有匹配的记录</td></tr>`}
                </tbody>
            </table>
        </div>
        <div class="note">${cfg.note}</div>`;
    }

    const CELL_STYLE = {
        strong: 'color:#f0e4c8;font-weight:700;',
        goldc: 'color:#e9cd94;',
        eqc: 'color:#e9cd94;font-size:.82rem;line-height:1.7;',
        num: 'color:#f2d79b;font-weight:700;font-variant-numeric:tabular-nums;'
    };
    const SOL_TAG = { '不溶': 'tag-err', '微溶': 'tag-warn', '可溶': 'tag-ok', '易溶': 'tag-ok', '极易溶': 'tag-ok', '难溶': 'tag-err', '沉淀': 'tag-gold' };

    function cell(col, raw) {
        const v = raw === undefined || raw === null ? '' : String(raw);
        if (!v) return '<td></td>';
        if (col.cls === 'tag') {
            return `<td><span class="tag ${SOL_TAG[v] || ''}">${esc(v)}</span></td>`;
        }
        if (col.cls === 'ionc') {
            return `<td><span class="mono ion-badge">${esc(v)}</span></td>`;
        }
        const text = col.pretty ? CHEM.prettySafe(v) : v;
        const cls = (col.cls === 'muted' ? 'muted' : '') + (col.mono ? ' mono' : '');
        const style = CELL_STYLE[col.cls];
        return `<td class="${cls.trim()}"${style ? ` style="${style}"` : ''}>${esc(text)}</td>`;
    }

    CHEM.refTab = function (t) {
        const st = state();
        st.tab = t; st.kw = ''; st.facet = '';
        CHEM.pages.refs();
    };
    CHEM.refSearch = function () {
        const el = document.getElementById('refKw');
        state().kw = el ? el.value.trim() : '';
        CHEM.pages.refs();
    };
    CHEM.refFacet = function (f) { state().facet = f; CHEM.pages.refs(); };
    CHEM.refReset = function () { CHEM.state.refs = { tab: state().tab, kw: '', facet: '' }; CHEM.pages.refs(); };
})();
