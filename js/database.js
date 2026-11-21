/* ============================================================
 *  js/database.js —— 数据库（统一检索 / 收藏夹 / 错题本 / 数据源）
 * ============================================================ */
(function () {
    'use strict';
    const CHEM = window.CHEM;
    const UI = CHEM.ui;
    const esc = CHEM.util.esc, store = CHEM.util.store;

    const PAGE = 80;

    /* ---------- 收藏夹 / 错题本 ---------- */
    CHEM.favList = function () { return store.get('fav', []); };
    CHEM.favAdd = function (item) {
        const list = CHEM.favList();
        const key = item.cat + '|' + item.title;
        if (list.some(x => (x.cat + '|' + x.title) === key)) return false;
        list.unshift({
            cat: item.cat, title: item.title, sub: item.sub || '',
            page: item.page || '', t: Date.now()
        });
        store.set('fav', list.slice(0, 400));
        return true;
    };
    CHEM.favRemove = function (i) {
        const list = CHEM.favList();
        list.splice(i, 1);
        store.set('fav', list);
        CHEM.pages.database();
    };
    /* 兼容旧接口 */
    CHEM.favClear = function () {
        if (!confirm('确定清空收藏夹吗？')) return;
        store.set('fav', []);
        CHEM.pages.database();
    };

    function isFav(cat, title) {
        return CHEM.favList().some(x => x.cat === cat && x.title === title);
    }

    /* ---------- 全站通用收藏按钮 ---------- */
    CHEM.favBtn = function (cat, title, sub, page) {
        const on = isFav(cat, title);
        return `<button type="button" class="fav-btn${on ? ' on' : ''}" data-fav="1"
            title="${on ? '已收藏，点击取消' : '加入收藏'}"
            data-fav-cat="${esc(cat)}" data-fav-title="${esc(title)}"
            data-fav-sub="${esc(sub || '')}" data-fav-page="${esc(page || '')}"
            onclick="event.stopPropagation();CHEM.favClick(this)">${on ? '★' : '☆'}</button>`;
    };

    CHEM.favClick = function (el) {
        const cat = el.getAttribute('data-fav-cat');
        const title = el.getAttribute('data-fav-title');
        if (!cat || !title) return;
        if (isFav(cat, title)) {
            const list = CHEM.favList();
            const idx = list.findIndex(x => x.cat === cat && x.title === title);
            if (idx >= 0) { list.splice(idx, 1); store.set('fav', list); }
            el.textContent = '☆';
            el.classList.remove('on');
            el.title = '加入收藏';
            CHEM.toast('已取消收藏');
        } else {
            CHEM.favAdd({
                cat: cat, title: title,
                sub: el.getAttribute('data-fav-sub') || '',
                page: el.getAttribute('data-fav-page') || ''
            });
            el.textContent = '★';
            el.classList.add('on');
            el.title = '已收藏，点击取消';
            CHEM.toast('已加入收藏');
        }
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
        (d.elements || []).forEach(e => rows.push({
            cat: '元素', title: `${e.symbol}　${e.name}`,
            sub: `原子序数 ${e.num}　原子量 ${e.mass}　化合价 ${e.valence}　${e.type}`,
            kw: `${e.symbol} ${e.name} ${e.type} ${e.valence} ${e.props}`, page: 'periodic', act: `CHEM.showElement('${e.symbol}')`
        }));
        (d.molecules || []).forEach(m => rows.push({
            cat: '分子', title: m.name, sub: `${m.formula}　Mr ${m.weight}　${m.type}　${m.desc}`,
            kw: `${m.name} ${m.formula} ${m.type} ${m.desc}`, page: 'molecules'
        }));
        (d.equations || []).forEach(e => rows.push({
            cat: '方程式', title: e.equation, sub: `${e.type}　${e.desc}`,
            kw: `${e.equation} ${e.type} ${e.desc}`, page: 'equations'
        }));
        (d.radicals || []).forEach(r => rows.push({
            cat: '原子团', title: `${r.name}　${r.formula}`, sub: `电荷 ${r.charge}　${r.desc}`,
            kw: `${r.name} ${r.formula} ${r.charge} ${r.desc}`, page: 'radicals'
        }));
        (d.acids || []).forEach(a => rows.push({
            cat: '酸碱', title: `${a.name}　${a.formula}`, sub: `${a.kind}·${a.strength}　${a.pk}　共轭 ${a.conjugate}　${a.desc}`,
            kw: `${a.name} ${a.formula} ${a.kind} ${a.strength} ${a.pk} ${a.desc}`, page: 'acidbase'
        }));
        (d.organics || []).forEach(o => rows.push({
            cat: '有机物', title: `${o.klass}　${o.example}`, sub: `${o.formula}　官能团 ${o.group}　通式 ${o.general}　${o.props}`,
            kw: `${o.klass} ${o.example} ${o.formula} ${o.group} ${o.general} ${o.props}`, page: 'organic'
        }));
        (d.organicReactions || []).forEach(r => rows.push({
            cat: '有机反应', title: r.equation, sub: `${r.type}　条件 ${r.condition}　${r.desc}`,
            kw: `${r.equation} ${r.type} ${r.condition} ${r.desc}`, page: 'organic'
        }));
        (d.indicators || []).forEach(i => rows.push({
            cat: '指示剂', title: `${i.name}　${i.range}`,
            sub: `酸色 ${i.acidColor}　碱色 ${i.baseColor}　${i.use}`,
            kw: `${i.name} ${i.range} ${i.acidColor} ${i.baseColor} ${i.use}`, page: 'acidbase'
        }));
        (d.aliases || []).forEach(a => rows.push({
            cat: '俗名', title: `${a.alias}　→　${a.chem}`,
            sub: `${a.formula}　${a.desc}`,
            kw: `${a.alias} ${a.chem} ${a.formula} ${a.desc}`, page: 'refs'
        }));
        (d.solubility || []).forEach(s => rows.push({
            cat: '溶解性', title: `${s.name}　${s.formula}`,
            sub: `${s.color}　${s.solubility}　${s.klass}　${s.desc}`,
            kw: `${s.name} ${s.formula} ${s.color} ${s.solubility} ${s.klass} ${s.desc}`, page: 'refs'
        }));
        (d.ions || []).forEach(i => rows.push({
            cat: '离子检验', title: i.ion,
            sub: `${i.method}　→　${i.phenomenon}　${i.desc}`,
            kw: `${i.ion} ${i.method} ${i.phenomenon} ${i.desc}`, page: 'refs'
        }));
        (d.constants || []).forEach(c => rows.push({
            cat: '常数', title: `${c.name}${c.symbol && c.symbol !== '—' ? '　' + c.symbol : ''}`,
            sub: `${c.value} ${c.unit}　${c.klass}　${c.desc}`,
            kw: `${c.klass} ${c.name} ${c.symbol} ${c.value} ${c.unit} ${c.desc}`, page: 'refs'
        }));
        (d.experiments || []).forEach(x => rows.push({
            cat: '实验', title: x.name,
            sub: `${x.phenomenon}　${x.conclusion}　注意：${x.caution}`,
            kw: `${x.name} ${x.phenomenon} ${x.conclusion} ${x.caution}`, page: 'refs'
        }));
        (d.questions || []).forEach(q => rows.push({
            cat: '题目', title: q.question, sub: `${q.type}·${q.level}　答案 ${q.answer}　${q.explain}`,
            kw: `${q.question} ${q.type} ${q.explain}`, page: 'practice'
        }));
        return rows;
    }

    let ROW_CACHE = null;
    function allRows() {
        if (!ROW_CACHE) ROW_CACHE = buildRows();
        return ROW_CACHE;
    }
    /* 数据重载后清缓存 */
    CHEM.invalidateRows = function () { ROW_CACHE = null; };

    CHEM.pages.database = function () {
        const st = CHEM.state.db = CHEM.state.db || { tab: 'search', cat: '全部', kw: '', limit: PAGE };
        if (!st.limit) st.limit = PAGE;
        const total = CHEM.totalRecords();
        const nFav = CHEM.favList().length, nWrong = CHEM.wrongList().length;
        const tabs = [
            ['search', '统一检索'],
            ['fav', '收藏夹' + (nFav ? ` (${nFav})` : '')],
            ['wrong', '错题本' + (nWrong ? ` (${nWrong})` : '')],
            ['source', '数据源']
        ];
        UI.panel('数据库', `· ${total} 条记录 ·`, UI.tabBar(tabs, st.tab, 'CHEM.dbTab') + ({
            search: searchHtml, fav: favHtml, wrong: wrongHtml, source: sourceHtml
        })[st.tab]());

        if (st.tab === 'search') {
            const el = document.getElementById('dbKw');
            if (el) {
                el.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.dbSearch(); });
            }
        }
        if (st.tab === 'fav') {
            const el = document.getElementById('favKw');
            if (el && st.favKw) {
                el.addEventListener('keydown', e => { if (e.key === 'Enter') CHEM.favSearch(); });
            }
        }
    };

    CHEM.dbTab = function (t) { CHEM.state.db.tab = t; CHEM.pages.database(); };

    /* ---------- 关键词高亮 ---------- */
    function hl(text, kw) {
        const s = String(text === undefined || text === null ? '' : text);
        if (!kw) return esc(s);
        let re;
        try { re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); }
        catch (e) { return esc(s); }
        let out = '', last = 0, m;
        while ((m = re.exec(s)) !== null) {
            if (m[0] === '') { re.lastIndex++; continue; }
            out += esc(s.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
            last = m.index + m[0].length;
        }
        return out + esc(s.slice(last));
    }

    /* ---------- 统一检索 ---------- */
    function searchHtml() {
        const st = CHEM.state.db;
        const all = allRows();
        const cats = ['全部'].concat(Array.from(new Set(all.map(r => r.cat))));
        const kwRaw = st.kw.trim();
        const kw = kwRaw.toLowerCase();

        let list = all;
        if (st.cat !== '全部') list = list.filter(r => r.cat === st.cat);
        if (kw) list = list.filter(r => (r.title + ' ' + r.sub + ' ' + r.kw).toLowerCase().includes(kw));
        CHEM.state.db._rows = list;

        const isBare = !kw && st.cat === '全部';
        const countOf = c => all.filter(r => r.cat === c).length;

        return `
        <div class="field">
            <input type="text" id="dbKw" placeholder="输入任意关键词：硫酸钡、pH、酯化、Fe3+、胆矾、银镜、Ksp …"
                   value="${esc(st.kw)}" style="flex:3;min-width:220px;">
            <button class="btn btn-primary" onclick="CHEM.dbSearch()">检索</button>
            <button class="btn" onclick="CHEM.dbReset()">重置</button>
            ${!isBare ? `<button class="btn btn-sm" onclick="CHEM.dbExportCSV()">导出结果</button>` : ''}
        </div>
        <div class="chip-row" style="margin-bottom:10px;">
            ${cats.map(c => `<span class="chip ${c === st.cat ? 'on' : ''}" onclick="CHEM.dbCat('${c}')">${c}${c === '全部' ? '' : ` <span class="muted">${countOf(c)}</span>`}</span>`).join('')}
        </div>
        <div class="muted" style="font-size:.8rem;margin-bottom:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span>${isBare ? `库中共 <b class="gold">${all.length}</b> 条记录` : `命中 <b class="gold">${list.length}</b> 条`}</span>
            ${!isBare && list.length > st.limit ? `<span>（已显示前 ${st.limit} 条）</span>` : ''}
            <span style="margin-left:auto;cursor:pointer;color:#a4884f;" onclick="CHEM.dbRandom()">🎲 随便看一条</span>
        </div>
        ${isBare ? overview(all, countOf) : ''}
        <div class="list">
            ${isBare ? '' : list.slice(0, st.limit).map((r, i) => `
                <div class="item">
                    <div class="item-head">
                        <span class="tag tag-gold">${r.cat}</span>
                        <span class="item-title mono">${hl(r.title, kwRaw)}</span>
                        <span style="margin-left:auto;display:flex;gap:6px;flex:none;align-items:center;">
                            ${r.act ? `<button class="btn btn-sm" onclick="${r.act}">查看</button>` : ''}
                            ${CHEM.favBtn(r.cat, r.title, r.sub, r.page)}
                        </span>
                    </div>
                    <div class="item-desc">${hl(r.sub, kwRaw)}</div>
                </div>`).join('')}
        </div>
        ${(!isBare && list.length > st.limit) ? `<div style="text-align:center;margin-top:14px;">
            <button class="btn" onclick="CHEM.dbMore()">继续展开（还有 ${list.length - st.limit} 条）</button></div>` : ''}
        ${(!isBare && list.length === 0) ? UI.note('没有找到匹配的记录，试试更短的关键词，或换个说法（如「胆矾」→「硫酸铜」）。', 'warn') : ''}`;
    }

    function overview(all, countOf) {
        const stats = CHEM.stats();
        const maxN = Math.max.apply(null, stats.map(s => s.n)) || 1;
        return `
        <div class="note">
            输入关键词即可跨库检索，或点上方的分类只看某一类。
            例：<span class="mono">硫酸钡</span>、<span class="mono">pH</span>、<span class="mono">酯化</span>、
            <span class="mono">胆矾</span>、<span class="mono">银镜</span>、<span class="mono">Ksp</span>。
        </div>
        <div class="stat-grid" style="margin-top:12px;">
            ${stats.map(s => `<div class="stat-card" style="cursor:pointer" onclick="CHEM.dbCat('${s.cat}')">
                <div class="n">${s.n}</div><div class="l">${s.label}</div></div>`).join('')}
        </div>
        <div class="sec-title" style="margin:20px 0 10px;">分 类 占 比</div>
        <div class="bar-list">
            ${stats.slice().sort((a, b) => b.n - a.n).map(s => `<div class="bar-row" onclick="CHEM.dbCat('${s.cat}')">
                <span class="bl">${s.label}</span>
                <span class="bar-track"><span class="bar-fill" style="width:${Math.max(2, s.n / maxN * 100).toFixed(1)}%"></span></span>
                <span class="bn">${s.n}</span>
            </div>`).join('')}
        </div>`;
    }

    CHEM.dbSearch = function () {
        const el = document.getElementById('dbKw');
        CHEM.state.db.kw = el ? el.value.trim() : '';
        CHEM.state.db.limit = PAGE;
        CHEM.pages.database();
    };
    CHEM.dbCat = function (c) {
        CHEM.state.db.cat = c;
        CHEM.state.db.limit = PAGE;
        CHEM.pages.database();
    };
    CHEM.dbReset = function () {
        CHEM.state.db = { tab: 'search', cat: '全部', kw: '', limit: PAGE };
        CHEM.pages.database();
    };
    CHEM.dbMore = function () {
        CHEM.state.db.limit += PAGE;
        CHEM.pages.database();
    };
    CHEM.dbRandom = function () {
        const all = allRows();
        if (!all.length) return;
        const r = all[Math.floor(Math.random() * all.length)];
        CHEM.state.db._random = r;
        UI.modal(`<div class="panel-title" style="font-size:1.3rem;">${esc(r.cat)}<span class="sub">随机一条</span></div>
            <div class="mono" style="font-size:1.02rem;color:#f4e3bb;line-height:1.8;">${esc(r.title)}</div>
            <div class="divider"></div>
            <div style="color:#c9b795;font-size:.9rem;line-height:1.9;">${esc(r.sub)}</div>
            <div class="field" style="margin-top:16px;">
                <button class="btn btn-sm" onclick="CHEM.dbStarRandom()">收藏</button>
                <button class="btn btn-sm" onclick="CHEM.ui.closeModal();CHEM.go('${r.page}')">前往相关页面</button>
            </div>`);
    };
    CHEM.dbStarRandom = function () {
        const r = CHEM.state.db._random;
        if (!r) return;
        CHEM.toast(CHEM.favAdd({ cat: r.cat, title: r.title, sub: r.sub }) ? '已加入收藏' : '已在收藏中');
    };

    CHEM.dbStar = function (cat, title, sub) {
        CHEM.toast(CHEM.favAdd({ cat, title, sub }) ? '已加入收藏' : '已在收藏中');
    };

    /* ---------- 导出检索结果为 CSV ---------- */
    CHEM.dbExportCSV = function () {
        const rows = CHEM.state.db._rows || [];
        if (!rows.length) { CHEM.toast('当前没有结果可导出'); return; }
        const q = v => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';
        const csv = '\uFEFF类别,标题,摘要\n' + rows.map(r => [r.cat, r.title, r.sub].map(q).join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `化学数据库-检索结果-${rows.length}条.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        CHEM.toast(`已导出 ${rows.length} 条`);
    };

    /* ---------- 收藏夹 ---------- */
    function ago(t) {
        if (!t) return '';
        const d = Date.now() - t;
        if (d < 60e3) return '刚刚';
        if (d < 3600e3) return Math.floor(d / 60e3) + ' 分钟前';
        if (d < 86400e3) return Math.floor(d / 3600e3) + ' 小时前';
        if (d < 30 * 86400e3) return Math.floor(d / 86400e3) + ' 天前';
        const dt = new Date(t);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }

    function favHtml() {
        const list = CHEM.favList();
        const st = CHEM.state.db;
        const kw = (st.favKw || '').trim().toLowerCase();
        const cats = {};
        list.forEach(f => { cats[f.cat] = (cats[f.cat] || 0) + 1; });

        let shown = list.map((f, i) => ({ f: f, i: i }));
        if (kw) shown = shown.filter(o => (o.f.cat + o.f.title + ' ' + (o.f.sub || '')).toLowerCase().includes(kw));
        if (st.favCat) shown = shown.filter(o => o.f.cat === st.favCat);

        return `
        <div class="field">
            <input type="text" id="favKw" placeholder="在收藏里搜索 …" value="${esc(st.favKw || '')}" style="flex:2;min-width:170px;"
                   onkeydown="if(event.key==='Enter')CHEM.favSearch()">
            <button class="btn btn-primary btn-sm" onclick="CHEM.favSearch()">检索</button>
            <button class="btn btn-sm" style="margin-left:auto;" onclick="CHEM.exportJSON()">导出 JSON</button>
            ${list.length ? `<button class="btn btn-sm" onclick="CHEM.favClear()">清空</button>` : ''}
        </div>
        ${list.length ? `<div class="chip-row" style="margin-bottom:12px;">
            <span class="chip ${!st.favCat ? 'on' : ''}" onclick="CHEM.favCat('')">全部 <span class="muted">${list.length}</span></span>
            ${Object.keys(cats).map(c => `<span class="chip ${st.favCat === c ? 'on' : ''}" onclick="CHEM.favCat('${esc(c)}')">${esc(c)} <span class="muted">${cats[c]}</span></span>`).join('')}
        </div>` : ''}
        ${list.length === 0 ? UI.note('还没有收藏。元素、分子、方程式、原子团、酸碱、有机反应、速查表的每一行都带 ☆ 按钮，点一下即可收藏到这里。') :
            (shown.length === 0 ? UI.note('没有匹配的收藏项。', 'warn') : `
        <div class="list">
            ${shown.map(o => {
                const f = o.f;
                return `<div class="item">
                <div class="item-head">
                    <span class="tag tag-gold">${esc(f.cat)}</span>
                    <span class="item-title mono">${esc(f.title)}</span>
                    <span class="muted" style="font-size:.72rem;margin-left:auto;flex:none;">${ago(f.t)}</span>
                    ${f.page ? `<button class="btn btn-sm" style="flex:none;" onclick="CHEM.favOpen('${esc(f.page)}')">前往</button>` : ''}
                    <button class="btn btn-sm" style="flex:none;" onclick="CHEM.favRemove(${o.i})">删除</button>
                </div>
                ${f.sub ? `<div class="item-desc">${esc(f.sub)}</div>` : ''}
            </div>`;
            }).join('')}
        </div>`)}
        <div class="note" style="margin-top:14px;">
            收藏保存在本机浏览器（localStorage），共 ${list.length} 条 · 上限 400 条。
            清理浏览器数据会丢失，重要内容请用「导出 JSON」备份。
        </div>`;
    }
    CHEM.favSearch = function () {
        const el = document.getElementById('favKw');
        CHEM.state.db.favKw = el ? el.value.trim() : '';
        CHEM.pages.database();
    };
    CHEM.favCat = function (c) {
        CHEM.state.db.favCat = c;
        CHEM.pages.database();
    };
    CHEM.favOpen = function (page) {
        if (CHEM.pages[page]) CHEM.go(page);
    };

    /* ---------- 错题本 ---------- */
    function wrongHtml() {
        const list = CHEM.wrongList();
        return `
        <div class="field">
            <span class="muted" style="font-size:.82rem;">练习中答错的题会自动收进这里，方便回头重做。</span>
            ${list.length ? `<button class="btn btn-sm" style="margin-left:auto;" onclick="CHEM.wrongClear()">清空</button>` : ''}
        </div>
        ${list.length === 0 ? UI.note('错题本还是空的。去「练一练」做几道题吧。') : `
        <div class="list">
            ${list.map((q, i) => `<div class="item">
                <div class="item-head">
                    <span class="tag tag-gold">${esc(q.type || '')}</span>
                    <span class="tag">${esc(q.level || '')}</span>
                    <span class="item-title" style="font-weight:400;font-size:.92rem;">${esc(q.question)}</span>
                    <button class="btn btn-sm" style="margin-left:auto;flex:none;" onclick="CHEM.wrongRemove(${i})">删除</button>
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
        const loaded = stats.filter(s => s.n > 0).length;
        return `
        ${UI.kv([
            ['加载方式', CHEM.source === 'files' ? '实时读取同目录 txt（http/https）' : CHEM.source === 'snapshot' ? '离线快照 db.js（file:// 直接打开）' : '数据缺失'],
            ['记录总数', `${total} 条 / ${stats.length} 类（已载入 ${loaded} 类）`],
            ['方程式索引', (CHEM.eqIndex ? Object.keys(CHEM.eqIndex).length : 0) + ' 条（用于多解方程式的系数比对）'],
            ['收藏 / 错题', `${CHEM.favList().length} 条收藏 · ${CHEM.wrongList().length} 道错题（本机保存）`],
            ['字段规范', '各表首行为表头，逗号分隔，含逗号的字段用英文双引号包裹']
        ])}
        <div class="divider"></div>
        <div class="tbl-wrap tbl-scroll" style="max-height:none;">
        <table class="tbl"><thead><tr><th>数据文件</th><th>类别</th><th>条数</th><th>状态</th></tr></thead><tbody>
            ${stats.map(s => `<tr>
                <td class="mono">${s.file}</td><td>${s.label}</td><td class="num">${s.n}</td>
                <td>${s.n > 0 ? '<span class="ok-text">✓ 已载入</span>' : '<span class="err-text">✗ 缺失</span>'}</td>
            </tr>`).join('')}
            <tr><td colspan="2" style="text-align:right;color:#a4884f;">合计</td>
                <td class="num" style="color:#f4e3bb;font-weight:700;">${total}</td><td></td></tr>
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
