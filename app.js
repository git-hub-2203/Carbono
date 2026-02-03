// Fatores de emissão (kg CO₂e por unidade)
const EMISSION_FACTORS = {
    transport: {
        car_gasoline: 0.12,    // por km
        car_ethanol: 0.05,
        motorcycle: 0.08,
        bus: 0.03,
        subway: 0.02,
        bicycle: 0,
        walking: 0,
        airplane: 0.18
    },
    energy: {
        electricity: 0.15,     // por kWh
        natural_gas: 2.00,     // por m³
        lpg: 1.50              // por kg
    },
    food: {
        beef: 27.0,           // por kg
        chicken: 6.9,
        pork: 12.1,
        fish: 5.0,
        dairy: 3.2,
        vegetables: 2.0,
        grains: 1.5
    },
    shopping: {
        electronics: 50.0,    // por item
        clothing: 15.0,
        furniture: 100.0,
        plastic: 5.0,
        paper: 2.0
    },
    waste: {
        landfill: 0.5,        // por kg
        recycled: 0.1,
        composted: 0.05
    }
};

// Frequência para conversão mensal
const FREQUENCY_FACTORS = {
    daily: 30,
    weekly_1: 4,
    weekly_2: 8,
    weekly_3: 12,
    weekly_5: 20,
    monthly_1: 1,
    monthly_2: 2,
    monthly_4: 4
};

// Inicialização do armazenamento
class CarbonStorage {
    static init() {
        if (!localStorage.getItem('carbonScopeData')) {
            const initialData = {
                habits: [],
                emissions: [],
                scenarios: [],
                weeklyPlans: [],
                currentPlan: null,
                userSettings: {}
            };
            localStorage.setItem('carbonScopeData', JSON.stringify(initialData));
        }
    }

    static getData() {
        return JSON.parse(localStorage.getItem('carbonScopeData') || '{}');
    }

    static saveData(data) {
        localStorage.setItem('carbonScopeData', JSON.stringify(data));
    }

    static addHabit(habit) {
        const data = this.getData();
        habit.id = Date.now(); // ID único baseado em timestamp
        data.habits.push(habit);
        this.saveData(data);
        this.calculateEmissions();
        return habit;
    }

    static getHabits() {
        return this.getData().habits || [];
    }

    static deleteHabit(id) {
        const data = this.getData();
        data.habits = data.habits.filter(h => h.id !== id);
        this.saveData(data);
        this.calculateEmissions();
    }

    static calculateEmissions() {
        const habits = this.getHabits();
        const emissionsByCategory = {
            transport: 0,
            energy: 0,
            food: 0,
            shopping: 0,
            waste: 0
        };

        habits.forEach(habit => {
            let emissions = 0;
            
            switch(habit.category) {
                case 'transport':
                    const freqFactor = FREQUENCY_FACTORS[habit.frequency] || 1;
                    const monthlyDistance = habit.distance * freqFactor;
                    emissions = monthlyDistance * EMISSION_FACTORS.transport[habit.type];
                    emissionsByCategory.transport += emissions;
                    break;
                    
                case 'energy':
                    emissions = habit.consumption * EMISSION_FACTORS.energy[habit.type];
                    emissionsByCategory.energy += emissions;
                    break;
                    
                case 'food':
                    const weeklyKg = habit.quantity;
                    const monthlyKg = weeklyKg * 4;
                    emissions = monthlyKg * EMISSION_FACTORS.food[habit.type];
                    emissionsByCategory.food += emissions;
                    break;
                    
                case 'shopping':
                    emissions = habit.quantity * EMISSION_FACTORS.shopping[habit.type];
                    emissionsByCategory.shopping += emissions;
                    break;
                    
                case 'waste':
                    const weeklyWaste = habit.quantity;
                    const monthlyWaste = weeklyWaste * 4;
                    emissions = monthlyWaste * EMISSION_FACTORS.waste[habit.type];
                    emissionsByCategory.waste += emissions;
                    break;
            }
            
            habit.emissions = emissions;
        });

        // Salvar emissões calculadas
        const data = this.getData();
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        
        // Verificar se já existe registro para este mês
        const existingIndex = data.emissions.findIndex(e => e.month === currentMonth);
        
        const totalEmissions = Object.values(emissionsByCategory).reduce((a, b) => a + b, 0);
        
        if (existingIndex !== -1) {
            data.emissions[existingIndex] = {
                month: currentMonth,
                total: totalEmissions,
                byCategory: emissionsByCategory
            };
        } else {
            data.emissions.push({
                month: currentMonth,
                total: totalEmissions,
                byCategory: emissionsByCategory
            });
        }
        
        this.saveData(data);
        return totalEmissions;
    }

