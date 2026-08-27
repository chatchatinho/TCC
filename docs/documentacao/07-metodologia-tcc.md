# 1 INTRODUÇÃO

O controle de temperatura e umidade em alguns ambientes é um fator muito importante. Isso afeta a conservação de materiais, a preservação de alimentos e medicamentos e até mesmo o funcionamento correto de certos processos. Por isso, é fundamental monitorar essas condições para garantir eficiência, segurança e qualidade nos locais onde isso é necessário.

Com o avanço da tecnologia e a Internet das Coisas (IoT), podem ser criados sistemas que coletam, transmitem e disponibilizam dados ambientais de forma rápida e eficiente. A IoT permite que dispositivos eletrônicos, sensores e sistemas computacionais trabalhem juntos, possibilitando soluções inteligentes para monitorar e controlar informações em tempo real.

A Internet das Coisas (IoT) foi concebida para conectar objetos, de modo que o mundo físico e o ambiente digital deixem de ser separados. Kevin Ashton apresentou essa ideia ainda em seus estágios iniciais, e Sundmaeker e colaboradores (2010) descreveram como sensores e atuadores poderiam torná-la realidade. Dessa forma, os dispositivos passam a se comunicar entre si sem a necessidade de intervenção humana, coletando e compartilhando dados em tempo real (ASHTON, 2009; SUNDMAEKER et al., 2010).

Além disso, sistemas de monitoramento ambiental podem ser desenvolvidos utilizando diferentes tecnologias, como sensores, microcontroladores, bancos de dados e aplicações computacionais. Essa integração entre hardware e software permite criar soluções que ajudam os usuários a monitorar as condições ambientais e tomar decisões informadas.

Essas soluções baseadas em IoT têm aplicações em áreas como agricultura, automação de ambientes controlados e armazenamento de produtos sensíveis. Por exemplo, sistemas inteligentes aplicados à agricultura permitem monitorar condições ambientais, controlar processos de forma automatizada e reduzir desperdícios, mostrando a importância do uso de tecnologias conectadas para otimizar atividades (KAMIENSKI et al., 2019; WOLFERT et al., 2017).

No entanto, muitos ambientes ainda dependem de verificações manuais ou métodos limitados para monitorar alterações de temperatura e umidade, o que pode causar problemas e prejuízos. É necessário desenvolver soluções computacionais que permitam o monitoramento contínuo dessas variáveis.

Diante deste cenário, o objetivo desta pesquisa é desenvolver um sistema computacional de monitoramento de temperatura e umidade que possa contribuir para o controle do ambiente, como por exemplo uma estufa, e prevenir problemas causados por alterações inadequadas dessas condições.

Essa pesquisa é relevante porque oferece uma solução tecnológica que pode ajudar a monitorar as condições ambientais de diferentes espaços. A utilização de sensores integrados a um sistema computacional permite coletar e organizar dados, proporcionando maior controle, confiabilidade e facilidade na análise das informações. Além disso, o projeto tem importância social, pois pode melhorar ambientes que necessitam de acompanhamento constante, reduzindo riscos relacionados à falta de controle ambiental.

Como o monitoramento contínuo da temperatura e da umidade pode ajudar na preservação de materiais, alimentos e medicamentos?

O monitoramento contínuo permite acompanhar as condições do ambiente em tempo real e identificar rapidamente qualquer alteração de temperatura ou umidade. Dessa forma, é possível agir antes que essas mudanças causem danos, evitando perdas e ajudando a manter a qualidade e a segurança de materiais, alimentos e medicamentos armazenados.

## 1.1 OBJETIVOS

O objetivo geral desta pesquisa é desenvolver um sistema computacional de monitoramento ambiental capaz de coletar informações de temperatura e umidade, disponibilizando esses dados de forma organizada para auxiliar no controle das condições do ambiente monitorado. A pesquisa surge da necessidade de solucionar a dificuldade de acompanhar continuamente as variações de temperatura e umidade de forma prática e eficiente. A ausência desse monitoramento pode dificultar a identificação de alterações no ambiente e prejudicar a tomada de decisões para manter condições adequadas no local monitorado.

### Objetivos Específicos

Para alcançar esse objetivo, foram definidos objetivos específicos, como:

- Realizar uma pesquisa bibliográfica sobre Internet das Coisas, sensores e sistemas de monitoramento ambiental;
- Compreender a importância do controle de temperatura e umidade em diferentes contextos;
- Desenvolver um protótipo capaz de coletar e apresentar dados ambientais.

## 1.2 METODOLOGIA

Para desenvolver essa pesquisa, foi utilizada uma abordagem baseada em pesquisa bibliográfica e aplicação prática, envolvendo conceitos de Engenharia de Software e Desenvolvimento de Sistemas, com caráter exploratório e qualitativo, uma vez que o foco esteve no desenvolvimento de uma solução tecnológica baseada em necessidades reais de controle ambiental. No ambiente de desenvolvimento de software, foi utilizado o Visual Studio Code (VS Code) como editor de código principal, com o back-end desenvolvido em Node.js e Express.js e o front-end em React, seguindo uma arquitetura cliente-servidor com comunicação via API REST. Para o armazenamento dos dados coletados, foi utilizado o banco de dados relacional PostgreSQL, gerenciado por meio do ORM Prisma, responsável por armazenar o histórico das medições de temperatura e umidade, as configurações de cada usuário e os alertas gerados, permitindo consultas e geração de relatórios.

