# 🧬 DNS Smart Server (Unbound Orchestrator MVP)

DNS Smart Server é um servidor DNS recursivo/autoritativo de alta performance integrado com uma **Interface Web Premium** de gestão, firewall, blocklists e monitoramento de latência em tempo real. Ele orquestra o **NLnet Labs Unbound** executando de forma segura em ambientes isolados via Docker.

---

## 🚀 Principais Funcionalidades

### 1. 🧠 Inteligência & Otimização de Latência
* **SRTT Selector**: Mede dinamicamente o Round-Trip Time (RTT) de cada DNS upstream (forwarder) e prioriza consultas na velocidade máxima.
* **Prefetch Cache**: Antecipa expirações de domínios populares no cache e faz o refresh em background (zero latência para o cliente final).
* **Serve-Expired (RFC 8767)**: Mantém resiliência servindo cache expirado por até 72 horas em cenários de queda de internet.
* **Mirror Root Local (RFC 8806)**: Evita overhead de consultas para servidores root recursivos copiando a zona raiz localmente.
* **QNAME Minimization**: Reduz a exposição de dados de navegação para servidores DNS externos.

### 2. 🛡️ Segurança & Firewall
* **Adblocker Integrado**: Bloqueia anúncios, rastreadores e ameaças conhecidas através de feeds de blocklists (suporta hosts/adblock formats).
* **DNS Rebinding Protection**: Previne ataques maliciosos bloqueando respostas de servidores externos resolvendo para IPs privados da LAN.
* **Response Rate Limiting (RRL)**: Proteção robusta contra ataques de amplificação DNS e inundações DDoS por sub-redes.
* **Validação DNSSEC**: Validação criptográfica integrada garante a integridade da origem dos registros recebidos.

### 3. 📊 Dashboard Premium Real-Time (WebSocket)
* **Live Query Log Table**: Monitor de consultas em tempo real com estatísticas de IP, latência, código de resposta e cache hit.
* **Sleek Dark Theme**: Interface premium com glassmorphism, gradientes modernos e micro-animações.
* **Real-time Chart.js Charts**: Gráficos de QPS, distribuição de tipos de consulta, códigos de erro e rankings de clientes/domínios.
* **Upstream Health Indicators**: Gráficos de barra e sparklines monitoram a latência e status dos resolvers recursivos em tempo real.

---

## 🛠️ Como Executar com Docker Compose

### 📋 Pré-requisitos
Certifique-se de ter instalado:
* **Docker** e **Docker Compose**
* Caso execute no Linux, libere a porta 53 no host desabilitando o `systemd-resolved` (veja seção de Solução de Problemas).

### 🚀 Inicialização Rápida

1. Clone o repositório e navegue até a pasta:
   ```bash
   cd 115-DNS_Smart
   ```

2. Copie o arquivo de variáveis de ambiente padrão:
   ```bash
   cp .env.example .env
   ```

3. Inicie os containers com build em background:
   ```bash
   docker compose up --build -d
   ```

4. Verifique se os containers estão rodando de forma saudável:
   ```bash
   docker compose ps
   ```

5. Acesse o Painel de Controle no seu navegador:
   * **URL**: `http://localhost:3000`
   * **Usuário Padrão**: `admin`
   * **Senha Padrão**: `dnssmart2024` (Pode ser alterada no arquivo `.env`)

---

## 🧪 Como Testar e Validar

### 1. Testar Resolução Recursiva Básica
Use o utilitário `dig` para enviar uma consulta ao container DNS:
```bash
dig @localhost google.com
```
A resposta deve retornar status `NOERROR` com os IPs correspondentes.

### 2. Validar Cache Hit (Latência Otimizada)
Envie uma consulta pela segunda vez para ver a atuação do cache ultra-rápido:
```bash
dig @localhost example.com | grep "Query time"
# Primeira vez: ~30-150ms (Miss)

dig @localhost example.com | grep "Query time"
# Segunda vez: 0ms E/OU 1ms (Hit served from cache!)
```

### 3. Testar Bloqueio de Firewall (Blocklist)
Adicione um domínio ao painel de bloqueios (ex: `ads.tracker.com`). Ao testar a resolução:
```bash
dig @localhost ads.tracker.com
```
O Unbound responderá instantaneamente com status `NXDOMAIN` (Não encontrado), filtrando o anúncio na origem!

### 4. Validar Monitor de Saúde das Upstreams
Acesse o painel administratvo na aba **Upstream DNS** ou no rodapé do dashboard. O painel consultará o Unbound via controle remoto TLS na porta `8953` para recuperar as latências ativas de cada servidor.

---

## 🖥️ Arquitetura dos Diretórios

* `/unbound`: Contém o Dockerfile de compilação Alpine, configurações do Unbound base (`unbound.conf`), certificados de controle TLS e o inicializador `entrypoint.sh`.
* `/gui`: Backend Fastify escrito em TypeScript compilado, banco SQLite e os arquivos estáticos da SPA em Javascript Vanilla, CSS Variables e Chart.js.
* `/shared`: Arquivos de tipos e constantes comuns partilhados.

---

## 🛠️ Solução de Problemas

### Porta 53 já em uso no Linux (systemd-resolved)
Em sistemas com Ubuntu ou Debian, o resolvedor local padrão impede que o Docker vincule a porta 53. Para desabilitar:
1. Abra o arquivo de configuração:
   ```bash
   sudo nano /etc/systemd/resolved.conf
   ```
2. Adicione ou modifique a linha:
   ```ini
   DNSStubListener=no
   ```
3. Reinicie o resolvedor do sistema:
   ```bash
   sudo systemctl restart systemd-resolved
   ```
4. Suba novamente os containers com `docker compose up -d`.
