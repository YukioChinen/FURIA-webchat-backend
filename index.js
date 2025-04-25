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
const port = process.env.PORT || 5001; // Use a different port than the frontend

// Middleware
app.use(cors()); // Allow requests from your frontend
app.use(bodyParser.json());

// --- Google AI Setup ---
const MODEL_NAME = "gemini-1.5-flash-latest";
const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
    console.error('Erro: Chave de API do Google não encontrada. Verifique seu arquivo .env');
    process.exit(1); // Exit if API key is missing
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

const generationConfig = {
    temperature: 0.8, // Controls randomness
    topK: 1,
    topP: 1,
    maxOutputTokens: 256, // Limit response length
};

// Safety settings to block harmful content
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
// --- End Google AI Setup ---

// --- Load Initial Context from JSON ---
try {
    const contextPath = path.join(__dirname, 'initialContext.json');
    const contextData = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
    // Now 'contextData' holds the parsed JSON object (instructions, acknowledgement)
    global.furiaContext = contextData; // Store in global scope for access in the handler
    global.liquipediaData = null; // Initialize global variable for scraped data
} catch (error) {
    console.error('Erro ao carregar ou parsear initialContext.json:', error);
    process.exit(1); // Exit if context file is missing or invalid
}
// --- End Load Initial Context ---

