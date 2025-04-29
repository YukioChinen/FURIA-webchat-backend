# FURIA-webchat-backend

Este é o back-end de um desafio técnico. O projeto consiste em uma API que utiliza a tecnologia de inteligência artificial da Google para criar um chatbot especializado na organização de e-sports FURIA.

**Links Úteis:**
- **Repositório do Frontend:** [FURIA Webchat Frontend](https://github.com/YukioChinen/FURIA-webchat-frontend)
- **Repositório do Backend:** [FURIA Webchat Backend](https://github.com/YukioChinen/FURIA-webchat-backend)
- **Site Online (Vercel):** [FURIA Chatbot](https://furia-webchat-frontend.vercel.app/)

## 🚀 Tecnologias Utilizadas

- **Node.js**: Plataforma para execução do JavaScript no servidor.
- **Express**: Framework para criação de APIs REST.
- **Google Generative AI**: API de inteligência artificial para geração de respostas.
- **dotenv**: Gerenciamento de variáveis de ambiente.
- **body-parser**: Middleware para parsing de requisições.
- **cors**: Middleware para habilitar o compartilhamento de recursos entre diferentes origens.

## 📋 Funcionalidades

- **Chatbot especializado**: Responde exclusivamente sobre a organização FURIA e temas relacionados a e-sports.
- **Configuração de segurança**: Bloqueia respostas com conteúdo prejudicial, como discurso de ódio ou assédio.
- **Contexto personalizado**: O chatbot é configurado para responder de forma entusiasmada e em português brasileiro, com foco em informações sobre a FURIA.

## 📂 Estrutura do Projeto
```
FURIA-webchat-backend/ 
├── index.js # Arquivo principal do servidor 
├── .env # Variáveis de ambiente (não incluído no repositório) 
├── package.json # Dependências e scripts do projeto 
└── README.md # Documentação do projeto
```

## 🔧 Configuração e Execução

### Pré-requisitos

- Node.js instalado na máquina.
- Uma conta com acesso à API do Google Generative AI.
- Arquivo `.env` configurado com a chave da API.

### Passos para executar o projeto

1. Clone o repositório:
   ```
   git clone https://github.com/YukioChinen/FURIA-webchat-backend
   cd FURIA-webchat-backend
   ```

2. Instale as dependências:
   ```
   npm install
   ```

3. Crie um arquivo `.env` na raiz do projeto e adicione a chave da API:
   ```
   GOOGLE_API_KEY=SuaChaveDeAPI
   ```

4. Inicie o servidor:
   ```
   npm start
   ```

5. O servidor estará disponível em `http://localhost:5001`.

## 📡 Endpoints

### POST `/api/chat`

- **Descrição**: Endpoint para enviar mensagens ao chatbot.
- **Body**:
```
  {
    "history": [
      { "sender": "user", "text": "Mensagem anterior do usuário" },
      { "sender": "bot", "text": "Resposta anterior do bot" }
    ],
    "message": "Mensagem atual do usuário"
  }
```
- **Resposta**:
```
  {
    "reply": "Resposta gerada pelo chatbot"
  }
```

## ⚠️ Observações

- O chatbot foi configurado para responder apenas sobre a FURIA e temas relacionados. Perguntas fora desse escopo serão recusadas.
- Certifique-se de que a chave da API está configurada corretamente no arquivo `.env`.
- As informações dos atuais jogadores e coach, e resultados anteriores são retirados dinamicamente do site da Liquipedia.


## 🖤 Sobre a FURIA

A FURIA é uma das maiores organizações de e-sports do Brasil, com equipes em diversas modalidades. Este projeto foi desenvolvido com o objetivo de criar uma experiência interativa para os fãs da organização.

---

**Desenvolvido como parte de um desafio técnico.**
