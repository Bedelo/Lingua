import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const ADRESSE_LOCAL = process.env.EXPO_PUBLIC_ADRESSE_LOCAL || 'localhost';
const PORT = process.env.EXPO_PUBLIC_PORT || '3000';
// const BASE_URL = process.env.NGROK_URL;
const BASE_URL = `http://${ADRESSE_LOCAL}:${PORT}`;

interface AudioRecording {
  id: string;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  upload_date: string;
  created_at: string;
  updated_at: string;
}

export default function AudioScreen() {
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecordings = async () => {
    try {
      console.log('🔄 Chargement des enregistrements...');
      const response = await fetch(`${BASE_URL}/api/audio`, {
        headers: {
          'ngrok-skip-browser-warning': 'true' 
        },
      });
      const result = await response.json();
      
      if (result.success) {
        setRecordings(result.data);
        console.log(`✅ ${result.data.length} enregistrement(s) chargé(s)`);
      } else {
        throw new Error(result.error || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement:', error);
      Alert.alert('Erreur', 'Impossible de charger les enregistrements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecordings();
  };

  const deleteRecording = async (id: string, filename: string) => {
    Alert.alert(
      'Confirmer la suppression',
      `Êtes-vous sûr de vouloir supprimer l'enregistrement "${filename}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BASE_URL}/api/audio/${id}`, {
                method: 'DELETE',
                headers: {
                  'ngrok-skip-browser-warning': 'true' 
                },
              });
              
              const result = await response.json();
              
              if (result.success) {
                Alert.alert('Succès', 'Enregistrement supprimé');
                fetchRecordings(); // Recharger la liste
              } else {
                throw new Error(result.error || 'Erreur inconnue');
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

  const downloadRecording = async (id: string, filename: string) => {
    try {
      const downloadUrl = `${BASE_URL}/api/audio/${id}/download`;
      console.log('🔗 URL de téléchargement:', downloadUrl);
      Alert.alert(
        'Téléchargement',
        `URL de téléchargement copiée dans la console:\n${downloadUrl}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('❌ Erreur lors du téléchargement:', error);
      Alert.alert('Erreur', 'Impossible de télécharger l\'enregistrement');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>← Retour</ThemedText>
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>Enregistrements Audio</ThemedText>
        <ThemedText style={styles.subtitle}>
          {recordings.length} enregistrement(s) trouvé(s)
        </ThemedText>
      </ThemedView>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <ThemedView style={styles.loadingContainer}>
            <ThemedText>Chargement des enregistrements...</ThemedText>
          </ThemedView>
        ) : recordings.length === 0 ? (
          <ThemedView style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>Aucun enregistrement trouvé</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              Vérifiez que le backend est démarré et que des enregistrements ont été uploadés.
            </ThemedText>
          </ThemedView>
        ) : (
          recordings.map((recording, index) => (
            <ThemedView key={recording.id} style={styles.recordingCard}>
              <ThemedView style={styles.recordingHeader}>
                <ThemedText style={styles.recordingTitle}>
                  📁 {recording.original_name || recording.filename}
                </ThemedText>
                <ThemedText style={styles.recordingIndex}>#{index + 1}</ThemedText>
              </ThemedView>
              
              <ThemedView style={styles.recordingDetails}>
                <ThemedText style={styles.detailText}>
                  🆔 ID: {recording.id.substring(0, 8)}...
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  📏 Taille: {formatFileSize(recording.file_size)}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  🎵 Type: {recording.mime_type}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  📅 Créé: {formatDate(recording.created_at)}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  📤 Uploadé: {formatDate(recording.upload_date)}
                </ThemedText>
              </ThemedView>

              <ThemedView style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.downloadButton]}
                  onPress={() => downloadRecording(recording.id, recording.filename)}
                >
                  <ThemedText style={styles.actionButtonText}>⬇️ Télécharger</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => deleteRecording(recording.id, recording.original_name || recording.filename)}
                >
                  <ThemedText style={styles.actionButtonText}>🗑️ Supprimer</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  recordingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  recordingIndex: {
    fontSize: 14,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recordingDetails: {
    marginBottom: 16,
  },
  detailText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadButton: {
    backgroundColor: '#10B981',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});