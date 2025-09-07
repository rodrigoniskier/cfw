/*
 * ARQUIVO 3: app.js
 * O motor lógico para o Devocional da WCF.
 */

// Espera que o HTML esteja totalmente carregado antes de executar qualquer script.
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Seleção dos Elementos do DOM ---
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const loadButton = document.getElementById('load-devotional-btn');
    const devotionalContainer = document.getElementById('area-devocional');
    const planInfoEl = document.getElementById('plan-info');
    const errorEl = document.getElementById('error-message');

    let wcfData = []; // Onde os nossos 175 parágrafos do JSON irão viver.
    const TOTAL_PARAGRAPHS = 175; // O número total de parágrafos na WCF (Cap 1-33).

    // --- 2. Carregamento Assíncrono dos Dados ---
    // Como estamos num servidor web, usamos fetch() para carregar o JSON.
    async function loadDatabase() {
        try {
            const response = await fetch('dados.json');
            if (!response.ok) {
                throw new Error(`Erro HTTP: Não foi possível encontrar 'dados.json'. Status: ${response.status}`);
            }
            wcfData = await response.json();
            
            // Verificação de integridade (deve corresponder ao nosso total planeado)
            if (!wcfData || wcfData.length !== TOTAL_PARAGRAPHS) {
                 throw new Error(`Os dados carregados estão incompletos ou corrompidos. Esperados: ${TOTAL_PARAGRAPHS}. Recebidos: ${wcfData.length}`);
            }

            // Após carregar os dados, tentamos carregar qualquer plano guardado
            loadSavedPlan();

        } catch (error) {
            console.error("Falha ao carregar a base de dados devocional:", error);
            displayError("ERRO CRÍTICO: Não foi possível carregar o arquivo 'dados.json'. Verifique se o arquivo está no mesmo diretório.");
        }
    }

    // --- 3. Lógica do Agendador Flexível ---

    function handleLoadDevotionalClick() {
        clearMessages();

        // 3.1. Validação das Datas
        const startDateValue = startDateInput.value;
        const endDateValue = endDateInput.value;

        if (!startDateValue || !endDateValue) {
            displayError("Por favor, selecione uma Data de Início E uma Data de Fim.");
            return;
        }

        const startDate = normalizeDate(new Date(startDateValue));
        const endDate = normalizeDate(new Date(endDateValue));
        const today = normalizeDate(new Date());


        if (endDate < startDate) {
            displayError("A Data de Fim deve ser posterior à Data de Início.");
            return;
        }

        // 3.2. Guardar o plano no LocalStorage para conveniência
        localStorage.setItem('wcf_devotional_start', startDateValue);
        localStorage.setItem('wcf_devotional_end', endDateValue);

        // 3.3. Executar o cálculo
        calculateAndDisplaySchedule(startDate, endDate, today);
    }

    function calculateAndDisplaySchedule(startDate, endDate, today) {
        
        // 3.4. Verificar se o plano está ativo hoje
        if (today < startDate) {
            planInfoEl.textContent = "O seu plano de leitura começa em " + startDate.toLocaleDateString('pt-BR', {timeZone: 'UTC'});
            devotionalContainer.innerHTML = "<p>Nenhuma leitura agendada para hoje.</p>";
            return;
        }
        if (today > endDate) {
            planInfoEl.textContent = "O seu plano de leitura selecionado terminou em " + endDate.toLocaleDateString('pt-BR', {timeZone: 'UTC'});
            devotionalContainer.innerHTML = "<p>Plano concluído! Pode começar um novo plano selecionando novas datas.</p>";
            return;
        }

        // 3.5. Calcular a Duração e o Ritmo
        const msPerDay = 1000 * 60 * 60 * 24;
        const totalDurationDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1; // +1 para incluir o último dia
        const currentDayOfPlan = Math.round((today.getTime() - startDate.getTime()) / msPerDay) + 1;

        const itemsPerDayRatio = TOTAL_PARAGRAPHS / totalDurationDays;

        // 3.6. Calcular o "bloco" de parágrafos para hoje
        // Arredondamos para garantir que todos os 175 itens sejam cobertos até ao final.
        const endIndex = Math.round(currentDayOfPlan * itemsPerDayRatio);
        const startIndex = Math.round((currentDayOfPlan - 1) * itemsPerDayRatio);

        const itemsToShow = wcfData.slice(startIndex, endIndex);

        // 3.7. Atualizar UI
        const readingsCount = itemsToShow.length;
        planInfoEl.textContent = `Plano Ativo: Dia ${currentDayOfPlan} de ${totalDurationDays}. Exibindo ${readingsCount} ${readingsCount === 1 ? 'leitura' : 'leituras'} hoje.`;

        // 3.8. Renderizar o conteúdo
        renderDevotionals(itemsToShow);
    }


    // --- 4. Função de Renderização ---
    // Recebe um array de objetos de parágrafos e converte-os em HTML.
    function renderDevotionals(itemsArray) {
        if (itemsArray.length === 0) {
            // Isto pode acontecer se o plano for muito longo (ex: 365 dias), criando dias de descanso.
            devotionalContainer.innerHTML = "<h3>Descanso Agendado</h3><p>Não há leituras específicas agendadas para hoje neste plano. Aproveite para meditar no que já leu.</p>";
            return;
        }

        let htmlString = "";

        itemsArray.forEach(item => {
            htmlString += `
                <article class="devocional-item">
                    <h3>${item.capitulo_titulo} (Cap. ${item.capitulo_num}, Par. ${item.paragrafo_num})</h3>
                    
                    <h4>Texto da Confissão:</h4>
                    <blockquote class="wcf-texto">
                        ${item.texto_wcf}
                    </blockquote>
                    <p class="referencias"><strong>Referências:</strong> ${item.referencias_biblicas}</p>

                    <h4>Comentário Devocional:</h4>
                    <div class="comentario">
                        ${item.comentario_devocional}
                    </div>
                </article>
            `;
        });

        devotionalContainer.innerHTML = htmlString;
    }


    // --- 5. Funções Utilitárias ---
    
    // Tenta carregar um plano guardado quando a página abre
    function loadSavedPlan() {
        const savedStart = localStorage.getItem('wcf_devotional_start');
        const savedEnd = localStorage.getItem('wcf_devotional_end');

        if (savedStart && savedEnd) {
            startDateInput.value = savedStart;
            endDateInput.value = savedEnd;
            // Carrega automaticamente a devoção do dia se um plano válido estiver guardado
            handleLoadDevotionalClick();
        }
    }

    // Normaliza datas para meia-noite (UTC) para evitar erros de fuso horário nos cálculos
    function normalizeDate(dateObj) {
        // Pega a data local e "força" o JS a tratá-la como UTC para cálculos de diferença.
        return new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()));
    }

    function displayError(message) {
        errorEl.textContent = message;
    }

    function clearMessages() {
        errorEl.textContent = "";
        planInfoEl.textContent = "";
    }

    // --- 6. Inicialização ---
    loadButton.addEventListener('click', handleLoadDevotionalClick);
    loadDatabase(); // Começa a carregar o JSON assim que o script é executado.

});
