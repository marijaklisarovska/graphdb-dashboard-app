let charts = [];

function showLoader() {
    document.getElementById('overlay').style.display = 'flex';
}

function hideLoader() {
    document.getElementById('overlay').style.display = 'none';
}

async function sendPrompt() {
    const prompt = document.getElementById('prompt').value;
    if (!prompt.trim()) return;

    showLoader();

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({prompt: prompt})
        });
        const data = await response.json();

        document.getElementById('cypher').textContent = data.executed_cypher;
        document.getElementById('results').textContent = JSON.stringify(data.results, null, 2);

        processAndVisualizeData(data.results);

    } catch (error) {
        console.error(error);
        document.getElementById('results').textContent = 'Error fetching data';
    } finally {
        hideLoader();
    }
}

function processAndVisualizeData(results) {
    document.getElementById('initialPlaceholder').style.display = 'none';
    document.getElementById('visualizationArea').style.display = 'block';

    clearVisualizations();

    if (!results || results.length === 0) {
        showMessage('No data found for the query');
        return;
    }

    const detectedCharts = detectChartTypes(results);
    if (detectedCharts.length > 0) {
        createCharts(detectedCharts);
        document.getElementById('chartWrapper').style.display = 'grid';
    } else {
        document.getElementById('chartWrapper').style.display = 'none';
    }

    createDataTable(results);
}

