import { STORE_CONFIG, allStoreNames } from './config.js';

/* ============================================
   EXPORTAÇÃO DE RELATÓRIOS POR LOJA
   Relatório profissional (HTML imprimível/PDF)
   ============================================ */

const numberFormatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});
const decimalFormatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
});

export const formatNumber = (num, decimals = 0) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return (decimals === 0 ? numberFormatter : decimalFormatter).format(num);
};

export { numberFormatter, decimalFormatter };

export const buildNarrative = (store, date, value, meta, achievement, delta) => {
    const gap = meta - value;
    const achStr = formatNumber(achievement, 1);
    const deltaStr = formatNumber(delta, 1);
    const absDeltaStr = formatNumber(Math.abs(delta), 1);

    if (achievement >= 100) {
        if (delta !== null && delta > 0) {
            return `A unidade ${store} registrou desempenho positivo em ${date}, superando a meta estabelecida com ${value} vendas — ${achStr}% do objetivo. O crescimento de ${deltaStr}% em relação ao período anterior reforça a consistência da equipe e a eficácia das estratégias aplicadas. Recomenda-se manter o ritmo e aprimorar as práticas que conduziram a este resultado.`;
        }
        return `A unidade ${store} atingiu e superou a meta em ${date}, totalizando ${value} vendas — ${achStr}% do objetivo. Este resultado demonstra o comprometimento da equipe com os objetivos da rede. Parabenizamos toda a equipe e recomendamos manter a consistência operacional para os próximos períodos.`;
    }

    if (achievement >= 85) {
        if (delta !== null && delta > 0) {
            return `A unidade ${store} ficou próxima da meta em ${date}, com ${value} vendas realizadas (${achStr}% do objetivo) — um déficit de apenas ${gap} unidades. O crescimento de ${deltaStr}% frente ao período anterior demonstra evolução positiva e indica que a equipe está no caminho certo. Com pequenos ajustes operacionais e foco nas oportunidades de fechamento, o cumprimento integral da meta está ao alcance.`;
        }
        const retText = (delta !== null && delta < 0)
            ? `A leve retração de ${absDeltaStr}% frente ao período anterior exige atenção. Recomenda-se `
            : 'Recomenda-se ';
        return `A unidade ${store} apresentou resultado próximo da meta em ${date}, com ${value} vendas realizadas (${achStr}% do objetivo). ${retText}identificar os fatores que impediram o atingimento pleno e adotar ações corretivas para garantir o cumprimento da meta nos próximos períodos.`;
    }

    if (achievement >= 60) {
        if (delta !== null && delta > 0) {
            return `A unidade ${store} encerrou ${date} com ${value} vendas — atingimento de ${achStr}% da meta de ${meta} unidades. Apesar da evolução positiva de ${deltaStr}% frente ao período anterior, o resultado ainda está aquém do objetivo. O déficit de ${gap} vendas exige ação estruturada, com metas intermediárias semanais e acompanhamento próximo dos indicadores.`;
        }
        const retText = (delta !== null && delta < 0)
            ? `— com retração de ${absDeltaStr}% frente ao período anterior — `
            : '';
        return `A unidade ${store} encerrou ${date} com ${value} vendas realizadas, representando ${achStr}% da meta de ${meta} unidades. Este desempenho abaixo do esperado ${retText}exige levantamento das causas, revisão das abordagens comerciais e implementação de plano de ação estruturado com indicadores claros de acompanhamento.`;
    }

    if (delta !== null && delta > 0) {
        return `A unidade ${store} registrou em ${date} um total de ${value} vendas — atingimento de ${achStr}% da meta de ${meta} unidades. Embora a evolução de ${deltaStr}% frente ao período anterior sinalize melhora no ritmo, o resultado absoluto ainda é crítico. O déficit de ${gap} vendas é expressivo e requer intervenção estratégica, diagnóstico preciso dos gargalos operacionais e plano de recuperação com metas semanais monitoradas.`;
    }

    const retText = (delta !== null && delta < 0)
        ? `A retração de ${absDeltaStr}% em relação ao período anterior agrava ainda mais o cenário. `
        : '';
    return `A unidade ${store} encerrou ${date} com apenas ${value} vendas realizadas — atingimento de ${achStr}% da meta de ${meta} unidades — configurando um resultado crítico. ${retText}Esta situação exige diagnóstico aprofundado e imediato, seguido de implementação urgente de plano de recuperação com metas intermediárias claras, acompanhamento diário e envolvimento direto da liderança para reverter a trajetória.`;
};

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[ch]));

