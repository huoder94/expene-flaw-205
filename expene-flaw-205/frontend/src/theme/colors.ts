import { StyleSheet } from 'react-native';

export const colors = {
  background: '#0B0F19',
  card: '#131C31',
  cardAlt: '#1B2A4A',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  border: '#22304D',
  primary: '#6366F1',
  primaryLight: 'rgba(99, 102, 241, 0.15)',
  receita: '#10B981',
  receitaBg: 'rgba(16, 185, 129, 0.15)',
  despesa: '#EF4444',
  despesaBg: 'rgba(239, 68, 68, 0.15)',
  poupanca: '#F59E0B',
  poupancaBg: 'rgba(245, 158, 11, 0.15)',
  accent: '#8B5CF6'
};

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  shadowCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  }
});