function detectChartTypes(results) {
    const charts = [];
    const firstRow = results[0];

    const numericFields = Object.keys(firstRow).filter(key => {
        const value = firstRow[key];
        return typeof value === 'number' || (!isNaN(parseFloat(value)) && isFinite(value));
    });

    const stringFields = Object.keys(firstRow).filter(key => {
        const value = firstRow[key];
        return typeof value === 'string' && isNaN(parseFloat(value));
    });

    const timeFields = Object.keys(firstRow).filter(key => 
        key.toLowerCase().includes('year') || key.toLowerCase().includes('y.year')
    );

    console.log('Detected fields:', { numericFields, stringFields, timeFields });

    // SCENARIO 1: Single category + single numeric value = Bar + Pie charts
    if (stringFields.length >= 1 && numericFields.length >= 1) {
        const categoryField = stringFields[0];
        const valueField = numericFields[0];
        const uniqueCategories = [...new Set(results.map(row => row[categoryField]))];
        
        if (uniqueCategories.length <= 15 && uniqueCategories.length >= 2) {
            charts.push({
                type: 'bar',
                title: `${valueField} by ${categoryField}`,
                description: `Comparison of ${valueField} across different ${categoryField}`,
                data: {
                    labels: results.map(row => row[categoryField]),
                    datasets: [{
                        label: valueField,
                        data: results.map(row => parseFloat(row[valueField])),
                        backgroundColor: generateColors(results.length)
                    }]
                }
            });

            if (results.length <= 8) {
                charts.push({
                    type: 'pie',
                    title: `Distribution of ${valueField}`,
                    description: `Percentage distribution of ${valueField}`,
                    data: {
                        labels: results.map(row => row[categoryField]),
                        datasets: [{
                            data: results.map(row => parseFloat(row[valueField])),
                            backgroundColor: generateColors(results.length)
                        }]
                    }
                });
            }
        }
    }

    // SCENARIO 2: Time series data = Line chart
    if (timeFields.length >= 1 && numericFields.length >= 1) {
        const timeField = timeFields[0];
        const valueField = numericFields[0];
        const sortedResults = [...results].sort((a, b) => a[timeField] - b[timeField]);

        charts.push({
            type: 'line',
            title: `${valueField} Over Time`,
            data: {
                labels: sortedResults.map(row => row[timeField]),
                datasets: [{
                    label: valueField,
                    data: sortedResults.map(row => parseFloat(row[valueField])),
                    borderColor: 'blue',
                    backgroundColor: 'rgba(0, 0, 255, 0.1)',
                    fill: false,
                    tension: 0.1
                }]
            }
        });
    }

    // SCENARIO 3: Multiple numeric values = Radar or Multi-line chart
    if (numericFields.length >= 2 && stringFields.length >= 1) {
        const categoryField = stringFields[0];
        const numericFieldsToUse = numericFields.slice(0, 6);

        if (results.length <= 10) {
            // Radar chart for comparing multiple metrics
            charts.push({
                type: 'radar',
                title: `Multi-dimensional Comparison`,
                description: `Comparison of multiple metrics across ${categoryField}`,
                data: {
                    labels: numericFieldsToUse,
                    datasets: results.map((row, index) => ({
                        label: row[categoryField],
                        data: numericFieldsToUse.map(field => parseFloat(row[field])),
                        backgroundColor: generateTransparentColor(index, results.length),
                        borderColor: generateColors(results.length)[index],
                        borderWidth: 2
                    }))
                }
            });
        }

        // Multi-line chart for trends if we have time data
        if (timeFields.length >= 1) {
            const timeField = timeFields[0];
            const sortedResults = [...results].sort((a, b) => a[timeField] - b[timeField]);
            const categories = [...new Set(results.map(row => row[categoryField]))];

            if (categories.length <= 8) {
                 charts.push({
                    type: 'line',
                    title: `Multiple ${categoryField} Trends`,
                    description: `Comparison of ${numericFields[0]} across different ${categoryField}`,
                    data: {
                        labels: [...new Set(sortedResults.map(row => row[timeField]))].sort(),
                        datasets: categories.map((category, index) => {
                            const categoryData = sortedResults.filter(row => row[categoryField] === category);
                            return {
                                label: category,
                                data: categoryData.map(row => parseFloat(row[numericFields[0]])),
                                borderColor: generateColors(categories.length)[index],
                                backgroundColor: generateTransparentColor(index, categories.length),
                                fill: false,
                                tension: 0.4
                            };
                        })
                    }
                 });
            }
        }
    }

    // SCENARIO 4: Two numeric fields = Scatter plot
    if (numericFields.length >= 2) {
        const xField = numericFields[0];
        const yField = numericFields[1];
        const labelField = stringFields[0] || 'Data Points';

        const datasets = [{
            label: labelField,
            data: results.map(row => ({
                x: parseFloat(row[xField]),
                y: parseFloat(row[yField])
            })),
            backgroundColor: generateColors(1)[0],
            borderColor: generateColors(1)[0],
            pointRadius: 6
        }];

        if (stringFields.length >= 1) {
            const categoryField = stringFields[0];
            const categories = [...new Set(results.map(row => row[categoryField]))];
            
            datasets.length = 0;

            categories.forEach((category, index) => {
                const categoryData = results.filter(row => row[categoryField] === category);
                datasets.push({
                    label: category,
                    data: categoryData.map(row => ({
                        x: parseFloat(row[xField]),
                        y: parseFloat(row[yField])
                    })),
                    backgroundColor: generateColors(categories.length)[index],
                    borderColor: generateColors(categories.length)[index],
                    pointRadius: 6
                });
            });
        }

        charts.push({
            type: 'scatter',
            title: `${yField} vs ${xField}`,
            description: `Relationship between ${yField} and ${xField}`,
            data: { datasets }
        });
    }

    // Chart 3: Pie chart for distribution (if we have one categorical and one numeric field)
    // if (stringFields.length >= 1 && numericFields.length >= 1 && results.length <= 8) {
    //     const categoryField = stringFields[0];
    //     const valueField = numericFields[0];
        
    //     charts.push({
    //         type: 'pie',
    //         title: `Distribution of ${valueField}`,
    //         data: {
    //             labels: results.map(row => row[categoryField]),
    //             datasets: [{
    //                 data: results.map(row => parseFloat(row[valueField])),
    //                 backgroundColor: generateColors(results.length)
    //             }]
    //         }
    //     });
    // }

     console.log('Generated charts:', charts.length);
    return charts;
}