    static getCurrentEmissions() {
        const data = this.getData();
        const currentMonth = new Date().toISOString().slice(0, 7);
        return data.emissions.find(e => e.month === currentMonth) || { total: 0, byCategory: {} };
    }

    static getMonthlyHistory() {
        return this.getData().emissions || [];
    }

    static addScenario(scenario) {
        const data = this.getData();
        scenario.id = Date.now();
        scenario.createdAt = new Date().toISOString();
        data.scenarios.push(scenario);
        this.saveData(data);
        return scenario;
    }

    static getScenarios() {
        return this.getData().scenarios || [];
    }

    static addWeeklyPlan(plan) {
        const data = this.getData();
        plan.id = Date.now();
        plan.createdAt = new Date().toISOString();
        plan.completed = false;
        plan.progress = 0;
        
        // Definir a semana atual (segunda a domingo)
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Segunda, ...
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajuste para começar na segunda
        const monday = new Date(today.setDate(diff));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        plan.weekStart = monday.toISOString().split('T')[0];
        plan.weekEnd = sunday.toISOString().split('T')[0];
        plan.goals = plan.goals.map(goal => ({
            ...goal,
            completed: false
        }));
        
        data.weeklyPlans.push(plan);
        data.currentPlan = plan.id;
        this.saveData(data);
        return plan;
    }

    static getCurrentPlan() {
        const data = this.getData();
        if (!data.currentPlan) return null;
        return data.weeklyPlans.find(p => p.id === data.currentPlan);
    }

    static updatePlanProgress(planId, goalIndex, completed) {
        const data = this.getData();
        const planIndex = data.weeklyPlans.findIndex(p => p.id === planId);
        
        if (planIndex !== -1) {
            const plan = data.weeklyPlans[planIndex];
            if (plan.goals[goalIndex]) {
                plan.goals[goalIndex].completed = completed;
                
                // Calcular progresso total
                const completedGoals = plan.goals.filter(g => g.completed).length;
                plan.progress = Math.round((completedGoals / plan.goals.length) * 100);
                
                // Verificar se todas as metas foram concluídas
                if (completedGoals === plan.goals.length) {
                    plan.completed = true;
                }
                
                data.weeklyPlans[planIndex] = plan;
                this.saveData(data);
            }
        }
    }

    static getPreviousPlans() {
        const data = this.getData();
        const currentPlanId = data.currentPlan;
        return data.weeklyPlans.filter(p => p.id !== currentPlanId);
    }
}

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    CarbonStorage.init();
    
    // Identificar qual página está carregada
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    
    // Executar funções específicas para cada página
    switch(page) {
        case 'index.html':
            initHomePage();
            break;
        case 'dashboard.html':
            initDashboardPage();
            break;
        case 'habits.html':
            initHabitsPage();
            break;
        case 'scenarios.html':
            initScenariosPage();
            break;
        case 'plans.html':
            initPlansPage();
            break;
    }
    
    // Configurar navegação entre abas
    setupTabNavigation();
});

// Funções para a página inicial
function initHomePage() {
    // Atualizar estatísticas na página inicial
    const currentEmissions = CarbonStorage.getCurrentEmissions();
    const totalEmissions = currentEmissions.total || 0;
    
    // Formatar número para exibição
    document.querySelectorAll('.total-number').forEach(el => {
        if (el.id !== 'totalEmissions') {
            el.textContent = totalEmissions.toFixed(1);
        }
    });
}

// Funções para o dashboard
function initDashboardPage() {
    updateDashboard();
    
    // Configurar botão de atualização
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', updateDashboard);
    }
}

