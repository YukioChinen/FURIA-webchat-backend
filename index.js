require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(bodyParser.json());

// --- Configuração da IA do Google ---
const MODEL_NAME = "gemini-1.5-flash-latest";
const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
    console.error('Erro: Chave de API do Google não encontrada. Verifique seu arquivo .env');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

const generationConfig = {
    temperature: 0.8,
    topK: 1,
    topP: 1,
    maxOutputTokens: 256,
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
// --- Fim da Configuração da IA do Google ---

// --- Carregar Contexto Inicial do JSON ---
try {
    const contextPath = path.join(__dirname, 'initialContext.json');
    const contextData = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
    global.furiaContext = contextData;
    global.liquipediaData = null;
} catch (error) {
    console.error('Erro ao carregar ou parsear initialContext.json:', error);
    process.exit(1);
}
// --- Fim do Carregamento do Contexto Inicial ---

// --- Função de Web Scraping (Liquipedia - Dados Dinâmicos) ---
async function fetchLiquipediaData() {
    const mainUrl = 'https://liquipedia.net/counterstrike/FURIA';
    const resultsUrl = 'https://liquipedia.net/counterstrike/FURIA/Results';

    const scrapedData = {
        players: [],
        coach: [],
        recentResults: []
    };

    try {
        // --- Raspar Página Principal (Jogadores/Coach) ---
        console.log(`\u{1F9FE} Buscando Elenco: ${mainUrl}`);
        const { data: mainData } = await axios.get(mainUrl);
        const $main = cheerio.load(mainData);
        const playerSelector = 'table.wikitable.wikitable-striped > tbody > tr > td:nth-child(1) > b > span > span > a';
        $main(playerSelector).each((i, el) => {
            const elementLink = $main(el);
            const title = elementLink.attr('title');
            const rowText = elementLink.closest('tr').text().toLowerCase();
            if (title && title.length > 1) {
                if (rowText.includes('(coach)')) {
                    if (scrapedData.coach.indexOf(title) === -1 && scrapedData.coach.length < 1) {
                         console.log(`[Main Scrape] Coach adicionado: ${title}`);
                        scrapedData.coach.push(title);
                    }
                } else {
                    if (scrapedData.players.indexOf(title) === -1 && scrapedData.players.length < 5) {
                         console.log(`[Main Scrape] Player adicionado: ${title}`);
                        scrapedData.players.push(title);
                    }
                }
            }
        });
        console.log(`\u{1F7E2} Elenco raspado: Players=${scrapedData.players.length}, Coach=${scrapedData.coach.length}`);

    } catch (error) {
        console.error(`\u{1F534} Erro ao buscar/processar elenco de ${mainUrl}:`, error.message);
    }

    try {
        // --- Raspar Página de Resultados (Baseado na Estrutura XPath) ---
        console.log(`\u{1F9FE} Buscando Resultados Recentes: ${resultsUrl}`);
        const { data: resultsData } = await axios.get(resultsUrl);
        const $results = cheerio.load(resultsData);

        const resultsTable = $results('table.wikitable.sortable').first();
        if (!resultsTable.length) {
             console.log("[Results Scrape] Tabela de resultados principal não encontrada.");
        } else {
            const dataRows = resultsTable.find('tbody > tr').slice(1, 6);
            console.log(`[Results Scrape] Encontradas ${dataRows.length} linhas de dados para processar.`);

            dataRows.each((i, row) => {
                const columns = $results(row).find('td');
                 console.log(`[Results Scrape] Processando linha ${i+1} com ${columns.length} colunas.`);

                if (columns.length >= 9) {
                    const date = $results(columns[0]).text().trim();
                    const placement = $results(columns[1]).find('b').text().trim();
                    const tournament = $results(columns[6]).find('a').last().text().trim();
                    const score = $results(columns[7]).text().trim();
                    const opponentLink = $results(columns[8]).find('span > span > a').first();
                    let opponent = opponentLink.attr('title') || opponentLink.text().trim();

                    console.log(`[Results Scrape] Linha ${i+1} Dados Brutos: D='${date}', P='${placement}', T='${tournament}', S='${score}', OppLink='${opponentLink.length ? 'Encontrado' : 'Não'}' OppRaw='${opponent}'`);

                    if (date && placement && tournament && score && opponent) {
                        const resultString = `${date} - ${tournament}: ${placement} (${score} vs ${opponent})`;
                        scrapedData.recentResults.push(resultString);
                        console.log(`[Results Scrape] Formatado e adicionado: ${resultString}`);
                    } else {
                        console.log(`[Results Scrape] Linha ${i+1} ignorada (dados formatados faltando).`);
                    }
                } else {
                    console.log(`[Results Scrape] Linha ${i+1} ignorada (colunas insuficientes: ${columns.length})`);
                }
            });
            console.log(`\u{1F7E2} ${scrapedData.recentResults.length} resultados recentes formatados.`);
        }

    } catch (error) {
        console.error(`\u{1F534} Erro ao buscar/processar resultados de ${resultsUrl}:`, error.message);
    }

    return scrapedData;
}
// --- Fim da Função de Web Scraping ---

// --- Buscar Dados da Liquipedia na Inicialização ---
(async () => {
    global.liquipediaData = await fetchLiquipediaData();
})();
// --- Fim da Busca na Inicialização ---

// --- Endpoint do Chat ---
app.post('/api/chat', async (req, res) => {
    const { history, message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Mensagem não fornecida.' });
    }

    // --- Construir Contexto Inicial (Combinar Instruções JSON + Dados Dinâmicos) ---
    const contextJson = global.furiaContext;
    const dynamicData = global.liquipediaData;

    let initialContext = `Contexto Importante:\\n`;
    initialContext += contextJson.instructions.map(instr => `- ${instr}`).join('\\\\n');

    // Adicionar Dados Estáticos do JSON
    if (contextJson.founders && contextJson.founders.length > 0) {
        initialContext += `\\\\n\\\\nCo-Fundadores: ${contextJson.founders.join(', ')}.`;
    }
    if (contextJson.sites && Object.keys(contextJson.sites).length > 0) {
        initialContext += `\\\\n\\\\nSites Oficiais (Links permitidos):\n`;
        for (const siteName in contextJson.sites) {
            initialContext += `- ${siteName}: ${contextJson.sites[siteName]}\n`;
        }
    }
    if (contextJson.teams) {
        initialContext += `\\\\n--- Outros Times (JSON) --- \\\\n`;
        for (const teamKey in contextJson.teams) {
            const team = contextJson.teams[teamKey];
            initialContext += `- ${team.label}: ${team.players.join(', ')}.`;
            if (team.coach && team.coach.length > 0) {
                initialContext += ` Coach: ${team.coach.join(', ')}.`;
            }
            initialContext += '\n';
        }
        initialContext += `----------------------------\n`;
    }

    // Adicionar Dados Dinâmicos da Liquipedia (se bem-sucedido)
    if (dynamicData) {
        initialContext += `\\\\n\\\\n--- Informações Dinâmicas (Liquipedia) ---`;

        // Informações do Time
        if (dynamicData.players && dynamicData.players.length > 0) {
            initialContext += `\\\\nTime CS2 Principal: ${dynamicData.players.join(', ')}.`;
            if (dynamicData.coach && dynamicData.coach.length > 0) {
                initialContext += ` Coach: ${dynamicData.coach.join(', ')}.`;
            }
            initialContext += `\\\\n`;
        } else {
            initialContext += `\\\\nTime CS2 Principal: (Não foi possível buscar elenco da Liquipedia)\\\\n`;
        }

        // Informações de Resultados Recentes
        if (dynamicData.recentResults && dynamicData.recentResults.length > 0) {
            initialContext += `\\\\nÚltimos Resultados (Liquipedia): \\\\n`;
            dynamicData.recentResults.forEach(result => {
                initialContext += `- ${result}\\\\n`;
            });
        } else {
            initialContext += `\\\\nÚltimos Resultados: (Não foi possível buscar resultados da Liquipedia)\\\\n`;
        }

        initialContext += `---------------------------------------\\\\n`;
    } else {
        initialContext += `\\\\n\\\\nAVISO: Não foi possível buscar dados dinâmicos da Liquipedia.\\\\n`;
    }

    // --- Fim do Contexto Inicial ---

    try {
        // Formatar histórico do frontend
        let chatHistoryFromFrontend = history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        }));

        // Remover a última mensagem do usuário do histórico (ela é enviada via sendMessage)
        if (chatHistoryFromFrontend.length > 0 && chatHistoryFromFrontend[chatHistoryFromFrontend.length - 1].role === 'user') {
            chatHistoryFromFrontend.pop();
        }

        // Definir as mensagens iniciais de contexto
        const primingMessages = [
            { role: 'user', parts: [{ text: initialContext }] },
            { role: 'model', parts: [{ text: contextJson.acknowledgement }] }
        ];

        // Combinar contexto inicial com o histórico de chat real do frontend
        const finalHistoryForGemini = [...primingMessages, ...chatHistoryFromFrontend];

        // Iniciar chat com o histórico combinado
        const chat = model.startChat({
            generationConfig,
            safetySettings,
            history: finalHistoryForGemini,
        });

        // Enviar a nova mensagem real do usuário
        const result = await chat.sendMessage(message);
        const response = result.response;
        const botReply = response.text();

        res.json({ reply: botReply });

    } catch (error) {
        console.error('Erro ao chamar a API Gemini:', error);
        if (error.message.includes('SAFETY')) {
            res.status(400).json({ reply: 'Desculpe, não posso responder a isso por motivos de segurança. 😬' });
        } else {
            res.status(500).json({ error: 'Erro interno ao processar a mensagem.' });
        }
    }
});
// --- Fim do Endpoint do Chat ---

app.listen(port, () => {
    console.log(`🤖 Servidor Backend (FURIA AI) rodando na porta ${port}`);
}); 