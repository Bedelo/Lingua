// Exemple d'intégration pour l'application React Native
// Ce code montre comment modifier index.tsx pour envoyer les fichiers au backend

// 1. Ajouter cette fonction dans le composant HomeScreen
const uploadToBackend = async (audioUri) => {
  try {
    // Créer un FormData pour l'upload
    const formData = new FormData();
    
    // Ajouter le fichier audio
    formData.append('audio', {
      uri: audioUri,
      type: 'audio/m4a',
      name: `recording_${Date.now()}.m4a`
    });

    // Envoyer au backend
    const response = await fetch('http://localhost:3000/api/audio/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Upload réussi:', result.data);
      Alert.alert('Succès', `Fichier uploadé avec l'ID: ${result.data.id}`);
      return result.data;
    } else {
      throw new Error(result.error || 'Erreur inconnue');
    }
  } catch (error) {
    console.error('❌ Erreur upload:', error);
    Alert.alert('Erreur', 'Impossible d\'envoyer le fichier au serveur');
    throw error;
  }
};

// 2. Modifier la fonction stopRecording pour inclure l'upload
const stopRecording = async () => {
  try {
    if (!recordingRef.current) return;

    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    setIsRecording(false);
    
    if (uri) {
      // Sauvegarder localement (code existant)
      const tempDir = FileSystem.documentDirectory + 'temp/rec/';
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `recording_${timestamp}.m4a`;
      const newUri = tempDir + fileName;
      
      await FileSystem.copyAsync({
        from: uri,
        to: newUri
      });
      
      console.log('Enregistrement sauvegardé localement:', newUri);
      
      // NOUVEAU: Envoyer au backend
      try {
        const uploadResult = await uploadToBackend(newUri);
        Alert.alert(
          'Succès complet', 
          `Fichier sauvegardé localement et sur le serveur\nID serveur: ${uploadResult.id}`
        );
      } catch (uploadError) {
        // Si l'upload échoue, on garde quand même le fichier local
        Alert.alert(
          'Sauvegarde partielle', 
          `Fichier sauvegardé localement mais pas sur le serveur\nFichier: ${fileName}`
        );
      }
    }
    
    recordingRef.current = null;
  } catch (error) {
    console.error('Erreur lors de l\'arrêt de l\'enregistrement:', error);
    Alert.alert('Erreur', 'Impossible d\'arrêter l\'enregistrement');
  }
};

// 3. Fonction pour récupérer tous les enregistrements du serveur
const fetchServerRecordings = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/audio');
    const result = await response.json();
    
    if (result.success) {
      console.log('📊 Enregistrements sur le serveur:', result.data);
      return result.data;
    } else {
      throw new Error(result.error || 'Erreur inconnue');
    }
  } catch (error) {
    console.error('❌ Erreur récupération:', error);
    Alert.alert('Erreur', 'Impossible de récupérer les enregistrements du serveur');
    return [];
  }
};

// 4. Fonction pour supprimer un enregistrement du serveur
const deleteServerRecording = async (recordingId) => {
  try {
    const response = await fetch(`http://localhost:3000/api/audio/${recordingId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('🗑️ Enregistrement supprimé:', recordingId);
      Alert.alert('Succès', 'Enregistrement supprimé du serveur');
      return true;
    } else {
      throw new Error(result.error || 'Erreur inconnue');
    }
  } catch (error) {
    console.error('❌ Erreur suppression:', error);
    Alert.alert('Erreur', 'Impossible de supprimer l\'enregistrement du serveur');
    return false;
  }
};

// 5. Fonction pour télécharger un enregistrement depuis le serveur
const downloadServerRecording = async (recordingId) => {
  try {
    const downloadUrl = `http://localhost:3000/api/audio/${recordingId}/download`;
    console.log('🔗 URL de téléchargement:', downloadUrl);
    
    // Pour React Native, vous pourriez utiliser react-native-fs ou expo-file-system
    // pour télécharger le fichier
    
    return downloadUrl;
  } catch (error) {
    console.error('❌ Erreur téléchargement:', error);
    Alert.alert('Erreur', 'Impossible de télécharger l\'enregistrement');
    return null;
  }
};

// NOTES D'IMPLÉMENTATION:
// 
// 1. Assurez-vous que le serveur backend est démarré (npm run dev)
// 2. Remplacez 'localhost' par l'IP de votre machine si vous testez sur un appareil physique
// 3. Ajoutez les permissions réseau dans app.json si nécessaire
// 4. Considérez l'ajout d'un indicateur de chargement pendant l'upload
// 5. Implémentez une logique de retry en cas d'échec réseau
// 6. Ajoutez une interface pour visualiser/gérer les enregistrements du serveur

export {
  uploadToBackend,
  fetchServerRecordings,
  deleteServerRecording,
  downloadServerRecording
};