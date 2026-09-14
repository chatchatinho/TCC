1. Ligar os fios (3 fios só)
DHT11	ESP32
VCC	3V3
GND	GND
DATA	GPIO 4
Se o módulo do sensor tiver um 4º pino escrito "NC", pode ignorar — não usa.

2. Cadastrar o dispositivo no site
Com o sistema web aberto e você logado:

Vá em Dispositivos → dê um nome (ex. "Sensor Sala") → Adicionar.
Vai aparecer um identificador (tipo ESP32-A1B2C3) e um token. Copie os dois agora — o token só aparece essa vez.
3. Preencher o arquivo de configuração do firmware
Na pasta esp32/firmware do projeto, copie config.example.h e renomeie a cópia para config.h. Abra e preencha 4 coisas:

Pra achar o SEU_IP_LOCAL: no PowerShell, rode ipconfig e procure "Endereço IPv4" (algo como 192.168.0.15). O ESP32 não entende localhost — só o IP da sua máquina na rede.

⚠️ Duas coisas importantes: o Wi-Fi precisa ser 2.4GHz (o ESP32 não conecta em 5GHz), e o ESP32 precisa estar na mesma rede do computador que roda o backend.

4. Enviar o programa pra placa
No Arduino IDE: abra esp32/firmware/firmware.ino → escolha a placa (Tools → Board → esp32 → ESP32 Dev Module, se não souber qual é a sua) → escolha a porta USB (Tools → Port) → clique na seta de Upload.

5. Conferir que funcionou
Abra o Serial Monitor (115200 baud) e veja se aparece "Wi-Fi conectado" e "Leitura registrada com sucesso". Depois é só olhar o Dashboard no navegador — a leitura real deve aparecer e o status do dispositivo virar 🟢 Online.







o firmware do ESP32 já está preparado pra isso — já tem suporte a HTTPS embutido (dá pra ver em esp32/firmware/firmware.ino), então não precisa mudar nada no código do sensor, só o endereço que ele aponta.

A ideia central: hoje o ESP32 precisa estar na mesma rede Wi-Fi do computador porque ele fala com um IP local (192.168.x.x). Colocando o site num servidor de verdade (com domínio público), o ESP32 passa a falar com um endereço da internet — e aí ele funciona de qualquer rede com internet, inclusive de casa enquanto o servidor está em outro lugar. Não precisa nem mexer no roteador de casa (sem "abrir porta").

O que muda, na prática:

Hospedar o site: backend + PostgreSQL + frontend precisam rodar num servidor com IP/domínio público — algo como Render, Railway ou Fly.io (mais simples, já dão HTTPS de graça) ou uma VPS própria (mais controle, mais trabalho de configurar).
HTTPS obrigatório: o backend já checa NODE_ENV=production pra só aceitar cookies seguros nesse modo — então o site em produção precisa estar em https://, não http://.
3 variáveis de ambiente pra trocar: CORS_ORIGIN e FRONTEND_URL no backend (apontando pro domínio real do site) e VITE_API_URL no frontend (apontando pro domínio real da API).
No ESP32, só trocar uma linha no config.h:
#define API_BASE_URL "https://seu-backend.com/api"

Minha recomendação, dado que é um TCC (não precisa de infraestrutura elaborada): usar um serviço tipo Render ou Railway — eles sobem o Postgres, o backend e o frontend com HTTPS automático, sem precisar mexer com certificado/Nginx na mão. A troca é: menos controle/customização, mas configuração muito mais rápida que uma VPS.

Quer que eu te guie passo a passo pra subir num desses serviços?