function updateDashboard() {
    const currentEmissions = CarbonStorage.getCurrentEmissions();
    const monthlyHistory = CarbonStorage.getMonthlyHistory();
    const totalEmissions = currentEmissions.total || 0;
    
    // Atualizar totais
    document.getElementById('totalEmissions').textContent = totalEmissions.toFixed(1);
    
    // Calcular comparação com mês anterior
    let comparison = 0;
    if (monthlyHistory.length >= 2) {
        const previousMonth = monthlyHistory[monthlyHistory.length - 2];
        if (previousMonth.total > 0) {
            comparison = ((totalEmissions - previousMonth.total) / previousMonth.total * 100).toFixed(1);
        }
    }
    
    document.getElementById('comparison').textContent = comparison + '%';
    document.getElementById('comparison').style.color = comparison >= 0 ? '#e74c3c' : '#2ecc71';
    
    // Atualizar gráfico de categorias
    updateCategoryChart(currentEmissions.byCategory);
    
    // Atualizar gráfico mensal
    updateMonthlyChart(monthlyHistory);
    
    // Atualizar detalhes por categoria
    updateCategoryDetails(currentEmissions.byCategory);
    
    // Atualizar insights
    updateInsights(currentEmissions.byCategory);
}

function updateCategoryChart(categoryData) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    const labels = Object.keys(categoryData || {}).map(cat => {
        const names = {
            transport: 'Transporte',
            energy: 'Energia',
            food: 'Alimentação',
            shopping: 'Compras',
            waste: 'Resíduos'
        };
        return names[cat] || cat;
    });
    
    const data = Object.values(categoryData || {});
    const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6'];
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateMonthlyChart(history) {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;
    
    // Pegar últimos 6 meses
    const lastSixMonths = history.slice(-6);
    
    const labels = lastSixMonths.map(item => {
        const [year, month] = item.month.split('-');
        return `${month}/${year.slice(2)}`;
    });
    
    const data = lastSixMonths.map(item => item.total);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Emissões (kg CO₂e)',
                data: data,
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateCategoryDetails(categoryData) {
    const container = document.getElementById('categoryDetails');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.entries(categoryData || {}).forEach(([category, value]) => {
        const names = {
            transport: 'Transporte',
            energy: 'Energia',
            food: 'Alimentação',
            shopping: 'Compras',
            waste: 'Resíduos'
        };
        
        const icons = {
            transport: 'fa-car',
            energy: 'fa-bolt',
            food: 'fa-utensils',
            shopping: 'fa-shopping-bag',
            waste: 'fa-trash'
        };
        
        const div = document.createElement('div');
        div.className = 'detail-item';
        div.innerHTML = `
            <h4>
                <span><i class="fas ${icons[category]}"></i> ${names[category]}</span>
                <span>${value.toFixed(1)} kg</span>
            </h4>
            <p>${(value / (Object.values(categoryData).reduce((a, b) => a + b, 0) || 1) * 100).toFixed(1)}% do total</p>
        `;
        container.appendChild(div);
    });
}

function updateInsights(categoryData) {
    const container = document.getElementById('insightsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    const insights = [];
    
    // Gerar insights baseados nos dados
    if (categoryData.transport > 100) {
        insights.push({
            icon: 'fa-car',
            text: 'Sua categoria de transporte tem alto impacto. Considere usar mais transporte público ou bicicleta.'
        });
    }
    
    if (categoryData.energy > 150) {
        insights.push({
            icon: 'fa-lightbulb',
            text: 'O consumo de energia está elevado. Desligue aparelhos da tomada e use lâmpadas LED.'
        });
    }
    
    if (categoryData.food > 200) {
        insights.push({
            icon: 'fa-carrot',
            text: 'Sua alimentação tem grande impacto. Reduzir carne pode diminuir significativamente suas emissões.'
        });
    }
    
    if (categoryData.shopping > 100) {
        insights.push({
            icon: 'fa-shopping-bag',
            text: 'Suas compras geram muitas emissões. Considere comprar menos e optar por produtos duráveis.'
        });
    }
    
    if (categoryData.waste > 50) {
        insights.push({
            icon: 'fa-recycle',
            text: 'Você gera muitos resíduos. Aumentar a reciclagem e compostagem pode reduzir suas emissões.'
        });
    }
    
    // Insight padrão se não houver muitos dados
    if (insights.length === 0) {
        insights.push({
            icon: 'fa-leaf',
            text: 'Continue registrando seus hábitos para receber recomendações personalizadas.'
        });
    }
    
    // Adicionar insights à página
    insights.forEach(insight => {
        const div = document.createElement('div');
        div.className = 'insight-item';
        div.innerHTML = `
            <i class="fas ${insight.icon}"></i>
            <span>${insight.text}</span>
        `;
        container.appendChild(div);
    });
}

// Funções para a página de hábitos
function initHabitsPage() {
    loadHabitsList();
    setupHabitForms();
}

function loadHabitsList() {
    const container = document.getElementById('habitsList');
    if (!container) return;
    
    const habits = CarbonStorage.getHabits();
    container.innerHTML = '';
    
    if (habits.length === 0) {
        container.innerHTML = '<p class="no-habits">Nenhum hábito registrado ainda. Adicione seu primeiro hábito acima!</p>';
        return;
    }
    
    habits.forEach(habit => {
        const names = {
            transport: {
                car_gasoline: 'Carro a gasolina',
                car_ethanol: 'Carro a etanol',
                motorcycle: 'Moto',
                bus: 'Ônibus',
                subway: 'Metrô/Trem',
                bicycle: 'Bicicleta',
                walking: 'Caminhada',
                airplane: 'Avião'
            },
            energy: {
                electricity: 'Eletricidade',
                natural_gas: 'Gás Natural',
                lpg: 'Gás de Cozinha'
            },
            food: {
                beef: 'Carne bovina',
                chicken: 'Frango',
                pork: 'Porco',
                fish: 'Peixe',
                dairy: 'Laticínios',
                vegetables: 'Legumes/Verduras',
                grains: 'Grãos/Cereais'
            },
            shopping: {
                electronics: 'Eletrônicos',
                clothing: 'Roupas',
                furniture: 'Móveis',
                plastic: 'Plástico',
                paper: 'Papel'
            },
            waste: {
                landfill: 'Aterro comum',
                recycled: 'Reciclado',
                composted: 'Compostado'
            }
        };
        
        const categoryNames = {
            transport: 'Transporte',
            energy: 'Energia',
            food: 'Alimentação',
            shopping: 'Compras',
            waste: 'Resíduos'
        };
        
        const div = document.createElement('div');
        div.className = 'habit-item';
        div.innerHTML = `
            <div class="habit-info">
                <h4>${categoryNames[habit.category]}: ${names[habit.category][habit.type]}</h4>
                <p>
                    ${habit.quantity} ${getUnit(habit.category, habit.type)} 
                    ${habit.frequency ? `(${getFrequencyText(habit.frequency)})` : ''}
                </p>
                <p class="habit-emissions">Emissões: ${habit.emissions ? habit.emissions.toFixed(1) : '0'} kg CO₂e/mês</p>
            </div>
            <div class="habit-actions">
                <button class="delete-btn" data-id="${habit.id}">
                    <i class="fas fa-trash"></i> Remover
                </button>
            </div>
        `;
        container.appendChild(div);
    });
    
    // Adicionar listeners para botões de remover
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.getAttribute('data-id'));
            CarbonStorage.deleteHabit(id);
            loadHabitsList();
        });
    });
}

