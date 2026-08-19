# 🎮 GTA VI Collector — Le Grand Jeu Keep Cool

Site web + base de données + système de tirage au sort pour le jeu-concours
organisé à la salle de sport à l'occasion de la sortie de GTA VI.

**5 PlayStation 5** et **5 jeux GTA VI** à gagner. Participation via l'achat du
t-shirt collector (code unique par t-shirt), en ligne ou à l'accueil.

---

## Ce que contient le projet

| Élément | Fichier / URL |
|---|---|
| Site public (présentation + inscription) | `public/index.html` → `/` |
| Boutique en ligne (achat t-shirt + paiement) | `public/boutique.html` → `/boutique.html` |
| Page de confirmation de commande | `public/merci.html` → `/merci.html` |
| Règlement en ligne | `public/reglement.html` → `/reglement.html` |
| Tableau de bord admin (suivi, ajout salle, export) | `public/admin.html` → `/admin.html` |
| Interface de tirage au sort animée | `public/tirage.html` → `/tirage.html` |
| Vérificateur public du tirage | `public/verificateur.html` → `/verificateur.html` |
| Serveur + API + base SQLite | `server.js`, `lib/` |
| Génération des codes t-shirt | `scripts/generate-codes.js` |

La base de données (SQLite) est créée automatiquement dans `data/concours.db`.

---

## Démarrage en 3 minutes (en local)

```bash
# 1. Installer les dépendances
npm install

# 2. Générer les codes uniques des t-shirts (ex. 300 t-shirts)
npm run gen-codes 300
#    -> crée les codes en base + un CSV imprimable dans data/codes-a-imprimer.csv

# 3. Lancer le site
npm start
```

Puis ouvrez :

- Site public : http://localhost:3000
- Admin : http://localhost:3000/admin.html
- Tirage : http://localhost:3000/tirage.html

> Mot de passe admin par défaut : `keepcool-gta6` — **à changer** (voir Configuration).

---

## Configuration

Copiez `.env.example` en `.env` et adaptez : nom de la salle, ville, dates,
prix du t-shirt, nombre de lots, **mot de passe admin**, etc.
Sur un hébergeur, définissez ces valeurs comme variables d'environnement.

Le visuel du t-shirt : déposez votre image dans `public/assets/` et remplacez
le bloc `.hero-visual` dans `public/index.html` par votre `<img>`.

---

## Le t-shirt et les codes

Chaque t-shirt collector porte un **code unique** (ex. `GTA6-AB12-CD34`) imprimé
sur une étiquette ou une carte. Ce code est le ticket de participation :

1. Générez autant de codes que de t-shirts (`npm run gen-codes <nombre>`).
2. Imprimez-les depuis `data/codes-a-imprimer.csv` (un code par étiquette).
3. Le client saisit son code en ligne, ou le donne à l'accueil.

Un code = une participation. Impossible de l'utiliser deux fois.

---

## Le tirage au sort (transparent & vérifiable)

Le tirage n'est pas une « boîte noire ». Il repose sur une **graine publique**
annoncée à l'avance et un calcul reproductible :

> classement = tri des participants par `SHA-256(graine | code)` croissant
> → 5 premiers = PS5, 5 suivants = GTA VI, suivants = suppléants.

**Bonne pratique :** choisissez une graine que vous ne pouvez pas prédire, par
exemple les numéros du tirage du Loto d'une date future annoncée. Ainsi,
personne (pas même vous) ne peut manipuler le résultat.

N'importe quel participant peut recalculer le classement dans son navigateur via
`/verificateur.html` (aucune donnée envoyée à un serveur) : c'est la preuve que
le tirage est honnête.

Lancer le tirage : `/tirage.html` (interface animée) ou en ligne de commande :

```bash
npm run draw "KEEPCOOL-GTA6-2026 numeros loto 20/09"
```

Un procès-verbal (JSON) téléchargeable est produit à chaque tirage.

---

## Boutique en ligne, paiement Mollie et e-mails

Les clients peuvent acheter le t-shirt directement en ligne (`/boutique.html`) :
choix des tailles + quantités, livraison à domicile (**+3,50 €**) ou retrait à la
salle (gratuit), puis paiement. Dès que le paiement est validé :

1. la commande passe en « payée » et reçoit un **numéro** (`SSC-2026-00001`…) ;
2. un **code de participation** est généré automatiquement **par t-shirt** et
   le client est **inscrit au tirage** (aucune ressaisie) ;
3. un **e-mail de confirmation stylé** (look du site) est envoyé : récapitulatif,
   numéro de commande, frais d'envoi, et le(s) code(s) de participation.

### Paiement Mollie

- Renseignez `MOLLIE_API_KEY` (clé `test_…` puis `live_…` depuis votre dashboard
  Mollie) et `BASE_URL` (l'URL publique de votre site).
- Mollie a besoin de joindre le **webhook** `BASE_URL/api/webhook/mollie` : votre
  site doit donc être en ligne (le webhook ne fonctionne pas sur `localhost`).
  La page de confirmation revérifie aussi le statut au retour, par sécurité.
- **Sans clé** (`MOLLIE_API_KEY` vide) : le site tourne en **mode démo** — une page
  de paiement simulée permet de tester tout le parcours de bout en bout.

### E-mails (SMTP)

- Renseignez `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
- **Sans SMTP** : mode fichier — chaque e-mail est écrit dans `data/emails/…html`
  (utile pour prévisualiser le rendu).
- Une copie de chaque commande est envoyée en **copie cachée** à `MAIL_BCC`.

Le suivi des commandes est visible dans le tableau de bord admin.

## Mise en ligne (hébergement)

L'application est un serveur Node.js standard. Elle se déploie sur n'importe quel
hébergeur Node (Render, Railway, Fly.io, un VPS, etc.) :

1. Poussez le code sur le dépôt de l'hébergeur.
2. Commande de build : `npm install` — commande de démarrage : `npm start`.
3. Définissez les variables d'environnement (surtout `ADMIN_PASSWORD`).
4. Prévoyez un disque persistant pour le dossier `data/` (la base SQLite).

> ⚠️ SQLite stocke la base dans un fichier. Sur les hébergeurs « sans disque
> persistant », montez un volume sur `data/` pour ne pas perdre les inscriptions.

---

## Rappels juridiques (France)

- Jeu-concours **avec obligation d'achat** = loterie publicitaire, autorisée si
  loyale (art. L.121-20 du Code de la consommation). Une **voie de participation
  gratuite** est prévue au règlement par sécurité.
- Le **règlement** (`reglement.html` + version Word fournie) doit être complété
  (SIRET, adresse, dates…) et accessible gratuitement.
- **RGPD** : données utilisées uniquement pour le Jeu, droits d'accès/suppression.
- Le Jeu est **sans lien** avec Rockstar, Take-Two ou Sony (mention obligatoire).

Ce projet fournit une base solide ; faites relire le règlement par un
professionnel du droit avant publication si vous le souhaitez.
