(() => {
    'use strict';

    const state = {
        salesChartInstance: null,
        allValidData: [],
        chartLabels: [],
        labelToIndex: new Map(),
        loadedLogos: {},
        allLogosLoaded: false
    };

    const DOM = {
        get totalSales() { return document.getElementById('totalSales'); },
        get averageSales() { return document.getElementById('averageSales'); },
        get loadingIndicator() { return document.getElementById('loadingIndicator'); },
        get chartContainer() { return document.getElementById('chartContainer'); },
        get errorMessage() { return document.getElementById('errorMessage'); },
        get loadingStatus() { return document.getElementById('loadingStatus'); },
        get errorText() { return document.getElementById('errorText'); },
        get detailModal() { return document.getElementById('detailModal'); },
        get modalBackdrop() { return document.getElementById('modalBackdrop'); },
        get modalWrapper() { return document.getElementById('modalWrapper'); },
        get modalPanel() { return document.getElementById('modalPanel'); },
        get modalStoreName() { return document.getElementById('modalStoreName'); },
        get modalDateLabel() { return document.getElementById('modalDateLabel'); },
        get modalValueDisplay() { return document.getElementById('modalValueDisplay'); },
        get modalFeedbackContainer() { return document.getElementById('modalFeedbackContainer'); },
        get modalFeedbackContent() { return document.getElementById('modalFeedbackContent'); },
        get modalStatusDot() { return document.getElementById('modalStatusDot'); },
        get salesChart() { return document.getElementById('salesChart'); },
        get bgCanvas() { return document.getElementById('bgCanvas'); }
    };

    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
    const easeOutBounce = (t) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
    };

    const formatNumber = (num, decimals = 0) => {
        if (num === null || isNaN(num)) return '-';
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    };

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

    const animateCounter = (element, targetValue, duration = 1200) => {
        if (!element) return;
        const startTime = performance.now();
        const isDecimal = targetValue % 1 !== 0;

        element.style.opacity = '0';
        element.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            element.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            element.style.opacity = '1';
            element.style.transform = 'scale(1)';
        }, 200);

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutBounce(progress);
            const current = eased * targetValue;
            element.textContent = formatNumber(current, isDecimal ? 1 : 0);
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };

        requestAnimationFrame(update);
    };

    const loadLogo = (store, src) => {
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
    };

    const preloadLogos = () => {
        const promises = Object.entries(STORE_CONFIG).map(([store, cfg]) => {
            return loadLogo(store, cfg.logo).then((img) => {
                state.loadedLogos[store] = img;
            });
        });
        return Promise.all(promises).then(() => {
            state.allLogosLoaded = true;
        });
    };

    const buildNarrative = (store, date, value, meta, achievement, prevValue, prevDate, delta) => {
        const gap = meta - value;

        if (achievement >= 100) {
            if (delta !== null && delta > 0) {
                return `A unidade ${store} registrou desempenho positivo em ${date}, superando a meta estabelecida com ${value} vendas — ${achievement.toFixed(1)}% do objetivo. O crescimento de ${delta.toFixed(1)}% em relação ao período anterior reforça a consistência da equipe e a eficácia das estratégias aplicadas. Este resultado contribui para a solidez dos números da rede e serve como referência para as demais unidades. Recomenda-se manter o ritmo e aprimorar as práticas que conduziram a este resultado.`;
            }
            return `A unidade ${store} atingiu e superou a meta em ${date}, totalizando ${value} vendas — ${achievement.toFixed(1)}% do objetivo. Este resultado demonstra o comprometimento da equipe com os objetivos da rede. Parabenizamos toda a equipe e recomendamos manter a consistência operacional para os próximos períodos.`;
        }

        if (achievement >= 85) {
            if (delta !== null && delta > 0) {
                return `A unidade ${store} ficou próxima da meta em ${date}, com ${value} vendas realizadas (${achievement.toFixed(1)}% do objetivo) — um déficit de apenas ${gap} unidades. O crescimento de ${delta.toFixed(1)}% frente ao período anterior demonstra evolução positiva e indica que a equipe está no caminho certo. Com pequenos ajustes operacionais e foco nas oportunidades de fechamento, o cumprimento integral da meta está ao alcance.`;
            }
            return `A unidade ${store} apresentou resultado próximo da meta em ${date}, com ${value} vendas realizadas (${achievement.toFixed(1)}% do objetivo). ${delta !== null && delta < 0 ? `A leve retração de ${Math.abs(delta).toFixed(1)}% frente ao período anterior exige atenção. R` : 'R'}ecomenda-se identificar os fatores que impediram o atingimento pleno e adotar ações corretivas para garantir o cumprimento da meta nos próximos períodos.`;
        }

        if (achievement >= 60) {
            if (delta !== null && delta > 0) {
                return `A unidade ${store} encerrou ${date} com ${value} vendas — atingimento de ${achievement.toFixed(1)}% da meta de ${meta} unidades. Apesar da evolução positiva de ${delta.toFixed(1)}% frente ao período anterior, o resultado ainda está significativamente aquém do objetivo. O déficit de ${gap} vendas exige ação estruturada, com metas intermediárias semanais e acompanhamento próximo dos indicadores.`;
            }
            return `A unidade ${store} encerrou ${date} com ${value} vendas realizadas, representando ${achievement.toFixed(1)}% da meta de ${meta} unidades. Este desempenho abaixo do esperado ${delta !== null && delta < 0 ? `— com retração de ${Math.abs(delta).toFixed(1)}% frente ao período anterior — ` : ''}exige levantamento das causas, revisão das abordagens comerciais e implementação de plano de ação estruturado com indicadores claros de acompanhamento.`;
        }

        if (delta !== null && delta > 0) {
            return `A unidade ${store} registrou em ${date} um total de ${value} vendas — atingimento de ${achievement.toFixed(1)}% da meta de ${meta} unidades. Embora a evolução de ${delta.toFixed(1)}% frente ao período anterior sinalize melhora no ritmo, o resultado absoluto ainda é crítico. O gap de ${gap} vendas é expressivo e requer intervenção estratégica, diagnóstico preciso dos gargalos operacionais e plano de recuperação com metas semanais monitoradas de perto.`;
        }

        return `A unidade ${store} encerrou ${date} com apenas ${value} vendas realizadas — atingimento de ${achievement.toFixed(1)}% da meta de ${meta} unidades — configurando um resultado crítico. ${delta !== null && delta < 0 ? `A retração de ${Math.abs(delta).toFixed(1)}% em relação ao período anterior agrava ainda mais o cenário. ` : ''}Esta situação exige diagnóstico aprofundado e imediato, seguido de implementação urgente de plano de recuperação com metas intermediárias claras, acompanhamento diário e envolvimento direto da liderança para reverter a trajetória.`;
    };

    const generateFeedbackHTML = (store, date, value) => {
        const meta = STORE_META[store] || 65;
        const achievement = (value / meta) * 100;

        const currentIdx = state.labelToIndex.get(date) ?? -1;
        let prevValue = null;
        let prevDate = null;

        if (currentIdx > 0) {
            for (let i = currentIdx - 1; i >= 0; i--) {
                const raw = parseFloat(state.allValidData[i][store]);
                if (!isNaN(raw)) {
                    prevValue = raw;
                    prevDate = state.chartLabels[i];
                    break;
                }
            }
        }

        const delta = prevValue !== null
            ? ((value - prevValue) / prevValue * 100)
            : null;
        const deltaStr = delta !== null
            ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`
            : null;

        let statusClass, achievementBadgeClass;
        if (achievement >= 100) {
            statusClass = 'font-extrabold';
            achievementBadgeClass = 'success';
        } else if (achievement >= 85) {
            statusClass = 'font-extrabold';
            achievementBadgeClass = 'warning';
        } else if (achievement >= 60) {
            statusClass = 'font-bold';
            achievementBadgeClass = 'warning';
        } else {
            statusClass = 'font-bold';
            achievementBadgeClass = 'danger';
        }

        const deltaColor = delta === null
            ? 'font-semibold'
            : (delta >= 0 ? 'font-extrabold' : 'font-bold');

        const evolutionRow = prevDate
            ? `<div class="metric-row">
                   <span class="text-sm font-bold">Evolução (${prevDate} → ${date})</span>
                   <span class="text-sm ${deltaColor}">${prevValue} → ${value} (${deltaStr})</span>
               </div>`
            : `<div class="metric-row">
                   <span class="text-sm font-bold">Situação</span>
                   <span class="text-sm font-semibold">Primeiro período registrado</span>
               </div>`;

        const narrative = buildNarrative(store, date, value, meta, achievement, prevValue, prevDate, delta);

        return `
            <div class="flex items-center gap-3 mb-4">
                <p class="font-extrabold text-lg">${store}</p>
                <span class="achievement-badge ${achievementBadgeClass}">${achievement.toFixed(1)}% da meta</span>
            </div>
            <p class="text-xs font-bold uppercase tracking-widest mb-4">Análise de Desempenho | Reunião de Equipe</p>
            <div class="space-y-3 text-left">
                <div class="metric-row">
                    <span class="text-sm font-bold">Meta Mensal</span>
                    <span class="text-sm font-extrabold">${meta} vendas</span>
                </div>
                <div class="metric-row">
                    <span class="text-sm font-bold">Realizado</span>
                    <span class="text-sm ${statusClass}">${value} vendas</span>
                </div>
                <div class="metric-row">
                    <span class="text-sm font-bold">Atingimento</span>
                    <span class="text-sm ${statusClass}">${achievement.toFixed(1)}%</span>
                </div>
                ${evolutionRow}
            </div>
            <div class="narrative-box ${achievementBadgeClass}">
                <p class="font-extrabold mb-2">Análise Formal:</p>
                <p class="leading-relaxed font-medium">${narrative}</p>
            </div>`;
    };

    const openModal = (store, date, value, color) => {
        DOM.modalStoreName.textContent = store;
        DOM.modalDateLabel.textContent = date;
        DOM.modalValueDisplay.textContent = formatNumber(value);

        if (DOM.modalStatusDot) {
            DOM.modalStatusDot.style.backgroundColor = color;
        }

        DOM.modalFeedbackContent.innerHTML = generateFeedbackHTML(store, date, value);
        DOM.modalFeedbackContainer.classList.remove('hidden');

        DOM.detailModal.classList.remove('hidden');
        DOM.modalBackdrop.classList.remove('fade-out');
        DOM.modalBackdrop.classList.add('fade-in');
        DOM.modalPanel.classList.remove('slide-down');
        DOM.modalPanel.classList.add('bounce-in');
    };

    const closeModal = () => {
        DOM.modalBackdrop.classList.remove('fade-in');
        DOM.modalBackdrop.classList.add('fade-out');
        DOM.modalPanel.classList.remove('bounce-in');
        DOM.modalPanel.classList.add('slide-down');
        setTimeout(() => {
            DOM.detailModal.classList.add('hidden');
            DOM.modalBackdrop.classList.remove('fade-out');
            DOM.modalPanel.classList.remove('slide-down');
        }, 350);
    };

    DOM.modalWrapper.addEventListener('click', (e) => {
        if (e.target === DOM.modalWrapper) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !DOM.detailModal.classList.contains('hidden')) {
            closeModal();
        }
    });

    const targetLinesPlugin = {
        id: 'targetLines',
        beforeDraw: (chart) => {
            const { ctx, chartArea: { left, right }, scales: { y } } = chart;
            const lines = chart.options.plugins.targetLines?.lines || [];
            if (!lines.length) return;

            ctx.save();
            lines.forEach((line) => {
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
        beforeDatasetsDraw(chart) {
            const { ctx, chartArea } = chart;
            const progress = chart.lineDrawProgress || 1;
            ctx.save();
            const clipWidth = (chartArea.right - chartArea.left) * progress;
            ctx.beginPath();
            ctx.rect(chartArea.left, chartArea.top, clipWidth, chartArea.bottom - chartArea.top);
            ctx.clip();
        },
        afterDatasetsDraw(chart) {
            chart.ctx.restore();
        }
    };

    const lineEndLogoPlugin = {
        id: 'lineEndLogo',
        afterDatasetsDraw(chart) {
            if (chart.showLineEndLogos === false) return;

            const { ctx, data, scales, chartArea } = chart;
            const progress = chart.lineDrawProgress || 1;
            if (progress <= 0) return;

            const totalPoints = data.labels.length;
            const visibleIndex = Math.min(
                Math.floor(progress * totalPoints),
                totalPoints - 1
            );

            data.datasets.forEach((dataset, datasetIndex) => {
                if (!chart.isDatasetVisible(datasetIndex)) return;

                const logo = state.loadedLogos[dataset.storeName];
                if (!logo) return;

                const meta = chart.getDatasetMeta(datasetIndex);
                if (!meta.data[visibleIndex]) return;

                const point = meta.data[visibleIndex];
                const x = point.x;
                const y = point.y;

                if (x < chartArea.left || x > chartArea.right) return;
                if (y < chartArea.top || y > chartArea.bottom) return;

                const logoSize = 26;
                const halfSize = logoSize / 2;

                ctx.save();

                ctx.beginPath();
                ctx.arc(x, y, halfSize + 3, 0, Math.PI * 2);
                ctx.fillStyle = '#FFFFFF';
                ctx.fill();
                ctx.strokeStyle = dataset.borderColor;
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(x, y, halfSize, 0, Math.PI * 2);
                ctx.clip();

                ctx.drawImage(logo, x - halfSize, y - halfSize, logoSize, logoSize);

                ctx.restore();
            });
        }
    };

    Chart.register(targetLinesPlugin);
    Chart.register(lineDrawAnimation);
    Chart.register(lineEndLogoPlugin);
    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }

    const updateSummaryMetrics = (data) => {
        let total = 0;
        data.forEach((row) => {
            allStoreNames.forEach((store) => {
                const v = parseFloat(row[store]);
                if (!isNaN(v)) total += v;
            });
        });
        animateCounter(DOM.totalSales, total, 1200);
        animateCounter(DOM.averageSales, data.length > 0 ? total / data.length : 0, 1200);
    };

    const handleHoverEffect = (activeElements, chart) => {
        if (!chart) return;
        const isHovering = activeElements.length > 0;
        const activeIndex = isHovering ? activeElements[0].datasetIndex : -1;
        const grey = '#B2BEC3';

        chart.showLineEndLogos = !isHovering;

        const setDatasetProps = (ds, props) => {
            Object.assign(ds, {
                borderColor: props.borderColor,
                borderWidth: props.borderWidth,
                pointRadius: props.pointRadius,
                pointBorderColor: props.pointBorderColor,
                pointBackgroundColor: props.pointBg,
                pointHoverRadius: props.pointHoverRadius,
                pointHoverBorderColor: props.pointHoverBorderColor,
                datalabels: { display: props.datalabelsDisplay },
                order: props.order
            });
        };

        chart.data.datasets.forEach((ds, idx) => {
            ds.datalabels = ds.datalabels || {};
            if (isHovering) {
                if (idx === activeIndex) {
                    setDatasetProps(ds, {
                        borderColor: ds.originalBorderColor,
                        borderWidth: 4,
                        pointRadius: 8,
                        pointBorderColor: ds.originalBorderColor,
                        pointBg: '#FFFFFF',
                        pointHoverRadius: 10,
                        pointHoverBorderColor: ds.originalBorderColor,
                        datalabelsDisplay: 'auto',
                        order: 1
                    });
                } else {
                    setDatasetProps(ds, {
                        borderColor: grey,
                        borderWidth: 2,
                        pointRadius: 5,
                        pointBorderColor: grey,
                        pointBg: '#FFFFFF',
                        pointHoverRadius: 5,
                        pointHoverBorderColor: grey,
                        datalabelsDisplay: false,
                        order: 10
                    });
                }
            } else {
                setDatasetProps(ds, {
                    borderColor: ds.originalBorderColor,
                    borderWidth: 3,
                    pointRadius: 8,
                    pointBorderColor: ds.originalBorderColor,
                    pointBg: '#FFFFFF',
                    pointHoverRadius: 10,
                    pointHoverBorderColor: ds.originalBorderColor,
                    datalabelsDisplay: 'auto',
                    order: 0
                });
            }
        });
        chart.update('none');
    };

    const createCustomLegend = (chart) => {
        try {
            const existingLegend = document.getElementById('custom-legend');
            if (existingLegend) existingLegend.remove();

            const legendContainer = document.createElement('div');
            legendContainer.id = 'custom-legend';
            legendContainer.className = 'chart-legend';

            const logoSize = 56;

            let tooltip = null;

            const createTooltip = (text, borderColor) => {
                if (!tooltip) {
                    tooltip = document.createElement('div');
                    tooltip.style.cssText = `
                        position: fixed;
                        background: #2D3436;
                        padding: 8px 14px;
                        border-radius: 6px;
                        font-size: 11px;
                        font-weight: 700;
                        color: #FFFFFF;
                        border: 2px solid #2D3436;
                        pointer-events: none;
                        z-index: 1000;
                        white-space: nowrap;
                        box-shadow: 2px 2px 0px #2D3436;
                        opacity: 0;
                        transition: opacity 0.15s ease;
                        letter-spacing: 0.02em;
                    `;
                    document.body.appendChild(tooltip);
                }
                tooltip.textContent = text;
                tooltip.style.borderColor = borderColor || '#ccc';
                return tooltip;
            };

            const showTooltip = (e, text, borderColor) => {
                const tip = createTooltip(text, borderColor);
                const rect = e.target.getBoundingClientRect();
                requestAnimationFrame(() => {
                    tip.style.left = `${rect.left + rect.width / 2}px`;
                    tip.style.top = `${rect.bottom + 8}px`;
                    tip.style.transform = 'translateX(-50%)';
                    tip.style.opacity = '1';
                });
            };

            const hideTooltip = () => {
                if (tooltip) tooltip.style.opacity = '0';
            };

            const makeCircle = (imgSrc, title, borderColor) => {
                const wrapper = document.createElement('div');
                wrapper.style.cssText = `
                    width: ${logoSize}px;
                    height: ${logoSize}px;
                    border-radius: 50%;
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                    border: 3px solid #2D3436;
                    box-shadow: 3px 3px 0px #2D3436;
                    background: #FFFFFF;
                    animation: fadeInUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
                `;
                wrapper.title = title;
                const img = document.createElement('img');
                img.src = imgSrc;
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                wrapper.appendChild(img);

                wrapper.addEventListener('mouseenter', (e) => {
                    wrapper.style.transform = 'translate(-3px, -3px) scale(1.08)';
                    wrapper.style.boxShadow = '5px 5px 0px #2D3436';
                    showTooltip(e, title, borderColor);
                });
                wrapper.addEventListener('mouseleave', () => {
                    wrapper.style.transform = 'translate(0, 0) scale(1)';
                    wrapper.style.boxShadow = '3px 3px 0px #2D3436';
                    hideTooltip();
                });
                wrapper.addEventListener('mousedown', () => {
                    wrapper.style.transform = 'translate(0, 0) scale(0.95)';
                    wrapper.style.boxShadow = '1px 1px 0px #2D3436';
                });
                wrapper.addEventListener('mouseup', () => {
                    wrapper.style.transform = 'translate(-3px, -3px) scale(1.08)';
                    wrapper.style.boxShadow = '5px 5px 0px #2D3436';
                });

                return wrapper;
            };

            const updateOpacity = () => {
                const allVis = allStoreNames.every((_, i) => chart.isDatasetVisible(i));
                const todasBtn = legendContainer.querySelector('[title="Todas as Lojas"]');
                if (todasBtn) todasBtn.style.opacity = allVis ? '1' : '0.3';
                allStoreNames.forEach((_, i) => {
                    const btn = legendContainer.querySelector(`[title="${allStoreNames[i].replace('Miplace ', '')}"]`);
                    if (btn) btn.style.opacity = chart.isDatasetVisible(i) ? '1' : '0.3';
                });
            };

            const todasBtn = makeCircle('img/Todas.png', 'Todas as Lojas', '#2D3436');
            todasBtn.style.animationDelay = '0.1s';
            todasBtn.onclick = () => {
                allStoreNames.forEach((_, i) => chart.setDatasetVisibility(i, true));
                chart.update();
                updateOpacity();
            };
            legendContainer.appendChild(todasBtn);

            allStoreNames.forEach((store, idx) => {
                const img = state.loadedLogos[store];
                if (!img) return;
                const cfg = STORE_CONFIG[store];
                const btn = makeCircle(img.src, store.replace('Miplace ', ''), cfg.borderColor);
                btn.style.animationDelay = `${0.15 + idx * 0.08}s`;

                btn.onclick = () => {
                    const allVis = allStoreNames.every((_, i) => chart.isDatasetVisible(i));
                    if (allVis) {
                        allStoreNames.forEach((_, i) => {
                            chart.setDatasetVisibility(i, i === idx);
                        });
                    } else {
                        chart.setDatasetVisibility(idx, !chart.isDatasetVisible(idx));
                        const anyVisible = allStoreNames.some((_, i) => chart.isDatasetVisible(i));
                        if (!anyVisible) {
                            chart.setDatasetVisibility(idx, true);
                        }
                    }
                    chart.update();
                    updateOpacity();
                };

                btn.onmouseenter = () => {
                    btn.style.transform = 'translate(-3px, -3px) scale(1.08)';
                    btn.style.boxShadow = '5px 5px 0px #2D3436';
                    handleHoverEffect([{ datasetIndex: idx }], chart);
                };
                btn.onmouseleave = () => {
                    btn.style.transform = 'translate(0, 0) scale(1)';
                    btn.style.boxShadow = '3px 3px 0px #2D3436';
                    handleHoverEffect([], chart);
                };
                btn.onmousedown = () => {
                    btn.style.transform = 'translate(0, 0) scale(0.95)';
                    btn.style.boxShadow = '1px 1px 0px #2D3436';
                };
                btn.onmouseup = () => {
                    btn.style.transform = 'translate(-3px, -3px) scale(1.08)';
                    btn.style.boxShadow = '5px 5px 0px #2D3436';
                };

                legendContainer.appendChild(btn);
            });

            updateOpacity();
            const chartContainer = document.getElementById('chartContainer');
            chartContainer.parentNode.insertBefore(legendContainer, chartContainer);
        } catch (err) {
            console.error('Erro em createCustomLegend:', err);
        }
    };

    const renderChart = () => {
        if (!state.allValidData.length || !state.chartLabels.length) return;

        const datasets = allStoreNames.map((store) => {
            const cfg = STORE_CONFIG[store];
            return {
                label: store.replace('Miplace ', ''),
                storeName: store,
                data: state.allValidData.map((row) => {
                    const v = parseFloat(row[store]);
                    return isNaN(v) ? null : v;
                }),
                originalBorderColor: cfg.borderColor,
                originalBackgroundColor: cfg.color,
                borderColor: cfg.borderColor,
                backgroundColor: cfg.color,
                tension: 0.35,
                fill: false,
                pointRadius: 8,
                pointHoverRadius: 10,
                hitRadius: 30,
                pointBackgroundColor: '#FFFFFF',
                pointBorderColor: cfg.borderColor,
                pointBorderWidth: 3,
                borderWidth: 3,
                datalabels: { display: 'auto' },
                spanGaps: true
            };
        });

        const ctx = DOM.salesChart.getContext('2d');
        if (state.salesChartInstance) {
            state.salesChartInstance.destroy();
        }

        Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
        Chart.defaults.color = '#636E72';

        state.salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: state.chartLabels,
                datasets
            },
            showLineEndLogos: true,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'nearest', intersect: true, axis: 'xy' },
                onClick: (event, elements, chart) => {
                    if (!elements.length) return;
                    const { datasetIndex, index } = elements[0];
                    const ds = chart.data.datasets[datasetIndex];
                    if (ds.data[index] !== null) {
                        openModal(ds.storeName, chart.data.labels[index], ds.data[index], ds.originalBackgroundColor);
                    }
                },
                onHover: (event, activeElements, chart) => {
                    event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                    handleHoverEffect(activeElements, chart);
                },
                animation: {
                    duration: 3000,
                    easing: 'easeOutQuart',
                    onProgress(animation) {
                        const chart = this;
                        const progress = animation.currentStep / animation.numSteps;
                        chart.lineDrawProgress = progress;
                    },
                    onComplete() {
                        this.lineDrawProgress = 1;
                    }
                },
                layout: {
                    padding: { top: 30, right: 50, left: 50, bottom: 10 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#2D3436',
                        titleColor: '#FFFFFF',
                        bodyColor: '#DFE6E9',
                        borderColor: '#2D3436',
                        borderWidth: 3,
                        padding: 14,
                        boxPadding: 6,
                        usePointStyle: true,
                        cornerRadius: 6,
                        titleFont: { weight: '700', size: 13 },
                        bodyFont: { weight: '600', size: 12 },
                        displayColors: true,
                        callbacks: {
                            label: (ctx) => {
                                let label = (ctx.dataset.label || '') + ': ';
                                if (ctx.parsed.y !== null) label += formatNumber(ctx.parsed.y);
                                return label;
                            }
                        }
                    },
                    datalabels: {
                        align: 'top',
                        anchor: 'end',
                        offset: 4,
                        color: (ctx) => ctx.dataset.borderColor,
                        font: { weight: 'bold', size: 10 },
                        formatter: (val) => val !== null ? Math.round(val) : '',
                        display: (ctx) => ctx.dataset.datalabels?.display ?? 'auto',
                        textShadowColor: '#FFFFFF',
                        textShadowBlur: 2
                    },
                    targetLines: {
                        lines: [
                            { value: 130, color: 'rgba(0, 184, 148, 0.6)', dash: [6, 4], width: 2 },
                            { value: 65, color: 'rgba(253, 203, 110, 0.8)', dash: [6, 4], width: 2 }
                        ]
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11, weight: '600' }, color: '#636E72' },
                        border: { display: false },
                        offset: true,
                        min: -0.5,
                        max: state.chartLabels.length - 0.5
                    },
                    y: {
                        beginAtZero: true,
                        max: 300,
                        border: { display: false },
                        grid: {
                            color: 'rgba(45, 52, 54, 0.1)',
                            borderDash: [4, 4],
                            tickLength: 0
                        },
                        ticks: {
                            stepSize: 50,
                            padding: 10,
                            font: { size: 11, weight: '600' },
                            color: '#636E72'
                        }
                    }
                }
            }
        });

        createCustomLegend(state.salesChartInstance);
    };

    const init = () => {
        fetch('data/sales-data.csv')
            .then((response) => {
                if (!response.ok) throw new Error('Falha ao carregar o arquivo CSV');
                DOM.loadingStatus.textContent = 'Carregando dados...';
                return response.text();
            })
            .then((csvText) => {
                try {
                    DOM.loadingStatus.textContent = 'Processando métricas...';
                    const lines = csvText.trim().split('\n');
                    const headers = lines[0].split(',').map((h) => h.trim());
                    const parsed = lines.slice(1).map((line) => {
                        const values = line.split(',').map((v) => v.trim());
                        return headers.reduce((acc, h, i) => {
                            acc[h] = values[i] || null;
                            return acc;
                        }, {});
                    });

                    state.allValidData = parsed.filter((row) => row.MES);
                    state.chartLabels = state.allValidData.map((row) => getFormattedDate(row.MES));
                    state.labelToIndex = new Map(state.chartLabels.map((label, idx) => [label, idx]));

                    updateSummaryMetrics(state.allValidData);
                    DOM.loadingStatus.textContent = 'Carregando logos...';

                    preloadLogos()
                        .then(() => {
                            try {
                                DOM.loadingStatus.textContent = 'Renderizando gráfico...';
                                renderChart();
                                DOM.loadingIndicator.classList.add('hidden');
                                DOM.chartContainer.classList.remove('hidden');
                            } catch (err) {
                                console.error('Erro ao renderizar:', err);
                                DOM.loadingIndicator.classList.add('hidden');
                                DOM.errorMessage.classList.remove('hidden');
                                DOM.errorText.textContent = err.message;
                            }
                        })
                        .catch((err) => {
                            console.error('Erro no preloadLogos:', err);
                            DOM.loadingIndicator.classList.add('hidden');
                            DOM.errorMessage.classList.remove('hidden');
                            DOM.errorText.textContent = err.message;
                        });
                } catch (err) {
                    DOM.loadingIndicator.classList.add('hidden');
                    DOM.errorMessage.classList.remove('hidden');
                    DOM.errorText.textContent = err.message;
                }
            })
            .catch((err) => {
                DOM.loadingIndicator.classList.add('hidden');
                DOM.errorMessage.classList.remove('hidden');
                DOM.errorText.textContent = err.message;
            });
    };

    const initBackgroundAnimation = () => {
        const canvas = DOM.bgCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        let time = 0;
        let animationId;

        const floatingShapes = [];
        for (let i = 0; i < 8; i++) {
            floatingShapes.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: 20 + Math.random() * 40,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.3,
                opacity: 0.03 + Math.random() * 0.04,
                color: ['#74B9FF', '#55EFC4', '#FD79A8', '#A29BFE', '#FFEAA7'][Math.floor(Math.random() * 5)]
            });
        }

        const animate = () => {
            ctx.fillStyle = '#FEF9EF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            time += 2;

            const spacing = 50;
            ctx.strokeStyle = 'rgba(45, 52, 54, 0.06)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 0; x < canvas.width; x += spacing) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
            }
            for (let y = 0; y < canvas.height; y += spacing) {
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
            }
            ctx.stroke();

            floatingShapes.forEach(shape => {
                shape.x += shape.speedX;
                shape.y += shape.speedY;

                if (shape.x < -shape.size) shape.x = canvas.width + shape.size;
                if (shape.x > canvas.width + shape.size) shape.x = -shape.size;
                if (shape.y < -shape.size) shape.y = canvas.height + shape.size;
                if (shape.y > canvas.height + shape.size) shape.y = -shape.size;

                ctx.fillStyle = shape.color;
                ctx.globalAlpha = shape.opacity;
                ctx.beginPath();
                ctx.arc(shape.x, shape.y, shape.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;

            const scanX = (time % (canvas.width + 200)) - 100;

            ctx.fillStyle = 'rgba(116, 185, 255, 0.6)';
            ctx.fillRect(scanX, 0, 2, canvas.height);
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#74B9FF';
            ctx.fillRect(scanX, 0, 2, canvas.height);
            ctx.shadowBlur = 0;

            for (let x = 0; x < canvas.width; x += spacing) {
                if (Math.abs(x - scanX) < 150) {
                    for (let y = 0; y < canvas.height; y += spacing) {
                        const alpha = 1 - Math.abs(x - scanX) / 150;
                        ctx.fillStyle = `rgba(116, 185, 255, ${alpha * 0.5})`;
                        ctx.beginPath();
                        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            animationId = requestAnimationFrame(animate);
        };

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                cancelAnimationFrame(animationId);
            } else {
                animationId = requestAnimationFrame(animate);
            }
        });

        animationId = requestAnimationFrame(animate);
    };

    document.addEventListener('DOMContentLoaded', () => {
        init();
        initBackgroundAnimation();
    });
})();