const statusMeta = (achievement) => {
    if (achievement === null || achievement === undefined || isNaN(achievement)) {
        return { key: 'none', label: 'Sem registro' };
    }
    if (achievement >= 100) return { key: 'success', label: 'Meta atingida' };
    if (achievement >= 85) return { key: 'warning', label: 'Próxima da meta' };
    if (achievement >= 60) return { key: 'warning', label: 'Abaixo da meta' };
    return { key: 'danger', label: 'Resultado crítico' };
};

const formatDelta = (delta) => {
    if (delta === null || delta === undefined || isNaN(delta)) return null;
    return `${delta >= 0 ? '+' : ''}${formatNumber(delta, 1)}%`;
};

const resolveAsset = (path) => {
    if (!path) return '';
    try {
        const base = (typeof document !== 'undefined' && document.baseURI) ? document.baseURI : null;
        return base ? new URL(path, base).href : path;
    } catch (err) {
        return path;
    }
};

const slugify = (value) => String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const computeStoreStats = (store, data, labels) => {
    const cfg = STORE_CONFIG[store] || {};
    const meta = cfg.target || 65;

    const points = labels.map((label, idx) => {
        const row = data[idx] || {};
        const raw = parseFloat(row[store]);
        return { label, value: Number.isNaN(raw) ? null : raw, achievement: null, delta: null };
    });

    let prevValue = null;
    for (const point of points) {
        if (point.value === null) continue;
        point.achievement = (point.value / meta) * 100;
        point.delta = (prevValue !== null && prevValue > 0)
            ? ((point.value - prevValue) / prevValue) * 100
            : null;
        prevValue = point.value;
    }

    const valid = points.filter((p) => p.value !== null);
    const total = valid.reduce((sum, p) => sum + p.value, 0);
    const avg = valid.length ? total / valid.length : 0;
    const avgAchievement = valid.length
        ? valid.reduce((sum, p) => sum + p.achievement, 0) / valid.length
        : 0;

    let best = null;
    let worst = null;
    for (const p of valid) {
        if (!best || p.value > best.value) best = p;
        if (!worst || p.value < worst.value) worst = p;
    }

    const last = valid.length ? valid[valid.length - 1] : null;
    const aboveTarget = valid.filter((p) => p.achievement >= 100).length;

    const head = valid.slice(0, 3);
    const tail = valid.slice(-3);
    const headAvg = head.length ? head.reduce((s, p) => s + p.value, 0) / head.length : 0;
    const tailAvg = tail.length ? tail.reduce((s, p) => s + p.value, 0) / tail.length : 0;
    const trendPct = (valid.length >= 4 && headAvg > 0)
        ? ((tailAvg - headAvg) / headAvg) * 100
        : null;

    return {
        store,
        shortName: cfg.shortName || store,
        logo: cfg.logo || '',
        meta,
        color: cfg.color,
        borderColor: cfg.borderColor || '#78716c',
        points,
        valid,
        total,
        avg,
        avgAchievement,
        best,
        worst,
        last,
        aboveTarget,
        monthsWithData: valid.length,
        monthsTotal: points.length,
        periodStart: valid.length ? valid[0].label : null,
        periodEnd: last ? last.label : null,
        trendPct
    };
};

const buildPeriodNarrative = (stats) => {
    const { store, meta, total, avg, avgAchievement, valid, monthsWithData, best, worst, aboveTarget, trendPct, periodStart, periodEnd } = stats;

    if (!valid.length) {
        return 'Não há registros de vendas para esta unidade no período informado, portanto não é possível consolidar uma análise de desempenho.';
    }

    const pctMonths = formatNumber((aboveTarget / monthsWithData) * 100, 1);
    const periodText = monthsWithData === 1 ? '1 mês registrado' : `${monthsWithData} meses registrados`;
    const opening = `No período de ${periodStart} a ${periodEnd}, a unidade ${store} acumulou ${formatNumber(total)} vendas em ${periodText}, com média mensal de ${formatNumber(avg, 1)} vendas e atingimento médio de ${formatNumber(avgAchievement, 1)}% da meta de ${meta} unidades. A meta foi superada em ${aboveTarget} ${aboveTarget === 1 ? 'mês' : 'meses'} (${pctMonths}% do período). O melhor resultado ocorreu em ${best.label}, com ${formatNumber(best.value)} vendas, e o menor em ${worst.label}, com ${formatNumber(worst.value)} vendas.`;

    let trend = '';
    if (trendPct !== null) {
        if (Math.abs(trendPct) < 5) {
            trend = ' A comparação entre os primeiros e os últimos meses indica estabilidade no ritmo comercial da unidade.';
        } else if (trendPct > 0) {
            trend = ` A média dos últimos meses superou a dos primeiros em ${formatNumber(trendPct, 1)}%, evidenciando aceleração do ritmo de vendas.`;
        } else {
            trend = ` A média dos últimos meses recuou ${formatNumber(Math.abs(trendPct), 1)}% frente aos primeiros meses do período, sinal de perda de ritmo que merece acompanhamento.`;
        }
    }

    let closing;
    if (avgAchievement >= 100) {
        closing = ' Recomenda-se manter as práticas atuais e documentar as ações que sustentaram o resultado, permitindo sua replicação nas demais unidades da rede.';
    } else if (avgAchievement >= 85) {
        closing = ' Com ajustes pontuais e foco nas oportunidades de conversão, o atingimento integral da meta está ao alcance; recomenda-se monitoramento quinzenal dos indicadores.';
    } else if (avgAchievement >= 60) {
        closing = ' O resultado exige plano de ação com metas intermediárias semanais, revisão das abordagens comerciais e acompanhamento próximo dos indicadores-chave.';
    } else {
        closing = ' A situação exige diagnóstico aprofundado dos gargalos operacionais e plano de recuperação com metas intermediárias claras, acompanhamento diário e envolvimento direto da liderança.';
    }

    return opening + trend + closing;
};

