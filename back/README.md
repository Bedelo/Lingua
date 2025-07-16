# Lingua Backend

Backend Node.js/Express avec base de données SQLite pour la gestion et persistance des enregistrements audio de l'application Lingua.

## 🚀 Installation

```bash
# Installer les dépendances
npm install

# Initialiser la base de données
npm run init-db

# Démarrer le serveur en mode développement
npm run dev

# Ou démarrer en mode production
npm start
```

## 📊 Base de données

Le backend utilise SQLite avec la table suivante :

### Table `audio_recordings`
- `id` (TEXT PRIMARY KEY) - Identifiant unique UUID
- `filename` (TEXT) - Nom du fichier sur le serveur
- `original_name` (TEXT) - Nom original du fichier
- `file_path` (TEXT) - Chemin vers le fichier
- `file_size` (INTEGER) - Taille du fichier en bytes
- `mime_type` (TEXT) - Type MIME du fichier
- `upload_date` (TEXT) - Date d'upload ISO
- `created_at` (DATETIME) - Date de création
- `updated_at` (DATETIME) - Date de dernière modification

## 🔗 API Endpoints

### Santé du serveur
```
GET /api/health
```
Retourne le statut du serveur.

### Upload d'audio
```
POST /api/audio/upload
Content-Type: multipart/form-data
Body: audio (file)
```
Upload un fichier audio et le sauvegarde en base.

### Récupérer tous les enregistrements
```
GET /api/audio
```
Retourne la liste de tous les enregistrements audio.

### Récupérer un enregistrement spécifique
```
GET /api/audio/:id
```
Retourne les détails d'un enregistrement par son ID.

### Télécharger un fichier audio
```
GET /api/audio/:id/download
```
Télécharge le fichier audio correspondant à l'ID.

### Supprimer un enregistrement
```
DELETE /api/audio/:id
```
Supprime un enregistrement et son fichier associé.

## 📁 Structure des fichiers

```
back/
├── database/
│   ├── db.js              # Module de gestion SQLite
│   └── lingua.db          # Base de données SQLite (créée automatiquement)
├── scripts/
│   └── init-db.js         # Script d'initialisation de la DB
├── uploads/               # Dossier des fichiers uploadés (créé automatiquement)
├── server.js              # Serveur Express principal
├── package.json           # Dépendances et scripts
└── README.md              # Cette documentation
```

## 🔧 Configuration

### Variables d'environnement
- `PORT` : Port du serveur (défaut: 3000)

### Limites
- Taille maximale des fichiers : 50MB
- Types de fichiers acceptés : audio/* uniquement

## 🔄 Intégration avec l'app React Native

Pour intégrer avec l'application React Native existante, vous pouvez modifier le code dans `index.tsx` pour envoyer les fichiers au backend :

```javascript
const uploadAudio = async (uri) => {
  const formData = new FormData();
  formData.append('audio', {
    uri: uri,
    type: 'audio/m4a',
    name: 'recording.m4a'
  });

  try {
    const response = await fetch('http://localhost:3000/api/audio/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    const result = await response.json();
    console.log('Upload réussi:', result);
  } catch (error) {
    console.error('Erreur upload:', error);
  }
};
```

## 🛠️ Développement

### Scripts disponibles
- `npm start` : Démarre le serveur
- `npm run dev` : Démarre avec nodemon (rechargement automatique)
- `npm run init-db` : Initialise la base de données

### Logs
Le serveur affiche des logs détaillés pour :
- Connexions à la base de données
- Uploads de fichiers
- Erreurs et exceptions
- Statistiques d'utilisation