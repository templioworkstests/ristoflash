# RistoFlash - Gestione Ordini Ristoranti

SPA multi-tenant per la gestione degli ordini ai tavoli dei ristoranti, accessibile tramite QR code.

## Tecnologie

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Routing**: React Router v6
- **Notifiche**: React Hot Toast

## Setup

1. Installa le dipendenze:
```bash
npm install
```

2. Crea un file `.env.local` nella root del progetto con le seguenti variabili:
```
VITE_SUPABASE_URL=https://YOUR_SUPABASE_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
# Opzionale: gestisci la service role solo lato backend/edge functions, non nel frontend pubblico
# SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

3. Avvia il server di sviluppo:
```bash
npm run dev
```

## Struttura Database

Prima di utilizzare l'applicazione, è necessario creare le seguenti tabelle in Supabase:

### Tabelle Principali

1. **restaurants** - Gestione dei ristoranti
2. **users** - Utenti del sistema (admin, manager, staff)
3. **categories** - Categorie del menu
4. **products** - Prodotti del menu
5. **tables** - Tavoli del ristorante
6. **orders** - Ordini
7. **order_items** - Dettagli ordini
8. **waiter_calls** - Chiamate cameriere
9. **subscription_plans** - Piani di abbonamento

### Politiche RLS (Row Level Security)

Per garantire la sicurezza, implementa le seguenti politiche RLS in Supabase:

- Gli utenti possono accedere solo ai dati del proprio ristorante
- I clienti possono solo leggere il menu e creare ordini per il loro tavolo
- L'admin può accedere a tutti i dati

## Funzionalità

### Pannello Amministratore (Livello 0)
- Dashboard con statistiche
- Gestione CRUD ristoranti
- Gestione piani di abbonamento

### Pannello Ristorante (Livelli 1 e 2)
- **Menu**: Gestione categorie e prodotti
- **Tavoli**: Creazione tavoli e generazione QR Code
- **Ordini**: Visualizzazione ordini in tempo reale tramite Supabase Realtime
- **Staff**: Gestione utenti del ristorante

### Interfaccia Cliente (Anonimo)
- Accesso tramite QR Code
- Visualizzazione menu mobile-first
- Carrello e ordinazione
- Funzione "Chiamata Cameriere"

## Sicurezza

- Tutte le chiavi sensibili devono essere salvate in `.env.local` e non committate
- Implementa RLS policies in Supabase
- Utilizza autenticazione Supabase per tutti gli endpoint protetti

## Script SQL per creare le tabelle

Vedi `database-schema.sql` per lo schema completo del database.

## Automazione push da terminale

- Usa `./scripts/autopush.sh "Messaggio commit"` per eseguire in sequenza `git add -A`, `git commit` e `git push` sul branch corrente.
- Lo script mostra prima lo stato (`git status --short`) così puoi verificare le modifiche che sta per includere.
- L'autenticazione verso GitHub sfrutta le credenziali già salvate (PAT nel portachiavi). Se viene richiesta, inserisci il tuo username e il token come password.
- Assicurati di rigenerare un PAT se lo hai esposto e conferma che le regole di `.gitignore` tengano fuori i file sensibili prima di eseguire lo script.










