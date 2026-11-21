/* ============================================================
 *  js/database.js —— 数据库（统一检索 / 收藏夹 / 错题本 / 数据源）
 * ============================================================ */
(function () {
    'use strict';
    const CHEM = window.CHEM;
    const UI = CHEM.ui;
    const esc = CHEM.util.esc, store = CHEM.util.store;

    const TABS = [['search', '统一检索'], ['fav', '收藏夹'], ['wrong', '错题本'], ['source', '数据源']];

    /* ---------- 收藏夹 / 错题本 ---------- */
    CHEM.favList = function () { return store.get('fav', []); };
    CHEM.favAdd = function (item) {
        const list = CHEM.favList();
        const key = item.cat + '|' + item.title;
        if (list.some(x => (x.cat + '|' + x.title) === key)) return false;
        list.unshift({ cat: item.cat, title: item.title, sub: item.sub || '', t: Date.now() });
        store.set('fav', list.slice(0, 300));
        return true;
    };
    CHEM.favRemove = function (i) {
        const list = CHEM.favList();
        list.splice(i, 1);
        store.set('fav', list);
        CHEM.pages.database();
    };
    CHEM.wrongList = function () { return store.get('wrong', []); };
    CHEM.wrongAdd = function (q) {
        const list = CHEM.wrongList();
        if (list.some(x => x.question === q.question)) return false;
        list.unshift(Object.assign({}, q, { t: Date.now() }));
        store.set('wrong', list.slice(0, 300));
        return true;
    };
    CHEM.wrongRemove = function (i) {
        const list = CHEM.wrongList();
        list.splice(i, 1);
        store.set('wrong', list);
        CHEM.pages.database();
    };
    CHEM.wrongClear = function () {
        if (!confirm('确定清空全部错题吗？')) return;
        store.set('wrong', []);
        CHEM.pages.database();
    };

    /* ---------- 检索索引 ---------- */
    function buildRows() {
        const rows = [];
        const d = CHEM.DB;
        d.elements.forEach(e => rows.push({
            cat: '元素', title: `${e.symbol}　${e.name}`,
            sub: `原子序数 ${e.num}　原子量 ${e.mass}　化合价 ${e.valence}　${e.type}`,
            kw: `${e.symbol} ${e.name} ${e.type} ${e.valence} ${e.props}`, page: 'periodic', act: `CHEM.showElement('${e.symbol}')`
        }));
        d.molecules.forEach(m => rows.push({
            cat: '分子', title: m.name, sub: `${m.formula}　Mr ${m.weight}　${m.type}　${m.desc}`,
            kw: `${m.name} ${m.formula} ${m.type} ${m.desc}`, page: 'molecules'
        }));
        d.equations.forEach(e => rows.push({
            cat: '方程式', title: e.equation, sub: `${e.type}　${e.desc}`,
            kw: `${e.equation} ${e.type} ${e.desc}`, page: 'equations'
        }));
        d.radicals.forEach(r => rows.push({
            cat: '原子团', title: `${r.name}　${r.formula}`, sub: `电荷 ${r.charge}　${r.desc}`,
            kw: `${r.name} ${r.formula} ${r.charge} ${r.desc}`, page: 'radicals'
        }));
        d.acids.forEach(a => rows.push({
            cat: '酸碱', title: `${a.name}　${a.formula}`, sub: `${a.kind}·${a.strength}　${a.pk}　共轭 ${a.conjugate}　${a.desc}`,
            kw: `${a.name} ${a.formula} ${a.kind} ${a.strength} ${a.pk} ${a.desc}`, page: 'acidbase'
        }));
        d.organics.forEach(o => rows.push({
            cat: '有机物', title: `${o.klass}　${o.example}`, sub: `${o.formula}　官能团 ${o.group}　通式 ${o.general}　${o.props}`,
            kw: `${o.klass} ${o.example} ${o.formula} ${o.group} ${o.general} ${o.props}`, page: 'organic'
        }));
        d.organicReactions.forEach(r => rows.push({
            cat: '有机反应', title: r.equation, sub: `${r.type}　条件 ${r.condition}　${r.desc}`,
            kw: `${r.equation} ${r.type} ${r.condition} ${r.desc}`, page: 'organic'
        }));
        d.indicators.forEach(i => rows.push({
            cat: '指示剂', title: `${i.name}　${i.range}`,
            sub: `酸色 ${i.acidColor}　碱色 ${i.baseColor}　${i.use}`,
            kw: `${i.name} ${i.range} ${i.acidColor} ${i.baseColor} ${i.use}`, page: 'acidbase'
        }));
        d.questions.forEach(q => rows.push({
            cat: '题目', title: q.question, sub: `${q.type}·${q.level}　答案 ${q.answer}　${q.explain}`,
            kw: `${q.question} ${q.type} ${q.explain}`, page: 'practice'
        }));
        return rows;
    }

    CHEM.pages.database = function () {
        const st = CHEM.state.db = CHEM.state.db || { tab: 'search', cat: '全部', kw: '' };
        const total = Object.keys(CHEM.DB).reduce((a, k) => a + CHEM.DB[k].length, 0);
        UI.panel('数据库', `· ${total} 条记录 ·`, UI.tabBar(TABS, st.tab, 'CHEM.dbTab') + ({
            search: searchHtml, fav: favHtml, wrong: wrongHtml, source: sourceHtml
        })[st.tab]());

        if (st.tab === 'search') {
            const el = document.getElementById('dbKw');
            if (el) { el.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.dbSearch(); }); setTimeout(() => el.focus(), 50); }
        }
    };

    CHEM.dbTab = function (t) { CHEM.state.db.tab = t; CHEM.pages.database(); };

    /* ---------- 统一检索 ---------- */
    function searchHtml() {
        const st = CHEM.state.db;
        const all = buildRows();
        const cats = ['全部'].concat(Array.from(new Set(all.map(r => r.cat))));
        const kw = st.kw.toLowerCase();
        let list = all;
        if (st.cat !== '全部') list = list.filter(r => r.cat === st.cat);
        if (kw) list = list.filter(r => (r.title + ' ' + r.sub + ' ' + r.kw).toLowerCase().includes(kw));
        const LIMIT = 100;
        CHEM.state.db._rows = list;

        return `
        <div class="field">
            <input type="text" id="dbKw" placeholder="输入任意关键词：硫酸钡、pH、酯化、Fe3+、配平 …" value="${esc(st.kw)}" style="flex:3;min-width:220px;">
            <button class="btn btn-primary" onclick="CHEM.dbSearch()">检索</button>
            <button class="btn" onclick="CHEM.dbReset()">重置</button>
        </div>
        <div class="chip-row" style="margin-bottom:10px;">
            ${cats.map(c => `<span class="chip" style="border-color:${c === st.cat ? '#c9a86a' : '#5a3f22'};color:${c === st.cat ? '#eace9f' : '#d4c09a'}" onclick="CHEM.dbCat('${c}')">${c}</span>`).join('')}
        </div>
        <div class="muted" style="font-size:.82rem;margin-bottom:8px;">
            ${kw || st.cat !== '全部' ? `命中 <b class="gold">${list.length}</b> 条` : `库中共 <b class="gold">${list.length}</b> 条记录`}
            ${(kw || st.cat !== '全部') && list.length > LIMIT ? `（仅显示前 ${LIMIT} 条，请细化关键词）` : ''}
        </div>
        ${(!kw && st.cat === '全部') ? `
        <div class="note">
            输入关键词即可跨库检索，或点上方的分类只看某一类。
            例：<span class="mono">硫酸钡</span>、<span class="mono">pH</span>、<span class="mono">酯化</span>、
            <span class="mono">Fe3+</span>、<span class="mono">缓冲</span>、<span class="mono">消去</span>。
        </div>
        <div class="stat-grid" style="margin-top:12px;">
            ${CHEM.stats().map(s => `<div class="stat-card" style="cursor:pointer" onclick="CHEM.dbCat('${s.cat}')">
                <div class="n">${s.n}</div><div class="l">${s.label}</div></div>`).join('')}
        </div>` : ''}
        <div class="list">
            ${(!kw && st.cat === '全部') ? '' : list.slice(0, LIMIT).map(r => `
                <div class="item">
                    <div class="item-head">
                        <span class="tag tag-gold">${r.cat}</span>
                        <span class="item-title mono">${esc(r.title)}</span>
                        <span style="margin-left:auto;display:flex;gap:6px;">
                            ${r.act ? `<button class="btn btn-sm" onclick="${r.act}">查看</button>` : ''}
                            <button class="btn btn-sm" onclick="CHEM.dbStarAt(${list.indexOf(r)})">☆</button>
                        </span>
                    </div>
                    <div class="item-desc">${esc(r.sub)}</div>
                </div>`).join('')}
        </div>
        ${list.length === 0 ? UI.note('没有找到匹配的记录，试试更短的关键词。', 'warn') : ''}`;
    }

    CHEM.dbSearch = function () {
        CHEM.state.db.kw = document.getElementById('dbKw').value.trim();
        CHEM.pages.database();
    };
    CHEM.dbCat = function (c) { CHEM.state.db.cat = c; CHEM.pages.database(); };
    CHEM.dbReset = function () { CHEM.state.db = { tab: 'search', cat: '全部', kw: '' }; CHEM.pages.database(); };
    CHEM.dbStar = function (cat, title, sub) {
        CHEM.toast(CHEM.favAdd({ cat, title, sub }) ? '已加入收藏' : '已在收藏中');
    };
    CHEM.dbStarAt = function (i) {
        const r = (CHEM.state.db._rows || [])[i];
        if (!r) return;
        CHEM.toast(CHEM.favAdd({ cat: r.cat, title: r.title, sub: r.sub }) ? '已加入收藏' : '已在收藏中');
    };

    /* ---------- 收藏夹 ---------- */
    function favHtml() {
        const list = CHEM.favList();
        return `
        <div class="field">
            <span class="muted" style="font-size:.85rem;">收藏保存在本机浏览器（localStorage），换设备或清理缓存会丢失。</span>
            <button class="btn btn-sm" style="margin-left:auto;" onclick="CHEM.exportJSON()">导出 JSON</button>
            ${list.length ? `<button class="btn btn-sm" onclick="CHEM.favClear()">清空</button>` : ''}
        </div>
        ${list.length === 0 ? UI.note('还没有收藏。在「统一检索」或配平结果里点 ☆ 即可收藏。') : `
        <div class="list">
            ${list.map((f, i) => `<div class="item">
                <div class="item-head">
                    <span class="tag tag-gold">${esc(f.cat)}</span>
                    <span class="item-title mono">${esc(f.title)}</span>
                    <button class="btn btn-sm" style="margin-left:auto;" onclick="CHEM.favRemove(${i})">删除</button>
                </div>
                ${f.sub ? `<div class="item-desc">${esc(f.sub)}</div>` : ''}
            </div>`).join('')}
        </div>`}`;
    }
    CHEM.favClear = function () {
        if (!confirm('确定清空收藏夹吗？')) return;
        store.set('fav', []);
        CHEM.pages.database();
    };

    /* ---------- 错题本 ---------- */
    function wrongHtml() {
        const list = CHEM.wrongList();
        return `
        <div class="field">
            <span class="muted" style="font-size:.85rem;">练习中答错的题会自动收进这里，方便回头重做。</span>
            ${list.length ? `<button class="btn btn-sm" style="margin-left:auto;" onclick="CHEM.wrongClear()">清空</button>` : ''}
        </div>
        ${list.length === 0 ? UI.note('错题本还是空的。去「练一练」做几道题吧。') : `
        <div class="list">
            ${list.map((q, i) => `<div class="item">
                <div class="item-head">
                    <span class="tag tag-gold">${esc(q.type || '')}</span>
                    <span class="tag">${esc(q.level || '')}</span>
                    <span class="item-title" style="font-weight:400;font-size:.95rem;">${esc(q.question)}</span>
                    <button class="btn btn-sm" style="margin-left:auto;" onclick="CHEM.wrongRemove(${i})">删除</button>
                </div>
                <div class="item-desc">
                    ${['A', 'B', 'C', 'D'].map(L => q[L] ? `<span class="muted">${L}. ${esc(q[L])}　</span>` : '').join('')}
                    <br><span class="ok-text">正确答案 ${esc(q.answer)}</span>　${esc(q.explain || '')}
                </div>
            </div>`).join('')}
        </div>`}`;
    }

    /* ---------- 数据源 ---------- */
    function sourceHtml() {
        const stats = CHEM.stats();
        const total = stats.reduce((a, s) => a + s.n, 0);
        return `
        ${UI.kv([
            ['加载方式', CHEM.source === 'files' ? '实时读取同目录 txt（http/https）' : CHEM.source === 'snapshot' ? '离线快照 db.js（file:// 直接打开）' : '数据缺失'],
            ['记录总数', total + ' 条'],
            ['方程式索引', (CHEM.eqIndex ? Object.keys(CHEM.eqIndex).length : 0) + ' 条（用于多解方程式的系数比对）'],
            ['字段规范', '各表首行为表头，逗号分隔，含逗号的字段用英文双引号包裹']
        ])}
        <div class="divider"></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>数据文件</th><th>用途</th><th>条数</th><th>状态</th></tr></thead><tbody>
            ${stats.map(s => `<tr>
                <td class="mono">${s.file}</td><td>${s.label}</td><td class="num">${s.n}</td>
                <td>${s.n > 0 ? '<span class="ok-text">✓ 已载入</span>' : '<span class="err-text">✗ 缺失</span>'}</td>
            </tr>`).join('')}
        </tbody></table></div>
        <div class="note">
            <b>扩充数据</b>：直接编辑对应 txt（保持表头与列顺序），然后在仓库根目录执行
            <span class="mono">node tools/build_db.js</span> 重新生成 db.js 快照即可。运行
            <span class="mono">node tools/test_core.js</span> 可检验配平引擎是否仍正常。
        </div>
        <div class="note warn">
            直接双击 index.html 时浏览器禁止读取本地文件（fetch 被拦截），此时页面自动使用 db.js 快照；
            如需读取最新 txt，请用本地服务器：<span class="mono">python -m http.server</span> 后访问 localhost:8000。
        </div>`;
    }

    /* ---------- 导出 ---------- */
    CHEM.exportJSON = function () {
        const data = { fav: CHEM.favList(), wrong: CHEM.wrongList(), exported: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'huaxue-我的数据.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        CHEM.toast('已导出');
    };
})();
