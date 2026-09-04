import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { useAuth } from '@/src/contexts/AuthContext';

export default function LoginScreen() {
  const { signInWithGoogle, loginError, loading } = useAuth();
  const [busy, setBusy] = React.useState(false);

  const handleLogin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signInWithGoogle();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container} testID="login-screen">
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <LinearGradient
        colors={['#4F46E5', '#3B82F6', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroIconRow}>
          <Ionicons name="wallet" size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.heroTitle}>Suas Finanças na Nuvem</Text>
        <Text style={styles.heroSub}>
          Entre com o Google e acesse suas transações em qualquer telemóvel — seus dados ficam sempre seguros.
        </Text>
      </LinearGradient>

      <View style={styles.featuresBox}>
        <FeatureItem icon="cloud-done" text="Backup automático em nuvem" />
        <FeatureItem icon="shield-checkmark" text="Sincronização entre dispositivos" />
        <FeatureItem icon="lock-closed" text="Sessão permanente e segura" />
      </View>

      <Pressable
        style={[styles.googleBtn, busy && { opacity: 0.6 }]}
        onPress={handleLogin}
        disabled={busy || loading}
        testID="google-login-btn"
      >
        {busy || loading ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text style={styles.googleBtnText}>Entrar com Google</Text>
          </>
        )}
      </Pressable>

      {loginError ? (
        <View style={styles.errorBox} testID="login-error">
          <Ionicons name="alert-circle" size={16} color={colors.despesa} />
          <Text style={styles.errorText}>{loginError}</Text>
        </View>
      ) : null}

      <Text style={styles.footer}>
        Ao continuar você concorda com o uso do login gerido pela Emergent.
      </Text>
    </View>
  );
}

const FeatureItem = ({ icon, text }: { icon: any; text: string }) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIconWrap}>
      <Ionicons name={icon} size={16} color={colors.primary} />
    </View>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center' },
  heroCard: { borderRadius: 24, padding: 24, marginBottom: 24 },
  heroIconRow: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  featuresBox: { gap: 12, marginBottom: 32 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 14, color: colors.textPrimary, fontWeight: '500', flex: 1 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, height: 52, gap: 10, marginBottom: 12 },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(239, 68, 68, 0.12)', borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { fontSize: 12, color: colors.despesa, flex: 1 },
  footer: { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
});