// --- Web Scraping Function (Liquipedia - Dynamic Data) ---
async function fetchLiquipediaData() {
    const mainUrl = 'https://liquipedia.net/counterstrike/FURIA';
    const resultsUrl = 'https://liquipedia.net/counterstrike/FURIA/Results';

    const scrapedData = {
        players: [],
        coach: [],
        recentResults: [] // Array para strings de resultados
    };

    try {
        // --- Scrape Main Page (Players/Coach) ---
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
        // --- Scrape Results Page (Based on XPath Structure) ---
        console.log(`\u{1F9FE} Buscando Resultados Recentes: ${resultsUrl}`);
        const { data: resultsData } = await axios.get(resultsUrl);
        const $results = cheerio.load(resultsData);

        const resultsTable = $results('table.wikitable.sortable').first(); // Pega a primeira tabela sortable
        if (!resultsTable.length) {
             console.log("[Results Scrape] Tabela de resultados principal não encontrada.");
        } else {
            // Seleciona as linhas do tbody, ignora a primeira (cabeçalho), pega as próximas 5
            const dataRows = resultsTable.find('tbody > tr').slice(1, 6);
            console.log(`[Results Scrape] Encontradas ${dataRows.length} linhas de dados para processar.`);

            dataRows.each((i, row) => {
                const columns = $results(row).find('td');
                 console.log(`[Results Scrape] Processando linha ${i+1} com ${columns.length} colunas.`);

                if (columns.length >= 9) { // Precisa de pelo menos 9 colunas pela estrutura do XPath
                    const date = $results(columns[0]).text().trim(); // td[1]
                    const placement = $results(columns[1]).find('b').text().trim(); // td[2]/b
                    const tournament = $results(columns[6]).find('a').last().text().trim(); // td[7]/a (último link)
                    const score = $results(columns[7]).text().trim(); // td[8]
                    const opponentLink = $results(columns[8]).find('span > span > a').first(); // td[9]/span/span/a
                    let opponent = opponentLink.attr('title') || opponentLink.text().trim(); // td[9] -> title ou texto do link

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
// --- End Web Scraping Function ---

// --- Fetch Liquipedia Data on Startup ---
(async () => {
    global.liquipediaData = await fetchLiquipediaData();
})();
// --- End Fetch on Startup ---

// --- Chat Endpoint ---
app.post('/api/chat', async (req, res) => {
    const { history, message } = req.body; // Expecting history and the new message

    if (!message) {
        return res.status(400).json({ error: 'Mensagem não fornecida.' });
    }

    // --- Build Initial Context (Combine JSON Instructions + Dynamic Data) ---
    const contextJson = global.furiaContext;
    const dynamicData = global.liquipediaData;

    let initialContext = `Contexto Importante:\\n`;
    initialContext += contextJson.instructions.map(instr => `- ${instr}`).join('\\n');

    // Add Static Data from JSON
    if (contextJson.founders && contextJson.founders.length > 0) {
        initialContext += `\\n\\nCo-Fundadores: ${contextJson.founders.join(', ')}.`;
    }
    if (contextJson.sites && Object.keys(contextJson.sites).length > 0) {
        initialContext += `\\n\\nSites Oficiais (Links permitidos):\\n`;
        for (const siteName in contextJson.sites) {
            initialContext += `- ${siteName}: ${contextJson.sites[siteName]}\\n`;
        }
    }
    if (contextJson.teams) {
        initialContext += `\\n--- Outros Times (JSON) --- \\n`;
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

    // Add Dynamic Data from Liquipedia (if successful)
    if (dynamicData) {
        initialContext += `\\n\\n--- Informações Dinâmicas (Liquipedia) ---`;

        // Team Info
        if (dynamicData.players && dynamicData.players.length > 0) {
            initialContext += `\\nTime CS2 Principal: ${dynamicData.players.join(', ')}.`;
            if (dynamicData.coach && dynamicData.coach.length > 0) {
                initialContext += ` Coach: ${dynamicData.coach.join(', ')}.`;
            }
            initialContext += `\\n`; // Newline after team
        } else {
            initialContext += `\\nTime CS2 Principal: (Não foi possível buscar elenco da Liquipedia)\\n`; // Mensagem mais específica
        }

        // Recent Results Info
        if (dynamicData.recentResults && dynamicData.recentResults.length > 0) {
            initialContext += `\\nÚltimos Resultados (Liquipedia): \\n`;
            dynamicData.recentResults.forEach(result => {
                initialContext += `- ${result}\\n`;
            });
        } else {
            initialContext += `\\nÚltimos Resultados: (Não foi possível buscar resultados da Liquipedia)\\n`; // Mensagem mais específica
        }

        initialContext += `---------------------------------------\\n`;
    } else {
        initialContext += `\\n\\nAVISO: Não foi possível buscar dados dinâmicos da Liquipedia.\\n`;
    }

    // --- Fim do Contexto Inicial ---

    try {
        // Format history from frontend
        let chatHistoryFromFrontend = history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        }));

        // Remove the last user message from history (it's sent via sendMessage)
        if (chatHistoryFromFrontend.length > 0 && chatHistoryFromFrontend[chatHistoryFromFrontend.length - 1].role === 'user') {
            chatHistoryFromFrontend.pop();
        }

        // Define the initial context priming messages
        const primingMessages = [
            { role: 'user', parts: [{ text: initialContext }] },
            { role: 'model', parts: [{ text: contextJson.acknowledgement }] } // Use acknowledgement from JSON
        ];

        // Combine priming context with the actual chat history from frontend
        const finalHistoryForGemini = [...primingMessages, ...chatHistoryFromFrontend];

        // Start chat with the combined history
        const chat = model.startChat({
            generationConfig,
            safetySettings,
            history: finalHistoryForGemini, // Send combined history
        });

        // Send the actual new user message
        const result = await chat.sendMessage(message);
        const response = result.response;
        const botReply = response.text();

        res.json({ reply: botReply });

    } catch (error) {
        console.error('Erro ao chamar a API Gemini:', error);
        if (error.message.includes('SAFETY')) { // Check for safety blocks
            res.status(400).json({ reply: 'Desculpe, não posso responder a isso por motivos de segurança. 😬' });
        } else {
            res.status(500).json({ error: 'Erro interno ao processar a mensagem.' });
        }
    }
});
// --- End Chat Endpoint ---

app.listen(port, () => {
    console.log(`🤖 Servidor Backend (FURIA AI) rodando na porta ${port}`);
}); 