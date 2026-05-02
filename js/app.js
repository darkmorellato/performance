let salesChartInstance = null;
let allValidData = [];
let chartLabels = [];
let labelToIndex = new Map();

const loadedLogos = {};
let allLogosLoaded = false;

function loadLogo(store, src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.warn(`Logo não encontrado: ${src}, usando fallback`);
            const cfg = STORE_CONFIG[store];
            const color = cfg ? cfg.color : '#cccccc';
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(16, 16, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const initial = store.replace('Miplace ', '').charAt(0);
            ctx.fillText(initial, 16, 16);
            const dataUrl = canvas.toDataURL('image/png');
            const fallbackImg = new Image();
            fallbackImg.onload = () => resolve(fallbackImg);
            fallbackImg.src = dataUrl;
        };
        img.src = src;
    });
}

function preloadLogos() {
    const promises = Object.entries(STORE_CONFIG).map(([store, cfg]) => {
        return loadLogo(store, cfg.logo).then(img => {
            loadedLogos[store] = img;
        });
    });
    return Promise.all(promises).then(() => { allLogosLoaded = true; });
}

const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

function animateCounter(element, targetValue, duration = 1000) {
    const startTime = performance.now();
    const isDecimal = targetValue % 1 !== 0;
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuart(progress);
        const current = eased * targetValue;
        element.textContent = formatNumber(current, isDecimal ? 1 : 0);
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

function buildNarrative(store, date, value, meta, achievement, prevValue, prevDate, delta) {
    const gap = meta - value;

    if (achievement >= 100) {
        if (delta !== null && delta > 0)
            return `A unidade ${store} registrou desempenho positivo em ${date}, superando a meta estabelecida com ${value} vendas — ${achievement.toFixed(1)}% do objetivo. O crescimento de ${delta.toFixed(1)}% em relação ao período anterior reforça a consistência da equipe e a eficácia das estratégias aplicadas. Este resultado contribui para a solidez dos números da rede e serve como referência para as demais unidades. Recomenda-se manter o ritmo e aprimorar as práticas que conduziram a este resultado.`;
        return `A unidade ${store} atingiu e superou a meta em ${date}, totalizando ${value} vendas — ${achievement.toFixed(1)}% do objetivo. Este resultado demonstra o comprometimento da equipe com os objetivos da rede. Parabenizamos toda a equipe e recomendamos manter a consistência operacional para os próximos períodos.`;
    }

    if (achievement >= 85) {
        if (delta !== null && delta > 0)
            return `A unidade ${store} ficou próxima da meta em ${date}, com ${value} vendas realizadas (${achievement.toFixed(1)}% do objetivo) — um déficit de apenas ${gap} unidades. O crescimento de ${delta.toFixed(1)}% frente ao período anterior demonstra evolução positiva e indica que a equipe está no caminho certo. Com pequenos ajustes operacionais e foco nas oportunidades de fechamento, o cumprimento integral da meta está ao alcance.`;
        return `A unidade ${store} apresentou resultado próximo da meta em ${date}, com ${value} vendas realizadas (${achievement.toFixed(1)}% do objetivo). ${delta !== null && delta < 0 ? `A leve retração de ${Math.abs(delta).toFixed(1)}% frente ao período anterior exige atenção. R` : 'R'}ecomenda-se identificar os fatores que impediram o atingimento pleno e adotar ações corretivas para garantir o cumprimento da meta nos próximos períodos.`;
    }

    if (achievement >= 60) {
        if (delta !== null && delta > 0)
            return `A unidade ${store} encerrou ${date} com ${value} vendas — atingimento de ${achievement.toFixed(1)}% da meta de ${meta} unidades. Apesar da evolução positiva de ${delta.toFixed(1)}% frente ao período anterior, o resultado ainda está significativamente aquém do objetivo. O déficit de ${gap} vendas exige ação estruturada, com metas intermediárias semanais e acompanhamento próximo dos indicadores.`;
        return `A unidade ${store} encerrou ${date} com ${value} vendas realizadas, representando ${achievement.toFixed(1)}% da meta de ${meta} unidades. Este desempenho abaixo do esperado ${delta !== null && delta < 0 ? `— com retração de ${Math.abs(delta).toFixed(1)}% frente ao período anterior — ` : ''}exige levantamento das causas, revisão das abordagens comerciais e implementação de plano de ação estruturado com indicadores claros de acompanhamento.`;
    }

    if (delta !== null && delta > 0)
        return `A unidade ${store} registrou em ${date} um total de ${value} vendas — atingimento de ${achievement.toFixed(1)}% da meta de ${meta} unidades. Embora a evolução de ${delta.toFixed(1)}% frente ao período anterior sinalize melhora no ritmo, o resultado absoluto ainda é crítico. O gap de ${gap} vendas é expressivo e requer intervenção estratégica, diagnóstico preciso dos gargalos operacionais e plano de recuperação com metas semanais monitoradas de perto.`;
    return `A unidade ${store} encerrou ${date} com apenas ${value} vendas realizadas — atingimento de ${achievement.toFixed(1)}% da meta de ${meta} unidades — configurando um resultado crítico. ${delta !== null && delta < 0 ? `A retração de ${Math.abs(delta).toFixed(1)}% em relação ao período anterior agrava ainda mais o cenário. ` : ''}Esta situação exige diagnóstico aprofundado e imediato, seguido de implementação urgente de plano de recuperação com metas intermediárias claras, acompanhamento diário e envolvimento direto da liderança para reverter a trajetória.`;
}

function generateFeedbackHTML(store, date, value) {
    const meta = STORE_META[store] || 65;
    const achievement = (value / meta) * 100;

    const currentIdx = labelToIndex.get(date) ?? -1;
    let prevValue = null, prevDate = null;
    if (currentIdx > 0) {
        const key = STORE_KEY_REVERSE[store];
        for (let i = currentIdx - 1; i >= 0; i--) {
            const raw = parseFloat(allValidData[i][key]);
            if (!isNaN(raw)) { prevValue = raw; prevDate = chartLabels[i]; break; }
        }
    }

    const delta = prevValue !== null ? ((value - prevValue) / prevValue * 100) : null;
    const deltaStr = delta !== null ? (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%' : null;

    let resultBg, resultText, statusClass, borderClass, bgClass;
    if (achievement >= 100) {
        resultBg = 'bg-emerald-50'; resultText = 'text-emerald-700';
        statusClass = 'text-emerald-700 font-bold';
        borderClass = 'border-emerald-400'; bgClass = 'bg-emerald-50';
    } else if (achievement >= 85) {
        resultBg = 'bg-amber-50'; resultText = 'text-amber-700';
        statusClass = 'text-amber-600 font-bold';
        borderClass = 'border-amber-400'; bgClass = 'bg-amber-50';
    } else if (achievement >= 60) {
        resultBg = 'bg-orange-50'; resultText = 'text-orange-700';
        statusClass = 'text-orange-600 font-bold';
        borderClass = 'border-orange-400'; bgClass = 'bg-orange-50';
    } else {
        resultBg = 'bg-red-50'; resultText = 'text-red-700';
        statusClass = 'text-red-700 font-bold';
        borderClass = 'border-red-400'; bgClass = 'bg-red-50';
    }

    const deltaColor = delta === null ? 'text-slate-500'
        : (delta >= 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold');

    const evolutionRow = prevDate
        ? `<div class="flex justify-between items-center bg-slate-50 rounded-lg px-4 py-2">
               <span class="text-sm font-semibold text-slate-600">Evolução (${prevDate} → ${date})</span>
               <span class="text-sm ${deltaColor}">${prevValue} → ${value} (${deltaStr})</span>
           </div>`
        : `<div class="flex justify-between items-center bg-slate-50 rounded-lg px-4 py-2">
               <span class="text-sm font-semibold text-slate-600">Situação</span>
               <span class="text-sm text-slate-500 font-medium">Primeiro período registrado</span>
           </div>`;

    const narrative = buildNarrative(store, date, value, meta, achievement, prevValue, prevDate, delta);

    return `
        <p class="font-bold text-slate-900 mb-1 text-lg">${store} — ${date}</p>
        <p class="text-xs text-slate-400 uppercase tracking-widest mb-4">Análise de Desempenho | Reunião de Equipe</p>
        <div class="space-y-3 text-left">
            <div class="flex justify-between items-center bg-slate-100 rounded-lg px-4 py-2">
                <span class="text-sm font-semibold text-slate-600">Meta Mensal</span>
                <span class="text-sm font-bold text-slate-900">${meta} vendas</span>
            </div>
            <div class="flex justify-between items-center ${resultBg} rounded-lg px-4 py-2">
                <span class="text-sm font-semibold text-slate-600">Realizado</span>
                <span class="text-sm font-bold ${resultText}">${value} vendas</span>
            </div>
            <div class="flex justify-between items-center bg-slate-50 rounded-lg px-4 py-2">
                <span class="text-sm font-semibold text-slate-600">Atingimento</span>
                <span class="text-sm ${statusClass}">${achievement.toFixed(1)}%</span>
            </div>
            ${evolutionRow}
        </div>
        <div class="mt-5 text-slate-700 text-sm border-l-4 ${borderClass} pl-4 py-2 leading-relaxed ${bgClass} rounded-r-lg">
            <p class="font-bold text-slate-800 mb-1">Análise Formal:</p>
            ${narrative}
        </div>`;
}

const modal = document.getElementById('detailModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalWrapper = document.getElementById('modalWrapper');
const modalPanel = document.getElementById('modalPanel');
const modalStoreName = document.getElementById('modalStoreName');
const modalDateLabel = document.getElementById('modalDateLabel');
const modalValueDisplay = document.getElementById('modalValueDisplay');
const modalFeedbackContainer = document.getElementById('modalFeedbackContainer');
const modalFeedbackContent = document.getElementById('modalFeedbackContent');

function openModal(store, date, value, color) {
    modalStoreName.textContent = store;
    modalStoreName.style.color = color;
    modalDateLabel.textContent = date;
    modalValueDisplay.textContent = formatNumber(value);
    modalValueDisplay.style.color = color;

    modalFeedbackContent.innerHTML = generateFeedbackHTML(store, date, value);
    modalFeedbackContainer.classList.remove('hidden');

    modal.classList.remove('hidden');
    setTimeout(() => {
        modalBackdrop.classList.remove('opacity-0');
        modalPanel.classList.remove('opacity-0', 'scale-95');
        modalPanel.classList.add('opacity-100', 'scale-100');
    }, 10);
}

function closeModal() {
    modalBackdrop.classList.add('opacity-0');
    modalPanel.classList.remove('opacity-100', 'scale-100');
    modalPanel.classList.add('opacity-0', 'scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

modalWrapper.addEventListener('click', (e) => { if (e.target === modalWrapper) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

const targetLinesPlugin = {
    id: 'targetLines',
    beforeDraw: (chart) => {
        const { ctx, chartArea: { left, right }, scales: { y } } = chart;
        const lines = chart.options.plugins.targetLines?.lines || [];
        if (!lines.length) return;
        ctx.save();
        lines.forEach(line => {
            const yPos = y.getPixelForValue(line.value);
            ctx.strokeStyle = line.color || '#94a3b8';
            ctx.lineWidth = line.width || 1;
            ctx.setLineDash(line.dash || [4, 4]);
            ctx.beginPath();
            ctx.moveTo(left, yPos);
            ctx.lineTo(right, yPos);
            ctx.stroke();
        });
        ctx.restore();
    }
};

const lineDrawAnimation = {
    id: 'lineDrawAnimation',
    beforeDatasetsDraw(chart, args, options) {
        const { ctx, chartArea } = chart;
        const progress = chart.lineDrawProgress || 1;
        
        ctx.save();
        const clipWidth = (chartArea.right - chartArea.left) * progress;
        ctx.beginPath();
        ctx.rect(chartArea.left, chartArea.top, clipWidth, chartArea.bottom - chartArea.top);
        ctx.clip();
    },
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.restore();
    }
};

Chart.register(targetLinesPlugin);
Chart.register(lineDrawAnimation);
if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);

const getFormattedDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '-';
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(date.getTime())) return '-';
    const month = date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
    const year = date.getFullYear().toString().slice(-2);
    return `${month.charAt(0).toUpperCase() + month.slice(1)}/${year}`;
};

const formatNumber = (num, decimals = 0) => {
    if (num === null || isNaN(num)) return '-';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
};

const updateSummaryMetrics = (data) => {
    let total = 0;
    data.forEach(row => {
        allStoreNames.forEach(store => {
            const v = parseFloat(row[store]);
            if (!isNaN(v)) total += v;
        });
    });
    animateCounter(document.getElementById('totalSales'), total, 1200);
    animateCounter(document.getElementById('averageSales'), data.length > 0 ? total / data.length : 0, 1200);
};

const handleHoverEffect = (activeElements, chart) => {
    if (!chart) return;
    const isHovering = activeElements.length > 0;
    const activeIndex = isHovering ? activeElements[0].datasetIndex : -1;
    const grey = '#cbd5e1';
    const setDatasetProps = (ds, props) => {
        Object.assign(ds, { borderColor: props.borderColor, borderWidth: props.borderWidth,
            pointRadius: props.pointRadius, pointBorderColor: props.pointBorderColor,
            pointBackgroundColor: props.pointBg, pointHoverRadius: props.pointHoverRadius,
            pointHoverBorderColor: props.pointHoverBorderColor, datalabels: { display: props.datalabelsDisplay }, order: props.order });
    };
    chart.data.datasets.forEach((ds, idx) => {
        ds.datalabels = ds.datalabels || {};
        if (isHovering) {
            setDatasetProps(ds, idx === activeIndex
                ? { borderColor: ds.originalBorderColor, borderWidth: 4, pointRadius: 6, pointBorderColor: ds.originalBorderColor,
                    pointBg: '#fff', pointHoverRadius: 8, pointHoverBorderColor: ds.originalBorderColor, datalabelsDisplay: 'auto', order: 1 }
                : { borderColor: grey, borderWidth: 2, pointRadius: 4, pointBorderColor: grey,
                    pointBg: '#fff', pointHoverRadius: 4, pointHoverBorderColor: grey, datalabelsDisplay: false, order: 10 });
        } else {
            setDatasetProps(ds, { borderColor: ds.originalBorderColor, borderWidth: 2.5, pointRadius: 6,
                pointBorderColor: ds.originalBorderColor, pointBg: '#fff', pointHoverRadius: 8,
                pointHoverBorderColor: ds.originalBorderColor, datalabelsDisplay: 'auto', order: 0 });
        }
    });
    chart.update();
};

function createCustomLegend(chart) {
    try {
        const existingLegend = document.getElementById('custom-legend');
        if (existingLegend) existingLegend.remove();

        const legendContainer = document.createElement('div');
        legendContainer.id = 'custom-legend';
        legendContainer.style.cssText = 'display:flex;justify-content:flex-end;align-items:center;gap:14px;margin-bottom:10px;padding:8px 0;';

const logoSize = 60;

         // Create tooltip container
         let tooltip = null;
         function createTooltip(text, borderColor) {
             if (!tooltip) {
                 tooltip = document.createElement('div');
                 tooltip.style.cssText = 'position:absolute;background:#fff;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;color:#1e293b;border:2px solid;pointer-events:none;z-index:1000;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.15);opacity:0;transition:opacity 0.2s;';
                 document.body.appendChild(tooltip);
             }
             tooltip.textContent = text;
             tooltip.style.borderColor = borderColor || '#ccc';
             return tooltip;
         }
function showTooltip(e, text, borderColor) {
              const tip = createTooltip(text, borderColor);
              const rect = e.target.getBoundingClientRect();

              requestAnimationFrame(() => {
                  const canvasRect = chart.canvas.getBoundingClientRect();
                  const y300Pixel = chart.scales.y.getPixelForValue(300);
                  const y300ViewportY = canvasRect.top + y300Pixel;

                  const tooltipHeight = tip.offsetHeight;
                  const gap = y300ViewportY - rect.bottom;
                  let tooltipTop = rect.bottom + Math.max(0, (gap - tooltipHeight) / 2);

                  tooltipTop = Math.max(rect.bottom, Math.min(tooltipTop, y300ViewportY - tooltipHeight));

                  const tooltipLeft = rect.left + rect.width / 2;
                  tip.style.left = tooltipLeft + 'px';
                  tip.style.top = tooltipTop + 'px';
                  tip.style.transform = 'translateX(-50%)';

                  tip.style.opacity = '1';
              });
          }
         function hideTooltip() {
             if (tooltip) tooltip.style.opacity = '0';
         }

const makeCircle = (imgSrc, title, borderColor) => {
             const wrapper = document.createElement('div');
             wrapper.style.cssText = 'width:' + logoSize + 'px;height:' + logoSize + 'px;border-radius:50%;overflow:hidden;cursor:pointer;transition:opacity 0.2s,transform 0.2s;border:3px solid ' + (borderColor || '#ccc');
             wrapper.title = title;
             const img = document.createElement('img');
             img.src = imgSrc;
             img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
             wrapper.appendChild(img);
             wrapper.addEventListener('mouseenter', (e) => showTooltip(e, title, borderColor));
             wrapper.addEventListener('mouseleave', hideTooltip);
             return wrapper;
         };

        const todasLojasSrc = 'img/Todas.png';

        const updateOpacity = () => {
            const allVis = allStoreNames.every((_,i) => chart.isDatasetVisible(i));
            legendContainer.children[0].style.opacity = allVis ? '1' : '0.3';
            for(let i=0; i<allStoreNames.length; i++) {
                const btn = legendContainer.children[i+1];
                if(btn) btn.style.opacity = chart.isDatasetVisible(i) ? '1' : '0.3';
            }
        };

const todasBtn = makeCircle(todasLojasSrc, 'Todas as Lojas', '#FFFFFF');
         todasBtn.onclick = () => { allStoreNames.forEach((_,i) => { chart.setDatasetVisibility(i, true); }); chart.update(); updateOpacity(); };
         todasBtn.addEventListener('mouseenter', function(e) { 
             this.style.transform='scale(1.1)';
             showTooltip(e, 'Todas as Lojas', '#FFFFFF');
         });
         todasBtn.addEventListener('mouseleave', function() { 
             this.style.transform='scale(1)';
             hideTooltip();
         });
         legendContainer.appendChild(todasBtn);

        allStoreNames.forEach((store, idx) => {
            const img = loadedLogos[store];
            if(!img) return;
            const cfg = STORE_CONFIG[store];
            const btn = makeCircle(img.src, store.replace('Miplace ',''), cfg.borderColor);
            btn.onclick = () => {
                const allVis = allStoreNames.every((_,i) => chart.isDatasetVisible(i));
                if(allVis) {
                    allStoreNames.forEach((_,i) => { if(i!==idx) chart.setDatasetVisibility(i, false); else chart.setDatasetVisibility(i, true); });
                } else {
                    allStoreNames.forEach((_,i) => { chart.setDatasetVisibility(i, i===idx); });
                }
                chart.update();
                updateOpacity();
            };
            btn.onmouseenter = () => { btn.style.transform='scale(1.1)'; handleHoverEffect([{datasetIndex:idx}],chart); };
            btn.onmouseleave = () => { btn.style.transform='scale(1)'; handleHoverEffect([],chart); };
            legendContainer.appendChild(btn);
        });

        updateOpacity();
        const chartContainer = document.getElementById('chartContainer');
        chartContainer.parentNode.insertBefore(legendContainer, chartContainer);
    } catch(err) {
        console.error('Erro em createCustomLegend:', err);
    }
}

const renderChart = () => {
    if (!allValidData.length || !chartLabels.length) return;

    const datasets = allStoreNames.map(store => {
        const cfg = STORE_CONFIG[store];
        return {
            label: store.replace('Miplace ', ''),
            storeName: store,
            data: allValidData.map(row => { const v = parseFloat(row[store]); return isNaN(v) ? null : v; }),
            originalBorderColor: cfg.borderColor,
            originalBackgroundColor: cfg.color,
            borderColor: cfg.borderColor,
            backgroundColor: cfg.color,
            tension: 0.35, fill: false,
            pointRadius: 8, pointHoverRadius: 8, hitRadius: 30,
            pointBackgroundColor: '#fff', pointBorderColor: cfg.borderColor, pointBorderWidth: 2,
            borderWidth: 2.5, datalabels: { display: 'auto' }, spanGaps: true
        };
    });

    const ctx = document.getElementById('salesChart').getContext('2d');
    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#64748b';

    salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: chartLabels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: true, axis: 'xy' },
            onClick: (event, elements, chart) => {
                if (!elements.length) return;
                const { datasetIndex, index } = elements[0];
                const ds = chart.data.datasets[datasetIndex];
                if (ds.data[index] !== null)
                    openModal(ds.storeName, chart.data.labels[index], ds.data[index], ds.originalBackgroundColor);
            },
            onHover: (event, activeElements, chart) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                handleHoverEffect(activeElements, chart);
            },
            animation: {
                duration: 4000,
                easing: 'linear',
                onProgress: function(animation) {
                    const chart = this;
                    const progress = animation.currentStep / animation.numSteps;
                    chart.lineDrawProgress = progress;
                },
                onComplete: function() {
                    this.lineDrawProgress = 1;
                }
            },
            layout: { padding: { top: 30, right: 50, left: 50, bottom: 10 } },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#fff', titleColor: '#1e293b', bodyColor: '#475569',
                    borderColor: '#e2e8f0', borderWidth: 1, padding: 12, boxPadding: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: (ctx) => {
                            let l = (ctx.dataset.label || '') + ': ';
                            if (ctx.parsed.y !== null) l += formatNumber(ctx.parsed.y);
                            return l;
                        }
                    }
                },
                datalabels: {
                    align: 'top', anchor: 'end', offset: 4,
                    color: (ctx) => ctx.dataset.borderColor,
                    font: { weight: 'bold', size: 9 },
                    formatter: (val) => val !== null ? Math.round(val) : '',
                    display: (ctx) => ctx.dataset.datalabels?.display ?? 'auto'
                },
                targetLines: {
                    lines: [
                        { value: 130, color: '#0d9488', dash: [4, 4], width: 1.5 },
                        { value: 65, color: '#65a30d', dash: [4, 4], width: 1.5 }
                    ]
                }
            },
            scales: {
                x: { 
                grid: { display: false }, 
                ticks: { font: { size: 11 }, color: '#333333' }, 
                border: { display: false }, 
                offset: true,
                min: -0.5,
                max: chartLabels.length - 0.5
            },
                y: {
                    beginAtZero: true, max: 300, border: { display: false },
                    grid: { color: '#94A3B8', borderDash: [4, 4], tickLength: 0 },
                    ticks: { stepSize: 50, padding: 10, font: { size: 11 }, color: '#333333' }
                }
            }
        }
    });
    createCustomLegend(salesChartInstance);
};