function createCharts(chartConfigs) {
    const chartWrapper = document.getElementById('chartWrapper');

    chartConfigs.forEach((config, index) => {
        const chartCard = document.createElement('div');
        chartCard.className = 'chart-card';
        
        const title = document.createElement('h3');
        title.textContent = config.title;
        chartCard.appendChild(title);

        if (config.description) {
            const description = document.createElement('p');
            description.className = 'chart-description';
            description.textContent = config.description;
            chartCard.appendChild(description);
        }
        
        const container = document.createElement('div');
        container.className = 'chart-container';
        
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        chartCard.appendChild(container);
        
        chartWrapper.appendChild(chartCard);

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: config.type,
            data: config.data,
            options: getChartOptions(config.type, config.title)
        });

        charts.push(chart);
    });
}

function getChartOptions(type, title) {
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: title
            }
        }
    };

    switch (type) {
        case 'bar':
            return baseOptions;
        case 'line':
            return {
                ...baseOptions,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Value'
                        }
                    }
                }
            };
        case 'pie':
            return baseOptions;
        case 'radar':
            return baseOptions;
        case 'scatter':
            return {
                ...baseOptions,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'X Value'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Y Value'
                        }
                    }
                }
            };
        default:
            return baseOptions;
    }
}

function createDataTable(results) {
    const container = document.getElementById('dataTableContainer');
    container.innerHTML = '';
    
    if (!results || results.length === 0) {
        container.innerHTML = '<p>No data available</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'data-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    Object.keys(results[0]).forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    
    results.forEach(row => {
        const tr = document.createElement('tr');
        
        Object.values(row).forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
}

function clearVisualizations() {
    charts.forEach(chart => chart.destroy());
    charts = [];
    document.getElementById('chartWrapper').innerHTML = '';
    document.getElementById('dataTableContainer').innerHTML = '';
}

function showMessage(message) {
    const visualizationArea = document.getElementById('visualizationArea');
    visualizationArea.innerHTML = `<div class="placeholder">${message}</div>`;
    visualizationArea.style.display = 'block';
}

function showError(message) {
    const visualizationArea = document.getElementById('visualizationArea');
    visualizationArea.innerHTML = `<div class="placeholder error">${message}</div>`;
    visualizationArea.style.display = 'block';
}

function generateColors(count) {
    const colors = [
        '#4dc9f6', '#f67019', '#f53794', '#537bc4', '#acc236',
        '#166a8f', '#00a950', '#58595b', '#8549ba', '#ff6e54',
        '#665191', '#a05195', '#d45087', '#f95d6a', '#ff7c43'
    ];

    if (count > colors.length) {
        const additionalColors = [];
        for (let i = colors.length; i < count; i++) {
            additionalColors.push(`hsl(${(i * 137.5) % 360}, 70%, 65%)`);
        }
        return [...colors, ...additionalColors];
    }
    
    return colors.slice(0, count);
}

function generateTransparentColor(index, total) {
    const baseColors = generateColors(total);
    return baseColors[index] + '40';
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('initialPlaceholder').style.display = 'block';
    document.getElementById('visualizationArea').style.display = 'none';
});

function initializeCharts() {
    
    if (chart1) {
        chart1.destroy();
    }
    if (chart2) {
        chart2.destroy();
    }

    const ctx1 = document.getElementById("chart1");
    const ctx2 = document.getElementById("chart2");
    
    chart1 = new Chart(ctx1, {
        type: "bar",
        data: {
            labels: ["Finland", "Denmark", "Sweden"],
            datasets: [{
                label: "Happiness Score 2020",
                data: [7.8, 7.6, 7.5],
                backgroundColor: ["#4dc9f6", "#f67019", "#f53794"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });

    chart2 = new Chart(ctx2, {
        type: "line",
        data: {
            labels: ["2018", "2019", "2020", "2021"],
            datasets: [{
                label: "Finland Happiness Trend",
                data: [7.6, 7.8, 7.7, 7.9],
                borderColor: "blue",
                backgroundColor: "rgba(0, 0, 255, 0.1)",
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}