Em parceria com os integrantes do ensino médio com curso técnico de eletrônica, no que se refere ao hardware, foi utilizado o microcontrolador ESP32, responsável pelo processamento dos dados e pela comunicação entre os sensores e o sistema. O ESP32 foi selecionado por possuir conectividade Wi-Fi integrada, baixo consumo de energia e ampla compatibilidade com sensores utilizados em projetos de automação e monitoramento ambiental. Para a medição das variáveis ambientais, foi utilizado o sensor DHT11, responsável pela captura contínua da temperatura e da umidade do ambiente.

Posteriormente, foi conduzido o levantamento de requisitos do sistema por meio da análise das necessidades do sistema, em parceria com os integrantes do ensino médio com curso técnico de meio ambiente, que forneceram o ambiente para testes.

O desenvolvimento do sistema seguiu uma abordagem incremental e iterativa, estruturada em etapas sequenciais com validação ao final de cada uma: (1) definição da arquitetura e das decisões técnicas; (2) modelagem e implementação do banco de dados; (3) desenvolvimento do back-end e das regras de negócio; (4) desenvolvimento do front-end; (5) desenvolvimento do firmware do ESP32; (6) verificação de integração entre os módulos; (7) revisão de segurança da aplicação; (8) implementação de testes automatizados; e (9) consolidação da documentação técnica. Cada etapa produziu um documento de decisões técnicas antes da implementação, de modo que escolhas estruturais — como o modelo de dados, o mecanismo de autenticação e a estratégia de geração de alertas — fossem avaliadas antes de se tornarem código.

Além disso, o desenvolvimento contou com o apoio de uma ferramenta de inteligência artificial (Claude, da Anthropic, na variante Claude Code, um assistente de programação baseado em agentes) como recurso auxiliar ao longo de todas as etapas do projeto. A ferramenta foi utilizada na geração e revisão de código do back-end, do front-end e do firmware do ESP32; na elaboração da documentação técnica (arquitetura, integração, segurança e documentação técnica consolidada); na escrita e execução de testes automatizados de back-end com Jest e Supertest; e na verificação manual de fluxos de ponta a ponta em navegador real (login, cadastro de dispositivos, geração de alertas, filtros de histórico, entre outros), sem uma suíte automatizada dedicada no front-end. A IA também apoiou a depuração de erros durante a configuração do ambiente de desenvolvimento local (banco de dados, variáveis de ambiente, política de execução do PowerShell) e a correção iterativa de problemas identificados durante o uso prático do sistema — como uma falha na leitura de valores decimais digitados com vírgula, o ajuste do intervalo de leituras automáticas do firmware e a reformulação da tela de notificações para separá-las por dispositivo.

O uso da IA seguiu um processo supervisionado do início ao fim: cada etapa do desenvolvimento foi definida, revisada e validada pelo autor antes de prosseguir para a etapa seguinte, e nenhuma funcionalidade foi considerada concluída apenas por inspeção de código — toda implementação foi verificada em execução real, por meio dos testes automatizados, de testes de ponta a ponta no navegador e de requisições reais contra o sistema em funcionamento. Dessa forma, a inteligência artificial atuou como ferramenta de suporte técnico ao processo de desenvolvimento, de maneira análoga a um par de programação, cabendo ao autor a definição dos requisitos, as decisões finais sobre arquitetura e funcionalidades, a validação dos resultados obtidos e a responsabilidade integral pela pesquisa.

## 1.3 MODELO CONCEITUAL

O sistema proposto tem como finalidade apresentar os dados da temperatura e umidade do ambiente captados por meio de sensores, processamento, armazenamento e visualização dos dados em tempo real. O domínio do problema está relacionado ao controle ambiental em espaços que necessitam de condições climáticas estáveis para garantir conforto, segurança e preservação de materiais.

Os requisitos foram classificados em funcionais e não funcionais, servindo como base para o desenvolvimento da aplicação.

### Requisitos Funcionais (RF)

- RF01 – O sistema deve capturar dados de temperatura do ambiente em tempo real.
- RF02 – O sistema deve capturar dados de umidade do ambiente em tempo real.
- RF03 – O sistema deve exibir os dados coletados em uma interface de visualização.
- RF04 – O sistema deve armazenar o histórico das medições realizadas.
- RF05 – O sistema deve permitir o monitoramento contínuo do ambiente.

### Requisitos Não Funcionais (RNF)

- RNF01 – O sistema deve possuir uma interface simples e intuitiva.
- RNF02 – O sistema deve apresentar confiabilidade na coleta e exibição dos dados.
- RNF03 – O sistema deve ser compatível com diferentes dispositivos (desktop e mobile).
- RNF04 – O sistema deve garantir atualização dos dados em tempo real ou com baixa latência.

## REFERÊNCIAS

ASHTON, K. (2009) That "Internet of Things" Thing. In the Real World, Things Matter More than Ideas. **RFID Journal**.

SUNDMAEKER, H.; GUILLEMIN, P.; FRIESS, P.; WOELFFLÉ, S. (2010) **Vision and Challenges for Realising the Internet of Things**. Cluster of European Research Projects on the Internet of Things — CERP IoT.

KAMIENSKI, C.; SOININEN, J. P.; TAUMBERGER, M.; DANTAS, R.; TOSCANO, A.; CINOTTI, T. S.; MAIA, R. F.; TORRE NETO, A. (2019) **Smart Water Management Platform: IoT-Based Precision Irrigation for Agriculture**.

WOLFERT, S.; GE, L.; VERDOUW, C.; BOGAARDT, M. J. (2017) **Big Data in Smart Farming — A Review**. Agricultural Systems.