const smoothPath = (pts) => {
    if (!pts.length) return '';
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    const k = 0.18;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const c1x = p1.x + (p2.x - p0.x) * k;
        const c1y = p1.y + (p2.y - p0.y) * k;
        const c2x = p2.x - (p3.x - p1.x) * k;
        const c2y = p2.y - (p3.y - p1.y) * k;
        d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
};

const buildChartSVG = (stats) => {
    const W = 820;
    const H = 320;
    const padL = 50;
    const padR = 30;
    const padT = 26;
    const padB = 54;
    const { points, meta, borderColor, shortName } = stats;

    const values = points.filter((p) => p.value !== null).map((p) => p.value);
    if (!values.length) {
        return '<p class="rep-empty">Sem dados de vendas no período para desenhar o gráfico.</p>';
    }

    const maxVal = Math.max(meta, ...values);
    const yMax = Math.max(50, Math.ceil((maxVal * 1.12) / 50) * 50);
    const n = points.length;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const baseline = padT + innerH;
    const xAt = (i) => (n === 1 ? padL + innerW / 2 : padL + (innerW * i) / (n - 1));
    const yAt = (v) => baseline - (v / yMax) * innerH;

    const grid = [];
    const gridCount = 5;
    for (let g = 0; g <= gridCount; g++) {
        const val = (yMax / gridCount) * g;
        const y = yAt(val);
        grid.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="rgba(168,162,158,0.28)" stroke-dasharray="4 4" />`);
        grid.push(`<text x="${padL - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="axis-label">${formatNumber(val)}</text>`);
    }

    const segments = [];
    let current = [];
    points.forEach((p, i) => {
        if (p.value === null) {
            if (current.length) segments.push(current);
            current = [];
            return;
        }
        current.push({ x: xAt(i), y: yAt(p.value), point: p });
    });
    if (current.length) segments.push(current);

    const lines = segments.map((seg) => `<path d="${smoothPath(seg)}" fill="none" stroke="${borderColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`).join('');
    const areas = segments.map((seg) => {
        const first = seg[0];
        const lastP = seg[seg.length - 1];
        return `<path d="${smoothPath(seg)} L ${lastP.x.toFixed(1)} ${baseline.toFixed(1)} L ${first.x.toFixed(1)} ${baseline.toFixed(1)} Z" fill="${borderColor}" fill-opacity="0.12" />`;
    }).join('');
    const dots = segments.flatMap((seg) => seg.map(({ x, y, point }) => {
        const title = `${point.label}: ${formatNumber(point.value)} vendas · ${formatNumber(point.achievement, 1)}% da meta`;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="#FFFFFF" stroke="${borderColor}" stroke-width="2.5"><title>${escapeHTML(title)}</title></circle>`;
    })).join('');

    const step = Math.max(1, Math.ceil(n / 11));
    const xLabels = points.map((p, i) => {
        if (i % step !== 0 && i !== n - 1) return '';
        return `<text x="${xAt(i).toFixed(1)}" y="${baseline + 24}" text-anchor="middle" class="axis-label">${escapeHTML(p.label)}</text>`;
    }).join('');

    const metaY = yAt(meta);
    const targetLine = `<line x1="${padL}" y1="${metaY.toFixed(1)}" x2="${W - padR}" y2="${metaY.toFixed(1)}" stroke="rgba(196,181,160,0.95)" stroke-width="1.5" stroke-dasharray="7 5" />`
        + `<text x="${W - padR}" y="${(metaY - 8).toFixed(1)}" text-anchor="end" class="target-label">Meta ${meta} vendas</text>`;

    const aria = `Gráfico de linha da evolução mensal de vendas da ${stats.store}, comparada à meta de ${meta} unidades`;

    return `
        <div class="rep-chart">
            <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHTML(aria)}" xmlns="http://www.w3.org/2000/svg">
                ${grid.join('')}
                ${areas}
                ${targetLine}
                ${lines}
                ${dots}
                ${xLabels}
            </svg>
            <div class="rep-legend">
                <span class="rep-legend-item"><i style="background:${borderColor}"></i> ${escapeHTML(shortName)} (realizado)</span>
                <span class="rep-legend-item"><i class="is-dashed"></i> Meta mensal (${meta})</span>
            </div>
        </div>`;
};

const kpiCard = (label, value, sub) => `
    <div class="rep-kpi">
        <p class="rep-kpi-label">${label}</p>
        <p class="rep-kpi-value">${value}</p>
        <p class="rep-kpi-sub">${sub}</p>
    </div>`;

const buildTableRows = (stats) => stats.points.map((p) => {
    if (p.value === null) {
        return `<tr class="row-empty">
            <td>${escapeHTML(p.label)}</td>
            <td class="num">&mdash;</td>
            <td class="num">${stats.meta}</td>
            <td class="num">&mdash;</td>
            <td class="num">&mdash;</td>
            <td><span class="rep-tag none">Sem registro</span></td>
        </tr>`;
    }
    const st = statusMeta(p.achievement);
    const delta = formatDelta(p.delta);
    const deltaCls = p.delta === null ? '' : (p.delta >= 0 ? 'up' : 'down');
    const achCls = p.achievement >= 100 ? 'up' : (p.achievement < 60 ? 'down' : '');
    const isLatest = stats.last && stats.last.label === p.label;
    return `<tr${isLatest ? ' class="row-latest"' : ''}>
        <td>${escapeHTML(p.label)}</td>
        <td class="num strong">${formatNumber(p.value)}</td>
        <td class="num">${stats.meta}</td>
        <td class="num ${achCls}">${formatNumber(p.achievement, 1)}%</td>
        <td class="num ${deltaCls}">${delta || '&mdash;'}</td>
        <td><span class="rep-tag ${st.key}">${st.label}</span></td>
    </tr>`;
}).join('');

const buildStorePage = (store, data, labels, generatedAt) => {
    const stats = computeStoreStats(store, data, labels);
    const cfg = STORE_CONFIG[store] || {};
    const last = stats.last;
    const latestStatus = last ? statusMeta(last.achievement) : statusMeta(null);
    const deltaStr = last ? formatDelta(last.delta) : null;
    const periodLabel = stats.periodStart
        ? `${stats.periodStart} — ${stats.periodEnd} · ${stats.monthsWithData} ${stats.monthsWithData === 1 ? 'mês registrado' : 'meses registrados'}`
        : 'Sem registros no período';

    const statusBlock = last
        ? `<span class="rep-tag ${latestStatus.key}">${latestStatus.label}</span>
           <p class="rep-status-value">${formatNumber(last.achievement, 1)}%</p>
           <p class="rep-status-sub">da meta em ${escapeHTML(last.label)}${deltaStr ? ` &bull; ${deltaStr} vs. anterior` : ''}</p>`
        : `<span class="rep-tag none">Sem registro</span>
           <p class="rep-status-sub">Sem vendas no período</p>`;

    const monthNarrative = last
        ? `<div class="rep-narrative accent">
               <p class="rep-narrative-title">Feedback do mês mais recente &mdash; ${escapeHTML(last.label)}</p>
               <p>${escapeHTML(buildNarrative(store, last.label, last.value, stats.meta, last.achievement, last.delta))}</p>
           </div>`
        : '';

    return `
    <section class="page">
        <header class="rep-head">
            <div>
                <p class="rep-brand-mark">MI PLACE</p>
                <p class="rep-brand-sub">Relatório individual de desempenho</p>
            </div>
            <div class="rep-head-meta">
                <p>Gerado em ${escapeHTML(generatedAt)}</p>
                <p>Analytics by Dark Morellato</p>
            </div>
        </header>

        <div class="rep-identity">
            <img class="rep-logo" src="${escapeHTML(resolveAsset(stats.logo))}" alt="Logo da ${escapeHTML(store)}" />
            <div class="rep-identity-text">
                <p class="rep-eyebrow">Unidade</p>
                <h1 class="rep-title">${escapeHTML(store)}</h1>
                <p class="rep-period">${escapeHTML(periodLabel)}</p>
            </div>
            <div class="rep-status">${statusBlock}</div>
        </div>

        <section class="rep-kpis" aria-label="Indicadores de desempenho">
            ${kpiCard('Total no período', formatNumber(stats.total), `${stats.monthsWithData} meses registrados`)}
            ${kpiCard('Média mensal', formatNumber(stats.avg, 1), 'vendas por mês')}
            ${kpiCard('Meta mensal', formatNumber(stats.meta), 'unidades por mês')}
            ${kpiCard('Atingimento médio', `${formatNumber(stats.avgAchievement, 1)}%`, 'da meta no período')}
            ${stats.best
                ? kpiCard('Melhor mês', formatNumber(stats.best.value), escapeHTML(stats.best.label))
                : kpiCard('Melhor mês', '-', 'sem dados')}
            ${stats.worst
                ? kpiCard('Pior mês', formatNumber(stats.worst.value), escapeHTML(stats.worst.label))
                : kpiCard('Pior mês', '-', 'sem dados')}
        </section>

        <section class="rep-block">
            <h2 class="rep-h2">Evolução Mensal de Vendas</h2>
            ${buildChartSVG(stats)}
        </section>

        <section class="rep-block">
            <h2 class="rep-h2">Detalhamento Mensal</h2>
            <table class="data-table">
                <caption class="rep-visually-hidden">Detalhamento mensal de vendas da ${escapeHTML(store)}</caption>
                <thead>
                    <tr>
                        <th scope="col">Mês</th>
                        <th scope="col" class="num">Realizado</th>
                        <th scope="col" class="num">Meta</th>
                        <th scope="col" class="num">Atingimento</th>
                        <th scope="col" class="num">Variação</th>
                        <th scope="col">Status</th>
                    </tr>
                </thead>
                <tbody>${buildTableRows(stats)}</tbody>
            </table>
        </section>

        <section class="rep-block">
            <h2 class="rep-h2">Feedback e Análise de Desempenho</h2>
            <div class="rep-narrative">
                <p class="rep-narrative-title">Consolidação do período &mdash; ${escapeHTML(stats.periodStart || '—')} a ${escapeHTML(stats.periodEnd || '—')}</p>
                <p>${escapeHTML(buildPeriodNarrative(stats))}</p>
            </div>
            ${monthNarrative}
        </section>

        <footer class="rep-foot">
            <span>Dados de performance interna &mdash; Mi Place</span>
            <span>Documento gerado automaticamente pelo Dashboard de Vendas</span>
        </footer>
    </section>`;
};

const REPORT_STYLE = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
    background: #faf9f6;
    color: #57534e;
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 13px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
}
p { margin: 0; }

.rep-toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 14px;
    background: #1c1917;
    color: #faf9f6;
    padding: 12px 22px;
}
.rep-toolbar-info { display: flex; flex-direction: column; gap: 2px; }
.rep-toolbar-info strong {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}
.rep-toolbar-info span { font-size: 11px; color: #a8a29e; }
.rep-toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.rep-btn {
    border: 1px solid #faf9f6;
    background: #faf9f6;
    color: #1c1917;
    padding: 9px 16px;
    font-family: inherit;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.15s ease;
}
.rep-btn.ghost { background: transparent; color: #faf9f6; }
.rep-btn:hover { opacity: 0.85; }
.rep-btn:focus-visible { outline: 2px solid #c4b5a0; outline-offset: 2px; }

.rep-doc { padding: 24px 16px 48px; }
.page {
    max-width: 940px;
    margin: 0 auto 28px;
    background: #ffffff;
    border: 1px solid #e7e5e4;
    padding: 38px 42px 30px;
}

.rep-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    border-bottom: 1px solid #e7e5e4;
    padding-bottom: 16px;
    margin-bottom: 26px;
}
.rep-brand-mark {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 17px;
    font-weight: 700;
    color: #1c1917;
    letter-spacing: 0.04em;
}
.rep-brand-sub, .rep-head-meta p, .rep-eyebrow, .rep-kpi-label, .rep-narrative-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #78716c;
}
.rep-head-meta { text-align: right; }

.rep-identity {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
}
.rep-logo {
    width: 68px;
    height: 68px;
    object-fit: contain;
    background: #ffffff;
    border: 1px solid #e7e5e4;
    border-radius: 8px;
    padding: 7px;
    flex-shrink: 0;
}
.rep-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 30px;
    font-weight: 700;
    color: #1c1917;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 4px 0 5px;
}
.rep-period { font-size: 12px; color: #78716c; }
.rep-status { margin-left: auto; text-align: right; }
.rep-status-value {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 34px;
    font-weight: 700;
    color: #1c1917;
    line-height: 1;
    margin-top: 10px;
    font-variant-numeric: tabular-nums;
}
.rep-status-sub { font-size: 11px; color: #78716c; margin-top: 6px; }

.rep-kpis {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin: 28px 0 0;
}
.rep-kpi {
    border: 1px solid #e7e5e4;
    background: #faf9f6;
    padding: 16px 18px;
}
.rep-kpi-value {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 26px;
    font-weight: 700;
    color: #1c1917;
    margin: 8px 0 3px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}
.rep-kpi-sub { font-size: 11px; color: #78716c; }

.rep-block { margin-top: 30px; }
.rep-h2 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 18px;
    font-weight: 700;
    color: #1c1917;
    margin: 0 0 14px;
    padding-bottom: 9px;
    border-bottom: 1px solid #e7e5e4;
    page-break-after: avoid;
    break-after: avoid;
}

.rep-chart {
    border: 1px solid #e7e5e4;
    background: #faf9f6;
    padding: 14px 12px 8px;
}
.rep-chart svg { display: block; width: 100%; height: auto; }
.rep-chart .axis-label {
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 500;
    fill: #78716c;
}
.rep-chart .target-label {
    font-family: 'Inter', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    fill: #a8a29e;
    text-transform: uppercase;
}
.rep-legend {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    padding: 10px 6px 4px;
    font-size: 11px;
    color: #57534e;
    font-weight: 600;
}
.rep-legend-item { display: inline-flex; align-items: center; gap: 7px; }
.rep-legend-item i {
    width: 14px;
    height: 3px;
    display: inline-block;
    border-radius: 2px;
}
.rep-legend-item i.is-dashed {
    background: repeating-linear-gradient(90deg, #c4b5a0 0 5px, transparent 5px 9px);
    height: 2px;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}
.data-table th {
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #78716c;
    padding: 10px 10px;
    border-bottom: 1px solid #d6d3d1;
}
.data-table td {
    padding: 9px 10px;
    border-bottom: 1px solid #f0efed;
    color: #44403c;
}
.data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.data-table .strong { font-weight: 700; color: #1c1917; }
.data-table tr { page-break-inside: avoid; break-inside: avoid; }
.data-table thead { display: table-header-group; }
.data-table .row-latest td { background: #faf9f6; font-weight: 600; color: #1c1917; }
.data-table .row-empty td { color: #a8a29e; }
.up { color: #4d6b3f !important; }
.down { color: #a34848 !important; }

.rep-tag {
    display: inline-block;
    padding: 3px 8px;
    border: 1px solid #e7e5e4;
    border-radius: 4px;
    background: #faf9f6;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #57534e;
    white-space: nowrap;
}
.rep-tag.success { border-color: #b8c4a3; color: #1c1917; }
.rep-tag.warning { border-color: #c4b5a0; color: #1c1917; }
.rep-tag.danger { border-color: #c4a3a3; color: #1c1917; }
.rep-tag.none { border-color: #e7e5e4; color: #a8a29e; }

.rep-narrative {
    background: #faf9f6;
    border: 1px solid #e7e5e4;
    border-left: 3px solid #c4b5a0;
    padding: 16px 18px;
    margin-bottom: 12px;
}
.rep-narrative.accent { border-left-color: #557a46; }
.rep-narrative p:last-child {
    color: #44403c;
    font-size: 13px;
    line-height: 1.75;
}
.rep-empty { color: #a8a29e; font-style: italic; padding: 20px 0; }

.rep-foot {
    margin-top: 32px;
    padding-top: 14px;
    border-top: 1px solid #e7e5e4;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #a8a29e;
}

.rep-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
}

@media screen and (max-width: 720px) {
    .page { padding: 26px 20px 22px; }
    .rep-kpis { grid-template-columns: repeat(2, 1fr); }
    .rep-status { margin-left: 0; text-align: left; }
    .rep-title { font-size: 24px; }
}

@page {
    size: A4 portrait;
    margin: 12mm;
}

@media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { background: #ffffff !important; }
    .rep-toolbar { display: none !important; }
    .rep-doc { padding: 0; }
    .page {
        max-width: none;
        margin: 0;
        padding: 0;
        border: none;
        page-break-after: always;
        break-after: page;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .rep-kpi { padding: 12px 14px; }
    .rep-kpi-value { font-size: 22px; }
    .rep-status-value { font-size: 28px; }
    .data-table { font-size: 11px; }
    .data-table td, .data-table th { padding: 7px 8px; }
}
`;

export const buildReportDocument = (stores, data, labels) => {
    const generatedAt = new Date().toLocaleString('pt-BR');
    const docTitle = stores.length === 1
        ? `Relatório de Desempenho — ${STORE_CONFIG[stores[0]]?.shortName || stores[0]}`
        : 'Relatório de Desempenho — Rede Mi Place';
    const pages = stores.map((store) => buildStorePage(store, data, labels, generatedAt)).join('\n');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHTML(docTitle)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>${REPORT_STYLE}</style>
</head>
<body>
    <div class="rep-toolbar">
        <div class="rep-toolbar-info">
            <strong>${escapeHTML(docTitle)}</strong>
            <span>Gerado em ${escapeHTML(generatedAt)} &bull; ${stores.length} ${stores.length === 1 ? 'unidade' : 'unidades'}</span>
        </div>
        <div class="rep-toolbar-actions">
            <button type="button" class="rep-btn ghost" onclick="window.close()">Fechar</button>
            <button type="button" class="rep-btn" onclick="window.print()">Salvar como PDF / Imprimir</button>
        </div>
    </div>
    <div class="rep-doc">
${pages}
    </div>
</body>
</html>`;
};

const openReportWindow = (html, filename) => {
    const win = window.open('', '_blank');
    if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        setTimeout(() => { try { win.focus(); } catch (err) { /* noop */ } }, 120);
        return true;
    }
    try {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 8000);
    } catch (err) {
        console.error('Falha ao gerar relatório:', err);
    }
    return false;
};

export const setupExportPanel = ({ getData } = {}) => {
    const els = {
        trigger: document.getElementById('exportBtn'),
        overlay: document.getElementById('exportModal'),
        backdrop: document.getElementById('exportBackdrop'),
        wrapper: document.getElementById('exportWrapper'),
        panel: document.getElementById('exportPanel'),
        closeBtn: document.getElementById('exportCloseBtn'),
        list: document.getElementById('exportStoreList'),
        exportAllBtn: document.getElementById('exportAllBtn'),
        status: document.getElementById('exportStatus')
    };

    if (!els.overlay || !els.panel) return;

    let isOpen = false;
    let lastFocused = null;
    let closeTimer = null;

    const setBackgroundInert = (inert) => {
        ['header', 'main'].forEach((sel) => {
            const node = document.querySelector(sel);
            if (!node) return;
            if (inert) node.setAttribute('inert', '');
            else node.removeAttribute('inert');
        });
    };

    const setStatus = (message, kind = '') => {
        if (!els.status) return;
        els.status.textContent = message;
        els.status.className = 'export-status' + (kind ? ` is-${kind}` : '');
    };

    const getDataSafe = () => {
        const payload = (typeof getData === 'function' ? getData() : null) || {};
        return { data: payload.data || [], labels: payload.labels || [] };
    };

    const renderList = () => {
        if (!els.list) return;
        const { data, labels } = getDataSafe();
        if (!data.length || !labels.length) {
            els.list.innerHTML = '<p class="export-empty">Os dados de vendas ainda não foram carregados.</p>';
            return;
        }

        els.list.innerHTML = allStoreNames.map((store, idx) => {
            const cfg = STORE_CONFIG[store] || {};
            const stats = computeStoreStats(store, data, labels);
            const last = stats.last;
            const st = last ? statusMeta(last.achievement) : statusMeta(null);
            const delta = last ? formatDelta(last.delta) : null;
            const badgeText = last ? `${formatNumber(last.achievement, 1)}% da meta` : 'Sem dados';
            const delay = (idx * 0.06).toFixed(2);

            return `
            <div class="export-row" role="listitem" style="animation-delay:${delay}s">
                <img class="export-row-logo" src="${escapeHTML(cfg.logo || '')}" alt="" width="44" height="44" loading="lazy" decoding="async">
                <div class="export-row-id">
                    <p class="export-row-name">${escapeHTML(cfg.shortName || store)}</p>
                    <p class="export-row-full">${escapeHTML(store)}</p>
                </div>
                <div class="export-row-metrics">
                    <span class="export-metric">
                        <span class="export-metric-value">${formatNumber(stats.total)}</span>
                        <span class="export-metric-label">vendas</span>
                    </span>
                    <span class="export-metric">
                        <span class="export-metric-value">${formatNumber(stats.avg, 1)}</span>
                        <span class="export-metric-label">média/mês</span>
                    </span>
                    <span class="export-metric">
                        <span class="export-metric-value">${last ? formatNumber(last.value) : '-'}</span>
                        <span class="export-metric-label">${last ? escapeHTML(last.label) : 'sem dados'}</span>
                    </span>
                    <span class="achievement-badge ${st.key === 'none' ? '' : st.key}">${badgeText}${delta ? ` (${delta})` : ''}</span>
                </div>
                <button type="button" class="export-row-btn" data-store="${escapeHTML(store)}" aria-label="Exportar relatório da ${escapeHTML(store)}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Exportar
                </button>
            </div>`;
        }).join('');
    };

    const exportStores = (stores) => {
        const { data, labels } = getDataSafe();
        if (!data.length || !stores.length) {
            setStatus('Dados indisponíveis no momento.', 'error');
            return;
        }

        const html = buildReportDocument(stores, data, labels);
        const filename = stores.length === 1
            ? `relatorio-${slugify(STORE_CONFIG[stores[0]]?.shortName || stores[0])}-mi-place.html`
            : 'relatorio-lojas-mi-place.html';
        const opened = openReportWindow(html, filename);

        if (opened) {
            const label = stores.length === 1
                ? STORE_CONFIG[stores[0]]?.shortName || stores[0]
                : 'todas as lojas';
            setStatus(`Relatório de ${label} aberto em nova aba — use "Salvar como PDF / Imprimir" para exportar.`, 'success');
        } else {
            setStatus('O navegador bloqueou a nova aba. O relatório foi baixado como arquivo HTML.', 'error');
        }
    };

    const getFocusables = () => {
        if (!els.panel) return [];
        const nodes = els.panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        return Array.from(nodes).filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0);
    };

    const open = () => {
        if (isOpen) return;
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
        lastFocused = document.activeElement;
        isOpen = true;
        renderList();
        setStatus('');

        els.overlay.style.pointerEvents = 'auto';
        els.overlay.classList.remove('hidden');
        if (els.backdrop) {
            els.backdrop.classList.remove('fade-out');
            els.backdrop.classList.add('fade-in');
        }
        els.panel.classList.remove('slide-down');
        els.panel.classList.add('bounce-in');

        setBackgroundInert(true);
        document.body.style.overflow = 'hidden';
        if (els.trigger) els.trigger.setAttribute('aria-expanded', 'true');

        setTimeout(() => {
            if (isOpen && els.closeBtn) els.closeBtn.focus();
        }, 100);
    };

    const close = () => {
        if (!isOpen) return;
        isOpen = false;

        document.body.style.overflow = '';
        setBackgroundInert(false);
        els.overlay.style.pointerEvents = 'none';
        if (els.trigger) {
            els.trigger.setAttribute('aria-expanded', 'false');
        }

        if (els.backdrop) {
            els.backdrop.classList.remove('fade-in');
            els.backdrop.classList.add('fade-out');
        }
        els.panel.classList.remove('bounce-in');
        els.panel.classList.add('slide-down');

        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(() => {
            closeTimer = null;
            els.overlay.classList.add('hidden');
            if (els.backdrop) els.backdrop.classList.remove('fade-out');
            els.panel.classList.remove('slide-down');
            els.overlay.style.pointerEvents = '';

            const target = lastFocused;
            lastFocused = null;
            if (target && target.isConnected && typeof target.focus === 'function'
                && target !== document.body && target !== document.documentElement) {
                const focusable = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'IFRAME'].includes(target.tagName);
                if (focusable || target.hasAttribute('tabindex')) target.focus();
            }
        }, 250);
    };

    if (els.trigger) els.trigger.addEventListener('click', open);
    if (els.closeBtn) els.closeBtn.addEventListener('click', close);
    if (els.wrapper) {
        els.wrapper.addEventListener('click', (e) => {
            if (e.target === els.wrapper) close();
        });
    }
    if (els.exportAllBtn) {
        els.exportAllBtn.addEventListener('click', () => exportStores(allStoreNames.slice()));
    }
    if (els.list) {
        els.list.addEventListener('click', (e) => {
            const btn = e.target.closest('.export-row-btn');
            if (!btn || !btn.dataset.store) return;
            exportStores([btn.dataset.store]);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (!isOpen) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            close();
            return;
        }
        if (e.key !== 'Tab') return;
        const focusables = getFocusables();
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const inside = !!(active && els.panel.contains(active));

        if (e.shiftKey) {
            if (!inside || active === first) {
                e.preventDefault();
                last.focus();
            }
        } else if (!inside || active === last) {
            e.preventDefault();
            first.focus();
        }
    });
};
