# App — ThermoSense Lite (Dart/Flutter)

App Flutter (roda em Web, Android ou iOS a partir do mesmo código) que
consome a API PHP.

## Telas

- **Login / Cadastro**
- **Dashboard**: lista de dispositivos com a última leitura e status (online/offline)
- **Detalhe do dispositivo**: histórico de leituras + botão "Simular leitura" (testa sem hardware)
- **Novo dispositivo**: cria um dispositivo e mostra o token (uma vez) para configurar no ESP32
- **Configurações**: faixa ideal de temperatura/umidade (o que dispara os alertas)
- **Alertas**: lista de leituras fora da faixa, com opção de marcar como resolvido

## Como rodar

1. Instale as dependências:
   ```bash
   flutter pub get
   ```
2. Confira `lib/config.dart` — o endereço da API muda dependendo de onde o
   app roda (Chrome, emulador Android ou celular físico; instruções nos
   comentários do arquivo).
3. Rode:
   ```bash
   flutter run -d chrome     # mais rápido para testar
   # ou
   flutter run                # escolhe o emulador/dispositivo conectado
   ```

## Estrutura

```
lib/
├── main.dart              Entrada do app
├── config.dart             Endereço da API
├── models/                 User, Device, Measurement, AlertItem
├── services/api_service.dart   Toda a comunicação HTTP com o backend
└── screens/                 Uma tela por arquivo
```
