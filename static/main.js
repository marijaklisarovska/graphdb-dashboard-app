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
        showError('Failed to fetch data from server');
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
    
    const fields = analyzeFields(results);
    console.log('Analyzed fields:', fields);

    const { numericFields, stringFields, timeFields, categoricalFields } = fields;

    // SCENARIO 1: Time series data (year + numeric value) - Line chart
    if (timeFields.length > 0 && numericFields.length > 0) {
        const timeField = timeFields[0];
        const valueField = numericFields.find(f => !timeFields.includes(f)) || numericFields[0];
        const categoryField = categoricalFields[0];
        const sortedResults = [...results].sort((a, b) => a[timeField] - b[timeField]);
        
        if (categoryField) {
            const categories = [...new Set(results.map(row => row[categoryField]))];
            
            if (categories.length <= 8) {
                const allTimePoints = [...new Set(sortedResults.map(row => row[timeField]))].sort();
                
                charts.push({
                    type: 'line',
                    title: `${valueField} Trends Over Time`,
                    description: `Comparison of ${valueField} across different ${categoryField}`,
                    data: {
                        labels: allTimePoints,
                        datasets: categories.map((category, index) => {
                            const categoryData = sortedResults.filter(row => row[categoryField] === category);
                            
                            const data = allTimePoints.map(timePoint => {
                                const point = categoryData.find(row => row[timeField] === timePoint);
                                return point ? parseFloat(point[valueField]) : null;
                            });
                            
                            return {
                                label: category,
                                data: data,
                                borderColor: generateColors(categories.length)[index],
                                backgroundColor: generateTransparentColor(index, categories.length),
                                fill: false,
                                tension: 0.4,
                                spanGaps: true
                            };
                        })
                    }
                });
            }
        } else {
            charts.push({
                type: 'line',
                title: `${valueField} Over Time`,
                description: `Historical trend of ${valueField}`,
                data: {
                    labels: sortedResults.map(row => row[timeField]),
                    datasets: [{
                        label: valueField,
                        data: sortedResults.map(row => parseFloat(row[valueField])),
                        borderColor: '#4dc9f6',
                        backgroundColor: 'rgba(77, 201, 246, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                }
            });
        }
    }

    // SCENARIO 2: Categorical comparison (country + score) - Bar chart
    if (categoricalFields.length > 0 && numericFields.length > 0) {
        const categoryField = categoricalFields[0];
        const valueField = numericFields.find(f => !timeFields.includes(f)) || numericFields[0];
        const uniqueCategories = [...new Set(results.map(row => row[categoryField]))];
        
        if (uniqueCategories.length <= 20 && uniqueCategories.length >= 2) {
            const categoryScores = uniqueCategories.map(category => {
                const categoryData = results.filter(row => row[categoryField] === category);
                const maxScore = Math.max(...categoryData.map(row => parseFloat(row[valueField])));
                return {
                    category: category,
                    value: maxScore
                };
            }).sort((a, b) => b.value - a.value);
            
            charts.push({
                type: 'bar',
                title: `Top ${categoryScores.length} ${valueField}`,
                description: `Highest ${valueField} by ${categoryField}`,
                data: {
                    labels: categoryScores.map(item => item.category),
                    datasets: [{
                        label: valueField,
                        data: categoryScores.map(item => item.value),
                        backgroundColor: generateColors(categoryScores.length)
                    }]
                }
            });

            if (categoryScores.length <= 8) {
                charts.push({
                    type: 'pie',
                    title: `Distribution of Top ${valueField}`,
                    description: `Percentage distribution across ${categoryField}`,
                    data: {
                        labels: categoryScores.map(item => item.category),
                        datasets: [{
                            data: categoryScores.map(item => item.value),
                            backgroundColor: generateColors(categoryScores.length)
                        }]
                    }
                });
            }
        }
    }

    // SCENARIO 3: Single country, multiple years - Area chart
    if (timeFields.length > 0 && numericFields.length > 0 && categoricalFields.length === 1) {
        const categories = [...new Set(results.map(row => row[categoricalFields[0]]))];
        if (categories.length === 1) {
            const sortedResults = [...results].sort((a, b) => a[timeFields[0]] - b[timeFields[0]]);
            charts.push({
                type: 'line',
                title: `${categories[0]} - ${numericFields[0]} Over Time`,
                description: `Historical trend for ${categories[0]}`,
                data: {
                    labels: sortedResults.map(row => row[timeFields[0]]),
                    datasets: [{
                        label: numericFields[0],
                        data: sortedResults.map(row => parseFloat(row[numericFields[0]])),
                        borderColor: '#f67019',
                        backgroundColor: 'rgba(246, 112, 25, 0.2)',
                        fill: true,
                        tension: 0.4
                    }]
                }
            });
        }
    }

    console.log('Generated charts:', charts.length);
    return charts;
}

function analyzeFields(results) {
    const firstRow = results[0];
    const numericFields = [];
    const stringFields = [];
    const timeFields = [];
    const categoricalFields = [];

    Object.keys(firstRow).forEach(key => {
        const values = results.map(row => row[key]);
        const sampleValue = firstRow[key];
        
        if (isYearField(key, values)) {
            timeFields.push(key);
            numericFields.push(key);
        } 
       
        else if (isNumericField(values)) {
            numericFields.push(key);
        }
        
        else if (typeof sampleValue === 'string') {
            stringFields.push(key);
            const uniqueValues = [...new Set(values)];
            if (uniqueValues.length > 1 && uniqueValues.length <= 50) {
                categoricalFields.push(key);
            }
        }
    });

    return { numericFields, stringFields, timeFields, categoricalFields };
}

function isYearField(key, values) {
    const timeIndicators = ['year', 'date', 'time', 'y.year'];
    const hasTimeName = timeIndicators.some(indicator => 
        key.toLowerCase().includes(indicator)
    );
    
    if (!hasTimeName) return false;
    
    return values.every(value => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 1900 && num <= 2100;
    });
}

function isNumericField(values) {
    const numericCount = values.filter(value => {
        if (value === null || value === undefined) return false;
        return !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
    }).length;
    
    return numericCount >= values.length * 0.8;
}

function getLatestDataPerCategory(results, categoryField, timeField, valueField) {
    const categories = [...new Set(results.map(row => row[categoryField]))];
    
    return categories.map(category => {
        const categoryData = results.filter(row => row[categoryField] === category);
        const latest = categoryData.reduce((latest, current) => {
            return (!latest || current[timeField] > latest[timeField]) ? current : latest;
        }, null);
        
        return {
            category: category,
            value: latest ? parseFloat(latest[valueField]) : 0
        };
    }).filter(item => item.value !== 0);
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
                            text: 'Year'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Score'
                        },
                        beginAtZero: false
                    }
                },
                elements: {
                    point: {
                        radius: 4,
                        hoverRadius: 6
                    }
                }
            };
        case 'pie':
        case 'radar':
            return baseOptions;
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