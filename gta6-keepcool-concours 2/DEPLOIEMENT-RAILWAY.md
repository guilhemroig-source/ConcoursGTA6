# 🚂 Déployer le site sur Railway — guide pas à pas

Ce projet est une application Node.js + base SQLite. Railway la fait tourner en
continu et conserve la base grâce à un **volume persistant**. Compte ~15 minutes.

---

## 0. Ce qu'il te faut

- Un compte **GitHub** (gratuit) — pour héberger le code.
- Un compte **Railway** (railway.app) — connexion via GitHub.
- Un compte **Mollie** (mollie.com) — pour encaisser les paiements (clé de test
  d'abord, puis clé « live »).
- Des identifiants **SMTP** pour l'envoi des e-mails (ta boîte pro, ou un service
  d'envoi transactionnel). Optionnel au début : sans SMTP, les e-mails sont
  seulement enregistrés dans `data/emails/`.

---

## 1. Mettre le code sur GitHub

1. Crée un dépôt vide sur GitHub (ex. `concours-gta6`), **privé**.
2. Décompresse le projet sur ton ordinateur, puis dans un terminal, à la racine
   du dossier `gta6-keepcool-concours` :

   ```bash
   git init
   git add .
   git commit -m "Site jeu-concours GTA VI"
   git branch -M main
   git remote add origin https://github.com/TON-COMPTE/concours-gta6.git
   git push -u origin main
   ```

   > Le fichier `.gitignore` exclut déjà `node_modules`, la base de données et le
   > fichier `.env` : rien de sensible n'est envoyé.

---

## 2. Créer le projet sur Railway

1. Sur railway.app : **New Project** → **Deploy from GitHub repo** → choisis ton
   dépôt. Autorise Railway à accéder à GitHub si demandé.
2. Railway détecte Node automatiquement (Nixpacks), installe les dépendances
   (`npm install`) et démarre (`npm start`). Laisse le premier déploiement finir.

---

## 3. Ajouter le volume persistant (IMPORTANT)

Sans ça, la base serait effacée à chaque redéploiement.

1. Dans ton service Railway → onglet **Variables**… d'abord, puis **Settings**.
2. Clique sur le service → **+ Volume** (ou onglet *Data/Volumes*).
3. **Mount path** : `/data`
4. Valide. Le volume est créé et monté.

---

## 4. Configurer les variables d'environnement

Service → onglet **Variables** → ajoute (Raw editor pratique pour tout coller) :

```
DATA_DIR=/data
ADMIN_PASSWORD=un-mot-de-passe-solide
ORGANISATEUR=Keep Cool Narbonne
VILLE=Narbonne
DATE_DEBUT=JJ/MM/AAAA
DATE_FIN=JJ/MM/AAAA
DATE_TIRAGE=JJ/MM/AAAA
NB_GAGNANTS=3
NB_SUPPLEANTS=3
PRIX_TSHIRT_CENTS=2500
FRAIS_ENVOI_CENTS=350
MOLLIE_API_KEY=          (laisse vide pour tester en mode démo, voir étape 6)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=Keep Cool Narbonne <narbonne@keepcool.fr>
MAIL_BCC=narbonne@keepcool.fr
```

> `PORT` est géré automatiquement par Railway, ne le mets pas.

---

## 5. Générer le domaine public + BASE_URL

1. Service → **Settings** → **Networking** → **Generate Domain**.
2. Copie l'URL fournie (ex. `https://concours-gta6-production.up.railway.app`).
3. Retourne dans **Variables** et ajoute :

   ```
   BASE_URL=https://concours-gta6-production.up.railway.app
   ```

   (colle **ton** URL exacte). Railway redéploie tout seul.

> `BASE_URL` est indispensable : c'est l'adresse que Mollie utilise pour la
> redirection après paiement **et** pour le webhook de confirmation.

---

## 6. Brancher Mollie

1. Crée ton compte sur mollie.com, active au moins une méthode de paiement.
2. Dashboard Mollie → **Developers** → **API keys**. Commence avec la **Test API
   key** (`test_…`).
3. Colle-la dans la variable `MOLLIE_API_KEY` sur Railway. Redéploiement auto.
4. Teste un achat depuis `/boutique.html` : tu es redirigé vers la page Mollie de
   test, le paiement validé déclenche la commande, le code de participation et
   l'e-mail.
5. Quand tout est bon, remplace par la **Live API key** (`live_…`) pour encaisser
   réellement.

> Sans clé Mollie, le site reste utilisable en **mode démo** (paiement simulé) —
> pratique pour montrer le parcours avant d'avoir le compte.

---

## 7. Première mise en route

1. Ouvre `https://TON-URL/admin.html` et connecte-toi avec `ADMIN_PASSWORD`.
2. Dans **Données & tirage** → **Codes des t-shirts**, génère le nombre de codes
   correspondant à tes t-shirts vendus **en salle**, puis télécharge le CSV pour
   les imprimer/coller. (Les achats **en ligne** génèrent leur code tout seuls.)
3. Renseigne les dates dans le règlement (fichier Word) et affiche-le à l'accueil.

---

## 8. Le jour J et après

- Suis les inscriptions et commandes dans l'**admin**.
- À la clôture : passe la variable `INSCRIPTIONS_OUVERTES=false`.
- Va sur `/tirage.html`, saisis la **graine publique** annoncée, lance le tirage.
- Communique le résultat ; chacun peut vérifier sur `/verificateur.html`.

---

## Dépannage rapide

- **La base se vide après un déploiement** → le volume n'est pas monté sur `/data`
  ou `DATA_DIR` n'est pas `/data`. Vérifie l'étape 3 et 4.
- **Le paiement ne se confirme pas** → `BASE_URL` ne correspond pas au domaine
  public, ou la clé Mollie est absente. Vérifie l'étape 5 et 6.
- **Pas d'e-mail reçu** → SMTP non renseigné (les e-mails sont alors seulement
  dans `data/emails/`). Renseigne `SMTP_HOST` etc.
- **Erreur au build** → vérifie que Node 22 est utilisé (déjà fixé dans
  `package.json`).

Besoin d'un coup de main sur une étape précise ? Dis-moi où tu bloques.
