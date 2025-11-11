# Setup Guide - RistoFlash

## Prerequisiti

- Node.js 18+ e npm
- Account Supabase attivo
- Accesso al progetto Supabase

## Passo 1: Installazione Dipendenze

```bash
npm install
```

## Passo 2: Configurazione Environment Variables

Crea un file `.env.local` nella root del progetto con:

```
VITE_SUPABASE_URL=https://YOUR_SUPABASE_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

## Passo 3: Setup Database

1. Accedi al tuo progetto Supabase
2. Vai alla sezione "SQL Editor"
3. Esegui lo script SQL contenuto in `database-schema.sql`
4. Verifica che tutte le tabelle siano state create correttamente

## Passo 4: Configurazione RLS (Row Level Security)

Le politiche RLS sono incluse nello script SQL, ma potresti doverle personalizzare in base alle tue esigenze. Verifica nella sezione "Authentication" > "Policies" di Supabase.

## Passo 5: Creazione Utente Admin

Per creare il primo utente admin:

1. Vai alla sezione "Authentication" > "Users" in Supabase
2. Crea un nuovo utente manualmente o tramite l'API
3. Inserisci manualmente nella tabella `users` un record con:
   - `id`: l'UUID dell'utente appena creato
   - `email`: email dell'utente
   - `role`: 'admin'
   - `restaurant_id`: NULL (per gli admin)

Esempio SQL:
```sql
INSERT INTO users (id, email, role, restaurant_id)
VALUES ('UUID_DEL_UTENTE_AUTH', 'admin@ristoflash.com', 'admin', NULL);
```

## Passo 6: Avvio Applicazione

```bash
npm run dev
```

L'applicazione sarà disponibile su `http://localhost:5173`

## Passo 7: Test Funzionalità

1. Accedi con le credenziali admin
2. Crea un nuovo ristorante dal pannello admin
3. Crea un utente manager per il ristorante
4. Accedi come manager e configura menu, tavoli, etc.
5. Genera un QR code per un tavolo
6. Scansiona il QR code (o apri l'URL manualmente) per testare l'interfaccia cliente

## Note Importanti

### Realtime

Assicurati che la funzionalità Realtime sia abilitata in Supabase:
- Vai a "Project Settings" > "API"
- Verifica che "Realtime" sia abilitato

### Storage (Opzionale)

Per caricare immagini di prodotti e logo:
1. Crea un bucket chiamato "restaurant-assets" in Supabase Storage
2. Configura le politiche di accesso per il bucket

### Domini

Per utilizzare l'applicazione in produzione:
1. Configura il dominio nella sezione "Authentication" > "URL Configuration"
2. Aggiungi il dominio ai redirect URLs

### QR Code dinamici

- Sai che i QR ora passano da `/qr/:restaurantId/:tableId`, generando token con validità 2 ore.
- Assicurati di impostare la variabile `SUPABASE_SERVICE_ROLE_KEY` anche su Vercel (o nell'ambiente scelto) per permettere all'edge function di creare i token.

## Troubleshooting

### Errore "Missing Supabase environment variables"
- Verifica che il file `.env.local` esista e contenga tutte le variabili necessarie
- Riavvia il server di sviluppo

### Errori di autenticazione
- Verifica che l'utente esista in `auth.users` e in `users`
- Controlla che il ruolo sia corretto

### Realtime non funziona
- Verifica che Realtime sia abilitato nel progetto Supabase
- Controlla che le politiche RLS permettano la lettura dei dati necessari










