/*
 * ARQUIVO 3 (REVISADO): app.js
 * O motor lógico para o GERADOR DE PLANO DEVOCIONAL da WCF.
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Seleção dos Elementos do DOM ---
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const generateButton = document.getElementById('generate-plan-btn'); // Botão foi renomeado no HTML
    const statusContainer = document.getElementById('status-area');
    const loadingMessage = document.getElementById('loading-message');
    const planInfoEl = document.getElementById('plan-info');
    const errorEl = document.getElementById('error-message');

    let wcfData = []; // Onde os nossos 175 parágrafos do JSON irão viver.
    const TOTAL_PARAGRAPHS = 175;

    // --- 2. Carregamento Assíncrono dos Dados ---
    async function loadDatabase() {
        try {
            const response = await fetch('dados.json');
            if (!response.ok) {
                throw new Error(`Erro HTTP: Não foi possível encontrar 'dados.json'. Status: ${response.status}`);
            }
            wcfData = await response.json();
            
            if (!wcfData || wcfData.length !== TOTAL_PARAGRAPHS) {
                 throw new Error(`Dados carregados incompletos. Esperados: ${TOTAL_PARAGRAPHS}. Recebidos: ${wcfData.length}`);
            }

            loadingMessage.textContent = "Base de dados (175 parágrafos) carregada. Pronto para gerar o plano.";
            generateButton.disabled = false; // Habilita o botão após os dados carregarem

        } catch (error) {
            console.error("Falha ao carregar a base de dados devocional:", error);
            displayError("ERRO CRÍTICO: Não foi possível carregar 'dados.json'. Verifique se o arquivo está no servidor e no diretório correto.");
            loadingMessage.textContent = "Falha ao carregar dados.";
        }
    }

    // --- 3. NOVA LÓGICA: Gerador de Plano Completo ---

    function handleGeneratePlanClick() {
        clearMessages();

        // 3.1. Validação
        const startDateValue = startDateInput.value;
        const endDateValue = endDateInput.value;

        if (!startDateValue || !endDateValue) {
            displayError("Por favor, selecione uma Data de Início E uma Data de Fim.");
            return;
        }

        const startDate = normalizeDate(new Date(startDateValue));
        const endDate = normalizeDate(new Date(endDateValue));

        if (endDate < startDate) {
            displayError("A Data de Fim deve ser posterior à Data de Início.");
            return;
        }

        // 3.2. Calcular Duração e Ritmo
        const msPerDay = 1000 * 60 * 60 * 24;
        const totalDurationDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1; // +1 para incluir o último dia
        const itemsPerDayRatio = TOTAL_PARAGRAPHS / totalDurationDays;

        planInfoEl.textContent = `A gerar plano de ${totalDurationDays} dias (${itemsPerDayRatio.toFixed(2)} leituras/dia)...`;

        // 3.3. Gerar o HTML para a nova aba
        let printHtml = generatePrintableHtml(startDate, totalDurationDays, itemsPerDayRatio);

        // 3.4. Abrir a nova aba e escrever o conteúdo
        try {
            const newTab = window.open();
            newTab.document.open();
            newTab.document.write(printHtml);
            newTab.document.close();
        } catch (e) {
            displayError("Falha ao abrir a nova aba. Por favor, desative o bloqueador de pop-ups para este site.");
            console.error("Erro ao abrir pop-up:", e);
        }
    }

    // 3.5. Função de Geração de HTML (Loop principal)
    function generatePrintableHtml(startDate, totalDurationDays, ratio) {
        let html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Plano Devocional da WCF (${totalDurationDays} dias)</title>
    <link rel="stylesheet" href="estilos.css">
</head>
<body class="plano-impressao">
    <main>
        <div class="titulo-plano">
            <h1>Plano Devocional da Confissão de Fé de Westminster</h1>
            <h2>Período de ${startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a ${new Date(startDate.getTime() + (totalDurationDays - 1) * 1000 * 60 * 60 * 24).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} (${totalDurationDays} dias)</h2>
        </div>
        `;

        const msPerDay = 1000 * 60 * 60 * 24;

        // Itera por CADA DIA do plano
        for (let day = 1; day <= totalDurationDays; day++) {
            
            const currentPlanDate = new Date(startDate.getTime() + ((day - 1) * msPerDay));
            
            // Calcula o bloco de parágrafos para este dia
            const endIndex = Math.round(day * ratio);
            const startIndex = Math.round((day - 1) * ratio);
            const itemsToShow = wcfData.slice(startIndex, endIndex);

            // Adiciona o cabeçalho do Dia
            html += `
                <section class="dia-plano">
                    <h2>Dia ${day} <span class="data-plano">(${currentPlanDate.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })})</span></h2>
            `;

            if (itemsToShow.length === 0) {
                html += "<p><i>Dia de descanso ou recuperação (sem novas leituras agendadas).</i></p>";
            } else {
                // Adiciona cada item devocional para aquele dia
                itemsToShow.forEach(item => {
                    html += `
                        <article class="devocional-item">
                            <h3>${item.capitulo_titulo} (Cap. ${item.capitulo_num}, Par. ${item.paragrafo_num})</h3>
                            <blockquote class="wcf-texto">${item.texto_wcf}</blockquote>
                            <p class="referencias"><strong>Referências:</strong> ${item.referencias_biblicas}</p>
                            <h4>Comentário Devocional:</h4>
                            <div class="comentario">${item.comentario_devocional}</div>
                        </article>
                    `;
                });
            }

            html += `</section>`; // Fim do .dia-plano
        }

        html += `
    </main>
</body>
</html>`;

        return html;
    }


    // --- 4. Funções Utilitárias ---
    
    // Normaliza datas para evitar erros de fuso horário
    function normalizeDate(dateObj) {
         // O input 'date' retorna uma string (ex: 2025-09-08) que o construtor Date() interpreta como UTC 00:00. 
         // Devemos usar UTC para todos os cálculos para evitar erros de "off-by-one-day".
        const [year, month, day] = dateObj.toISOString().split('T')[0].split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day));
    }

    function displayError(message) {
        errorEl.textContent = message;
    }

    function clearMessages() {
        errorEl.textContent = "";
        planInfoEl.textContent = "";
    }

    // --- 5. Inicialização ---
    generateButton.addEventListener('click', handleGeneratePlanClick);
    generateButton.disabled = true; // Desabilitado até o JSON carregar
    loadDatabase(); // Começa a carregar o JSON.

});
