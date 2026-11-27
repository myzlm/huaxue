#!/usr/bin/env node
/* ============================================================
 *  tools/build_db.js
 *  把仓库根目录下的 *.txt 数据文件编译成 db.js（离线数据库快照）。
 *
 *  为什么需要它：
 *    index.html 默认用 fetch 读取同目录 txt（需要 http 服务）。
 *    若直接双击打开（file:// 协议），浏览器会拦截 fetch，
 *    此时 index.html 会退回到 db.js 里内嵌的数据。
 *
 *  用法：node tools/build_db.js
 *        （改完任意 txt 后重新运行一次即可）
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* CSV 解析：支持双引号包裹含逗号的字段 */
function parseCSVLine(line) {
    const parts = [];
    let cur = '';
    let inQuotes = false;
    for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === ',' && !inQuotes) { parts.push(cur.trim()); cur = ''; }
        else cur += ch;
    }
    parts.push(cur.trim());
    return parts.map(p => p.replace(/^"|"$/g, '').trim());
}

/* 每个数据文件的字段映射表 */
const SCHEMAS = {
    '原子.txt': {
        key: 'elements',
        fields: ['symbol', 'name', 'num', 'mass', 'valence', 'type', 'group', 'period', 'electron', 'year', 'discoverer', 'props'],
        required: 6,
        transform: r => { r.name = (r.name || '').split('(')[0].trim(); return r; }
    },
    '方程式.txt': { key: 'equations', fields: ['type', 'equation', 'desc'], required: 3 },
    '分子.txt': { key: 'molecules', fields: ['name', 'formula', 'weight', 'type', 'desc'], required: 5 },
    '原子团.txt': { key: 'radicals', fields: ['name', 'formula', 'charge', 'desc'], required: 4 },
    '问题.txt': {
        key: 'questions',
        fields: ['type', 'level', 'question', 'A', 'B', 'C', 'D', 'answer', 'explain'],
        required: 8,
        /* 兼容旧的 8 列格式：类型,问题,A,B,C,D,答案,解析 */
        transform: (r, raw) => {
            if (raw.length === 8) {
                return {
                    type: raw[0], level: '易', question: raw[1],
                    A: raw[2], B: raw[3], C: raw[4], D: raw[5],
                    answer: raw[6], explain: raw[7]
                };
            }
            return r;
        }
    },
    '酸碱.txt': { key: 'acids', fields: ['name', 'formula', 'kind', 'strength', 'pk', 'conjugate', 'desc'], required: 5 },
    '指示剂.txt': { key: 'indicators', fields: ['name', 'range', 'acidColor', 'baseColor', 'use'], required: 4 },
    '有机物.txt': { key: 'organics', fields: ['klass', 'example', 'formula', 'group', 'general', 'props'], required: 5 },
    '有机反应.txt': { key: 'organicReactions', fields: ['type', 'equation', 'condition', 'desc'], required: 4 },
    '俗名.txt': { key: 'aliases', fields: ['alias', 'chem', 'formula', 'desc'], required: 4 },
    '溶解性.txt': { key: 'solubility', fields: ['name', 'formula', 'color', 'solubility', 'klass', 'desc'], required: 6 },
    '离子检验.txt': { key: 'ions', fields: ['ion', 'method', 'phenomenon', 'desc'], required: 4 },
    '化学常数.txt': { key: 'constants', fields: ['klass', 'name', 'symbol', 'value', 'unit', 'desc'], required: 6 },
    '实验.txt': { key: 'experiments', fields: ['name', 'phenomenon', 'conclusion', 'caution'], required: 4 },
    '反应现象.txt': { key: 'reactions', fields: ['a', 'b', 'phenomenon', 'equation', 'desc', 'danger'], required: 6 },
    '实验步骤.txt': { key: 'procedures', fields: ['name', 'klass', 'tools', 'steps', 'phenomenon', 'conclusion', 'safety'], required: 7 },
    '器材.txt': { key: 'labware', fields: ['name', 'klass', 'use', 'points', 'caution'], required: 5 },
    '合金.txt': { key: 'alloys', fields: ['name', 'klass', 'composition', 'grade', 'density', 'melting', 'feature', 'use'], required: 8 },
    '合金元素.txt': { key: 'alloyElements', fields: ['name', 'symbol', 'apply', 'role', 'effect', 'desc'], required: 6 },
    '合金相图.txt': { key: 'phaseDiagrams', fields: ['system', 'type', 'a', 'b', 'mpA', 'mpB', 'eutecticT', 'eutecticC', 'desc'], required: 9 }
};

function readTable(file) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) return { rows: [], missing: true };
    const text = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    const schema = SCHEMAS[file];
    const rows = [];
    const warnings = [];
    for (let i = 1; i < lines.length; i++) {
        const raw = parseCSVLine(lines[i]);
        if (raw.length < schema.required) {
            warnings.push(`第 ${i + 1} 行字段不足（${raw.length}/${schema.required}）：${lines[i].slice(0, 40)}`);
            continue;
        }
        if (raw.length > schema.fields.length) {
            warnings.push(`第 ${i + 1} 行字段过多（${raw.length}/${schema.fields.length}）：${lines[i].slice(0, 40)}`);
        }
        const row = {};
        schema.fields.forEach((f, idx) => { row[f] = raw[idx] !== undefined ? raw[idx] : ''; });
        rows.push(schema.transform ? schema.transform(row, raw) : row);
    }
    return { rows, warnings };
}

function main() {
    const db = {};
    const report = [];
    let totalWarnings = 0;

    for (const file of Object.keys(SCHEMAS)) {
        const { rows, warnings = [], missing } = readTable(file);
        if (missing) {
            report.push(`  ✗ ${file} 不存在`);
            db[SCHEMAS[file].key] = [];
            continue;
        }
        db[SCHEMAS[file].key] = rows;
        report.push(`  ✓ ${file.padEnd(10, ' ')} → ${SCHEMAS[file].key.padEnd(17, ' ')} ${String(rows.length).padStart(4, ' ')} 条`);
        warnings.forEach(w => { totalWarnings++; report.push(`      ! ${w}`); });
    }

    const payload = {
        generated: new Date().toISOString(),
        version: '3.3',
        data: db
    };

    const js = `/* ============================================================\n`
        + ` *  db.js —— 由 tools/build_db.js 自动生成，请勿手动编辑\n`
        + ` *  生成时间：${payload.generated}\n`
        + ` *  用途：file:// 直接打开时的离线数据库快照（fetch 失败时兜底）\n`
        + ` *  重新生成：node tools/build_db.js\n`
        + ` * ============================================================ */\n`
        + `window.CHEM_DB = ${JSON.stringify(payload, null, 0)};\n`;

    fs.writeFileSync(path.join(ROOT, 'db.js'), js, 'utf8');

    console.log('数据编译完成：\n' + report.join('\n'));
    const sizes = Object.entries(db).map(([k, v]) => `${k}:${v.length}`).join('  ');
    console.log(`\n总计 ${Object.values(db).reduce((a, b) => a + b.length, 0)} 条记录  (${sizes})`);
    console.log(`db.js 已生成，约 ${(Buffer.byteLength(js) / 1024).toFixed(1)} KB`);
    if (totalWarnings) {
        console.log(`\n⚠ 发现 ${totalWarnings} 处数据格式警告，请检查上方列表`);
        process.exitCode = 0;
    }
}

main();