function getUnit(category, type) {
    switch(category) {
        case 'transport': return 'km';
        case 'energy':
            if (type === 'electricity') return 'kWh';
            if (type === 'natural_gas') return 'm³';
            return 'kg';
        case 'food': return 'kg';
        case 'shopping': return 'unidades';
        case 'waste': return 'kg';
        default: return '';
    }
}

function getFrequencyText(frequency) {
    const texts = {
        daily: 'diariamente',
        weekly_1: '1x por semana',
        weekly_2: '2x por semana',
        weekly_3: '3x por semana',
        weekly_5: '5x por semana',
        monthly_1: '1x por mês',
        monthly_2: '2x por mês',
        monthly_4: '4x por mês'
    };
    return texts[frequency] || frequency;
}

function setupHabitForms() {
    // Configurar formulário de transporte
    const transportForm = document.getElementById('transportForm');
    if (transportForm) {
        transportForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const habit = {
                category: 'transport',
                type: document.getElementById('transportType').value,
                distance: parseFloat(document.getElementById('transportDistance').value),
                frequency: document.getElementById('transportFrequency').value,
                quantity: parseFloat(document.getElementById('transportDistance').value)
            };
            
            CarbonStorage.addHabit(habit);
            transportForm.reset();
            loadHabitsList();
            showNotification('Hábito de transporte adicionado!');
        });
    }
    
    // Configurar formulário de energia
    const energyForm = document.getElementById('energyForm');
    if (energyForm) {
        energyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const habit = {
                category: 'energy',
                type: document.getElementById('energyType').value,
                consumption: parseFloat(document.getElementById('energyConsumption').value),
                quantity: parseFloat(document.getElementById('energyConsumption').value)
            };
            
            CarbonStorage.addHabit(habit);
            energyForm.reset();
            loadHabitsList();
            showNotification('Hábito de energia adicionado!');
        });
    }
    
    // Configurar formulário de alimentação
    const foodForm = document.getElementById('foodForm');
    if (foodForm) {
        foodForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const habit = {
                category: 'food',
                type: document.getElementById('foodType').value,
                quantity: parseFloat(document.getElementById('foodQuantity').value)
            };
            
            CarbonStorage.addHabit(habit);
            foodForm.reset();
            loadHabitsList();
            showNotification('Hábito alimentar adicionado!');
        });
    }
    
    // Configurar formulário de compras
    const shoppingForm = document.getElementById('shoppingForm');
    if (shoppingForm) {
        shoppingForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const habit = {
                category: 'shopping',
                type: document.getElementById('itemType').value,
                quantity: parseInt(document.getElementById('itemQuantity').value)
            };
            
            CarbonStorage.addHabit(habit);
            shoppingForm.reset();
            loadHabitsList();
            showNotification('Hábito de compras adicionado!');
        });
    }
    
    // Configurar formulário de resíduos
    const wasteForm = document.getElementById('wasteForm');
    if (wasteForm) {
        wasteForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const habit = {
                category: 'waste',
                type: document.getElementById('wasteType').value,
                quantity: parseFloat(document.getElementById('wasteQuantity').value)
            };
            
            CarbonStorage.addHabit(habit);
            wasteForm.reset();
            loadHabitsList();
            showNotification('Hábito de resíduos adicionado!');
        });
    }
}

