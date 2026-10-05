# Homezee — app unificada

Esta versão usa o projeto React do ZIP como base. Junta os menus Discover, Guardados, Mensagens, Visitas e Perfil; os dados sobre as fotografias; as casas próprias da Homezee; anúncios externos do Imovirtual e Idealista; e o mapa interativo como último elemento do carrossel.

## Publicar no Render

Esta versão substitui o projeto completo, não apenas o antigo homezee_app.py. Envia o conteúdo desta pasta para o repositório GitHub. Mantém as pastas public, src, migrations, scripts, server e a configuração incluída.

No Render, usa um serviço Node com estes campos:

- Build: `npm ci --ignore-scripts && npm run build && npm run typecheck`
- Start: `npm start`
- HOMEZEE_TARGET: `node`
- VITE_AUTH_ENABLED: `true`
- HOMEZEE_DEMO: `false`
- BETTER_AUTH_URL: o endereço público do serviço, por exemplo `https://homezee.onrender.com`
- BETTER_AUTH_SECRET: uma chave aleatória longa gerada no Render
- DATABASE_URL: ligação a uma base de dados PostgreSQL persistente

O ficheiro render.yaml também inclui esta configuração. O runtime precisa de Node 22 ou superior e Python 3. O processo inicia o coletor privado e a app em conjunto. Se o Render anterior era Python, cria um serviço Node para este projeto. A versão anterior continua disponível até trocares o endereço.

## O que experimentar

Cria uma conta com email e palavra-passe. Escolhe Braga e deixa o preço vazio, tipo Todos e quartos Todos. Os resultados dos portais aparecem quando a pesquisa termina. Guarda uma casa e abre-a em Guardados. Numa casa de portal, pedir visita abre o anúncio original; não cria chat, proposta ou visita interna. Nas casas da Homezee, a visita passa pelos horários propostos pelo vendedor, e as propostas exigem visita marcada como realizada.

Toca nas fotografias para avançar, ou no ícone de mapa. O mapa é a última página e permite zoom e movimento. A localização é aproximada quando a fonte não publica a morada exata.

## Demonstração e limites

Para uma demonstração local, `HOMEZEE_DEMO=true` ativa casas ilustrativas claramente identificadas. As fotografias destas casas não são anúncios reais. Em produção, mantém `false`. Sem DATABASE_URL, a base de dados temporária reinicia com o processo; não a uses para contas reais.

Os portais podem bloquear pedidos do alojamento, e a app apresenta os erros. A pesquisa cobre páginas públicas de duas fontes, até três páginas por fonte; não garante todas as casas da internet. Não contorna bloqueios. Os favoritos externos são fotografias do anúncio na última consulta; confirma sempre disponibilidade no portal.

Pro e destaques podem ser experimentados no modo demonstração. A cobrança real não está ligada, e a ativação está bloqueada fora desse modo. As comissões e processos de venda ficam pendentes após aceitação de uma proposta. Não existe processamento de pagamentos, confirmação notarial nem cobrança de comissões nesta entrega. As notificações são internas à app.

O login por email funciona na própria app. Google/X só devem ser apresentados se houver configuração válida do fornecedor original e VITE_GROK_LOGIN=true. A atribuição de administração exige HOMEZEE_ADMIN_USER_ID configurado no servidor.

## Verificação desta entrega

Compilação de produção e TypeScript verificados. Os percursos de criação de conta, configuração sem preço obrigatório, favoritos, pedido de visita nativa, navegação para o mapa e alteração de zoom foram exercitados no navegador. A integração de um anúncio externo foi também testada com uma fonte simulada, incluindo persistência nos favoritos, abertura do link original e ausência de visita ou chat internos. Foram inspecionados os ecrãs no telemóvel e no computador. Os testes interativos usaram Playwright após o cliente de teste do projeto original falhar ao iniciar.

Uma consulta real do coletor por Braga sem outros filtros devolveu 198 anúncios nesta sessão (108 do Imovirtual e 90 do Idealista). Este resultado não garante acesso a essas fontes a partir do Render. O Google Maps é um serviço externo; os comandos do carrossel e do zoom foram verificados, mas o carregamento das imagens do mapa ficou limitado na rede de teste.

A app publicada no Render não foi substituída nesta entrega. O ZIP contém o projeto a publicar e as instruções, não credenciais nem uma base de dados de produção.

O ecrã inicial passou também a verificação no modo de desenvolvimento, sem divergência face à compilação. O percurso autenticado foi validado na versão compilada; o ambiente de teste não completou esse percurso no servidor Vite de desenvolvimento.
