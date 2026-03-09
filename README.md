# 0xSaidoss — Portfolio CMS

## Lancer le site
```bash
cd portfolio3
python3 -m http.server 4444
# http://localhost:4444
```

## Admin
- URL : http://localhost:4444/admin/index.html
- Mot de passe par défaut : **cyber2024**

## Si le bouton Admin ne répond pas
Vide le localStorage depuis la console du navigateur :
```js
localStorage.clear()
```
Puis recharge la page.

## Si l'Arsenal n'est pas éditable (ancienne version)
```js
localStorage.removeItem('cmsv1_arsenal')
```

## Configuration EmailJS (contact)
Dans `js/main.js`, remplace :
```js
const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';
```

## Mot de passe oublié / hash incorrect
```js
localStorage.removeItem('cmsv1_passhash')
// Recharge → mot de passe par défaut : cyber2024
```
# Portfolio
