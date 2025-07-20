import { Image } from 'expo-image';
import { StyleSheet, TouchableOpacity, Alert } from 'react-native';
import React, { useState, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import Constants from 'expo-constants';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const ADRESSE_LOCAL = process.env.EXPO_PUBLIC_ADRESSE_LOCAL || 'localhost';
const PORT = process.env.EXPO_PUBLIC_PORT || '3000';
// const BASE_URL = process.env.NGROK_URL ;
const BASE_URL = `http://${ADRESSE_LOCAL}:${PORT}` || 'http://localhost:3000';

export default function HomeScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [savedRecordings, setSavedRecordings] = useState<string[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [lastTap, setLastTap] = useState<{ time: number, filename: string } | null>(null);
  const lastTapRef = useRef<{ time: number, filename: string } | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Test backend connection and load existing recordings on component mount
  useEffect(() => {
    const initializeApp = async () => {
      await testBackendConnection();
      await listSavedRecordings();
    };
    initializeApp();
  }, []);

  const testBackendConnection = async () => {
    try {
      console.log('🔄 Test de connexion au backend...');
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true' 
        },
      });
      console.log("response test: " + response)

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Connexion backend réussie:', result.message);
        console.log('🕐 Timestamp backend:', result.timestamp);
      } else {
        // throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        throw new Error(`Booooo`);
      }
    } catch (error) {
      console.log("baseUrl :" + BASE_URL)
      console.error('❌ Erreur de connexion backend:', error);
      console.log(`⚠️ Le backend n\'est pas accessible. Vérifiez que le serveur est démarré sur ${BASE_URL}`);
    }
  };

  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Permission d\'accès au microphone requise');
        return;
      }

      // Configure audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);

      console.log('🎙️ Enregistrement démarré');

    } catch (error) {
      console.error('❌ Erreur lors du démarrage de l\'enregistrement:', error);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      setIsRecording(false);
      recordingRef.current = null;

      if (uri) {
        await saveRecordingToDirectory(uri);
      }

      console.log('🛑 Enregistrement arrêté. URI:', uri);
      Alert.alert('Succès', 'Enregistrement terminé et sauvegardé!');

    } catch (error) {
      console.error('❌ Erreur lors de l\'arrêt de l\'enregistrement:', error);
      Alert.alert('Erreur', 'Impossible d\'arrêter l\'enregistrement');
    }
  };

  const saveRecordingToDirectory = async (sourceUri: string) => {
    try {
      // Create tmpLinguAudio directory if it doesn't exist
      const tmpLinguAudioDir = `${FileSystem.documentDirectory}tmpLinguAudio/`;
      const dirInfo = await FileSystem.getInfoAsync(tmpLinguAudioDir);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(tmpLinguAudioDir, { intermediates: true });
        console.log('📁 Dossier tmpLinguAudio créé:', tmpLinguAudioDir);
      }

      // Generate unique filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `recording_${timestamp}.m4a`;
      const destinationUri = `${tmpLinguAudioDir}${filename}`;

      // Copy the recording to the tmpLinguAudio directory
      await FileSystem.copyAsync({
        from: sourceUri,
        to: destinationUri
      });

      console.log('💾 Enregistrement sauvegardé:', destinationUri);

      // Verify the file was saved
      const fileInfo = await FileSystem.getInfoAsync(destinationUri);
      if (fileInfo.exists) {
        console.log('✅ Fichier confirmé - Taille:', fileInfo.size, 'bytes');
      }

      // Update the list of saved recordings
      await listSavedRecordings();

    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder l\'enregistrement');
    }
  };

  const listSavedRecordings = async () => {
    try {
      const tmpLinguAudioDir = `${FileSystem.documentDirectory}tmpLinguAudio/`;
      const dirInfo = await FileSystem.getInfoAsync(tmpLinguAudioDir);

      if (dirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(tmpLinguAudioDir);
        setSavedRecordings(files);
        console.log('📂 Enregistrements sauvegardés:', files);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la lecture du dossier:', error);
    }
  };

  const playAudio = async (filename: string) => {
    try {
      // Stop any currently playing audio
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setCurrentlyPlaying(null);
      }

      // If clicking on the same file that's playing, just stop it
      if (currentlyPlaying === filename) {
        return;
      }

      const tmpLinguAudioDir = `${FileSystem.documentDirectory}tmpLinguAudio/`;
      const audioUri = `${tmpLinguAudioDir}${filename}`;

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        Alert.alert('Erreur', 'Fichier audio introuvable');
        return;
      }

      console.log('🎵 Lecture de:', audioUri);

      // Create and load the sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      setSound(newSound);
      setCurrentlyPlaying(filename);

      // Set up playback status update
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setCurrentlyPlaying(null);
          setSound(null);
        }
      });

    } catch (error) {
      console.error('❌ Erreur lors de la lecture:', error);
      Alert.alert('Erreur', 'Impossible de lire le fichier audio');
    }
  };

  const stopAudio = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setCurrentlyPlaying(null);
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'arrêt:', error);
    }
  };

  const deleteRecording = async (filename: string) => {
    Alert.alert(
      'Supprimer l\'enregistrement',
      `Êtes-vous sûr de vouloir supprimer "${filename}" ?\n\nCette action est irréversible.`,
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              // Stop audio if this file is currently playing
              if (currentlyPlaying === filename) {
                await stopAudio();
              }

              const tmpLinguAudioDir = `${FileSystem.documentDirectory}tmpLinguAudio/`;
              const audioUri = `${tmpLinguAudioDir}${filename}`;

              // Check if file exists before trying to delete
              const fileInfo = await FileSystem.getInfoAsync(audioUri);
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(audioUri);
                console.log('🗑️ Fichier supprimé:', audioUri);

                // Update the recordings list
                await listSavedRecordings();

                Alert.alert('Succès', 'Enregistrement supprimé avec succès');
              } else {
                Alert.alert('Erreur', 'Fichier introuvable');
              }
            } catch (error) {
              console.error('❌ Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer l\'enregistrement');
            }
          }
        }
      ]
    );
  };

  const openBackendView = () => {
    router.push('/audio');
  };

  const uploadToBackend = async (filename: string) => {
    try {
      setUploading(filename);

      const tmpLinguAudioDir = `${FileSystem.documentDirectory}tmpLinguAudio/`;
      const audioUri = `${tmpLinguAudioDir}${filename}`;

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        Alert.alert('Erreur', 'Fichier audio introuvable');
        return;
      }

      console.log('📤 Début de l\'upload par chunks:', filename);

      // Create temporary blob file
      const tempBlobDir = `${FileSystem.documentDirectory}tempBlobs/`;
      const tempBlobDirInfo = await FileSystem.getInfoAsync(tempBlobDir);
      if (!tempBlobDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(tempBlobDir, { intermediates: true });
      }

      const tempBlobPath = `${tempBlobDir}${filename}.blob`;

      // Copy audio to temporary blob file
      await FileSystem.copyAsync({
        from: audioUri,
        to: tempBlobPath
      });

      console.log('💾 Fichier blob temporaire créé:', tempBlobPath);

      // Read the blob file as base64
      const audioBase64 = await FileSystem.readAsStringAsync(tempBlobPath, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Generate unique recording ID
      const recordingId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Split into chunks (64KB each)
      const chunkSize = 64 * 1024; // 64KB in bytes
      const base64ChunkSize = Math.floor((chunkSize * 4) / 3); // Base64 is ~4/3 larger
      const totalChunks = Math.ceil(audioBase64.length / base64ChunkSize);

      console.log(`📦 Fichier divisé en ${totalChunks} chunks de ${base64ChunkSize} caractères`);

      // Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * base64ChunkSize;
        const end = Math.min(start + base64ChunkSize, audioBase64.length);
        const chunkData = audioBase64.slice(start, end);

        const chunkResponse = await fetch(`${BASE_URL}/api/audio/upload-chunk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true' 
          },
          body: JSON.stringify({
            recordingId,
            chunkIndex: i,
            chunkData
          })
        });

        const chunkResult = await chunkResponse.json();
        if (!chunkResult.success) {
          throw new Error(`Erreur chunk ${i}: ${chunkResult.error}`);
        }

        console.log(`✅ Chunk ${i + 1}/${totalChunks} uploadé`);
      }

      // Finalize upload
      const finalizeResponse = await fetch(`${BASE_URL}/api/audio/finalize-chunked-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true' 
        },
        body: JSON.stringify({
          recordingId,
          filename,
          originalName: filename,
          mimeType: 'audio/mp4',
          totalSize: fileInfo.size
        })
      });

      const finalizeResult = await finalizeResponse.json();
      if (!finalizeResult.success) {
        throw new Error(`Erreur finalisation: ${finalizeResult.error}`);
      }

      // Clean up temporary blob file
      await FileSystem.deleteAsync(tempBlobPath);
      console.log('🗑️ Fichier blob temporaire supprimé');

      console.log('🎉 Upload terminé avec succès:', finalizeResult.data);
      Alert.alert(
        'Succès',
        `Enregistrement "${filename}" uploadé avec succès vers le backend!\n\nID: ${finalizeResult.data.id}`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('❌ Erreur lors de l\'upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      Alert.alert('Erreur', `Impossible d\'uploader l\'enregistrement:\n${errorMessage}`);
    } finally {
      setUploading(null);
    }
  };

  // Cleanup sound when component unmounts
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handleRecordingPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };





  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Lingua</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <TouchableOpacity
          style={[styles.baseButton, styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={handleRecordingPress}
        >
          <ThemedText style={styles.baseButtonText}>
            {isRecording ? '🛑 Arrêter' : '🎙️ Enregistrer'}
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.baseButton, styles.listButton]}
          onPress={listSavedRecordings}
        >
          <ThemedText style={styles.baseButtonText}>
            📂 Voir les enregistrements ({savedRecordings.length})
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.baseButton, styles.backendButton]}
          onPress={openBackendView}
        >
          <ThemedText style={styles.baseButtonText}>
            🌐 Accéder aux données backend
          </ThemedText>
        </TouchableOpacity>

        {savedRecordings.length > 0 && (
          <ThemedView style={styles.recordingsList}>
            <ThemedText type="subtitle">Enregistrements sauvegardés:</ThemedText>
            {savedRecordings.map((filename, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.recordingItem,
                  currentlyPlaying === filename && styles.recordingItemPlaying,
                  uploading === filename && styles.recordingItemUploading
                ]}
                onPress={() => {
                  const now = Date.now();
                  if (lastTapRef.current && lastTapRef.current.filename === filename && now - lastTapRef.current.time < 300) {
                    // Double tap detected
                    uploadToBackend(filename);
                    lastTapRef.current = null;
                    setLastTap(null);
                  } else {
                    // Single tap
                    const tapInfo = { time: now, filename };
                    lastTapRef.current = tapInfo;
                    setLastTap(tapInfo);
                    setTimeout(() => {
                      if (lastTapRef.current && lastTapRef.current.time === now) {
                        playAudio(filename);
                      }
                    }, 300);
                  }
                }}
                onLongPress={() => deleteRecording(filename)}
                delayLongPress={800}
                disabled={uploading === filename}
              >
                <ThemedText style={[
                  styles.recordingText,
                  currentlyPlaying === filename && styles.recordingTextPlaying,
                  uploading === filename && styles.recordingTextUploading
                ]}>
                  {uploading === filename ? '📤' : currentlyPlaying === filename ? '⏸️' : '▶️'} {filename}
                </ThemedText>
                <ThemedText style={[
                  styles.recordingHint,
                  uploading === filename && styles.recordingHintUploading
                ]}>
                  {uploading === filename ? 'Upload en cours...' : 'Appui long: supprimer • Double-clic: upload'}
                </ThemedText>
                {uploading === filename && (
                  <ThemedText style={styles.uploadingIndicator}>
                    ⏳ Envoi vers le backend...
                  </ThemedText>
                )}
              </TouchableOpacity>
            ))}

            {currentlyPlaying && (
              <TouchableOpacity
                style={styles.stopButton}
                onPress={stopAudio}
              >
                <ThemedText style={styles.stopButtonText}>
                  ⏹️ Arrêter la lecture
                </ThemedText>
              </TouchableOpacity>
            )}
          </ThemedView>
        )}
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  // Style de base uniforme pour tous les boutons
  baseButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    marginTop: 10,
    minWidth: 250,
    alignItems: 'center',
  },
  baseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Bouton d'enregistrement - garde son comportement spécial
  recordButton: {
    backgroundColor: '#007AFF', // Bleu par défaut
    marginTop: 20, // Un peu plus d'espace en haut
  },
  recordButtonActive: {
    backgroundColor: '#FF3B30', // Rouge quand il enregistre
  },
  // Autres boutons - couleur uniforme
  listButton: {
    backgroundColor: '#6C7B7F', // Gris uniforme
  },
  backendButton: {
    backgroundColor: '#6C7B7F', // Gris uniforme
  },
  recordingsList: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
  },
  recordingItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  recordingItemPlaying: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    borderColor: '#34C759',
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  recordingHint: {
    fontSize: 10,
    opacity: 0.6,
    fontStyle: 'italic',
    marginTop: 2,
  },
  recordingHintUploading: {
    color: '#FF9500',
    opacity: 0.8,
  },
  recordingItemUploading: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderColor: '#FF9500',
  },
  recordingTextUploading: {
    color: '#FF9500',
    fontWeight: '600',
  },
  uploadingIndicator: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  recordingTextPlaying: {
    color: '#34C759',
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  stopButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
