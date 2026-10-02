import { STORE_CONFIG, allStoreNames } from './config.js';
import {
    setupExportPanel,
    buildNarrative,
    formatNumber,
    numberFormatter,
    decimalFormatter
} from './export.js';

(() => {
    'use strict';

    const state = {
        salesChartInstance: null,
        allValidData: [],
        chartLabels: [],
        labelToIndex: new Map(),
        loadedLogos: {},
        lastFocusedElement: null,
        modalOpen: false,
        modalCloseTimer: null
    };

    let currentHoveredDatasetIndex = -1;
    let lastHoverKey = '';
    let canvasListenersAttached = false;
    let pendingMouseEvent = null;
    let hoverFrameId = null;

    const cancelPendingHover = () => {
        if (hoverFrameId !== null) {
            cancelAnimationFrame(hoverFrameId);
            hoverFrameId = null;
        }
        pendingMouseEvent = null;
    };

    // destroy() do Chart.js zera chart.canvas; usado para ignorar instâncias mortas
    const isChartUsable = (chart) => {
        if (!chart || chart.canvas === null) return false;
        if (typeof chart.isDestroyed === 'function' && chart.isDestroyed()) return false;
        return true;
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
        get modalCloseBtn() { return document.getElementById('modalCloseBtn'); },
        get modalStoreName() { return document.getElementById('modalStoreName'); },
        get modalDateLabel() { return document.getElementById('modalDateLabel'); },
        get modalValueDisplay() { return document.getElementById('modalValueDisplay'); },
        get modalFeedbackContainer() { return document.getElementById('modalFeedbackContainer'); },
        get modalFeedbackContent() { return document.getElementById('modalFeedbackContent'); },
        get modalStatusDot() { return document.getElementById('modalStatusDot'); },
        get salesChart() { return document.getElementById('salesChart'); },
        get exportBtn() { return document.getElementById('exportBtn'); }
    };

    // Easing cúbico ultra-suave para desenho das linhas
    const easeInOutCubic = (t) => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

    const formatDateLabel = (dateStr) => {
        if (!dateStr) return '-';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return '-';
        const y = +parts[0];
        const m = +parts[1];
        const d = +parts[2];
        if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return '-';
        if (m < 1 || m > 12 || d < 1 || d > 31) return '-';
        const date = new Date(y, m - 1, d);
        if (isNaN(date.getTime())) return '-';
        if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return '-';
        const month = monthFormatter.format(date).replace('.', '');
        const year = date.getFullYear().toString().slice(-2);
        return month.charAt(0).toUpperCase() + month.slice(1) + '/' + year;
    };

    const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    };

    const animateCounter = (element, targetValue, duration = 1400) => {
        if (!element) return;
        const startTime = performance.now();
        const isDecimal = targetValue % 1 !== 0;
        const formatter = isDecimal ? decimalFormatter : numberFormatter;

        element.style.opacity = '0';
        element.style.transform = 'translateY(4px)';

        setTimeout(() => {
            element.style.transition = 'all 0.3s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, 200);

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            element.textContent = formatter.format(eased * targetValue);
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = formatter.format(targetValue);
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
                const color = cfg ? cfg.borderColor : '#78716c';
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
                const initial = (cfg?.shortName || store).charAt(0).toUpperCase();
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
        return Promise.all(promises);
    };

    const findPrevValue = (store, currentIdx) => {
        for (let i = currentIdx - 1; i >= 0; i--) {
            const raw = parseFloat(state.allValidData[i][store]);
            if (!isNaN(raw)) {
                return { value: raw, date: state.chartLabels[i] };
            }
        }
        return null;
    };

    const generateFeedbackHTML = (store, date, value) => {
        const meta = STORE_CONFIG[store]?.target || 65;
        const achievement = (value / meta) * 100;

        const currentIdx = state.labelToIndex.get(date) ?? -1;
        const prev = currentIdx > 0 ? findPrevValue(store, currentIdx) : null;
        const prevValue = prev ? prev.value : null;
        const prevDate = prev ? prev.date : null;

        const delta = prevValue !== null && prevValue > 0 ? ((value - prevValue) / prevValue * 100) : null;
        const deltaStr = delta !== null ? `${delta >= 0 ? '+' : ''}${formatNumber(delta, 1)}%` : null;

        let statusClass, achievementBadgeClass;
        if (achievement >= 100) {
            statusClass = 'font-extrabold text-stone-900';
            achievementBadgeClass = 'success';
        } else if (achievement >= 85) {
            statusClass = 'font-extrabold text-stone-900';
            achievementBadgeClass = 'warning';
        } else if (achievement >= 60) {
            statusClass = 'font-bold text-stone-800';
            achievementBadgeClass = 'warning';
        } else {
            statusClass = 'font-bold text-stone-800';
            achievementBadgeClass = 'danger';
        }

        const deltaColor = delta === null
            ? 'font-semibold text-stone-600'
            : (delta >= 0 ? 'font-extrabold text-stone-900' : 'font-bold text-stone-800');

        const evolutionRow = prevDate
            ? `<div class="metric-row">
                   <span class="text-sm font-bold text-stone-700">Evolução (${prevDate} &rarr; ${date})</span>
                   <span class="text-sm ${deltaColor}">${prevValue} &rarr; ${value} (${deltaStr})</span>
               </div>`
            : `<div class="metric-row">
                   <span class="text-sm font-bold text-stone-700">Situação</span>
                   <span class="text-sm font-semibold text-stone-600">Primeiro período registrado</span>
               </div>`;

        const narrative = buildNarrative(store, date, value, meta, achievement, delta);

        return `
            <div class="flex items-center justify-between gap-3 mb-4">
                <p class="font-extrabold text-lg text-stone-900">${store}</p>
                <span class="achievement-badge ${achievementBadgeClass}">${formatNumber(achievement, 1)}% da meta</span>
            </div>
            <p class="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4">Análise de Desempenho &bull; Reunião de Equipe</p>
            <div class="space-y-2 text-left">
                <div class="metric-row">
                    <span class="text-sm font-bold text-stone-700">Meta Mensal</span>
                    <span class="text-sm font-extrabold text-stone-900">${meta} vendas</span>
                </div>
                <div class="metric-row">
                    <span class="text-sm font-bold text-stone-700">Realizado</span>
                    <span class="text-sm ${statusClass}">${value} vendas</span>
                </div>
                <div class="metric-row">
                    <span class="text-sm font-bold text-stone-700">Atingimento</span>
                    <span class="text-sm ${statusClass}">${formatNumber(achievement, 1)}%</span>
                </div>
                ${evolutionRow}
            </div>
            <div class="narrative-box ${achievementBadgeClass}">
                <p class="font-extrabold text-stone-900 mb-2">Análise Formal:</p>
                <p class="leading-relaxed font-medium text-stone-700 text-sm">${narrative}</p>
            </div>`;
    };

    const setBackgroundInert = (inert) => {
        ['header', 'main'].forEach((sel) => {
            const el = document.querySelector(sel);
            if (!el) return;
            if (inert) el.setAttribute('inert', '');
            else el.removeAttribute('inert');
        });
    };

    const getModalFocusables = () => {
        if (!DOM.modalPanel) return [];
        const nodes = DOM.modalPanel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        return Array.from(nodes).filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0);
    };

    const restoreModalFocus = () => {
        const el = state.lastFocusedElement;
        state.lastFocusedElement = null;
        if (!el || !el.isConnected || typeof el.focus !== 'function') return;
        if (el === document.body || el === document.documentElement) return;
        const nativelyFocusable = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'IFRAME'].includes(el.tagName);
        if (nativelyFocusable || el.hasAttribute('tabindex')) el.focus();
    };

    const openModal = (store, date, value, color, triggerElement = null) => {
        // Cancela um fechamento em andamento: sem isso, o timer pendente
        // esconderia o modal recém-reaberto
        if (state.modalCloseTimer) {
            clearTimeout(state.modalCloseTimer);
            state.modalCloseTimer = null;
        }

        state.lastFocusedElement = triggerElement || document.activeElement;
        state.modalOpen = true;
        hideTooltip();

        DOM.modalStoreName.textContent = store;
        DOM.modalDateLabel.textContent = date;
        DOM.modalValueDisplay.textContent = formatNumber(value);

        if (DOM.modalStatusDot) {
            DOM.modalStatusDot.style.backgroundColor = color;
        }

        DOM.modalFeedbackContent.innerHTML = generateFeedbackHTML(store, date, value);
        DOM.modalFeedbackContainer.classList.remove('hidden');

        DOM.detailModal.style.pointerEvents = 'auto';
        DOM.detailModal.classList.remove('hidden');
        DOM.modalBackdrop.classList.remove('fade-out');
        DOM.modalBackdrop.classList.add('fade-in');
        DOM.modalPanel.classList.remove('slide-down');
        DOM.modalPanel.classList.add('bounce-in');

        [DOM.modalStoreName, DOM.modalDateLabel, DOM.modalValueDisplay, DOM.modalFeedbackContainer].forEach((el, i) => {
            if (!el) return;
            el.classList.remove('modal-content-item');
            void el.offsetWidth;
            el.classList.add('modal-content-item');
            el.style.animationDelay = (0.18 + i * 0.08) + 's';
        });

        setBackgroundInert(true);
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            if (state.modalOpen && DOM.modalCloseBtn) {
                DOM.modalCloseBtn.focus();
            }
        }, 100);
    };

    const closeModal = () => {
        if (!state.modalOpen) return;
        state.modalOpen = false;

        document.body.style.overflow = '';
        setBackgroundInert(false);
        // Desbloqueia cliques no dashboard imediatamente ao iniciar o fechamento
        DOM.detailModal.style.pointerEvents = 'none';

        DOM.modalBackdrop.classList.remove('fade-in');
        DOM.modalBackdrop.classList.add('fade-out');
        DOM.modalPanel.classList.remove('bounce-in');
        DOM.modalPanel.classList.add('slide-down');
        [DOM.modalStoreName, DOM.modalDateLabel, DOM.modalValueDisplay, DOM.modalFeedbackContainer].forEach((el) => {
            if (!el) return;
            el.style.animationDelay = '';
        });

        if (state.modalCloseTimer) clearTimeout(state.modalCloseTimer);
        state.modalCloseTimer = setTimeout(() => {
            state.modalCloseTimer = null;
            DOM.detailModal.classList.add('hidden');
            DOM.modalBackdrop.classList.remove('fade-out');
            DOM.modalPanel.classList.remove('slide-down');
            DOM.detailModal.style.pointerEvents = '';
            [DOM.modalStoreName, DOM.modalDateLabel, DOM.modalValueDisplay, DOM.modalFeedbackContainer].forEach((el) => {
                if (!el) return;
                el.classList.remove('modal-content-item');
            });

            restoreModalFocus();
        }, 250);
    };

    const setupModalListeners = () => {
        if (DOM.modalWrapper) {
            DOM.modalWrapper.addEventListener('click', (e) => {
                if (e.target === DOM.modalWrapper) closeModal();
            });
        }
        if (DOM.modalCloseBtn) {
            DOM.modalCloseBtn.addEventListener('click', () => closeModal());
        }
        document.addEventListener('keydown', (e) => {
            if (!state.modalOpen) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
                return;
            }

            if (e.key !== 'Tab') return;
            const focusables = getModalFocusables();
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            const inside = !!(active && DOM.modalPanel && DOM.modalPanel.contains(active));

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

    const targetLinesPlugin = {
        id: 'targetLines',
        beforeDraw: (chart) => {
            const { ctx, chartArea, scales } = chart;
            if (!chartArea) return;
            const { left, right } = chartArea;
            const { y } = scales;
            const lines = chart.options.plugins.targetLines?.lines || [];
            if (!lines.length) return;

            ctx.save();
            for (const line of lines) {
                const yPos = y.getPixelForValue(line.value);
                ctx.strokeStyle = line.color || '#94a3b8';
                ctx.lineWidth = line.width || 1;
                ctx.setLineDash(line.dash || [4, 4]);
                ctx.beginPath();
                ctx.moveTo(left, yPos);
                ctx.lineTo(right, yPos);
                ctx.stroke();
            }
            ctx.restore();
        }
    };

    const lineDrawAnimation = {
        id: 'lineDrawAnimation',
        beforeDatasetsDraw(chart) {
            const { ctx, chartArea } = chart;
            if (!chartArea) return;
            const progress = chart.lineDrawProgress !== undefined ? chart.lineDrawProgress : 1;
            ctx.save();
            const clipWidth = (chartArea.right - chartArea.left) * progress;
            ctx.beginPath();
            ctx.rect(chartArea.left, chartArea.top - 20, clipWidth, (chartArea.bottom - chartArea.top) + 40);
            ctx.clip();
        },
        afterDatasetsDraw(chart) {
            if (chart.ctx) chart.ctx.restore();
        }
    };

    const lineEndLogoPlugin = {
        id: 'lineEndLogo',
        afterDatasetsDraw(chart) {
            if (!chart.chartArea) return;

            const progress = chart.lineDrawProgress !== undefined ? chart.lineDrawProgress : 1;
            if (progress <= 0) return;

            const { ctx, data, chartArea } = chart;
            const totalPoints = data.labels.length;
            if (totalPoints === 0) return;

            const clipX = chartArea.left + (chartArea.right - chartArea.left) * progress;
            const isHoveringAny = currentHoveredDatasetIndex !== -1;

            for (let datasetIndex = 0; datasetIndex < data.datasets.length; datasetIndex++) {
                if (!chart.isDatasetVisible(datasetIndex)) continue;
                const dataset = data.datasets[datasetIndex];
                const logo = state.loadedLogos[dataset.storeName];
                if (!logo) continue;

                const meta = chart.getDatasetMeta(datasetIndex);
                if (!meta || !meta.data || !meta.data.length) continue;

                const points = meta.data.filter(p => p && !p.skip && !isNaN(p.x) && !isNaN(p.y));
                if (!points.length) continue;

                let targetX, targetY;
                if (progress >= 1) {
                    const lastPoint = points[points.length - 1];
                    targetX = lastPoint.x;
                    targetY = lastPoint.y;
                } else {
                    const pFirst = points[0];
                    const pLast = points[points.length - 1];
                    if (clipX <= pFirst.x) {
                        targetX = pFirst.x;
                        targetY = pFirst.y;
                    } else if (clipX >= pLast.x) {
                        targetX = pLast.x;
                        targetY = pLast.y;
                    } else {
                        let p1 = pFirst;
                        let p2 = pLast;
                        for (let i = 0; i < points.length - 1; i++) {
                            if (points[i].x <= clipX && points[i + 1].x >= clipX) {
                                p1 = points[i];
                                p2 = points[i + 1];
                                break;
                            }
                        }
                        const span = p2.x - p1.x;
                        const r = span > 0 ? (clipX - p1.x) / span : 0;
                        targetX = clipX;
                        targetY = p1.y + r * (p2.y - p1.y);
                    }
                }

                if (targetX < chartArea.left || targetX > chartArea.right + 20) continue;
                if (targetY < chartArea.top - 20 || targetY > chartArea.bottom + 20) continue;

                const isCurrentHighlighted = datasetIndex === currentHoveredDatasetIndex;
                const alpha = isHoveringAny ? (isCurrentHighlighted ? 1.0 : 0.25) : 1.0;

                const logoSize = 26;
                const halfSize = logoSize / 2;

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(targetX, targetY, halfSize + 2, 0, Math.PI * 2);
                ctx.fillStyle = '#FFFFFF';
                ctx.fill();
                ctx.strokeStyle = dataset.borderColor || '#e7e5e4';
                ctx.lineWidth = isCurrentHighlighted ? 2 : 1.5;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(targetX, targetY, halfSize, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(logo, targetX - halfSize, targetY - halfSize, logoSize, logoSize);
                ctx.restore();
            }
        }
    };

    if (typeof Chart !== 'undefined') {
        Chart.register(targetLinesPlugin);
        Chart.register(lineDrawAnimation);
        Chart.register(lineEndLogoPlugin);
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }
    }

    const updateSummaryMetrics = (data, chart = null) => {
        let total = 0;
        const visibleStores = chart
            ? allStoreNames.filter((_, i) => chart.isDatasetVisible(i))
            : allStoreNames;

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            for (let j = 0; j < visibleStores.length; j++) {
                const v = parseFloat(row[visibleStores[j]]);
                if (!isNaN(v)) total += v;
            }
        }
        animateCounter(DOM.totalSales, total, 1000);
        animateCounter(DOM.averageSales, data.length > 0 ? total / data.length : 0, 1000);
    };

    // Aplica as cores originais da marca em todas as linhas e bolinhas visíveis
    const setLinesToOriginalColors = (chart) => {
        if (!chart) return;
        currentHoveredDatasetIndex = -1;
        lastHoverKey = '';
        chart.data.datasets.forEach((ds, idx) => {
            ds.borderColor = ds.originalBorderColor;
            ds.borderWidth = 3;
            ds.pointRadius = 6;
            ds.pointBorderWidth = 2.5;
            ds.pointBorderColor = ds.originalBorderColor;
            ds.pointBackgroundColor = '#FFFFFF';
            ds.pointHoverRadius = 9;
            ds.pointHoverBorderColor = ds.originalBorderColor;
            ds.pointHoverBackgroundColor = '#FFFFFF';
            ds.order = 2;
            if (!ds.datalabels) ds.datalabels = {};
            ds.datalabels.display = 'auto';

            const meta = chart.getDatasetMeta(idx);
            if (meta && meta.data) {
                for (let i = 0; i < meta.data.length; i++) {
                    const pt = meta.data[i];
                    if (pt && pt.options) {
                        pt.options.borderColor = ds.originalBorderColor;
                        pt.options.backgroundColor = '#FFFFFF';
                        pt.options.borderWidth = 2.5;
                        pt.options.radius = 6;
                        pt.options.hoverRadius = 9;
                        pt.options.hoverBorderColor = ds.originalBorderColor;
                        pt.options.hoverBackgroundColor = '#FFFFFF';
                    }
                }
            }
        });
    };

    // Algoritmo geométrico contínuo:
    // Calcula a distância vertical em relação à curva interpolada de cada linha.
    // Pontos com dado nulo chegam do Chart.js com skip=true e y na linha de base,
    // então precisam ser descartados antes de qualquer comparação.
    const getClosestDatasetAndPoint = (chart, mx, my) => {
        if (!chart || !chart.chartArea) return { datasetIndex: -1, pointIndex: -1 };
        const { left, right, top, bottom } = chart.chartArea;
        if (mx < left || mx > right || my < top - 30 || my > bottom + 30) {
            return { datasetIndex: -1, pointIndex: -1 };
        }

        let minDistance = Infinity;
        let bestDatasetIndex = -1;
        let bestPointIndex = -1;

        for (let dsIndex = 0; dsIndex < chart.data.datasets.length; dsIndex++) {
            if (!chart.isDatasetVisible(dsIndex)) continue;
            const meta = chart.getDatasetMeta(dsIndex);
            if (!meta || !meta.data || meta.data.length === 0) continue;

            const pts = [];
            for (let i = 0; i < meta.data.length; i++) {
                const p = meta.data[i];
                if (!p || p.skip || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
                pts.push({ index: i, x: p.x, y: p.y });
            }
            if (pts.length === 0) continue;

            const first = pts[0];
            const last = pts[pts.length - 1];

            // Encontrar o ponto mais próximo em X
            let nearest = first;
            let minXDist = Infinity;
            for (let i = 0; i < pts.length; i++) {
                const xDist = Math.abs(mx - pts[i].x);
                if (xDist < minXDist) {
                    minXDist = xDist;
                    nearest = pts[i];
                }
            }

            // Calcular a altura Y exata na curva da linha na coordenada mx
            let lineY = null;
            if (mx <= first.x) {
                lineY = first.y;
            } else if (mx >= last.x) {
                lineY = last.y;
            } else {
                for (let i = 0; i < pts.length - 1; i++) {
                    const p1 = pts[i];
                    const p2 = pts[i + 1];
                    if (mx >= p1.x && mx <= p2.x) {
                        const span = p2.x - p1.x;
                        const r = span > 0 ? (mx - p1.x) / span : 0;
                        const smoothR = r * r * (3 - 2 * r);
                        lineY = p1.y + smoothR * (p2.y - p1.y);
                        break;
                    }
                }
            }

            if (lineY !== null && Number.isFinite(lineY)) {
                const dist = Math.abs(my - lineY);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestDatasetIndex = dsIndex;
                    bestPointIndex = nearest.index;
                }
            }
        }

        // Tolerância de proximidade vertical (até 70px)
        if (minDistance <= 70) {
            return { datasetIndex: bestDatasetIndex, pointIndex: bestPointIndex };
        }
        return { datasetIndex: -1, pointIndex: -1 };
    };

    // Aplica o estado de hover e atualiza cores e tooltip com altíssima fidelidade
    const setHoveredState = (chart, targetDatasetIndex, targetPointIndex, eventCoord = null) => {
        if (!chart || chart._isAnimatingDraw || !isChartUsable(chart)) return;

        const datasetChanged = (currentHoveredDatasetIndex !== targetDatasetIndex);
        const hoverKey = targetDatasetIndex + ':' + targetPointIndex;
        const pointChanged = (lastHoverKey !== hoverKey);
        currentHoveredDatasetIndex = targetDatasetIndex;
        lastHoverKey = hoverKey;

        const isHovering = targetDatasetIndex !== -1;
        const grey = '#d6d3d1';

        // Nada mudou: evita reprocessar todo o gráfico a cada pixel do mouse.
        // Só a posição do tooltip precisa acompanhar o cursor.
        if (!datasetChanged && !pointChanged) {
            if (isHovering && targetPointIndex !== -1 && eventCoord && chart.tooltip) {
                chart.tooltip.setActiveElements(
                    [{ datasetIndex: targetDatasetIndex, index: targetPointIndex }],
                    eventCoord
                );
                chart.render();
            }
            return;
        }

        if (datasetChanged) {
            const datasets = chart.data.datasets;
            for (let idx = 0; idx < datasets.length; idx++) {
                if (!chart.isDatasetVisible(idx)) continue;
                const ds = datasets[idx];
                const meta = chart.getDatasetMeta(idx);

                const isHoveredLine = isHovering && idx === targetDatasetIndex;
                const isDimmedLine = isHovering && idx !== targetDatasetIndex;

                let bColor, bWidth, pRadius, pBorderWidth, pBorderColor, pBg, pHoverRadius, pOrder, datalabelsShow;

                if (isHoveredLine) {
                    bColor = ds.originalBorderColor;
                    bWidth = 3.5;
                    pRadius = 6.5;
                    pBorderWidth = 2.5;
                    pBorderColor = ds.originalBorderColor;
                    pBg = '#FFFFFF';
                    pHoverRadius = 9;
                    pOrder = 1; // Linha selecionada vem para a frente
                    datalabelsShow = 'auto';
                } else if (isDimmedLine) {
                    bColor = grey;
                    bWidth = 1.5;
                    pRadius = 3.5;
                    pBorderWidth = 1.5;
                    pBorderColor = grey;
                    pBg = '#f5f5f4';
                    pHoverRadius = 3.5;
                    pOrder = 10; // Linhas apagadas vão para o fundo
                    datalabelsShow = false;
                } else {
                    bColor = ds.originalBorderColor;
                    bWidth = 3;
                    pRadius = 6;
                    pBorderWidth = 2.5;
                    pBorderColor = ds.originalBorderColor;
                    pBg = '#FFFFFF';
                    pHoverRadius = 9;
                    pOrder = 2;
                    datalabelsShow = 'auto';
                }

                ds.borderColor = bColor;
                ds.borderWidth = bWidth;
                ds.pointRadius = pRadius;
                ds.pointBorderWidth = pBorderWidth;
                ds.pointBorderColor = pBorderColor;
                ds.pointBackgroundColor = pBg;
                ds.pointHoverRadius = pHoverRadius;
                ds.pointHoverBorderColor = pBorderColor;
                ds.pointHoverBackgroundColor = pBg;
                ds.order = pOrder;
                if (!ds.datalabels) ds.datalabels = {};
                ds.datalabels.display = datalabelsShow;

                if (meta && meta.data) {
                    for (let i = 0; i < meta.data.length; i++) {
                        const pt = meta.data[i];
                        if (pt && pt.options) {
                            pt.options.borderColor = pBorderColor;
                            pt.options.backgroundColor = pBg;
                            pt.options.borderWidth = pBorderWidth;
                            pt.options.radius = pRadius;
                            pt.options.hoverRadius = pHoverRadius;
                            pt.options.hoverBorderColor = pBorderColor;
                            pt.options.hoverBackgroundColor = pBg;
                        }
                    }
                }
            }
        }

        // Atualização do Tooltip focado apenas na linha ativa
        if (chart.tooltip) {
            if (isHovering && targetPointIndex !== -1) {
                chart.tooltip.setActiveElements(
                    [{ datasetIndex: targetDatasetIndex, index: targetPointIndex }],
                    eventCoord || { x: 0, y: 0 }
                );
            } else {
                chart.tooltip.setActiveElements([], { x: 0, y: 0 });
            }
        }

        chart.update('none');
    };

    // Configuração dos listeners no canvas uma única vez
    const setupCanvasHoverListeners = () => {
        if (canvasListenersAttached) return;
        const canvas = DOM.salesChart;
        if (!canvas) return;

        const applyHover = (e) => {
            const chart = state.salesChartInstance;
            if (!isChartUsable(chart) || chart._isAnimatingDraw) {
                canvas.style.cursor = 'default';
                return;
            }

            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const { datasetIndex, pointIndex } = getClosestDatasetAndPoint(chart, mx, my);
            canvas.style.cursor = datasetIndex !== -1 ? 'pointer' : 'default';
            setHoveredState(chart, datasetIndex, pointIndex, { x: mx, y: my });
        };

        // Agrupa movimentos em no máximo um tratamento por frame
        canvas.addEventListener('mousemove', (e) => {
            pendingMouseEvent = e;
            if (hoverFrameId !== null) return;
            hoverFrameId = requestAnimationFrame(() => {
                hoverFrameId = null;
                const evt = pendingMouseEvent;
                pendingMouseEvent = null;
                if (evt) applyHover(evt);
            });
        });

        canvas.addEventListener('click', (e) => {
            const chart = state.salesChartInstance;
            if (!isChartUsable(chart)) return;

            // Se o usuário clicar enquanto a animação estiver rodando, finaliza na hora para abrir o modal
            if (chart._isAnimatingDraw) {
                if (chart._lineDrawAnim && chart._lineDrawAnim.rafId) {
                    cancelAnimationFrame(chart._lineDrawAnim.rafId);
                    chart._lineDrawAnim = null;
                }
                chart._isAnimatingDraw = false;
                chart.lineDrawProgress = 1;
                setLinesToOriginalColors(chart);
                chart.update('none');
            }

            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const { datasetIndex, pointIndex } = getClosestDatasetAndPoint(chart, mx, my);
            if (datasetIndex !== -1 && pointIndex !== -1) {
                const ds = chart.data.datasets[datasetIndex];
                if (ds && ds.data[pointIndex] !== null && ds.data[pointIndex] !== undefined) {
                    openModal(
                        ds.storeName,
                        chart.data.labels[pointIndex],
                        ds.data[pointIndex],
                        ds.originalBackgroundColor
                    );
                }
            }
        });

        canvas.addEventListener('mouseleave', () => {
            cancelPendingHover();
            canvas.style.cursor = 'default';
            const chart = state.salesChartInstance;
            if (chart && !chart._isAnimatingDraw) {
                setHoveredState(chart, -1, -1);
            }
        });

        canvasListenersAttached = true;
    };

    // Animação de desenho da linha com velocidade suave e cadenciada (4500ms)
    const runLineDrawAnimation = (chart, duration = 4500) => {
        if (!isChartUsable(chart)) return;
        if (chart._lineDrawAnim && chart._lineDrawAnim.rafId) {
            cancelAnimationFrame(chart._lineDrawAnim.rafId);
        }

        cancelPendingHover();
        if (DOM.salesChart) DOM.salesChart.style.cursor = 'default';

        chart._isAnimatingDraw = true;
        chart.lineDrawProgress = 0;
        setLinesToOriginalColors(chart);
        chart.update('none');

        const startTime = performance.now();
        const animState = { rafId: null };
        chart._lineDrawAnim = animState;

        const tick = (now) => {
            if (!isChartUsable(chart)) {
                chart._isAnimatingDraw = false;
                chart._lineDrawAnim = null;
                return;
            }
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            const eased = easeInOutCubic(t);
            chart.lineDrawProgress = eased;
            // render() apenas redesenha: muito mais barato que update() por frame
            chart.render();
            if (t < 1) {
                animState.rafId = requestAnimationFrame(tick);
            } else {
                chart._isAnimatingDraw = false;
                chart._lineDrawAnim = null;
                chart.lineDrawProgress = 1;
                setLinesToOriginalColors(chart);
                chart.update('none');
            }
        };
        animState.rafId = requestAnimationFrame(tick);
    };

    let legendTooltipElement = null;

    const getOrCreateTooltip = () => {
        if (!legendTooltipElement) {
            legendTooltipElement = document.createElement('div');
            legendTooltipElement.id = 'legend-tooltip';
            legendTooltipElement.style.cssText = `
                position: fixed;
                background: #1c1917;
                padding: 6px 10px;
                border-radius: 0;
                font-size: 11px;
                font-weight: 500;
                color: #faf9f6;
                border: 1px solid #1c1917;
                pointer-events: none;
                z-index: 1000;
                white-space: nowrap;
                opacity: 0;
                transition: opacity 0.15s ease;
                letter-spacing: 0.05em;
                text-transform: uppercase;
            `;
            document.body.appendChild(legendTooltipElement);
        }
        return legendTooltipElement;
    };

    const showTooltip = (targetEl, text, borderColor) => {
        const tip = getOrCreateTooltip();
        tip.textContent = text;
        tip.style.borderColor = borderColor || '#1c1917';
        const rect = targetEl.getBoundingClientRect();
        tip.style.left = (rect.left + rect.width / 2) + 'px';
        tip.style.top = (rect.bottom + 8) + 'px';
        tip.style.transform = 'translateX(-50%)';
        tip.style.opacity = '1';
    };

    const hideTooltip = () => {
        if (legendTooltipElement) legendTooltipElement.style.opacity = '0';
    };

    const createCustomLegend = (chart) => {
        try {
            const existingLegend = document.getElementById('custom-legend');
            if (existingLegend) existingLegend.remove();

            const legendContainer = document.createElement('div');
            legendContainer.id = 'custom-legend';
            legendContainer.className = 'chart-legend';
            legendContainer.setAttribute('role', 'toolbar');
            legendContainer.setAttribute('aria-label', 'Filtros de lojas no gráfico');

            const makeCircle = (imgSrc, title, storeKey, borderColor) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'legend-btn';
                btn.dataset.store = storeKey;
                btn.title = title;
                btn.setAttribute('aria-label', `Alternar visualização da loja ${title}`);
                btn.setAttribute('aria-pressed', 'true');
                btn.style.animation = 'fadeInUp 0.4s ease both';

                const img = document.createElement('img');
                img.src = imgSrc;
                img.alt = title;
                img.loading = 'lazy';
                img.decoding = 'async';
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;pointer-events:none;';
                btn.appendChild(img);

                const setHoverState = (hover) => {
                    btn.style.transform = hover ? 'scale(1.05)' : 'scale(1)';
                    btn.style.borderColor = hover ? '#1c1917' : '#e7e5e4';
                };

                btn.addEventListener('mouseenter', () => {
                    setHoverState(true);
                    showTooltip(btn, title, borderColor);
                });
                btn.addEventListener('mouseleave', () => {
                    setHoverState(false);
                    hideTooltip();
                });
                btn.addEventListener('focus', () => showTooltip(btn, title, borderColor));
                btn.addEventListener('blur', () => hideTooltip());

                return btn;
            };

            const updateActiveStoresBadge = () => {
                const activeEl = document.getElementById('activeStoresText');
                const badgeEl = document.getElementById('activeStoresBadge');
                if (!activeEl) return;

                const visibleCount = allStoreNames.filter((_, i) => chart.isDatasetVisible(i)).length;
                const text = visibleCount === 1 ? '1 Loja Ativa' : `${visibleCount} Lojas Ativas`;
                if (activeEl.textContent !== text) {
                    activeEl.textContent = text;
                    if (badgeEl) {
                        badgeEl.classList.remove('badge-pop');
                        void badgeEl.offsetWidth;
                        badgeEl.classList.add('badge-pop');
                    }
                }
            };

            const updateOpacity = () => {
                const visibleCount = allStoreNames.filter((_, i) => chart.isDatasetVisible(i)).length;
                const allVis = visibleCount === allStoreNames.length;
                const todasBtn = legendContainer.querySelector('[data-store="__todas__"]');
                if (todasBtn) {
                    todasBtn.style.opacity = allVis ? '1' : '0.35';
                    todasBtn.style.borderColor = allVis ? '#1c1917' : '#e7e5e4';
                    todasBtn.style.boxShadow = allVis ? '0 2px 8px rgba(0,0,0,0.08)' : 'none';
                    todasBtn.setAttribute('aria-pressed', allVis ? 'true' : 'false');
                }
                allStoreNames.forEach((store, i) => {
                    const btn = legendContainer.querySelector(`[data-store="${store}"]`);
                    const isVis = chart.isDatasetVisible(i);
                    const cfg = STORE_CONFIG[store];
                    if (btn) {
                        btn.style.opacity = isVis ? '1' : '0.35';
                        btn.style.borderColor = isVis ? (cfg?.borderColor || '#1c1917') : '#e7e5e4';
                        btn.style.boxShadow = isVis ? '0 2px 8px rgba(0,0,0,0.08)' : 'none';
                        btn.setAttribute('aria-pressed', isVis ? 'true' : 'false');
                    }
                });
                updateActiveStoresBadge();
            };

            const todasBtn = document.createElement('button');
            todasBtn.type = 'button';
            todasBtn.className = 'legend-btn';
            todasBtn.dataset.store = '__todas__';
            todasBtn.title = 'Todas as Lojas';
            todasBtn.setAttribute('aria-label', 'Exibir todas as lojas');
            todasBtn.setAttribute('aria-pressed', 'true');
            todasBtn.style.animation = 'fadeInUp 0.4s ease 0.1s both';

            const todasImg = document.createElement('img');
            todasImg.src = 'img/todas.jpg';
            todasImg.alt = 'Todas as Lojas';
            todasImg.loading = 'lazy';
            todasImg.decoding = 'async';
            todasImg.style.cssText = 'width:100%;height:100%;object-fit:cover;transform:scale(1.465);transform-origin:center;pointer-events:none;';
            todasBtn.appendChild(todasImg);

            todasBtn.addEventListener('mouseenter', () => {
                todasBtn.style.transform = 'scale(1.05)';
                todasBtn.style.borderColor = '#1c1917';
                showTooltip(todasBtn, 'Todas as Lojas', '#1c1917');
            });
            todasBtn.addEventListener('mouseleave', () => {
                todasBtn.style.transform = 'scale(1)';
                todasBtn.style.borderColor = '#e7e5e4';
                hideTooltip();
            });
            todasBtn.addEventListener('focus', () => showTooltip(todasBtn, 'Todas as Lojas', '#1c1917'));
            todasBtn.addEventListener('blur', () => hideTooltip());

            // Clique em "Todas as Lojas": exibe todas e inicia a animação suave (4500ms)
            todasBtn.onclick = () => {
                allStoreNames.forEach((_, i) => chart.setDatasetVisibility(i, true));
                updateOpacity();
                updateSummaryMetrics(state.allValidData, chart);
                runLineDrawAnimation(chart, 4500);
            };

            legendContainer.appendChild(todasBtn);

            allStoreNames.forEach((store, idx) => {
                const img = state.loadedLogos[store];
                if (!img) return;
                const cfg = STORE_CONFIG[store];
                const displayName = cfg?.shortName || store;
                const btn = makeCircle(img.src, displayName, store, cfg?.borderColor);
                btn.style.animationDelay = (0.55 + idx * 0.07) + 's';

                // Lógica de Comparação Dinâmica Multi-Seleção:
                btn.onclick = () => {
                    const visibleCount = allStoreNames.filter((_, i) => chart.isDatasetVisible(i)).length;
                    const allVis = visibleCount === allStoreNames.length;
                    const isCurrentlyVisible = chart.isDatasetVisible(idx);

                    if (allVis) {
                        // 1. Se todas estavam ativas: isola a loja clicada para iniciar a comparação
                        allStoreNames.forEach((_, i) => {
                            chart.setDatasetVisibility(i, i === idx);
                        });
                        updateOpacity();
                        updateSummaryMetrics(state.allValidData, chart);
                        runLineDrawAnimation(chart, 3850);
                    } else if (isCurrentlyVisible) {
                        // 2. A loja clicada já está na comparação
                        if (visibleCount > 1) {
                            // Remove esta loja da comparação
                            chart.setDatasetVisibility(idx, false);
                            updateOpacity();
                            updateSummaryMetrics(state.allValidData, chart);
                            runLineDrawAnimation(chart, 3850);
                        } else {
                            // Se era a única ativa, restaura todas as lojas
                            allStoreNames.forEach((_, i) => chart.setDatasetVisibility(i, true));
                            updateOpacity();
                            updateSummaryMetrics(state.allValidData, chart);
                            runLineDrawAnimation(chart, 4500);
                        }
                    } else {
                        // 3. A loja não estava ativa: adiciona à comparação!
                        chart.setDatasetVisibility(idx, true);
                        const newVisCount = allStoreNames.filter((_, i) => chart.isDatasetVisible(i)).length;
                        updateOpacity();
                        updateSummaryMetrics(state.allValidData, chart);
                        runLineDrawAnimation(chart, newVisCount === allStoreNames.length ? 4500 : 3850);
                    }
                };

                btn.onmouseenter = () => {
                    if (chart.isDatasetVisible(idx)) setHoveredState(chart, idx, -1);
                };
                btn.onmouseleave = () => setHoveredState(chart, -1, -1);

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

        // Metas dinâmicas configuradas
        const uniqueTargets = [...new Set(Object.values(STORE_CONFIG).map(c => c.target))];
        const targetLinesConfig = uniqueTargets.map(val => ({
            value: val,
            color: val >= 100 ? 'rgba(196, 181, 160, 0.75)' : 'rgba(184, 196, 163, 0.75)',
            dash: [4, 4],
            width: 1
        }));

        // Escala dinâmica Y
        let maxDataValue = Math.max(...uniqueTargets);
        for (const row of state.allValidData) {
            for (const store of allStoreNames) {
                const val = parseFloat(row[store]);
                if (!isNaN(val) && val > maxDataValue) {
                    maxDataValue = val;
                }
            }
        }
        const dynamicYMax = Math.max(300, Math.ceil((maxDataValue * 1.12) / 50) * 50);

        const datasets = allStoreNames.map((store) => {
            const cfg = STORE_CONFIG[store];
            const data = new Array(state.allValidData.length);
            for (let i = 0; i < state.allValidData.length; i++) {
                const v = parseFloat(state.allValidData[i][store]);
                data[i] = isNaN(v) ? null : v;
            }
            return {
                label: cfg.shortName || store,
                storeName: store,
                data,
                originalBorderColor: cfg.borderColor,
                originalBackgroundColor: cfg.color,
                borderColor: cfg.borderColor,
                backgroundColor: cfg.color,
                tension: 0.35,
                fill: false,
                pointRadius: 6,
                pointHoverRadius: 9,
                hitRadius: 25,
                pointBackgroundColor: '#FFFFFF',
                pointBorderColor: cfg.borderColor,
                pointBorderWidth: 2.5,
                borderWidth: 3,
                datalabels: { display: 'auto' },
                spanGaps: true
            };
        });

        const ctx = DOM.salesChart.getContext('2d');
        if (state.salesChartInstance) {
            const prev = state.salesChartInstance;
            if (prev._lineDrawAnim && prev._lineDrawAnim.rafId) {
                cancelAnimationFrame(prev._lineDrawAnim.rafId);
            }
            prev._lineDrawAnim = null;
            prev._isAnimatingDraw = false;
            prev.destroy();
            state.salesChartInstance = null;
        }

        if (typeof Chart === 'undefined') {
            throw new Error('Chart.js não foi carregado');
        }

        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#78716c';

        state.salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: state.chartLabels,
                datasets
            },
            showLineEndLogos: true,
            lineDrawProgress: 0,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                events: [], // Desativa os eventos internos concorrentes do Chart.js para dar total controle ao motor nativo
                animation: false,
                animations: {
                    colors: false,
                    x: false,
                    y: false
                },
                layout: {
                    padding: { top: 30, right: 50, left: 50, bottom: 10 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(28, 25, 23, 0.95)',
                        titleColor: '#faf9f6',
                        bodyColor: '#d6d3d1',
                        borderColor: 'rgba(28, 25, 23, 0.95)',
                        borderWidth: 1,
                        padding: 14,
                        boxPadding: 6,
                        usePointStyle: true,
                        cornerRadius: 0,
                        titleFont: { weight: '600', size: 13, family: "'Inter', sans-serif" },
                        bodyFont: { weight: '400', size: 12, family: "'Inter', sans-serif" },
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
                        font: { weight: '600', size: 10 },
                        formatter: (val) => val !== null ? Math.round(val) : '',
                        display: (ctx) => ctx.dataset.datalabels?.display ?? 'auto'
                    },
                    targetLines: {
                        lines: targetLinesConfig
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11, weight: '500' }, color: '#78716c' },
                        border: { display: false },
                        offset: true,
                        min: -0.5,
                        max: state.chartLabels.length - 0.5
                    },
                    y: {
                        beginAtZero: true,
                        max: dynamicYMax,
                        border: { display: false },
                        grid: {
                            color: 'rgba(168, 162, 158, 0.15)',
                            borderDash: [4, 4],
                            tickLength: 0
                        },
                        ticks: {
                            stepSize: 50,
                            padding: 10,
                            font: { size: 11, weight: '500' },
                            color: '#78716c'
                        }
                    }
                }
            }
        });

        // Configura listeners nativos no canvas
        setupCanvasHoverListeners();

        createCustomLegend(state.salesChartInstance);
        runLineDrawAnimation(state.salesChartInstance, 4500);
    };

    const showError = (msg) => {
        DOM.loadingIndicator.classList.add('hidden');
        DOM.errorMessage.classList.remove('hidden');
        DOM.errorText.textContent = msg;
    };

    const init = async () => {
        try {
            DOM.loadingStatus.textContent = 'Carregando dados...';
            let response;
            try {
                response = await fetch('data/sales-data.csv');
            } catch (fetchErr) {
                console.error('Falha de rede no fetch:', fetchErr);
                throw new Error('Não foi possível carregar data/sales-data.csv. Se o dashboard foi aberto como arquivo local (file://), sirva-o por um servidor local (ex.: python3 -m http.server 8000) e acesse http://localhost:8000');
            }
            if (!response.ok) throw new Error(`Falha ao carregar o arquivo CSV de vendas (HTTP ${response.status})`);
            const rawCsvText = await response.text();

            DOM.loadingStatus.textContent = 'Processando métricas...';
            const csvText = rawCsvText.charCodeAt(0) === 0xFEFF ? rawCsvText.slice(1) : rawCsvText;
            const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
            if (lines.length < 2) throw new Error('CSV vazio ou sem registros válidos');

            const headers = parseCSVLine(lines[0]);

            const missingInCsv = allStoreNames.filter((store) => !headers.includes(store));
            const unknownInCsv = headers.filter((h) => h !== 'MES' && !allStoreNames.includes(h));
            if (missingInCsv.length || unknownInCsv.length) {
                console.warn('Colunas divergentes entre o CSV e a configuração:', {
                    ausentesNoCsv: missingInCsv,
                    desconhecidasNoCsv: unknownInCsv
                });
            }

            const dataRows = lines.slice(1);
            const parsed = new Array(dataRows.length);

            for (let i = 0; i < dataRows.length; i++) {
                const values = parseCSVLine(dataRows[i]);
                const row = {};
                for (let j = 0; j < headers.length; j++) {
                    row[headers[j]] = values[j] !== undefined ? values[j] : null;
                }
                parsed[i] = row;
            }

            const validRows = [];
            const labels = [];
            const seenLabels = new Set();
            for (const row of parsed) {
                if (!row.MES || row.MES.trim() === '') continue;
                const label = formatDateLabel(row.MES);
                if (label === '-') {
                    console.warn(`Linha descartada (data inválida): ${row.MES}`);
                    continue;
                }
                if (seenLabels.has(label)) {
                    console.warn(`Linha descartada (mês duplicado): ${row.MES}`);
                    continue;
                }
                seenLabels.add(label);
                validRows.push(row);
                labels.push(label);
            }
            if (!validRows.length) throw new Error('CSV vazio ou sem registros válidos');

            state.allValidData = validRows;
            state.chartLabels = labels;
            state.labelToIndex = new Map(labels.map((label, idx) => [label, idx]));

            updateSummaryMetrics(state.allValidData);

            if (DOM.exportBtn) DOM.exportBtn.disabled = false;

            DOM.loadingStatus.textContent = 'Carregando logos...';
            await preloadLogos();

            DOM.loadingStatus.textContent = 'Renderizando gráfico...';
            renderChart();
            DOM.loadingIndicator.classList.add('hidden');
            DOM.chartContainer.classList.remove('hidden');
        } catch (err) {
            console.error('Erro na inicialização do dashboard:', err);
            showError(err.message);
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        setupModalListeners();
        setupExportPanel({
            getData: () => ({ data: state.allValidData, labels: state.chartLabels })
        });
        init();
    });
})();