// Funções para a página de cenários
function initScenariosPage() {
    loadSavedScenarios();
    setupScenarioControls();
    updateScenarioResults();
}

function setupScenarioControls() {
    // Configurar sliders
    const sliders = [
        { id: 'carReduction', valueId: 'carReductionValue', format: val => `${val}%` },
        { id: 'meatReduction', valueId: 'meatReductionValue', format: val => `${val} dias` },
        { id: 'energyReduction', valueId: 'energyReductionValue', format: val => `${val}%` },
        { id: 'recyclingIncrease', valueId: 'recyclingIncreaseValue', format: val => `${val}%` }
    ];
    
    sliders.forEach(slider => {
        const sliderEl = document.getElementById(slider.id);
        const valueEl = document.getElementById(slider.valueId);
        
        if (sliderEl && valueEl) {
            sliderEl.addEventListener('input', function() {
                valueEl.textContent = slider.format(this.value);
                updateScenarioResults();
            });
        }
    });
    
    // Configurar botão de criar cenário
    const createBtn = document.getElementById('createScenarioBtn');
    if (createBtn) {
        createBtn.addEventListener('click', function() {
            const name = document.getElementById('scenarioName').value;
            if (!name) {
                showNotification('Por favor, dê um nome ao cenário!', 'error');
                return;
            }
            
            const carReduction = parseInt(document.getElementById('carReduction').value) / 100;
            const meatDays = parseInt(document.getElementById('meatReduction').value);
            const energyReduction = parseInt(document.getElementById('energyReduction').value) / 100;
            const recyclingIncrease = parseInt(document.getElementById('recyclingIncrease').value) / 100;
            
            const currentEmissions = CarbonStorage.getCurrentEmissions();
            const habits = CarbonStorage.getHabits();
            
            // Calcular emissões projetadas
            let projectedTotal = currentEmissions.total || 0;
            
            // Redução no transporte (assumindo que 50% das emissões de transporte são de carro)
            const transportReduction = (currentEmissions.byCategory?.transport || 0) * 0.5 * carReduction;
            projectedTotal -= transportReduction;
            
            // Redução na alimentação (cada dia sem carne reduz 0.5kg de emissões)
            const foodReduction = meatDays * 0.5 * 4; // 4 semanas no mês
            projectedTotal -= foodReduction;
            
            // Redução na energia
            const energyReductionKg = (currentEmissions.byCategory?.energy || 0) * energyReduction;
            projectedTotal -= energyReductionKg;
            
            // Aumento na reciclagem
            const wasteReduction = (currentEmissions.byCategory?.waste || 0) * 0.8 * recyclingIncrease;
            projectedTotal -= wasteReduction;
            
            const reductionPercent = ((currentEmissions.total - projectedTotal) / currentEmissions.total * 100).toFixed(1);
            
            const scenario = {
                name: name,
                description: `Redução de ${carReduction*100}% no carro, ${meatDays} dias sem carne, ${energyReduction*100}% menos energia, ${recyclingIncrease*100}% mais reciclagem`,
                baselineEmissions: currentEmissions.total,
                projectedEmissions: projectedTotal,
                reductionPercent: reductionPercent,
                reductionKg: currentEmissions.total - projectedTotal,
                carReduction: carReduction,
                meatDays: meatDays,
                energyReduction: energyReduction,
                recyclingIncrease: recyclingIncrease
            };
            
            CarbonStorage.addScenario(scenario);
            loadSavedScenarios();
            showNotification('Cenário salvo com sucesso!');
            
            // Limpar formulário
            document.getElementById('scenarioName').value = '';
        });
    }
}

