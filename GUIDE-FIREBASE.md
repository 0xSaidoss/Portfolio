# 🔥 Guide de configuration Firebase — 0xSaidoss Portfolio

## ÉTAPE 1 — Créer ton projet Firebase (5 min)

1. Va sur **https://console.firebase.google.com**
2. Clique **"Ajouter un projet"**
3. Nom du projet : `saidoss-portfolio`
4. Désactive Google Analytics (pas nécessaire) → **Créer le projet**

---

## ÉTAPE 2 — Activer Firestore (base de données)

1. Dans ton projet → **Build → Firestore Database**
2. Clique **"Créer une base de données"**
3. Choisis **"Commencer en mode test"** (règles ouvertes pendant 30 jours)
4. Région : **europe-west3** (Frankfurt, proche de la CI)
5. Clique **Activer**

---

## ÉTAPE 3 — Activer Firebase Authentication

1. Dans ton projet → **Build → Authentication**
2. Clique **"Commencer"**
3. Onglet **"Sign-in method"** → Activer **Email/Mot de passe**
4. Onglet **"Users"** → **"Ajouter un utilisateur"**
   - Email : `msaidou02.diallo@gmail.com`
   - Mot de passe : *(ton mot de passe admin)*
5. Clique **Ajouter l'utilisateur**

---

## ÉTAPE 4 — Récupérer ta config Firebase

1. Dans ton projet → ⚙ **Paramètres du projet** (icône engrenage)
2. Section **"Tes applications"** → clique **"</>"** (Web)
3. Nom : `portfolio-web` → **Enregistrer l'application**
4. Tu verras un objet `firebaseConfig` comme ça :

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "saidoss-portfolio.firebaseapp.com",
  projectId: "saidoss-portfolio",
  storageBucket: "saidoss-portfolio.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

5. **Copie ces valeurs** dans `js/firebase-store.js` :

```js
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",          // ← colle ici
  authDomain:        "saidoss-portfolio.firebaseapp.com",
  projectId:         "saidoss-portfolio",
  storageBucket:     "saidoss-portfolio.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

---

## ÉTAPE 5 — Sécuriser Firestore (Règles)

1. Firestore → **Règles** → Remplace par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Projets, posts, arsenal — lecture publique, écriture admin seulement
    match /projects/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /posts/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /arsenal/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Likes — lecture/écriture publique (pour les visiteurs)
    match /likes/{id} {
      allow read, write: if true;
    }

    // Commentaires — lecture/écriture publique, suppression admin
    match /comments/{projectId}/items/{commentId} {
      allow read, create: if true;
      allow delete: if request.auth != null;
    }

    // Visites — lecture admin, écriture publique
    match /meta/visits {
      allow read: if request.auth != null;
      allow write: if true;
    }
  }
}
```

2. Clique **Publier**

---

## ÉTAPE 6 — Déployer sur GitHub Pages

```bash
# 1. Crée un repo GitHub : saidoss-portfolio (PUBLIC)
git init
git add .
git commit -m "Initial commit — portfolio Firebase"
git branch -M main
git remote add origin https://github.com/0xSaidoss/saidoss-portfolio.git
git push -u origin main

# 2. Sur GitHub → Settings → Pages → Source: main branch / root
# 3. Ton site sera sur : https://0xsaidoss.github.io/saidoss-portfolio/
```

---

## ⚠️ IMPORTANT — GitHub Pages et modules ES

GitHub Pages supporte les fichiers statiques. Le `type="module"` dans les scripts HTML fonctionne nativement dans tous les navigateurs modernes. **Aucun build nécessaire.**

---

## 🔒 Plan gratuit Firebase (Spark)

| Ressource | Limite gratuite |
|-----------|----------------|
| Firestore lectures | 50 000 / jour |
| Firestore écritures | 20 000 / jour |
| Firestore stockage | 1 GB |
| Auth utilisateurs | Illimité |
| **Pour ton portfolio** | **Largement suffisant** ✅ |
