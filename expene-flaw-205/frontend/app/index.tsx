import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { colors, globalStyles } from '../src/theme/colors';
import { YEARS, MONTH_NAMES, parseMonthKey, getMonthName, getMonthsForYear } from '../src/mock';
import { useAuth } from '../src/contexts/AuthContext';
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransactionApi,
  getHeaderTitle as apiGetHeaderTitle,
  setHeaderTitleApi,
  getSavingsConfig,
  setSavingsConfig,
  ApiTransaction,
} from '../src/api/client';

type Transaction = ApiTransaction;

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { user, loading: authLoading, logout } = useAuth();

  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'receita' | 'despesa' | 'poupanca'>('todos');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingTx, setSavingTx] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      setDataLoading(true);
      setDataError(null);
      try {
        const [txs, headerResp, savings] = await Promise.all([
          listTransactions(),
          apiGetHeaderTitle().catch(() => ({ title: 'Despesas Mensais' })),
          getSavingsConfig().catch(() => ({ goal: 1_000_000, initial: 280_277 })),
        ]);
        if (!mounted) return;
        setTransactions(txs);
        setHeaderTitle(headerResp.title || 'Despesas Mensais');
        setTempHeaderTitle(headerResp.title || 'Despesas Mensais');
        setSavingsGoalState(savings.goal);
        setInitialSavingsState(savings.initial);
      } catch (e: any) {
        if (mounted) setDataError('Não foi possível carregar seus dados. Verifique sua conexão.');
      } finally {
        if (mounted) setDataLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'despesa' | 'receita' | 'poupanca'>('despesa');
  const [category, setCategory] = useState('Alimentação');
  const [notes, setNotes] = useState('');

  const typeOrder = { receita: 1, poupanca: 2, despesa: 3 };
  const monthTransactions = transactions.filter(t => {
    const matchesMonth = t.monthKey === selectedMonth;
    const matchesType = filterType === 'todos' ? true : t.type === filterType;
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMonth && matchesType && matchesSearch;
  }).sort((a, b) => {
    const priorityA = typeOrder[a.type] || 3;
    const priorityB = typeOrder[b.type] || 3;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return b.date.localeCompare(a.date);
  });

  const totalReceitas = transactions
    .filter(t => t.monthKey === selectedMonth && t.type === 'receita')
    .reduce((acc, curr) => acc + curr.amount, 0);
  const totalDespesas = transactions
    .filter(t => t.monthKey === selectedMonth && t.type === 'despesa')
    .reduce((acc, curr) => acc + curr.amount, 0);
  const totalPoupanca = transactions
    .filter(t => t.monthKey === selectedMonth && t.type === 'poupanca')
    .reduce((acc, curr) => acc + curr.amount, 0);
  const saldoAtual = totalReceitas - totalDespesas - totalPoupanca;

  const currentMonthObj = { key: selectedMonth, name: getMonthName(selectedMonth) };
  const initialYear = parseMonthKey(selectedMonth).year;
  const [pickerYear, setPickerYear] = useState<number>(initialYear);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isEditingHeaderTitle, setIsEditingHeaderTitle] = useState(false);
  const [headerTitle, setHeaderTitle] = useState('Despesas Mensais');
  const [tempHeaderTitle, setTempHeaderTitle] = useState('Despesas Mensais');
  const [autoTransferModalVisible, setAutoTransferModalVisible] = useState(false);
  const [transferredAmount, setTransferredAmount] = useState(0);
  const [showMonthlyComparison, setShowMonthlyComparison] = useState(false);
  const [isProfileMenuVisible, setIsProfileMenuVisible] = useState(false);

  const [savingsGoal, setSavingsGoalState] = useState<number>(1_000_000);
  const [initialSavings, setInitialSavingsState] = useState<number>(280_277);
  const [isEditSavingsVisible, setIsEditSavingsVisible] = useState(false);
  const [tempGoal, setTempGoal] = useState('');
  const [tempInitial, setTempInitial] = useState('');
  const [savingsBusy, setSavingsBusy] = useState(false);

  const comparisonMonths = React.useMemo(() => {
    const { year, month } = parseMonthKey(selectedMonth);
    const list: { key: string; name: string; short: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      while (m <= 0) { m += 12; y -= 1; }
      const monthName = MONTH_NAMES[m - 1];
      list.push({
        key: `${y}-${String(m).padStart(2, '0')}`,
        name: `${monthName} ${y}`,
        short: `${monthName.slice(0, 3)}/${String(y).slice(-2)}`,
      });
    }
    return list;
  }, [selectedMonth]);

  const monthlyStats = comparisonMonths.map((m) => {
    const receitas = transactions.filter(t => t.monthKey === m.key && t.type === 'receita').reduce((a, c) => a + c.amount, 0);
    const despesas = transactions.filter(t => t.monthKey === m.key && t.type === 'despesa').reduce((a, c) => a + c.amount, 0);
    const poupanca = transactions.filter(t => t.monthKey === m.key && t.type === 'poupanca').reduce((a, c) => a + c.amount, 0);
    return { ...m, receitas, despesas, poupanca };
  });

  const maxValueInComparison = Math.max(
    1,
    ...monthlyStats.flatMap(s => [s.receitas, s.despesas, s.poupanca])
  );

  const bestPoupancaMonthKey = monthlyStats.reduce(
    (best, curr) => (curr.poupanca > (best?.poupanca ?? -1) ? curr : best),
    monthlyStats[0]
  )?.key;

  const totalPoupancaTransactions = transactions
    .filter(t => t.type === 'poupanca')
    .reduce((acc, curr) => acc + curr.amount, 0);
  const savingsAccumulated = initialSavings + totalPoupancaTransactions;
  const savingsProgressRatio = savingsGoal > 0
    ? Math.max(0, Math.min(1, savingsAccumulated / savingsGoal))
    : 0;
  const savingsProgressPct = (savingsProgressRatio * 100);
  const savingsRemaining = Math.max(0, savingsGoal - savingsAccumulated);

  const openEditSavings = () => {
    setTempGoal(String(savingsGoal));
    setTempInitial(String(initialSavings));
    setIsEditSavingsVisible(true);
  };

  const handleSaveSavingsConfig = async () => {
    const goalNum = parseFloat((tempGoal || '0').toString().replace(',', '.'));
    const initialNum = parseFloat((tempInitial || '0').toString().replace(',', '.'));
    if (isNaN(goalNum) || isNaN(initialNum) || goalNum < 0 || initialNum < 0) return;
    setSavingsBusy(true);
    try {
      const saved = await setSavingsConfig({ goal: goalNum, initial: initialNum });
      setSavingsGoalState(saved.goal);
      setInitialSavingsState(saved.initial);
      setIsEditSavingsVisible(false);
    } catch (e) {
      // silent
    } finally {
      setSavingsBusy(false);
    }
  };

  const handleAddTransaction = async () => {
    if (savingTx) return;
    if (!title.trim() || !amount.trim()) return;
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount)) return;

    let iconName = 'cart';
    if (type === 'receita') iconName = 'cash';
    if (type === 'poupanca') iconName = 'shield-checkmark';
    if (type === 'despesa') {
      if (category === 'Alimentação') iconName = 'fast-food';
      else if (category === 'Moradia') iconName = 'home';
      else if (category === 'Lazer') iconName = 'game-controller';
      else iconName = 'card';
    }

    setSavingTx(true);
    try {
      if (editingId) {
        const updated = await updateTransaction(editingId, {
          title: title.trim(), amount: numAmount, type,
          category: category.trim() || 'Geral',
          date: new Date().toISOString().split('T')[0],
          monthKey: selectedMonth, icon: iconName, notes: notes.trim(),
        });
        setTransactions(prev => prev.map(t => t.id === editingId ? updated : t));
        setEditingId(null);
      } else {
        const newTxPayload = {
          title: title.trim(), amount: numAmount, type,
          category: category.trim() || 'Geral',
          date: new Date().toISOString().split('T')[0],
          monthKey: selectedMonth, icon: iconName, notes: notes.trim(),
        };
        const created = await createTransaction(newTxPayload);
        let nextList = [created, ...transactions];

        if (type === 'receita' && numAmount >= 75335) {
          const prevReceitas = transactions.filter(t => t.monthKey === selectedMonth && t.type === 'receita').reduce((a, c) => a + c.amount, 0);
          const prevDespesas = transactions.filter(t => t.monthKey === selectedMonth && t.type === 'despesa').reduce((a, c) => a + c.amount, 0);
          const prevPoupanca = transactions.filter(t => t.monthKey === selectedMonth && t.type === 'poupanca').reduce((a, c) => a + c.amount, 0);
          const sobra = prevReceitas - prevDespesas - prevPoupanca;
          if (sobra > 0) {
            const autoTx = await createTransaction({
              title: 'Transferência Automática para Poupança',
              amount: sobra, type: 'poupanca', category: 'Reserva',
              date: new Date().toISOString().split('T')[0],
              monthKey: selectedMonth, icon: 'shield-checkmark',
              notes: `Sobra de ${sobra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} CVE transferida automaticamente (Receita >= 75335 CVE)`,
            });
            nextList = [created, autoTx, ...transactions];
            setTransferredAmount(sobra);
            setAutoTransferModalVisible(true);
          }
        }
        setTransactions(nextList);
      }

      setTitle(''); setAmount(''); setNotes(''); setCategory('Alimentação');
      setIsAddModalVisible(false);
    } catch (e: any) {
      setDataError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSavingTx(false);
    }
  };

  const handleEditTransaction = (item: Transaction) => {
    setEditingId(item.id);
    setTitle(item.title); setAmount(item.amount.toString());
    setType(item.type); setCategory(item.category);
    setNotes(item.notes || '');
    setIsAddModalVisible(true);
  };

  const confirmDeleteTransaction = async (id: string) => {
    try {
      await deleteTransactionApi(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      setDataError('Não foi possível apagar. Tente novamente.');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try { await logout(); } finally { setLogoutBusy(false); }
  };

  if (authLoading) {
    return (
      <View style={[globalStyles.container, styles.centerFill]} testID="auth-loading">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;

  return (
    <View style={globalStyles.container} testID="finances-app-container">
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {dataLoading && (
        <View style={styles.dataLoadingOverlay} testID="data-loading-overlay">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.dataLoadingText}>Carregando suas finanças...</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeftContainer}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.greeting}>{headerTitle}</Text>
            <Pressable
              onPress={() => { setTempHeaderTitle(headerTitle); setIsEditingHeaderTitle(true); }}
              style={styles.headerEditBtnVisible}
              testID="edit-header-title-btn"
            >
              <Ionicons name="pencil" size={12} color="#FFFFFF" />
              <Text style={styles.headerEditBtnText}>Editar Título</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.monthSelectorBtn}
            onPress={() => {
              setPickerYear(parseMonthKey(selectedMonth).year);
              setIsMonthPickerVisible(true);
            }}
            testID="month-selector-btn"
          >
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={styles.monthSelectorText}>{currentMonthObj.name}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Pressable
          style={styles.profileAvatar}
          onPress={() => setIsProfileMenuVisible(true)}
          testID="profile-menu-btn"
        >
          <Ionicons name="person" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Collapsible Monthly Comparison */}
        <Pressable
          style={styles.comparisonToggle}
          onPress={() => setShowMonthlyComparison(!showMonthlyComparison)}
          testID="toggle-monthly-comparison-btn"
        >
          <View style={styles.comparisonToggleLeft}>
            <View style={styles.comparisonToggleIcon}>
              <Ionicons name="bar-chart" size={16} color={colors.primary} />
            </View>
            <Text style={styles.comparisonToggleText}>
              {showMonthlyComparison ? 'Ocultar Resumo Mensal' : 'Ver Resumo Mensal'}
            </Text>
          </View>
          <Ionicons name={showMonthlyComparison ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textPrimary} />
        </Pressable>

        {showMonthlyComparison && (
          <View style={styles.comparisonCard} testID="monthly-comparison-card">
            <View style={styles.comparisonHeader}>
              <Text style={styles.comparisonTitle}>Comparação dos Últimos 6 Meses</Text>
              <Text style={styles.comparisonSub}>Receitas, Despesas e Poupança lado a lado</Text>
            </View>

            <View style={styles.comparisonLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.receita }]} />
                <Text style={styles.legendText}>Receitas</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.despesa }]} />
                <Text style={styles.legendText}>Despesas</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.poupanca }]} />
                <Text style={styles.legendText}>Poupança</Text>
              </View>
            </View>

            {monthlyStats.map((m) => {
              const isBest = m.key === bestPoupancaMonthKey && m.poupanca > 0;
              const isCurrent = m.key === selectedMonth;
              return (
                <View key={m.key} style={[styles.monthRow, isCurrent && styles.monthRowCurrent]} testID={`comparison-row-${m.key}`}>
                  <View style={styles.monthRowHeader}>
                    <View style={styles.monthRowLabelWrap}>
                      <Text style={[styles.monthRowLabel, isCurrent && { color: colors.primary, fontWeight: '700' }]}>
                        {m.name}
                      </Text>
                      {isBest && (
                        <View style={styles.bestBadge} testID={`best-savings-badge-${m.key}`}>
                          <Ionicons name="trophy" size={10} color="#FFFFFF" />
                          <Text style={styles.bestBadgeText}>Melhor Poupança</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.barGroup}>
                    <View style={styles.barLine}>
                      <View style={[styles.bar, { backgroundColor: colors.receita, width: `${(m.receitas / maxValueInComparison) * 100}%` }]} />
                      <Text style={[styles.barValue, { color: colors.receita }]}>
                        {m.receitas.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CVE
                      </Text>
                    </View>
                    <View style={styles.barLine}>
                      <View style={[styles.bar, { backgroundColor: colors.despesa, width: `${(m.despesas / maxValueInComparison) * 100}%` }]} />
                      <Text style={[styles.barValue, { color: colors.despesa }]}>
                        {m.despesas.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CVE
                      </Text>
                    </View>
                    <View style={styles.barLine}>
                      <View style={[styles.bar, { backgroundColor: colors.poupanca, width: `${(m.poupanca / maxValueInComparison) * 100}%` }]} />
                      <Text style={[styles.barValue, { color: colors.poupanca }]}>
                        {m.poupanca.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CVE
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Savings Goal Card */}
        <Pressable
          style={styles.savingsGoalCard}
          onPress={openEditSavings}
          testID="savings-goal-card"
        >
          <View style={styles.savingsGoalHeader}>
            <View style={styles.savingsGoalTitleRow}>
              <View style={styles.savingsGoalIconBox}>
                <Ionicons name="trophy" size={16} color={colors.poupanca} />
              </View>
              <Text style={styles.savingsGoalTitle}>Meta de Poupança</Text>
            </View>
            <View style={styles.savingsGoalEditHint}>
              <Ionicons name="pencil" size={11} color={colors.textSecondary} />
              <Text style={styles.savingsGoalEditHintText}>Editar</Text>
            </View>
          </View>

          <View style={styles.savingsGoalAmountRow}>
            <Text style={styles.savingsGoalCurrent} testID="savings-current-amount">
              {savingsAccumulated.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CVE
            </Text>
            <Text style={styles.savingsGoalTarget}>
              / {savingsGoal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} CVE
            </Text>
          </View>

          <View style={styles.savingsProgressTrack}>
            <View
              style={[styles.savingsProgressFill, { width: `${savingsProgressPct}%` }]}
              testID="savings-progress-fill"
            />
          </View>

          <View style={styles.savingsGoalFooter}>
            <Text style={styles.savingsGoalPercent} testID="savings-progress-pct">
              {savingsProgressPct.toFixed(2)}% concluído
            </Text>
            <Text style={styles.savingsGoalRemaining}>
              Faltam {savingsRemaining.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} CVE
            </Text>
          </View>

          <Text style={styles.savingsGoalHint} numberOfLines={2}>
            Saldo Inicial + todas as suas poupanças acumuladas em todos os meses. Registe uma poupança com valor negativo para representar um resgate.
          </Text>
        </Pressable>

        {/* Main Balance Card */}
        <LinearGradient
          colors={['#4F46E5', '#3B82F6', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mainBalanceCard}
        >
          <View style={styles.mainBalanceHeader}>
            <Text style={styles.mainBalanceLabel}>Saldo Atual Disponível</Text>
            <Ionicons name="wallet" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.mainBalanceAmount} testID="saldo-atual-amount">
            {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CVE
          </Text>
          <Text style={styles.mainBalanceSub}>
            Atualizado para {currentMonthObj.name}
          </Text>
        </LinearGradient>

        {/* 3 Summary Cards Grid */}
        <View style={styles.summaryGridContainer}>
          <View style={[styles.summaryCard, { borderColor: 'rgba(16, 185, 129, 0.3)' }]} testID="summary-receitas-card">
            <View style={[styles.summaryIconContainer, { backgroundColor: colors.receitaBg }]}>
              <Ionicons name="arrow-down-circle" size={18} color={colors.receita} />
            </View>
            <Text style={styles.summaryCardTitle}>Receitas</Text>
            <Text style={[styles.summaryCardValue, { color: colors.receita }]} testID="total-receitas-value">
              {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} $
            </Text>
          </View>

          <View style={[styles.summaryCard, { borderColor: 'rgba(245, 158, 11, 0.3)' }]} testID="summary-poupanca-card">
            <View style={[styles.summaryIconContainer, { backgroundColor: colors.poupancaBg }]}>
              <Ionicons name="shield-checkmark" size={18} color={colors.poupanca} />
            </View>
            <Text style={styles.summaryCardTitle}>Poupança</Text>
            <Text style={[styles.summaryCardValue, { color: colors.poupanca }]} testID="total-poupanca-value">
              {totalPoupanca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} $
            </Text>
          </View>

          <View style={[styles.summaryCard, { borderColor: 'rgba(239, 68, 68, 0.3)' }]} testID="summary-despesas-card">
            <View style={[styles.summaryIconContainer, { backgroundColor: colors.despesaBg }]}>
              <Ionicons name="arrow-up-circle" size={18} color={colors.despesa} />
            </View>
            <Text style={styles.summaryCardTitle}>Despesas</Text>
            <Text style={[styles.summaryCardValue, { color: colors.despesa }]} testID="total-despesas-value">
              {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} $
            </Text>
          </View>
        </View>

        {/* Filter Chips & Search Bar */}
        <View style={styles.filterSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar transações..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              testID="search-transactions-input"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} testID="clear-search-btn">
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
          >
            {(['todos', 'receita', 'despesa', 'poupanca'] as const).map((typeItem) => {
              const active = filterType === typeItem;
              const labelMap = {
                todos: 'Todos', receita: 'Receitas',
                despesa: 'Despesas', poupanca: 'Poupanças',
              };
              return (
                <Pressable
                  key={typeItem}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setFilterType(typeItem)}
                  testID={`filter-chip-${typeItem}`}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {labelMap[typeItem]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Transaction History Section */}
        <View style={styles.historySection} testID="transaction-history-section">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Histórico de Transações</Text>
            <Text style={styles.transactionCount}>{monthTransactions.length} itens</Text>
          </View>

          {monthTransactions.length === 0 ? (
            <View style={styles.emptyContainer} testID="empty-transactions-view">
              <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>Nenhum registro encontrado</Text>
              <Text style={styles.emptySubtitle}>Adicione receitas, despesas ou poupanças para este mês.</Text>
            </View>
          ) : (
            monthTransactions.map((item) => {
              const isReceita = item.type === 'receita';
              const isPoupanca = item.type === 'poupanca';
              const amountColor = isReceita ? colors.receita : isPoupanca ? colors.poupanca : colors.despesa;
              const sign = isReceita ? '+ ' : isPoupanca ? '' : '- ';

              return (
                <View key={item.id} style={styles.transactionCard} testID={`transaction-item-${item.id}`}>
                  <View style={[styles.txIconBox, {
                    backgroundColor: isReceita ? colors.receitaBg : isPoupanca ? colors.poupancaBg : colors.despesaBg
                  }]}>
                    <Ionicons name={(item.icon as any) || 'cart'} size={18} color={amountColor} />
                  </View>

                  <View style={styles.txDetails}>
                    <Text style={styles.txTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.txSubRow}>
                      <Text style={styles.txCategory}>{item.category}</Text>
                      <Text style={styles.txDot}>•</Text>
                      <Text style={styles.txDate}>{item.date}</Text>
                    </View>
                    {item.notes ? <Text style={styles.txNotes}>{item.notes}</Text> : null}
                  </View>

                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, { color: amountColor }]} testID={`tx-amount-${item.id}`}>
                      {sign}{item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} CVE
                    </Text>
                    <View style={styles.txActionsRow}>
                      <Pressable onPress={() => handleEditTransaction(item)} style={styles.actionBtnEdit} testID={`edit-tx-${item.id}`}>
                        <Ionicons name="pencil-outline" size={13} color="#FFFFFF" />
                        <Text style={styles.actionBtnEditText}>Editar</Text>
                      </Pressable>
                      <Pressable onPress={() => setDeleteConfirmId(item.id)} style={styles.actionBtnDelete} testID={`delete-tx-${item.id}`}>
                        <Ionicons name="trash-outline" size={13} color="#FFFFFF" />
                        <Text style={styles.actionBtnDeleteText}>Apagar</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        style={styles.fab}
        onPress={() => setIsAddModalVisible(true)}
        testID="open-add-transaction-btn"
      >
        <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.fabGradient}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      {/* Add Transaction Modal */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent} testID="add-transaction-modal">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? 'Editar Registro' : 'Novo Registro Financeiro'}
              </Text>
              <Pressable onPress={() => { setIsAddModalVisible(false); setEditingId(null); }} testID="close-modal-btn">
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.inputLabel}>O que é este registro?</Text>

              <View style={styles.typeSelectorRow}>
                <Pressable
                  style={[styles.typeBtn, type === 'despesa' && { backgroundColor: colors.despesaBg, borderColor: colors.despesa }]}
                  onPress={() => { setType('despesa'); setCategory('Alimentação'); }}
                  testID="type-despesa-btn"
                >
                  <Ionicons name="arrow-up-circle" size={16} color={type === 'despesa' ? colors.despesa : colors.textSecondary} />
                  <Text style={[styles.typeBtnText, type === 'despesa' && { color: colors.despesa }]}>Despesa</Text>
                </Pressable>

                <Pressable
                  style={[styles.typeBtn, type === 'receita' && { backgroundColor: colors.receitaBg, borderColor: colors.receita }]}
                  onPress={() => { setType('receita'); setCategory('Trabalho'); }}
                  testID="type-receita-btn"
                >
                  <Ionicons name="arrow-down-circle" size={16} color={type === 'receita' ? colors.receita : colors.textSecondary} />
                  <Text style={[styles.typeBtnText, type === 'receita' && { color: colors.receita }]}>Receita</Text>
                </Pressable>

                <Pressable
                  style={[styles.typeBtn, type === 'poupanca' && { backgroundColor: colors.poupancaBg, borderColor: colors.poupanca }]}
                  onPress={() => { setType('poupanca'); setCategory('Investimentos'); }}
                  testID="type-poupanca-btn"
                >
                  <Ionicons name="shield-checkmark" size={16} color={type === 'poupanca' ? colors.poupanca : colors.textSecondary} />
                  <Text style={[styles.typeBtnText, type === 'poupanca' && { color: colors.poupanca }]}>Poupança</Text>
                </Pressable>
              </View>

              <Text style={styles.inputLabel}>Título / Descrição</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: Supermercado, Salário, Investimento..."
                placeholderTextColor={colors.textSecondary}
                value={title} onChangeText={setTitle}
                testID="tx-title-input"
              />

              <Text style={styles.inputLabel}>Valor (CVE)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="0,00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={amount} onChangeText={setAmount}
                testID="tx-amount-input"
              />

              <Text style={styles.inputLabel}>Descrição / Notas (com quebras de linha se necessário)</Text>
              <TextInput
                style={[styles.textInput, { height: 72, textAlignVertical: 'top', paddingTop: 12 }]}
                placeholder="Adicione detalhes..."
                placeholderTextColor={colors.textSecondary}
                multiline={true}
                value={notes} onChangeText={setNotes}
                testID="tx-notes-input"
              />

              <Text style={styles.inputLabel}>Categoria (Opcional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Nenhuma', val: '' },
                  ...(type === 'receita' ? ['Trabalho', 'Extra', 'Investimentos', 'Outros'] :
                     type === 'poupanca' ? ['Investimentos', 'Metas', 'Reserva', 'Outros'] :
                     ['Alimentação', 'Moradia', 'Lazer', 'Transporte', 'Saúde', 'Outros']).map(c => ({ label: c, val: c }))
                ].map((item) => {
                  const isSelected = category === item.val || (item.val === '' && !category);
                  return (
                    <Pressable
                      key={item.label}
                      style={[styles.catChip, isSelected && styles.catChipActive]}
                      onPress={() => setCategory(item.val)}
                      testID={`category-chip-${item.label}`}
                    >
                      <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.inputLabel}>Mês de Referência</Text>
              <View style={styles.monthBadge}>
                <Ionicons name="calendar" size={14} color={colors.primary} />
                <Text style={styles.monthBadgeText}>{currentMonthObj.name}</Text>
              </View>

              <Pressable
                style={[styles.submitBtn, savingTx && { opacity: 0.6 }]}
                onPress={handleAddTransaction}
                disabled={savingTx}
                testID="submit-transaction-btn"
              >
                {savingTx ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>{editingId ? 'Atualizar Registro' : 'Salvar Registro'}</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Savings Goal Modal */}
      <Modal
        visible={isEditSavingsVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsEditSavingsVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsEditSavingsVisible(false)}>
          <Pressable style={styles.confirmModalContent} onPress={(e) => e.stopPropagation()} testID="edit-savings-modal">
            <View style={[styles.confirmIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
              <Ionicons name="trophy" size={28} color={colors.poupanca} />
            </View>
            <Text style={styles.confirmTitleWhite}>Configurar Meta de Poupança</Text>
            <Text style={styles.confirmSubWhite}>
              Defina o valor da meta total e o saldo inicial já poupado.
            </Text>

            <Text style={[styles.inputLabel, { alignSelf: 'flex-start', color: 'rgba(255,255,255,0.7)' }]}>
              Meta Total (CVE)
            </Text>
            <TextInput
              style={[styles.textInput, { width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }]}
              keyboardType="numeric"
              value={tempGoal} onChangeText={setTempGoal}
              placeholder="1000000"
              placeholderTextColor="rgba(255,255,255,0.35)"
              testID="edit-savings-goal-input"
            />

            <Text style={[styles.inputLabel, { alignSelf: 'flex-start', color: 'rgba(255,255,255,0.7)' }]}>
              Saldo Inicial (CVE)
            </Text>
            <TextInput
              style={[styles.textInput, { width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }]}
              keyboardType="numeric"
              value={tempInitial} onChangeText={setTempInitial}
              placeholder="280277"
              placeholderTextColor="rgba(255,255,255,0.35)"
              testID="edit-savings-initial-input"
            />

            <View style={styles.confirmBtnsRow}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setIsEditSavingsVisible(false)} testID="cancel-savings-edit-btn">
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmSubmitBtn, savingsBusy && { opacity: 0.6 }]}
                onPress={handleSaveSavingsConfig}
                disabled={savingsBusy}
                testID="save-savings-config-btn"
              >
                {savingsBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmDeleteText}>Salvar</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Profile / Settings Popup Menu */}
      <Modal
        visible={isProfileMenuVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsProfileMenuVisible(false)}
      >
        <Pressable style={styles.profileMenuOverlay} onPress={() => setIsProfileMenuVisible(false)}>
          <Pressable style={styles.profileMenuCard} onPress={(e) => e.stopPropagation()} testID="profile-menu-modal">
            <View style={styles.profileMenuHeader}>
              <View style={styles.profileMenuAvatar}>
                <Ionicons name="person" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileMenuName} numberOfLines={1} testID="profile-menu-name">
                  {user?.name || 'Utilizador'}
                </Text>
                <Text style={styles.profileMenuEmail} numberOfLines={1} testID="profile-menu-email">
                  {user?.email || ''}
                </Text>
              </View>
            </View>

            <View style={styles.profileMenuDivider} />

            <Pressable
              style={styles.profileMenuItem}
              onPress={async () => { setIsProfileMenuVisible(false); await handleLogout(); }}
              disabled={logoutBusy}
              testID="menu-logout-btn"
            >
              <View style={[styles.profileMenuIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                {logoutBusy ? <ActivityIndicator size="small" color={colors.despesa} /> : <Ionicons name="log-out-outline" size={16} color={colors.despesa} />}
              </View>
              <Text style={[styles.profileMenuItemText, { color: colors.despesa }]}>Sair da conta</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Auto Transfer Success Modal */}
      <Modal
        visible={autoTransferModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAutoTransferModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAutoTransferModalVisible(false)}>
          <View style={styles.confirmModalContent} testID="auto-transfer-modal">
            <View style={[styles.confirmIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
              <Ionicons name="checkmark-done-circle" size={32} color={colors.receita} />
            </View>
            <Text style={styles.confirmTitleWhite}>Transferência Automática Realizada!</Text>
            <Text style={styles.confirmSubWhite}>
              Como registou uma receita igual ou superior a 75.335 CVE, a sobra de {transferredAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} CVE foi transferida e registada automaticamente na Poupança, limpando o saldo principal para o novo ciclo!
            </Text>

            <Pressable style={styles.confirmSubmitBtn} onPress={() => setAutoTransferModalVisible(false)} testID="close-auto-transfer-btn">
              <Text style={styles.confirmDeleteText}>Entendido</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmId !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteConfirmId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDeleteConfirmId(null)}>
          <View style={styles.confirmModalContent} testID="delete-confirm-modal">
            <View style={styles.confirmIconBox}>
              <Ionicons name="warning" size={28} color={colors.despesa} />
            </View>
            <Text style={styles.confirmTitleWhite}>Apagar Definitivamente?</Text>
            <Text style={styles.confirmSubWhite}>
              Tem certeza absoluta que deseja apagar este registo? Esta ação não pode ser desfeita e removerá o item permanentemente.
            </Text>

            <View style={styles.confirmBtnsRow}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setDeleteConfirmId(null)} testID="cancel-delete-btn">
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </Pressable>

              <Pressable style={styles.confirmDeleteBtn} onPress={() => deleteConfirmId && confirmDeleteTransaction(deleteConfirmId)} testID="confirm-delete-btn">
                <Text style={styles.confirmDeleteText}>Sim, Apagar</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
{/* Edit Header Title Modal */}
      <Modal
        visible={isEditingHeaderTitle}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsEditingHeaderTitle(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsEditingHeaderTitle(false)}>
          <View style={styles.confirmModalContent} testID="edit-header-modal">
            <Text style={styles.confirmTitleWhite}>Editar Título do Topo</Text>
            <Text style={styles.confirmSubWhite}>Digite o novo nome para o cabeçalho do aplicativo:</Text>

            <TextInput
              style={[styles.textInput, { marginTop: 12, marginBottom: 20 }]}
              value={tempHeaderTitle}
              onChangeText={setTempHeaderTitle}
              placeholder="Ex: Despesas Mensais"
              placeholderTextColor={colors.textSecondary}
              testID="header-title-input"
            />

            <View style={styles.confirmBtnsRow}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => setIsEditingHeaderTitle(false)}
              >
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={styles.confirmSubmitBtn}
                onPress={async () => {
                  if (tempHeaderTitle.trim()) {
                    const trimmed = tempHeaderTitle.trim();
                    setHeaderTitle(trimmed);
                    try {
                      await setHeaderTitleApi(trimmed);
                    } catch {}
                  }
                  setIsEditingHeaderTitle(false);
                }}
                testID="save-header-title-btn"
              >
                <Text style={styles.confirmDeleteText}>Salvar</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Month/Year Picker Modal */}
      <Modal
        visible={isMonthPickerVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsMonthPickerVisible(false)}
      >
        <Pressable style={styles.monthModalOverlay} onPress={() => setIsMonthPickerVisible(false)}>
          <Pressable style={styles.monthModalContent} onPress={(e) => e.stopPropagation()} testID="month-picker-modal">
            <Text style={styles.modalTitle}>Selecionar Período</Text>
            <Text style={styles.modalSub}>Escolha o ano e o mês para visualizar suas finanças</Text>

            <Text style={styles.pickerSectionLabel}>Ano</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearChipsContainer}>
              {YEARS.map((y) => {
                const active = pickerYear === y;
                return (
                  <Pressable
                    key={y}
                    onPress={() => setPickerYear(y)}
                    style={[styles.yearChip, active && styles.yearChipActive]}
                    testID={`year-chip-${y}`}
                  >
                    <Text style={[styles.yearChipText, active && styles.yearChipTextActive]}>{y}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.pickerSectionLabel}>Mês</Text>
            <ScrollView
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 8 }}
              style={{ maxHeight: 380 }}
            >
              {getMonthsForYear(pickerYear).map((m) => {
                const isSelected = m.key === selectedMonth;
                return (
                  <Pressable
                    key={m.key}
                    style={[styles.monthOption, isSelected && styles.monthOptionActive]}
                    onPress={() => { setSelectedMonth(m.key); setIsMonthPickerVisible(false); }}
                    testID={`month-option-${m.key}`}
                  >
                    <Ionicons name="calendar-outline" size={18} color={isSelected ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.monthOptionText, isSelected && { color: colors.primary, fontWeight: '600' }]}>
                      {m.name}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    backgroundColor: colors.background,
  },
  greeting: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  monthSelectorBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    marginTop: 4, gap: 6,
  },
  monthSelectorText: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  profileAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  mainBalanceCard: {
    borderRadius: 24, padding: 24, marginBottom: 20,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  mainBalanceHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  mainBalanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  mainBalanceAmount: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  mainBalanceSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  summaryGridContainer: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  summaryCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 16,
    padding: 10, borderWidth: 1,
  },
  summaryIconContainer: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  summaryCardTitle: { fontSize: 11, color: colors.textSecondary, marginBottom: 2, fontWeight: '500' },
  summaryCardValue: { fontSize: 12, fontWeight: '700' },
  txNotes: { fontSize: 11, color: colors.textSecondary, marginTop: 4, lineHeight: 14 },
  filterSection: { marginBottom: 20 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 12,
    paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  chipsContainer: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 16, height: 36, borderRadius: 18,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  historySection: { marginTop: 4 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  transactionCount: { fontSize: 12, color: colors.textSecondary },
  emptyContainer: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderRadius: 16, padding: 32,
    borderWidth: 1, borderColor: colors.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
  transactionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  txIconBox: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  txDetails: { flex: 1, marginRight: 8 },
  txTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  txSubRow: { flexDirection: 'row', alignItems: 'center' },
  txCategory: { fontSize: 12, color: colors.textSecondary },
  txDot: { fontSize: 12, color: colors.textSecondary, marginHorizontal: 6 },
  txDate: { fontSize: 12, color: colors.textSecondary },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  txActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  actionBtnEdit: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4,
  },
  actionBtnEditText: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  actionBtnDelete: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.despesa,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4,
  },
  actionBtnDeleteText: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 60, height: 60, borderRadius: 30,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  fabGradient: {
    width: '100%', height: '100%', borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24,
    borderWidth: 1, borderColor: colors.border, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  typeSelectorRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', height: 44,
    backgroundColor: colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, gap: 6,
  },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  textInput: {
    backgroundColor: colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, height: 48,
    fontSize: 14, color: colors.textPrimary, marginBottom: 16,
  },
  catChip: {
    paddingHorizontal: 14, height: 34, borderRadius: 17,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  catChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  monthBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, marginBottom: 24, gap: 8,
  },
  monthBadgeText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  submitBtn: {
    backgroundColor: colors.primary, height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  modalSub: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  monthModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-start', paddingTop: 80,
  },
  monthModalContent: {
    backgroundColor: colors.card, borderRadius: 20, padding: 20,
    marginHorizontal: 20, borderWidth: 1, borderColor: colors.border,
  },
  monthOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 4, gap: 12,
  },
  monthOptionActive: { backgroundColor: colors.primaryLight },
  monthOptionText: { flex: 1, fontSize: 14, color: colors.textPrimary },
  pickerSectionLabel: {
    fontSize: 12, fontWeight: '600', color: colors.textSecondary,
    marginTop: 8, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  yearChipsContainer: { gap: 8, paddingBottom: 4, paddingRight: 8 },
  yearChip: {
    paddingHorizontal: 14, height: 34, borderRadius: 17,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginBottom: 8,
  },
  yearChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  yearChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  yearChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  comparisonToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  comparisonToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  comparisonToggleIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  comparisonToggleText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  comparisonCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  comparisonHeader: { marginBottom: 12 },
  comparisonTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  comparisonSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  comparisonLegend: {
    flexDirection: 'row', gap: 14, marginBottom: 14, flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  monthRow: {
    paddingVertical: 10, borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  monthRowCurrent: {
    backgroundColor: 'rgba(99, 102, 241, 0.06)',
    borderRadius: 8, paddingHorizontal: 6,
  },
  monthRowHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  monthRowLabelWrap: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, flexWrap: 'wrap', flex: 1,
  },
  monthRowLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  bestBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.poupanca,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  bestBadgeText: { fontSize: 10, color: '#FFFFFF', fontWeight: '700' },
  barGroup: { gap: 6 },
  barLine: {
    flexDirection: 'row', alignItems: 'center', height: 18, gap: 8,
  },
  bar: { height: 8, borderRadius: 4, minWidth: 2 },
  barValue: { fontSize: 11, fontWeight: '600' },
  centerFill: { justifyContent: 'center', alignItems: 'center' },
  dataLoadingOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 999, gap: 12,
  },
  dataLoadingText: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  profileMenuOverlay: {
    flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: 100, paddingHorizontal: 16,
  },
  profileMenuCard: {
    backgroundColor: '#1F2937', borderRadius: 16, padding: 12,
    minWidth: 240, maxWidth: 320,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  profileMenuHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 4, paddingVertical: 6,
  },
  profileMenuAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  profileMenuName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  profileMenuEmail: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  profileMenuDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8,
  },
  profileMenuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 4, paddingVertical: 10, borderRadius: 10,
  },
  profileMenuIconBox: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  profileMenuItemText: { flex: 1, fontSize: 14, fontWeight: '600' },
  savingsGoalCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  savingsGoalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  savingsGoalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  savingsGoalIconBox: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.poupancaBg,
    alignItems: 'center', justifyContent: 'center',
  },
  savingsGoalTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  savingsGoalEditHint: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8,
  },
  savingsGoalEditHintText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  savingsGoalAmountRow: {
    flexDirection: 'row', alignItems: 'baseline',
    flexWrap: 'wrap', marginBottom: 12,
  },
  savingsGoalCurrent: {
    fontSize: 22, fontWeight: '800',
    color: colors.poupanca, marginRight: 6,
  },
  savingsGoalTarget: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  savingsProgressTrack: {
    height: 15, // ≈ 4mm em telas típicas
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden', marginBottom: 10,
  },
  savingsProgressFill: {
    height: '100%', backgroundColor: colors.poupanca, // Amarelo
    borderRadius: 8, minWidth: 2,
  },
  savingsGoalFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  savingsGoalPercent: { fontSize: 13, fontWeight: '700', color: colors.poupanca },
  savingsGoalRemaining: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  savingsGoalHint: { fontSize: 11, color: colors.textSecondary, lineHeight: 15 },
  headerLeftContainer: { flex: 1 },
  headerTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  },
  headerEditBtnVisible: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  headerEditBtnText: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  confirmModalContent: {
    backgroundColor: '#1F2937', borderRadius: 20, padding: 24, marginHorizontal: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  confirmIconBox: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  confirmTitleWhite: {
    fontSize: 18, fontWeight: '700', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 8,
  },
  confirmSubWhite: {
    fontSize: 13, color: 'rgba(255,255,255,0.75)',
    textAlign: 'center', lineHeight: 18, marginBottom: 20,
  },
  confirmBtnsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmCancelBtn: {
    flex: 1, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  confirmCancelText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  confirmDeleteBtn: {
    flex: 1, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.despesa,
  },
  confirmDeleteText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  confirmSubmitBtn: {
    flex: 1, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