document.addEventListener('DOMContentLoaded', () => {
    const loadingEl = document.getElementById('loadingIndicator');
    const chartEl = document.getElementById('chartContainer');
    const errorEl = document.getElementById('errorMessage');
    const loadingStatus = document.getElementById('loadingStatus');

    fetch('data/sales-data.csv')
        .then(response => {
            if (!response.ok) throw new Error('Falha ao carregar o arquivo CSV');
            loadingStatus.textContent = 'Carregando dados...';
            return response.text();
        })
        .then(csvText => {
    try {
        loadingStatus.textContent = 'Processando métricas...';
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const parsed = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            return headers.reduce((acc, h, i) => (acc[h] = values[i] || null, acc), {});
        });

        allValidData = parsed.filter(row => row.MES);
        chartLabels = allValidData.map(row => getFormattedDate(row.MES));
        labelToIndex = new Map(chartLabels.map((label, idx) => [label, idx]));
        updateSummaryMetrics(allValidData);
        loadingStatus.textContent = 'Carregando logos...';
        preloadLogos().then(() => {
            try {
                loadingStatus.textContent = 'Renderizando gráfico...';
                renderChart();
                loadingEl.classList.add('hidden');
                chartEl.classList.remove('hidden');
            } catch(err) {
                console.error('Erro ao renderizar:', err);
                loadingEl.classList.add('hidden');
                errorEl.classList.remove('hidden');
                document.getElementById('errorText').textContent = err.message;
            }
        }).catch(err => {
            console.error('Erro no preloadLogos:', err);
            loadingEl.classList.add('hidden');
            errorEl.classList.remove('hidden');
            document.getElementById('errorText').textContent = err.message;
        });
    } catch (err) {
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        document.getElementById('errorText').textContent = err.message;
    }
})
        .catch(err => {
            loadingEl.classList.add('hidden');
            errorEl.classList.remove('hidden');
            document.getElementById('errorText').textContent = err.message;
        });
});

// Laser scan background animation
(function() {
    const canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    let time = 0;
    let animationId;
    
    function animate() {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        time += 2;
        const spacing = 50;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
        for (let y = 0; y < canvas.height; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
        ctx.stroke();
        
        const scanX = (time % (canvas.width + 200)) - 100;
        
        ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.fillRect(scanX, 0, 2, canvas.height);
        ctx.shadowBlur = 20; ctx.shadowColor = '#38bdf8';
        ctx.fillRect(scanX, 0, 2, canvas.height);
        ctx.shadowBlur = 0;
        
        for (let x = 0; x < canvas.width; x += spacing) {
            if (Math.abs(x - scanX) < 150) {
                for (let y = 0; y < canvas.height; y += spacing) {
                    const alpha = 1 - Math.abs(x - scanX) / 150;
                    ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
                    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
                }
            }
        }
        animationId = requestAnimationFrame(animate);
    }
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) cancelAnimationFrame(animationId);
        else animationId = requestAnimationFrame(animate);
    });
    
    animationId = requestAnimationFrame(animate);
})();