function updateScenarioResults() {
    const currentEmissions = CarbonStorage.getCurrentEmissions();
    const totalEmissions = currentEmissions.total || 0;
    
    // Pegar valores dos sliders
    const carReduction = parseInt(document.getElementById('carReduction')?.value || 0) / 100;
    const meatDays = parseInt(document.getElementById('meatReduction')?.value || 0);
    const energyReduction = parseInt(document.getElementById('energyReduction')?.value || 0) / 100;
    const recyclingIncrease = parseInt(document.getElementById('recyclingIncrease')?.value || 0) / 100;
    
    // Calcular emissões projetadas
    let projectedTotal = totalEmissions;
    
    // Redução no transporte
    const transportReduction = (currentEmissions.byCategory?.transport || 0) * 0.5 * carReduction;
    projectedTotal -= transportReduction;
    
    // Redução na alimentação
    const foodReduction = meatDays * 0.5 * 4;
    projectedTotal -= foodReduction;
    
    // Redução na energia
    const energyReductionKg = (currentEmissions.byCategory?.energy || 0) * energyReduction;
    projectedTotal -= energyReductionKg;
    
    // Aumento na reciclagem
    const wasteReduction = (currentEmissions.byCategory?.waste || 0) * 0.8 * recyclingIncrease;
    projectedTotal -= wasteReduction;
    
    // Garantir que não seja negativo
    projectedTotal = Math.max(0, projectedTotal);
    
    // Atualizar interface
    document.getElementById('currentEmissions').textContent = `${totalEmissions.toFixed(1)} kg CO₂e`;
    document.getElementById('projectedEmissions').textContent = `${projectedTotal.toFixed(1)} kg CO₂e`;
    
    const reductionKg = totalEmissions - projectedTotal;
    const reductionPercent = totalEmissions > 0 ? (reductionKg / totalEmissions * 100).toFixed(1) : 0;
    
    document.getElementById('reductionPercent').textContent = `${reductionPercent}%`;
    document.getElementById('reductionKg').textContent = `${reductionKg.toFixed(1)} kg CO₂e`;
    
    // Atualizar equivalente de impacto
    const impactEl = document.getElementById('impactEquivalent');
    if (impactEl) {
        if (reductionKg > 100) {
            impactEl.textContent = `Essa redução equivale a ${Math.round(reductionKg / 20)} árvores plantadas!`;
        } else if (reductionKg > 50) {
            impactEl.textContent = `Essa redução equivale a não dirigir por ${Math.round(reductionKg / 0.12)} km!`;
        } else {
            impactEl.textContent = 'Cada redução conta! Continue fazendo sua parte.';
        }
    }
}

