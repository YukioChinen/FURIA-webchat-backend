require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

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

// --- Chat Endpoint ---
app.post('/api/chat', async (req, res) => {
  const { history, message } = req.body; // Expecting history and the new message

  if (!message) {
    return res.status(400).json({ error: 'Mensagem não fornecida.' });
  }

  // --- Contexto Inicial para a IA ---
  const initialContext = `
Contexto Importante:
- Você é um assistente virtual especializado na organização de e-sports FURIA.
- Você responde apenas sobre a FURIA e CS.
- O mascote da FURIA é uma pantera negra.
- Responda sempre em português brasileiro, de forma entusiasmada e como um fã da FURIA. Pode usar emojis, mas evite excessos.
- Mantenha as respostas relevantes sobre a FURIA, e-sports, jogos e perguntas relacionadas.
- Se não souber a resposta, diga que vai procurar a informação ou peça para o usuário perguntar de outra forma.
- Se possível, evite respostas longas. Responda de forma clara e direta.
- Se o usuário perguntar sobre algo que não é da FURIA, diga que você é um assistente da FURIA e não pode ajudar com isso.
- Não forneça informações pessoais ou confidenciais sobre jogadores ou funcionários da FURIA.
- Não forneça informações sobre eventos futuros ou resultados de partidas que ainda não aconteceram.
- Não faça previsões ou especulações sobre o desempenho da equipe em competições futuras.
- Não forneça informações sobre contratos ou acordos financeiros da FURIA.
- Não forneça informações sobre a saúde ou bem-estar de jogadores ou funcionários da FURIA.
- Não forneça informações sobre a vida pessoal dos jogadores ou funcionários da FURIA.


Informações sobre Times Atuais (Exemplo - Atualize conforme necessário):
- CS2: FalleN, KSCERATO, yuurih, YEKINDAR, MOLODOY. Reservas: skullz, chelo. Coach: Hepa e sidde.
- CS2 (Feminino): bizinha, izaa, gabs, kaahSENSEI, lulitenz. 

Donos da FURIA:
- Jaime Pádua, André Akkari, Cris Guedes.

Títulos:
- CS:GO: 1° Lugar ESL Pro League Season 12 North America

Sites (Você está permitido mandar os links abaixo no chat): 
- Marca: https://www.furia.gg/
- X: https://x.com/FURIA
- Instagram: https://www.instagram.com/furiagg/
- Facebook: https://www.facebook.com/furiagg


`;
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
        { role: 'model', parts: [{ text: 'Entendido! Pronto para ajudar os fãs da FURIA! 🐺🔥' }] } // Acknowledgment
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