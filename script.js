document.addEventListener('DOMContentLoaded', async () => {
    // Referências aos elementos HTML
    const loadingIndicator = document.getElementById('loadingIndicator');
    const chartContainer = document.getElementById('chartContainer');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    try {
        // Dados do arquivo GRAFICO VENDAS.xlsx - Sheet1.csv
        // As linhas iniciais vazias foram removidas para simplificar o parsing.
        // O cabeçalho e os dados começam a partir da coluna 'MES'.
        const csvData = `MES,MI PLACE KASSOUF,MI PLACE XV,MI PLACE DOM PEDRO,MI PLACE REALME,MI PLACE PREMIUM
2024-07-01,107,104,,57,
2024-08-01,113,90,132,57,
2024-09-01,107,65,155,61,
2024-10-01,106,63,139,39,
2024-11-01,98,89,176,47,
2024-12-01,129,62,242,60,
2025-01-01,115,68,271,90,23
2025-02-01,58,66,162,67,53,
2025-03-01,36,47,115,39,38,
2025-04-01,58,67,140,81,58,
2025-05-01,42,48,136,59,55,
2025-06-01,72,83,175,87,85,
2025-07-01,65,77,137,54,66,
2025-08-01,65,49,117,68,65, `; 
// Nova linha de dados para Julho de 2025

        // Função para parsear o CSV
        function parseCSV(csv) {
            const lines = csv.trim().split('\n');
            const headers = lines[0].split(',');
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                const row = {};
                headers.forEach((header, index) => {
                    // Trim para remover espaços em branco e tratar valores vazios como null
                    const value = values[index] ? values[index].trim() : '';
                    row[header.trim()] = value === '' ? null : value;
                });
                data.push(row);
            }
            return data;
        }

        const parsedData = parseCSV(csvData);

        // Preparar os dados para o Chart.js
        const labels = parsedData.map(row => {
            // Formatar a data para "Mês/Ano" (ex: Jun/24)
            const date = new Date(row.MES);
            const month = date.toLocaleString('pt-BR', { month: 'short' }).replace('.', ''); // 'short' para 3 letras, remove o ponto
            const year = date.getFullYear().toString().slice(-2); // Últimos 2 dígitos do ano
            return `${month.charAt(0).toUpperCase() + month.slice(1)}/${year}`;
        });

        const storeNames = ['MI PLACE KASSOUF', 'MI PLACE XV', 'MI PLACE DOM PEDRO', 'MI PLACE REALME', 'MI PLACE PREMIUM'];
        const colors = [
            'rgba(233, 105, 36, 1)', // Verde-água
            'rgba(33, 30, 31, 1)', // Vermelho
            'rgba(35, 154, 234, 1)', // Azul
            'rgba(238, 218, 37, 1)', // Amarelo
            'rgba(55, 207, 49, 1)' // Roxo
        ];
        const borderColors = [
            'rgba(228, 145, 43, 1)',
            'rgba(31, 27, 28, 1)',
            'rgba(31, 155, 237, 1)',
            'rgba(255, 205, 86, 1)',
            'rgba(26, 190, 78, 1)'
        ];

        const datasets = storeNames.map((store, index) => {
            return {
                label: store,
                data: parsedData.map(row => {
                    // Converter para número, ou null se não for um número válido (incluindo vazio)
                    const value = parseFloat(row[store]);
                    return isNaN(value) ? null : value;
                }),
                borderColor: borderColors[index],
                backgroundColor: colors[index],
                tension: 0.3, // Suaviza as linhas
                fill: false, // Não preenche a área abaixo da linha
                pointRadius: 5, // Tamanho dos pontos
                pointHoverRadius: 8, // Tamanho dos pontos ao passar o mouse
                pointBackgroundColor: borderColors[index],
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            };
        });

        // Configuração do gráfico Chart.js
        const ctx = document.getElementById('salesChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Permite que o gráfico se ajuste ao tamanho do container
                plugins: {
                    title: {
                        display: true,
                        text: 'Quantidade de Vendas por Loja (Jun/24 - Jul/25)', // Título atualizado para incluir Julho
                        font: {
                            size: 20,
                            weight: 'bold'
                        },
                        color: '#333'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleFont: { size: 14 },
                        bodyFont: { size: 12 },
                        padding: 10,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('pt-BR').format(context.parsed.y);
                                } else {
                                    label += 'N/A';
                                }
                                return label;
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: {
                                size: 12
                            },
                            color: '#555'
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Mês',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: '#333'
                        },
                        ticks: {
                            color: '#555'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Quantidade de Vendas',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: '#333'
                        },
                        beginAtZero: true,
                        ticks: {
                            color: '#555'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                }
            }
        });

        // Ocultar indicador de carregamento e mostrar o gráfico
        loadingIndicator.classList.add('hidden');
        chartContainer.classList.remove('hidden');

    } catch (error) {
        console.error("Erro ao carregar ou renderizar o gráfico:", error);
        loadingIndicator.classList.add('hidden');
        errorMessage.classList.remove('hidden');
        errorText.textContent = `Não foi possível carregar os dados do gráfico: ${error.message}`;
    }
});