function loadSavedScenarios() {
    const container = document.getElementById('savedScenariosList');
    if (!container) return;
    
    const scenarios = CarbonStorage.getScenarios();
    container.innerHTML = '';
    
    if (scenarios.length === 0) {
        container.innerHTML = '<p class="no-scenarios">Nenhum cenário salvo ainda. Crie seu primeiro cenário acima!</p>';
        return;
    }
    
    // Ordenar do mais recente para o mais antigo
    scenarios.sort((a, b) => b.id - a.id);
    
    scenarios.forEach(scenario => {
        const div = document.createElement('div');
        div.className = 'scenario-item';
        div.innerHTML = `
            <div class="scenario-info">
                <h4>${scenario.name}</h4>
                <p>${scenario.description}</p>
                <p class="scenario-result">
                    <i class="fas fa-chart-line"></i>
                    Redução de ${scenario.reductionPercent}% (${scenario.reductionKg.toFixed(1)} kg CO₂e)
                </p>
            </div>
            <div class="scenario-date">
                ${new Date(scenario.createdAt).toLocaleDateString('pt-BR')}
            </div>
        `;
        container.appendChild(div);
    });
}

// Funções para a página de planos
function initPlansPage() {
    loadCurrentPlan();
    loadPreviousPlans();
    setupPlanCreator();
}

function loadCurrentPlan() {
    const plan = CarbonStorage.getCurrentPlan();
    
    // Atualizar datas da semana atual
    const weekDates = document.getElementById('currentWeekDates');
    if (weekDates && plan) {
        const start = new Date(plan.weekStart);
        const end = new Date(plan.weekEnd);
        weekDates.textContent = `${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}`;
    } else if (weekDates) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        weekDates.textContent = `${monday.toLocaleDateString('pt-BR')} a ${sunday.toLocaleDateString('pt-BR')}`;
    }
    
    // Atualizar progresso
    const progressBar = document.getElementById('weekProgress');
    const progressText = document.getElementById('progressText');
    
    if (plan) {
        if (progressBar) {
            progressBar.style.width = `${plan.progress}%`;
        }
        if (progressText) {
            const completed = plan.goals.filter(g => g.completed).length;
            progressText.textContent = `${completed}/${plan.goals.length} metas concluídas`;
        }
        
        // Carregar metas
        const goalsContainer = document.getElementById('weeklyGoals');
        if (goalsContainer) {
            goalsContainer.innerHTML = '';
            
            plan.goals.forEach((goal, index) => {
                const goalNames = {
                    transport_public: {
                        title: 'Usar transporte público',
                        desc: 'Trocar 3 viagens de carro por ônibus/metrô',
                        icon: 'fa-bus'
                    },
                    food_vegetarian: {
                        title: 'Dias vegetarianos',
                        desc: '2 dias sem carne na semana',
                        icon: 'fa-carrot'
                    },
                    energy_saving: {
                        title: 'Economia de energia',
                        desc: 'Desligar aparelhos em standby',
                        icon: 'fa-lightbulb'
                    },
                    waste_recycling: {
                        title: 'Aumentar reciclagem',
                        desc: 'Separar resíduos para reciclagem',
                        icon: 'fa-recycle'
                    },
                    shopping_reduce: {
                        title: 'Compras conscientes',
                        desc: 'Evitar compras desnecessárias',
                        icon: 'fa-shopping-bag'
                    },
                    transport_bike: {
                        title: 'Usar bicicleta',
                        desc: '2 viagens de bicicleta em vez de carro',
                        icon: 'fa-bicycle'
                    }
                };
                
                const goalInfo = goalNames[goal.value] || { title: goal.value, desc: '', icon: 'fa-tasks' };
                
                const div = document.createElement('div');
                div.className = 'goal-item';
                div.innerHTML = `
                    <input type="checkbox" class="goal-checkbox" ${goal.completed ? 'checked' : ''} data-index="${index}">
                    <i class="fas ${goalInfo.icon}"></i>
                    <div class="goal-details">
                        <h4>${goalInfo.title}</h4>
                        <p>${goalInfo.desc}</p>
                    </div>
                `;
                goalsContainer.appendChild(div);
            });
            
            // Adicionar listeners para checkboxes
            document.querySelectorAll('.goal-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    const index = parseInt(this.getAttribute('data-index'));
                    CarbonStorage.updatePlanProgress(plan.id, index, this.checked);
                    loadCurrentPlan(); // Recarregar para atualizar progresso
                });
            });
        }
    } else {
        // Sem plano ativo
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = 'Nenhum plano ativo';
        
        const goalsContainer = document.getElementById('weeklyGoals');
        if (goalsContainer) {
            goalsContainer.innerHTML = '<p class="no-plan">Nenhum plano ativo. Crie um plano para começar!</p>';
        }
    }
}

function loadPreviousPlans() {
    const container = document.getElementById('previousPlansList');
    if (!container) return;
    
    const previousPlans = CarbonStorage.getPreviousPlans();
    container.innerHTML = '';
    
    if (previousPlans.length === 0) {
        container.innerHTML = '<p class="no-plans">Nenhum plano anterior encontrado.</p>';
        return;
    }
    
    // Ordenar do mais recente para o mais antigo
    previousPlans.sort((a, b) => b.id - a.id);
    
    // Mostrar apenas os últimos 5 planos
    previousPlans.slice(0, 5).forEach(plan => {
        const start = new Date(plan.weekStart);
        const end = new Date(plan.weekEnd);
        const completedGoals = plan.goals.filter(g => g.completed).length;
        
        const div = document.createElement('div');
        div.className = 'scenario-item';
        div.innerHTML = `
            <div class="scenario-info">
                <h4>Plano: ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}</h4>
                <p>${completedGoals}/${plan.goals.length} metas concluídas</p>
                <p class="scenario-result">
                    <i class="fas ${plan.completed ? 'fa-check-circle' : 'fa-clock'}"></i>
                    ${plan.completed ? 'Concluído' : 'Não concluído'} - ${plan.progress}% realizado
                </p>
            </div>
            <div class="scenario-date">
                ${plan.completed ? '✅' : '⏳'}
            </div>
        `;
        container.appendChild(div);
    });
}

function setupPlanCreator() {
    const createBtn = document.getElementById('createNewPlanBtn');
    const planCreator = document.getElementById('planCreator');
    const saveBtn = document.getElementById('savePlanBtn');
    const cancelBtn = document.getElementById('cancelPlanBtn');
    
    if (createBtn && planCreator) {
        createBtn.addEventListener('click', function() {
            planCreator.style.display = 'block';
            this.style.display = 'none';
        });
    }
    
    if (cancelBtn && planCreator) {
        cancelBtn.addEventListener('click', function() {
            planCreator.style.display = 'none';
            if (createBtn) createBtn.style.display = 'inline-flex';
        });
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            const selectedGoals = [];
            
            // Coletar metas selecionadas
            document.querySelectorAll('.goal-option input:checked').forEach(checkbox => {
                selectedGoals.push({
                    value: checkbox.value,
                    completed: false
                });
            });
            
            if (selectedGoals.length === 0) {
                showNotification('Selecione pelo menos uma meta!', 'error');
                return;
            }
            
            const plan = {
                goals: selectedGoals
            };
            
            CarbonStorage.addWeeklyPlan(plan);
            
            // Esconder criador e mostrar botão de criar
            if (planCreator) planCreator.style.display = 'none';
            if (createBtn) createBtn.style.display = 'inline-flex';
            
            // Limpar seleções
            document.querySelectorAll('.goal-option input').forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // Recarregar planos
            loadCurrentPlan();
            loadPreviousPlans();
            
            showNotification('Plano semanal criado com sucesso!');
        });
    }
}

// Funções utilitárias
function setupTabNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Remover classe active de todos os botões e conteúdos
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Adicionar classe active ao botão clicado
            this.classList.add('active');
            
            // Mostrar conteúdo correspondente
            const content = document.getElementById(`${tabId}-tab`);
            if (content) {
                content.classList.add('active');
            }
        });
    });
}

function showNotification(message, type = 'success') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Estilos para a notificação
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#2ecc71' : '#e74c3c'};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
    `;
    
    // Adicionar ao body
    document.body.appendChild(notification);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
    
    // Adicionar estilos de animação se não existirem
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}