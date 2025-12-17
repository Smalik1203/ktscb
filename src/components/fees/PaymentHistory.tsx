import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Platform, Modal, Animated, ScrollView, TextInput, Alert } from 'react-native';
import { Portal, Modal as PaperModal, Button , Searchbar } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { spacing, borderRadius, typography, colors } from '../../../lib/design-system';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors, Shadows } from '../../theme/types';
import { supabase } from '../../lib/supabase';
import { useClassSelection } from '../../contexts/ClassSelectionContext';
import { useAuth } from '../../contexts/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useStudents } from '../../hooks/useStudents';
import { getFeeComponentTypes } from '../../data/queries';
import { Wallet, CreditCard, Landmark, Smartphone, Circle, Search, Filter, Users, Calendar, CheckCircle2, Plus, X, ChevronRight, Info, AlertCircle } from 'lucide-react-native';

type PaymentRecord = {
  id: string;
  student_id: string;
  plan_id: string | null;
  component_type_id: string;
  amount_inr: number;
  payment_date: string; // YYYY-MM-DD
  payment_method: string | null;
  transaction_id: string | null;
  receipt_number: string | null;
  remarks: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string;
  recorded_by_name?: string | null; // Name of user who recorded the payment
  // joined
  student?: { id: string; full_name: string | null; student_code: string | null } | null;
  component?: { id: string; name: string } | null;
  total_fee_inr?: number; // computed from plan items
};

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateDisplay(isoOrYmd: string): string {
  const d = new Date(isoOrYmd);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const base = d.toLocaleDateString('en-GB', opts); // e.g., 30 Oct
  if (d.getFullYear() !== now.getFullYear()) return `${base} ${d.getFullYear()}`;
  return base;
}

export default function PaymentHistory() {
  const { scope, selectedClass, setSelectedClass, classes } = useClassSelection();
  const { profile } = useAuth();
  const { colors, isDark, shadows } = useTheme();
  const queryClient = useQueryClient();
  const schoolCode = scope.school_code;
  
  // Create dynamic styles based on theme
  const styles = useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);

  const [startDate, setStartDate] = useState<Date | null>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showHistoryDatePicker, setShowHistoryDatePicker] = useState<'start' | 'end' | null>(null);
  const [tempPickerDate, setTempPickerDate] = useState<Date | null>(null);
  // Always using range; no toggle UI
  const [activeTab, setActiveTab] = useState<'collected' | 'record'>('collected');
  const [showMethodModal, setShowMethodModal] = useState(false);
  
  // Payment recording form state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [showRecordDatePicker, setShowRecordDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStudentSelector, setShowStudentSelector] = useState(false);
  const [showComponentSelector, setShowComponentSelector] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [componentSearchQuery, setComponentSearchQuery] = useState('');
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<{
    student: any;
    payments: PaymentRecord[];
    totalPaid: number;
  } | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  const { data: studentsResponse } = useStudents(selectedClass?.id, schoolCode || undefined);
  const students = studentsResponse?.data || [];
  
  // Fetch fee components for recording payments
  const { data: feeComponents = [] } = useQuery({
    queryKey: ['feeComponents', schoolCode],
    queryFn: () => getFeeComponentTypes(schoolCode!).then(result => result.data || []),
    enabled: !!schoolCode && activeTab === 'record',
  });

  // Animated sheet (match syllabus modal)
  const classSlideAnim = React.useRef(new Animated.Value(0)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  const methodSlideAnim = React.useRef(new Animated.Value(0)).current;
  const methodOverlayOpacity = React.useRef(new Animated.Value(0)).current;
  const studentSlideAnim = React.useRef(new Animated.Value(0)).current;
  const studentOverlayOpacity = React.useRef(new Animated.Value(0)).current;
  const componentSlideAnim = React.useRef(new Animated.Value(0)).current;
  const componentOverlayOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showClassDropdown) {
      classSlideAnim.setValue(0);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(classSlideAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(classSlideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [showClassDropdown, classSlideAnim, overlayOpacity]);

  useEffect(() => {
    if (showMethodModal) {
      methodSlideAnim.setValue(0);
      methodOverlayOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(methodOverlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(methodSlideAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(methodOverlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(methodSlideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [showMethodModal, methodSlideAnim, methodOverlayOpacity]);

  useEffect(() => {
    if (showStudentSelector) {
      studentSlideAnim.setValue(0);
      studentOverlayOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(studentOverlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(studentSlideAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(studentOverlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(studentSlideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [showStudentSelector, studentSlideAnim, studentOverlayOpacity]);

  useEffect(() => {
    if (showComponentSelector) {
      componentSlideAnim.setValue(0);
      componentOverlayOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(componentOverlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(componentSlideAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(componentOverlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(componentSlideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [showComponentSelector, componentSlideAnim, componentOverlayOpacity]);

  // Plans for Record tab - to get plan_id when recording payment
  const studentIds = useMemo(() => students.map((s: any) => s.id), [students]);
  const { data: planByStudent } = useQuery<{ student_id: string; id: string }[]>({
    queryKey: ['fee_student_plans', schoolCode, selectedClass?.id || 'all', studentIds.join(',')],
    enabled: activeTab === 'record' && !!schoolCode && studentIds.length > 0,
    queryFn: async () => {
      if (!schoolCode) throw new Error('School code is required');
      const { data, error } = await supabase
        .from('fee_student_plans')
        .select('id, student_id')
        .eq('school_code', schoolCode)
        .in('student_id', studentIds);
      if (error) throw error;
      return data as any;
    }
  });

  // Student plan map for recording payments
  const studentPlanMap = useMemo(() => {
    const m = new Map<string, string>();
    (planByStudent || []).forEach(p => m.set(p.student_id, p.id));
    return m;
  }, [planByStudent]);

  // Fetch component balances for all components (used for greying out paid components)
  const selectedPlanIdForBalance = selectedStudentId ? studentPlanMap.get(selectedStudentId) : null;
  const { data: componentBalances } = useQuery({
    queryKey: ['componentBalances', selectedStudentId, selectedPlanIdForBalance, schoolCode],
    enabled: !!selectedStudentId && !!schoolCode && activeTab === 'record',
    queryFn: async () => {
      if (!selectedPlanIdForBalance || !schoolCode) {
        return new Map<string, { due: number; paid: number; remaining: number }>();
      }

      // Get all plan items
      const { data: planItems, error: itemsError } = await supabase
        .from('fee_student_plan_items')
        .select('amount_inr, quantity, component_type_id')
        .eq('plan_id', selectedPlanIdForBalance);
      
      if (itemsError) throw itemsError;

      // Get all existing payments
      const { data: existingPayments, error: paymentsError } = await supabase
        .from('fee_payments')
        .select('amount_inr, component_type_id')
        .eq('student_id', selectedStudentId!)
        .eq('school_code', schoolCode!);
      
      if (paymentsError) throw paymentsError;

      // Calculate balance for each component
      const balances = new Map<string, { due: number; paid: number; remaining: number }>();
      
      (planItems || []).forEach((item: any) => {
        const componentId = item.component_type_id;
        if (!componentId) return;

        const itemAmount = item.amount_inr || 0;
        const itemQuantity = item.quantity || 1;
        const due = itemAmount * itemQuantity;

        const paid = (existingPayments || [])
          .filter((p: any) => p.component_type_id === componentId)
          .reduce((sum: number, p: any) => sum + (p.amount_inr || 0), 0);

        const remaining = due - paid;

        balances.set(componentId, { due, paid, remaining });
      });

      return balances;
    },
  });

  // Fetch fee balance for selected student and component
  const selectedPlanId = selectedStudentId ? studentPlanMap.get(selectedStudentId) : null;
  const { data: feeBalance, isLoading: balanceLoading } = useQuery({
    queryKey: ['feeBalance', selectedStudentId, selectedPlanId, selectedComponentId, schoolCode],
    enabled: !!selectedStudentId && !!schoolCode && activeTab === 'record',
    queryFn: async () => {
      let componentDue = 0;
      let componentPaid = 0;
      let totalDue = 0;
      let totalPaid = 0;
      
      if (selectedPlanId) {
        // Get all plan items to calculate total
        const { data: planItems, error: itemsError } = await supabase
          .from('fee_student_plan_items')
          .select('amount_inr, quantity, component_type_id')
          .eq('plan_id', selectedPlanId);
        
        if (itemsError) throw itemsError;
        
        // Calculate total due from all plan items
        totalDue = (planItems || []).reduce((sum: number, item: any) => {
          const itemAmount = item.amount_inr || 0;
          const itemQuantity = item.quantity || 1;
          return sum + (itemAmount * itemQuantity);
        }, 0);
        
        // Calculate component-specific due if component is selected
        if (selectedComponentId) {
          const componentItem = (planItems || []).find((item: any) => 
            item.component_type_id === selectedComponentId
          );
          
          if (componentItem) {
            const itemAmount = componentItem.amount_inr || 0;
            const itemQuantity = componentItem.quantity || 1;
            componentDue = itemAmount * itemQuantity;
          }
        }
      }
      
      // Get all existing payments
      const { data: existingPayments, error: paymentsError } = await supabase
        .from('fee_payments')
        .select('amount_inr, component_type_id')
        .eq('student_id', selectedStudentId!)
        .eq('school_code', schoolCode!);
      
      if (paymentsError) throw paymentsError;
      
      // Calculate total paid
      totalPaid = (existingPayments || []).reduce((sum: number, payment: any) => {
        return sum + (payment.amount_inr || 0);
      }, 0);
      
      // Calculate component-specific paid if component is selected
      if (selectedComponentId) {
        componentPaid = (existingPayments || [])
          .filter((payment: any) => payment.component_type_id === selectedComponentId)
          .reduce((sum: number, payment: any) => {
            return sum + (payment.amount_inr || 0);
          }, 0);
      }
      
      const componentRemainingBalance = componentDue - componentPaid;
      const totalRemainingBalance = totalDue - totalPaid;
      
      return {
        totalDue,
        totalPaid,
        totalRemainingBalance,
        componentDue,
        componentPaid,
        componentRemainingBalance,
        hasPlan: !!selectedPlanId,
        hasComponent: !!selectedComponentId && componentDue > 0,
      };
    },
  });

  const {
    data: payments,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<PaymentRecord[]>({
    queryKey: [
      'fee_payments', 
      schoolCode, 
      selectedClass?.id || 'all', 
      startDate ? startDate.toISOString().slice(0,10) : null, 
      endDate ? endDate.toISOString().slice(0,10) : null,
      methodFilter || 'all',
      studentIds.join(',')
    ],
    queryFn: async () => {
      if (!schoolCode) throw new Error('School code is required');
      let query = supabase
        .from('fee_payments')
        .select(
          `
          id, student_id, plan_id, component_type_id, amount_inr, payment_date, payment_method,
          transaction_id, receipt_number, remarks, created_at, updated_at, created_by, recorded_by_name,
          student:student_id ( id, full_name, student_code, class_instance_id ),
          component:component_type_id ( id, name )
        `
        )
        .eq('school_code', schoolCode!);

      if (selectedClass?.id && studentIds.length > 0) {
        // filter by students of the selected class
        query = query.in('student_id', studentIds);
      }

      if (startDate) {
        query = query.gte('payment_date', startDate.toISOString().slice(0,10));
      }
      if (endDate) {
        query = query.lte('payment_date', endDate.toISOString().slice(0,10));
      }
      if (methodFilter) {
        query = query.eq('payment_method', methodFilter);
      }

      query = query
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);

      const { data, error } = await query;

      if (error) throw error;
      const payments = (data as unknown) as PaymentRecord[];
      const planIds = Array.from(new Set(payments.map(p => p.plan_id).filter(Boolean))) as string[];
      if (planIds.length === 0) return payments;

      // fetch plan items to compute totals
      const { data: items, error: itemsError } = await supabase
        .from('fee_student_plan_items')
        .select('plan_id, amount_inr')
        .in('plan_id', planIds);
      if (itemsError) throw itemsError;

      const planTotalMap = new Map<string, number>();
      for (const it of (items as any[])) {
        const pid = it.plan_id as string;
        const amt = it.amount_inr as number;
        planTotalMap.set(pid, (planTotalMap.get(pid) || 0) + (amt || 0));
      }

      return payments.map(p => ({
        ...p,
        total_fee_inr: p.plan_id ? (planTotalMap.get(p.plan_id) || 0) : undefined,
      }));
    },
  });

  const empty = !isLoading && (payments?.length ?? 0) === 0;

  const totalCollected = useMemo(() => {
    return (payments || []).reduce((sum, p) => sum + (p.amount_inr || 0), 0);
  }, [payments]);

  // Group payments by student and calculate totals
  const studentPaymentSummary = useMemo(() => {
    const summary = new Map<string, {
      student: any;
      payments: PaymentRecord[];
      totalPaid: number;
      totalFee: number;
      totalPending: number;
    }>();

    (payments || []).forEach((payment) => {
      const studentId = payment.student_id;
      if (!studentId) return;

      if (!summary.has(studentId)) {
        summary.set(studentId, {
          student: payment.student,
          payments: [],
          totalPaid: 0,
          totalFee: payment.total_fee_inr || 0,
          totalPending: 0,
        });
      }

      const studentSummary = summary.get(studentId)!;
      studentSummary.payments.push(payment);
      studentSummary.totalPaid += payment.amount_inr || 0;
      // Use the highest total_fee_inr from any payment (they should all be the same for a student)
      if (payment.total_fee_inr && payment.total_fee_inr > studentSummary.totalFee) {
        studentSummary.totalFee = payment.total_fee_inr;
      }
    });

    // Calculate pending for each student and sort payments by updated_at (oldest first)
    summary.forEach((summary) => {
      summary.totalPending = Math.max(0, summary.totalFee - summary.totalPaid);
      // Sort payments by updated_at ascending (oldest first)
      summary.payments.sort((a, b) => {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
        return dateA - dateB; // ascending order (oldest first)
      });
    });

    // Filter by search text
    let result = Array.from(summary.values());
    if (searchText.trim().length > 0) {
      const query = searchText.trim().toLowerCase();
      result = result.filter(s => {
        const name = (s.student?.full_name || '').toLowerCase();
        const code = (s.student?.student_code || '').toLowerCase();
        return name.includes(query) || code.includes(query);
      });
    }

    // Filter by date range (any payment in the range)
    if (startDate || endDate) {
      result = result.filter(s => {
        return s.payments.some(p => {
          const paymentDate = new Date(p.payment_date);
          if (startDate && paymentDate < new Date(startDate.toISOString().split('T')[0])) return false;
          if (endDate && paymentDate > new Date(endDate.toISOString().split('T')[0])) return false;
          return true;
        });
      });
    }

    // Filter by method
    if (methodFilter) {
      result = result.filter(s => {
        return s.payments.some(p => p.payment_method === methodFilter);
      });
    }

    return result.sort((a, b) => {
      // Sort by student name
      const nameA = (a.student?.full_name || '').toLowerCase();
      const nameB = (b.student?.full_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [payments, searchText, startDate, endDate, methodFilter]);

  const filtered = useMemo(() => {
    const list = payments || [];
    return list.filter((p) => {
      // date range
      if (startDate) {
        if (new Date(p.payment_date) < new Date(startDate.toISOString().split('T')[0])) return false;
      }
      if (endDate) {
        if (new Date(p.payment_date) > new Date(endDate.toISOString().split('T')[0])) return false;
      }
      // method
      if (methodFilter && p.payment_method !== methodFilter) return false;
      // search by student
      if (searchText.trim().length > 0) {
        const name = (p.student?.full_name || '').toLowerCase();
        if (!name.includes(searchText.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [payments, startDate, endDate, methodFilter, searchText]);

  // Format collected by - show who recorded the payment
  const formatCollectedBy = (payment: PaymentRecord) => {
    if (payment.recorded_by_name && payment.recorded_by_name.trim().length > 0) {
      return payment.recorded_by_name;
    }
    // Show "No Data" when recorded_by_name is null or empty
    return 'No Data';
  };

  const headlineDateText = startDate ? (
    endDate ? `${formatDateDisplay(startDate.toISOString())} – ${formatDateDisplay(endDate.toISOString())}` : formatDateDisplay(startDate.toISOString())
  ) : 'All time';

  const formatMethod = (m?: string | null) => {
    if (!m) return '—';
    return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
  };

  const openPaymentDetails = (studentSummary: { student: any; payments: PaymentRecord[]; totalPaid: number }) => {
    setSelectedStudentForDetails(studentSummary);
    setDetailsModalVisible(true);
  };

  const closePaymentDetails = () => {
    setDetailsModalVisible(false);
    setSelectedStudentForDetails(null);
  };

  // Handle payment submission
  const handleSubmitPayment = async () => {
    if (!selectedStudentId) {
      Alert.alert('Error', 'Please select a student');
      return;
    }
    
    if (!selectedComponentId) {
      Alert.alert('Error', 'Please select a fee component');
      return;
    }
    
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }
    
    const planId = studentPlanMap.get(selectedStudentId) || null;
    
    setIsSubmitting(true);
    try {
      // Calculate component-specific due and paid amounts
      let componentDue = 0;
      let componentPaid = 0;
      let totalDue = 0;
      
      if (planId) {
        // Get plan items with component info
        const { data: planItems, error: itemsError } = await supabase
          .from('fee_student_plan_items')
          .select('amount_inr, quantity, component_type_id')
          .eq('plan_id', planId);
        
        if (itemsError) {
          console.error('Error fetching plan items:', itemsError);
          Alert.alert('Error', 'Failed to fetch fee plan details');
          setIsSubmitting(false);
          return;
        }
        
        // Calculate total due from all plan items
        totalDue = (planItems || []).reduce((sum: number, item: any) => {
          const itemAmount = item.amount_inr || 0;
          const itemQuantity = item.quantity || 1;
          return sum + (itemAmount * itemQuantity);
        }, 0);
        
        // Calculate component-specific due if component is selected
        if (selectedComponentId) {
          const componentItem = (planItems || []).find((item: any) => 
            item.component_type_id === selectedComponentId
          );
          
          if (componentItem) {
            const itemAmount = componentItem.amount_inr || 0;
            const itemQuantity = componentItem.quantity || 1;
            componentDue = itemAmount * itemQuantity;
          }
        }
      }
      
      if (!schoolCode) {
        Alert.alert('Error', 'School code is required');
        setIsSubmitting(false);
        return;
      }

      // Calculate total and component-specific already paid
      const { data: existingPayments, error: paymentsError } = await supabase
        .from('fee_payments')
        .select('amount_inr, component_type_id')
        .eq('student_id', selectedStudentId)
        .eq('school_code', schoolCode!);
      
      if (paymentsError) {
        console.error('Error fetching existing payments:', paymentsError);
        Alert.alert('Error', 'Failed to fetch payment history');
        setIsSubmitting(false);
        return;
      }
      
      const totalPaid = (existingPayments || []).reduce((sum: number, payment: any) => {
        return sum + (payment.amount_inr || 0);
      }, 0);
      
      // Calculate component-specific paid if component is selected
      if (selectedComponentId) {
        componentPaid = (existingPayments || [])
          .filter((payment: any) => payment.component_type_id === selectedComponentId)
          .reduce((sum: number, payment: any) => {
            return sum + (payment.amount_inr || 0);
          }, 0);
      }
      
      // Calculate remaining balances
      const componentRemainingBalance = componentDue - componentPaid;
      const totalRemainingBalance = totalDue - totalPaid;
      
      // Validate payment amount - use component-specific limit if component is selected
      const maxAmount = selectedComponentId && componentDue > 0 
        ? componentRemainingBalance 
        : totalRemainingBalance;
      
      // Reject payment if: already fully paid/overpaid (maxAmount <= 0) OR exceeds remaining balance (amount > maxAmount)
      if (totalDue > 0 && (maxAmount <= 0 || amount > maxAmount)) {
        const componentName = selectedComponentId 
          ? feeComponents.find((c: any) => c.id === selectedComponentId)?.name || 'component'
          : 'total';
        
        let errorMessage: string;
        if (maxAmount <= 0) {
          // Already fully paid or overpaid
          errorMessage = `All fees are already paid for ${componentName}. Cannot accept additional payments.`;
          if (selectedComponentId && componentDue > 0) {
            errorMessage += `\n\nComponent Fee: ₹${componentDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nComponent Paid: ₹${componentPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (componentRemainingBalance < 0) {
              errorMessage += `\nOverpaid by: ₹${Math.abs(componentRemainingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          } else {
            errorMessage += `\n\nTotal Fee: ₹${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nAlready Paid: ₹${totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (totalRemainingBalance < 0) {
              errorMessage += `\nOverpaid by: ₹${Math.abs(totalRemainingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }
        } else {
          // Exceeds remaining balance
          errorMessage = `The payment amount (₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) exceeds the remaining balance for ${componentName} (₹${maxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`;
          if (selectedComponentId && componentDue > 0) {
            errorMessage += `\n\nComponent Fee: ₹${componentDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nComponent Paid: ₹${componentPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nComponent Remaining: ₹${componentRemainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          } else {
            errorMessage += `\n\nTotal Fee: ₹${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nAlready Paid: ₹${totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nRemaining: ₹${totalRemainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
        }
        
        Alert.alert(
          'Payment Not Allowed',
          errorMessage
        );
        setIsSubmitting(false);
        return;
      }
      
      if (!schoolCode) {
        Alert.alert('Error', 'School code is required');
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from('fee_payments')
        .insert({
          student_id: selectedStudentId!,
          plan_id: planId,
          component_type_id: selectedComponentId || null,
          amount_inr: amount,
          payment_method: paymentMethod,
          payment_date: paymentDate.toISOString().split('T')[0],
          transaction_id: receiptNumber || null,
          receipt_number: receiptNumber || null,
          remarks: remarks || null,
          school_code: schoolCode,
          created_by: profile?.auth_id || undefined,
          recorded_by_name: profile?.full_name || null,
        } as any);
      
      if (error) {
        console.error('Payment error:', error);
        Alert.alert('Error', error.message || 'Failed to record payment');
        return;
      }
      
      Alert.alert('Success', 'Payment recorded successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setSelectedStudentId(null);
            setSelectedComponentId(null);
            setPaymentAmount('');
            setPaymentMethod('cash');
            setReceiptNumber('');
            setRemarks('');
            setPaymentDate(new Date());
            
            // Refresh payments and fee balance
            refetch();
            queryClient.invalidateQueries({ queryKey: ['feeBalance', selectedStudentId] });
            queryClient.invalidateQueries({ queryKey: ['componentBalances', selectedStudentId] });
            
            // Switch to collected tab to see the new payment
            setActiveTab('collected');
          }
        }
      ]);
    } catch (error: any) {
      console.error('Payment submission error:', error);
      Alert.alert('Error', error.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Filter Row - Header (Task Management style) */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          {/* Class Filter */}
          <TouchableOpacity
            style={styles.filterItem}
            onPress={() => setShowClassDropdown(true)}
          >
            <View style={styles.filterIcon}>
              <Users size={16} color={colors.text.inverse} />
            </View>
            <View style={styles.filterContent}>
              <Text style={styles.filterValue} numberOfLines={1}>
                {selectedClass ? `Grade ${selectedClass.grade} ${selectedClass.section}` : 'Class'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.filterDivider} />

          {/* Start Date */}
          <TouchableOpacity 
            style={styles.filterItem}
            onPress={() => { setTempPickerDate(startDate || new Date()); setShowHistoryDatePicker('start'); }}
          >
            <View style={styles.filterIcon}>
              <Calendar size={16} color={colors.text.inverse} />
            </View>
            <View style={styles.filterContent}>
              <Text style={styles.filterValue} numberOfLines={1}>
                {(startDate || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.filterDivider} />

          {/* End Date */}
          <TouchableOpacity 
            style={styles.filterItem}
            onPress={() => { setTempPickerDate(endDate || startDate || new Date()); setShowHistoryDatePicker('end'); }}
          >
            <View style={styles.filterIcon}>
              <Calendar size={16} color={colors.text.inverse} />
            </View>
            <View style={styles.filterContent}>
              <Text style={styles.filterValue} numberOfLines={1}>
                {(endDate || startDate || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Toggle: Collected | Record Fee */}
      <View style={styles.toggleRow}>
        <TouchableOpacity onPress={() => setActiveTab('collected')} style={[styles.toggleBtn, activeTab==='collected' && styles.toggleBtnActive]}> 
          <Text style={[styles.toggleText, activeTab==='collected' && styles.toggleTextActive]}>Collected</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('record')} style={[styles.toggleBtn, activeTab==='record' && styles.toggleBtnActive]}> 
          <Text style={[styles.toggleText, activeTab==='record' && styles.toggleTextActive]}>Record Fee</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar with filter icon - only show for Collected tab */}
      {activeTab === 'collected' && (
        <View style={styles.searchSection}>
          <View style={styles.searchBarContainer}>
            <Searchbar
              placeholder="Search payments..."
              onChangeText={setSearchText}
              value={searchText}
              style={styles.searchBar}
              iconColor={colors.primary[600]}
            />
            <TouchableOpacity 
              style={styles.filterIconButton}
              onPress={() => setShowMethodModal(true)}
            >
              <Filter size={20} color={colors.primary[600]} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Headline summary moved below filters - only show for Collected tab */}
      {activeTab === 'collected' && (
        <View style={styles.headlineCard}>
          <View style={styles.headlineEdge} />
          <View style={styles.headlineContentCenter}>
            <Text style={styles.headlineAmount}>{formatAmount(totalCollected)}</Text>
          </View>
        </View>
      )}
      

      {activeTab==='collected' ? (
      <>
        <FlatList
          data={studentPaymentSummary}
          keyExtractor={(item) => item.student?.id || Math.random().toString()}
          renderItem={({ item }) => {
            return (
              <View style={styles.studentPaymentCard}>
                {/* Main Card Content */}
                <TouchableOpacity
                  style={styles.studentPaymentCardHeader}
                  onPress={() => openPaymentDetails(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.studentPaymentCardInfo}>
                    <View style={styles.studentPaymentCardNameRow}>
                      <Text style={styles.studentPaymentCardName}>
                        {item.student?.full_name || 'Unknown'}
                      </Text>
                      <ChevronRight 
                        size={18} 
                        color={colors.text.secondary}
                        style={styles.expandIcon}
                      />
                    </View>
                    {item.student?.student_code && (
                      <Text style={styles.studentPaymentCardCode}>
                        {item.student.student_code}
                      </Text>
                    )}
                  </View>
                  <View style={styles.studentPaymentCardAmounts}>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Paid:</Text>
                      <Text style={styles.amountPaidText}>{formatAmount(item.totalPaid)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Pending:</Text>
                      <Text style={[
                        styles.amountPendingText,
                        item.totalPending > 0 && styles.amountPendingTextDanger
                      ]}>
                        {formatAmount(item.totalPending)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={empty ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <CreditCard size={64} color={colors.primary[300]} />
              </View>
              <Text style={styles.emptyTitle}>No Payments Found</Text>
              <Text style={styles.emptyText}>
                No payments match your current filters.
              </Text>
            </View>
          ) : null}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          contentContainerStyle={studentPaymentSummary.length > 0 ? { paddingBottom: spacing.xl } : { flex: 1 }}
        />
      </>
      ) : (
        <ScrollView style={styles.recordScrollView} contentContainerStyle={styles.recordFormContainer}>
          {/* Student Selector */}
          <View style={styles.recordFormGroup}>
            <Text style={styles.recordLabel}>Student *</Text>
            <TouchableOpacity
              style={[styles.recordSelect, !selectedStudentId && styles.recordSelectEmpty]}
              onPress={() => setShowStudentSelector(true)}
            >
              <Text style={[styles.recordSelectText, !selectedStudentId && styles.recordSelectTextEmpty]}>
                {selectedStudentId 
                  ? students.find((s: any) => s.id === selectedStudentId)?.full_name || 'Select student'
                  : 'Select student'}
              </Text>
              <Users size={20} color={selectedStudentId ? colors.text.primary : colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          {/* Fee Balance Card - Show when student is selected */}
          {selectedStudentId && feeBalance && (
            <View style={styles.feeBalanceCard}>
              <View style={styles.feeBalanceHeader}>
                <Info size={18} color={colors.primary[600]} />
                <Text style={styles.feeBalanceTitle}>Fee Balance</Text>
              </View>
              {balanceLoading ? (
                <Text style={styles.feeBalanceLoading}>Loading...</Text>
              ) : feeBalance.hasPlan ? (
                <>
                  <View style={styles.feeBalanceRow}>
                    <Text style={styles.feeBalanceLabel}>Total Fee:</Text>
                    <Text style={styles.feeBalanceValue}>
                      {formatAmount(feeBalance.totalDue)}
                    </Text>
                  </View>
                  <View style={styles.feeBalanceRow}>
                    <Text style={styles.feeBalanceLabel}>Already Paid:</Text>
                    <Text style={[styles.feeBalanceValue, styles.feeBalancePaid]}>
                      {formatAmount(feeBalance.totalPaid)}
                    </Text>
                  </View>
                  <View style={[styles.feeBalanceRow, styles.feeBalanceRowLast]}>
                    <Text style={styles.feeBalanceLabel}>Remaining Balance:</Text>
                    <Text style={[
                      styles.feeBalanceValue,
                      feeBalance.totalRemainingBalance > 0 ? styles.feeBalanceRemaining : styles.feeBalanceComplete
                    ]}>
                      {formatAmount(feeBalance.totalRemainingBalance)}
                    </Text>
                  </View>
                  {/* Component-specific balance when component is selected */}
                  {selectedComponentId && feeBalance.hasComponent && (
                    <>
                      <View style={styles.feeBalanceDivider} />
                      <Text style={styles.feeBalanceComponentTitle}>
                        {feeComponents.find((c: any) => c.id === selectedComponentId)?.name || 'Selected Component'}
                      </Text>
                      <View style={styles.feeBalanceRow}>
                        <Text style={styles.feeBalanceLabel}>Component Fee:</Text>
                        <Text style={styles.feeBalanceValue}>
                          {formatAmount(feeBalance.componentDue)}
                        </Text>
                      </View>
                      <View style={styles.feeBalanceRow}>
                        <Text style={styles.feeBalanceLabel}>Component Paid:</Text>
                        <Text style={[styles.feeBalanceValue, styles.feeBalancePaid]}>
                          {formatAmount(feeBalance.componentPaid)}
                        </Text>
                      </View>
                      <View style={[styles.feeBalanceRow, styles.feeBalanceRowLast]}>
                        <Text style={styles.feeBalanceLabel}>Remaining:</Text>
                        <Text style={[
                          styles.feeBalanceValue,
                          feeBalance.componentRemainingBalance > 0 ? styles.feeBalanceRemaining : styles.feeBalanceComplete
                        ]}>
                          {formatAmount(feeBalance.componentRemainingBalance)}
                        </Text>
                      </View>
                    </>
                  )}
                  {feeBalance.totalRemainingBalance <= 0 && (
                    <View style={styles.feeBalanceWarning}>
                      <CheckCircle2 size={16} color={colors.success[600]} />
                      <Text style={styles.feeBalanceWarningText}>
                        All fees are paid for this student
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.feeBalanceNoPlan}>
                  <AlertCircle size={16} color={colors.warning[600]} />
                  <Text style={styles.feeBalanceNoPlanText}>
                    No fee plan assigned to this student
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Component Selector */}
          <View style={styles.recordFormGroup}>
            <Text style={styles.recordLabel}>Fee Component *</Text>
            <TouchableOpacity
              style={[styles.recordSelect, !selectedComponentId && styles.recordSelectEmpty]}
              onPress={() => setShowComponentSelector(true)}
            >
              <Text style={[styles.recordSelectText, !selectedComponentId && styles.recordSelectTextEmpty]}>
                {selectedComponentId 
                  ? feeComponents.find((c: any) => c.id === selectedComponentId)?.name || 'Select component'
                  : 'Select component'}
              </Text>
              <Circle size={20} color={selectedComponentId ? colors.text.primary : colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <View style={styles.recordFormGroup}>
            <View style={styles.recordLabelRow}>
              <Text style={styles.recordLabel}>Amount (₹) *</Text>
              {selectedComponentId && feeBalance?.hasComponent && feeBalance.componentRemainingBalance > 0 ? (
                <Text style={styles.recordMaxAmount}>
                  Max: {formatAmount(feeBalance.componentRemainingBalance)}
                </Text>
              ) : feeBalance?.hasPlan && feeBalance.totalRemainingBalance > 0 ? (
                <Text style={styles.recordMaxAmount}>
                  Max: {formatAmount(feeBalance.totalRemainingBalance)}
                </Text>
              ) : null}
            </View>
            <View style={[
              styles.recordAmountInputWrapper,
              paymentAmount && (() => {
                const amount = parseFloat(paymentAmount) || 0;
                // Use component-specific limit if component is selected, otherwise use total
                const maxAmount = selectedComponentId && feeBalance?.hasComponent 
                  ? feeBalance.componentRemainingBalance 
                  : feeBalance?.totalRemainingBalance || 0;
                
                // Show error if: already fully paid/overpaid (maxAmount <= 0) OR exceeds remaining balance (amount > maxAmount)
                if (feeBalance?.hasPlan && (maxAmount <= 0 || amount > maxAmount)) {
                  return styles.recordAmountInputError;
                }
                return null;
              })()
            ]}>
              <Text style={styles.recordCurrencySymbol}>₹</Text>
              <TextInput
                style={styles.recordAmountInput}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.text.tertiary}
              />
            </View>
            {paymentAmount && (() => {
              const amount = parseFloat(paymentAmount) || 0;
              // Use component-specific limit if component is selected, otherwise use total
              const maxAmount = selectedComponentId && feeBalance?.hasComponent 
                ? feeBalance.componentRemainingBalance 
                : feeBalance?.totalRemainingBalance || 0;
              
              if (feeBalance?.hasPlan) {
                if (maxAmount <= 0) {
                  // Already fully paid or overpaid
                  return (
                    <View style={styles.recordAmountError}>
                      <AlertCircle size={14} color={colors.error[600]} />
                      <Text style={styles.recordAmountErrorText}>
                        {selectedComponentId && feeBalance?.hasComponent
                          ? 'All fees for this component are already paid. Cannot accept additional payments.'
                          : 'All fees are already paid. Cannot accept additional payments.'}
                      </Text>
                    </View>
                  );
                } else if (amount > maxAmount) {
                  // Exceeds remaining balance
                  return (
                    <View style={styles.recordAmountError}>
                      <AlertCircle size={14} color={colors.error[600]} />
                      <Text style={styles.recordAmountErrorText}>
                        {selectedComponentId && feeBalance?.hasComponent
                          ? `Amount exceeds remaining balance for this component by ${formatAmount(amount - maxAmount)}`
                          : `Amount exceeds remaining balance by ${formatAmount(amount - maxAmount)}`}
                      </Text>
                    </View>
                  );
                } else if (amount > 0 && amount <= maxAmount) {
                  // Valid payment amount
                  const remainingAfter = maxAmount - amount;
                  return (
                    <View style={styles.recordAmountHint}>
                      <Text style={styles.recordAmountHintText}>
                        {selectedComponentId && feeBalance?.hasComponent
                          ? remainingAfter > 0 
                            ? `After payment: ${formatAmount(remainingAfter)} remaining for this component`
                            : 'Payment will complete this component'
                          : remainingAfter > 0 
                            ? `After payment: ${formatAmount(remainingAfter)} remaining`
                            : 'Payment will complete all fees'}
                      </Text>
                    </View>
                  );
                }
              }
              return null;
            })()}
          </View>

          {/* Payment Date */}
          <View style={styles.recordFormGroup}>
            <Text style={styles.recordLabel}>Payment Date *</Text>
            <TouchableOpacity
              style={styles.recordSelect}
              onPress={() => setShowRecordDatePicker(true)}
            >
              <Calendar size={20} color={colors.text.primary} />
              <Text style={styles.recordSelectText}>
                {paymentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Payment Method */}
          <View style={styles.recordFormGroup}>
            <Text style={styles.recordLabel}>Payment Method *</Text>
            <View style={styles.recordMethodContainer}>
              {['cash', 'cheque', 'online', 'card'].map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.recordMethodOption,
                    paymentMethod === method && styles.recordMethodOptionSelected
                  ]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Text style={[
                    styles.recordMethodText,
                    paymentMethod === method && styles.recordMethodTextSelected
                  ]}>
                    {method.charAt(0).toUpperCase() + method.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Transaction ID */}
          <View style={styles.recordFormGroup}>
            <Text style={styles.recordLabel}>Transaction/Receipt ID</Text>
            <TextInput
              style={styles.recordTextInput}
              value={receiptNumber}
              onChangeText={setReceiptNumber}
              placeholder="Optional"
              placeholderTextColor={colors.text.tertiary}
            />
          </View>

          {/* Remarks */}
          <View style={styles.recordFormGroup}>
            <Text style={styles.recordLabel}>Remarks</Text>
            <TextInput
              style={[styles.recordTextInput, styles.recordTextArea]}
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Optional remarks"
              multiline
              numberOfLines={3}
              placeholderTextColor={colors.text.tertiary}
            />
          </View>

          {/* Submit Button */}
          <Button
            mode="contained"
            onPress={handleSubmitPayment}
            loading={isSubmitting}
            disabled={isSubmitting || !selectedStudentId || !selectedComponentId || !paymentAmount}
            style={styles.recordSubmitButton}
          >
            Record Payment
          </Button>
        </ScrollView>
      )}

      {/* Class Selector Modal - Animated Bottom Sheet (match syllabus) */}
      <Modal
        visible={showClassDropdown}
        transparent
        animationType="none"
        onRequestClose={() => setShowClassDropdown(false)}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill as any}
            activeOpacity={1}
            onPress={() => setShowClassDropdown(false)}
          />
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [
                  {
                    translateY: classSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [500, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Class</Text>
            <ScrollView style={styles.sheetContent}>
              {(classes || []).map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.sheetItem, selectedClass?.id === c.id && styles.sheetItemActive]}
                  onPress={() => {
                    setSelectedClass(c);
                    setShowClassDropdown(false);
                  }}
                >
                  <Text style={[styles.sheetItemText, selectedClass?.id === c.id && styles.sheetItemTextActive]}>
                    Grade {c.grade} - Section {c.section}
                  </Text>
                  {selectedClass?.id === c.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Method Filter - Bottom Sheet (same as class filter) */}
      <Modal
        visible={showMethodModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowMethodModal(false)}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: methodOverlayOpacity }]}> 
          <TouchableOpacity
            style={StyleSheet.absoluteFill as any}
            activeOpacity={1}
            onPress={() => setShowMethodModal(false)}
          />
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [
                  {
                    translateY: methodSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [500, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Method</Text>
            <ScrollView style={styles.sheetContent}>
              {['any','cash','cheque','online','card','other'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.sheetItem, (methodFilter===null && m==='any') || methodFilter===m ? styles.sheetItemActive : undefined]}
                  onPress={() => {
                    setMethodFilter(m==='any'? null : m);
                    setShowMethodModal(false);
                  }}
                >
                  <Text style={[styles.sheetItemText, (methodFilter===null && m==='any') || methodFilter===m ? styles.sheetItemTextActive : undefined]}>
                    {m==='any' ? 'Any' : m.charAt(0).toUpperCase()+m.slice(1)}
                  </Text>
                  {((methodFilter===null && m==='any') || methodFilter===m) && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* History Date Picker (exact copy from Attendance) */}
      {showHistoryDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={showHistoryDatePicker === 'start' ? (startDate || new Date()) : (endDate || new Date())}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowHistoryDatePicker(null);
            if (selectedDate) {
              if (showHistoryDatePicker === 'start') {
                setStartDate(selectedDate);
              } else {
                setEndDate(selectedDate);
              }
            }
          }}
          minimumDate={new Date(2020, 0, 1)}
          maximumDate={new Date(2030, 11, 31)}
        />
      )}

      {showHistoryDatePicker && Platform.OS === 'ios' && (
        <Portal>
          <PaperModal
            visible={!!showHistoryDatePicker}
            onDismiss={() => setShowHistoryDatePicker(null)}
            contentContainerStyle={styles.datePickerModal}
          >
            <View style={styles.datePickerContainer}>
              <Text style={styles.datePickerTitle}>
                Select {showHistoryDatePicker === 'start' ? 'Start' : 'End'} Date
              </Text>
              <DateTimePicker
                value={showHistoryDatePicker === 'start' ? (startDate || new Date()) : (endDate || new Date())}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    if (showHistoryDatePicker === 'start') {
                      setStartDate(selectedDate);
                    } else {
                      setEndDate(selectedDate);
                    }
                  }
                }}
                minimumDate={new Date(2020, 0, 1)}
                maximumDate={new Date(2030, 11, 31)}
              />
              <View style={styles.datePickerActions}>
                <Button
                  mode="outlined"
                  onPress={() => setShowHistoryDatePicker(null)}
                  style={styles.datePickerButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={() => setShowHistoryDatePicker(null)}
                  style={styles.datePickerButton}
                >
                  Done
                </Button>
              </View>
            </View>
          </PaperModal>
        </Portal>
      )}

      {/* Record Date Picker */}
      {showRecordDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={paymentDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowRecordDatePicker(false);
            if (selectedDate) {
              setPaymentDate(selectedDate);
            }
          }}
          minimumDate={new Date(2020, 0, 1)}
          maximumDate={new Date(2030, 11, 31)}
        />
      )}

      {showRecordDatePicker && Platform.OS === 'ios' && (
        <Portal>
          <PaperModal
            visible={showRecordDatePicker}
            onDismiss={() => setShowRecordDatePicker(false)}
            contentContainerStyle={styles.datePickerModal}
          >
            <View style={styles.datePickerContainer}>
              <Text style={styles.datePickerTitle}>Select Payment Date</Text>
              <DateTimePicker
                value={paymentDate}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setPaymentDate(selectedDate);
                  }
                }}
                minimumDate={new Date(2020, 0, 1)}
                maximumDate={new Date(2030, 11, 31)}
              />
              <View style={styles.datePickerActions}>
                <Button
                  mode="outlined"
                  onPress={() => setShowRecordDatePicker(false)}
                  style={styles.datePickerButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={() => setShowRecordDatePicker(false)}
                  style={styles.datePickerButton}
                >
                  Done
                </Button>
              </View>
            </View>
          </PaperModal>
        </Portal>
      )}

      {/* Student Selector Modal */}
      <Modal
        visible={showStudentSelector}
        transparent
        animationType="none"
        onRequestClose={() => {
          setShowStudentSelector(false);
          setStudentSearchQuery('');
        }}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: studentOverlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill as any}
            activeOpacity={1}
            onPress={() => {
              setShowStudentSelector(false);
              setStudentSearchQuery('');
            }}
          />
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [
                  {
                    translateY: studentSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [500, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Student</Text>
            
            {/* Search Input */}
            <View style={styles.sheetSearchContainer}>
              <View style={styles.sheetSearchInputWrapper}>
                <Search size={18} color={colors.text.secondary} />
                <TextInput
                  style={styles.sheetSearchInput}
                  placeholder="Search students..."
                  value={studentSearchQuery}
                  onChangeText={setStudentSearchQuery}
                  placeholderTextColor={colors.text.tertiary}
                />
                {studentSearchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setStudentSearchQuery('')}
                    style={styles.sheetSearchClear}
                  >
                    <X size={16} color={colors.text.secondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={styles.sheetContent}>
              {(() => {
                // Filter students based on search
                const filteredStudents = students.filter((s: any) => {
                  if (!studentSearchQuery.trim()) return true;
                  const query = studentSearchQuery.toLowerCase();
                  const name = (s.full_name || '').toLowerCase();
                  const code = (s.student_code || '').toLowerCase();
                  return name.includes(query) || code.includes(query);
                });

                if (filteredStudents.length === 0) {
                  return (
                    <View style={[styles.sheetEmptyState, { minHeight: 200, justifyContent: 'center' }]}>
                      <Text style={styles.sheetEmptyText}>
                        {students.length === 0 
                          ? 'No students available' 
                          : `No students match "${studentSearchQuery}"`}
                      </Text>
                    </View>
                  );
                }

                return filteredStudents.map((s: any) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.sheetItem, selectedStudentId === s.id && styles.sheetItemActive]}
                    onPress={() => {
                      setSelectedStudentId(s.id);
                      setShowStudentSelector(false);
                      setStudentSearchQuery(''); // Clear search when selecting
                    }}
                  >
                    <Text style={[styles.sheetItemText, selectedStudentId === s.id && styles.sheetItemTextActive]}>
                      {s.full_name} {s.student_code ? `(${s.student_code})` : ''}
                    </Text>
                    {selectedStudentId === s.id && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ));
              })()}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Payment Details Modal */}
      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePaymentDetails}
      >
        <View style={styles.detailsModalOverlay}>
          <TouchableOpacity
            style={styles.detailsModalBackdrop}
            activeOpacity={1}
            onPress={closePaymentDetails}
          />
          <View style={styles.detailsModalContent}>
            <View style={styles.detailsModalHeader}>
              <View style={styles.detailsModalHeaderInfo}>
                <Text style={styles.detailsModalTitle}>
                  {selectedStudentForDetails?.student?.full_name || 'Unknown'}
                </Text>
                {selectedStudentForDetails?.student?.student_code && (
                  <Text style={styles.detailsModalSubtitle}>
                    {selectedStudentForDetails.student.student_code}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={closePaymentDetails}
                style={styles.detailsModalCloseButton}
              >
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.detailsModalBody}
              contentContainerStyle={styles.detailsModalContentContainer}
            >
              {!selectedStudentForDetails || selectedStudentForDetails.payments.length === 0 ? (
                <View style={styles.detailsModalEmpty}>
                  <Text style={styles.detailsModalEmptyText}>No payment details</Text>
                </View>
              ) : (
                <View style={styles.paymentDetailsContainer}>
                  <View style={styles.paymentDetailsList}>
                    {selectedStudentForDetails.payments.map((payment, index) => (
                      <View key={payment.id}>
                        <View style={styles.studentPaymentDetailRow}>
                          <Text style={styles.studentPaymentDetailIndex}>
                            #{index + 1}
                          </Text>
                          <Text style={styles.studentPaymentDetailAmount}>
                            {formatAmount(payment.amount_inr)}
                          </Text>
                          <View style={styles.studentPaymentDetailBadge}>
                            <Text style={styles.studentPaymentDetailBadgeText}>
                              {formatMethod(payment.payment_method)}
                            </Text>
                          </View>
                          <Text style={styles.studentPaymentDetailText}>
                            {formatDateDisplay(payment.payment_date)}
                          </Text>
                          <Text style={styles.studentPaymentDetailText}>
                            {formatCollectedBy(payment)}
                          </Text>
                          {payment.receipt_number && (
                            <Text style={styles.studentPaymentDetailText}>
                              {payment.receipt_number}
                            </Text>
                          )}
                        </View>
                        {index < selectedStudentForDetails.payments.length - 1 && (
                          <View style={styles.paymentDivider} />
                        )}
                      </View>
                    ))}
                  </View>
                  
                  {/* Total Paid - Compact */}
                  <View style={styles.paymentTotalRow}>
                    <Text style={styles.paymentTotalLabel}>TOTAL PAID</Text>
                    <Text style={styles.paymentTotalAmount}>
                      {formatAmount(selectedStudentForDetails.totalPaid)}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Component Selector Modal */}
      <Modal
        visible={showComponentSelector}
        transparent
        animationType="none"
        onRequestClose={() => {
          setShowComponentSelector(false);
          setComponentSearchQuery('');
        }}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: componentOverlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill as any}
            activeOpacity={1}
            onPress={() => {
              setShowComponentSelector(false);
              setComponentSearchQuery('');
            }}
          />
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [
                  {
                    translateY: componentSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [500, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Fee Component</Text>
            
            {/* Search Input */}
            <View style={styles.sheetSearchContainer}>
              <View style={styles.sheetSearchInputWrapper}>
                <Search size={18} color={colors.text.secondary} />
                <TextInput
                  style={styles.sheetSearchInput}
                  placeholder="Search components..."
                  value={componentSearchQuery}
                  onChangeText={setComponentSearchQuery}
                  placeholderTextColor={colors.text.tertiary}
                />
                {componentSearchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setComponentSearchQuery('')}
                    style={styles.sheetSearchClear}
                  >
                    <X size={16} color={colors.text.secondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={styles.sheetContent}>
              {(() => {
                // Filter components based on search
                const filteredComponents = feeComponents.filter((c: any) => {
                  if (!componentSearchQuery.trim()) return true;
                  const query = componentSearchQuery.toLowerCase();
                  const name = (c.name || '').toLowerCase();
                  return name.includes(query);
                });

                if (filteredComponents.length === 0) {
                  return (
                    <View style={[styles.sheetEmptyState, { minHeight: 200, justifyContent: 'center' }]}>
                      <Text style={styles.sheetEmptyText}>
                        {feeComponents.length === 0 
                          ? 'No fee components available' 
                          : `No components match "${componentSearchQuery}"`}
                      </Text>
                    </View>
                  );
                }

                return filteredComponents.map((c: any) => {
                  // Check if component is fully paid
                  const componentBalance = componentBalances?.get(c.id);
                  const isPaid = componentBalance && componentBalance.remaining <= 0 && componentBalance.due > 0;

                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.sheetItem,
                        selectedComponentId === c.id && styles.sheetItemActive,
                        isPaid && styles.sheetItemPaid
                      ]}
                      onPress={() => {
                        if (!isPaid) {
                          setSelectedComponentId(c.id);
                          setShowComponentSelector(false);
                          setComponentSearchQuery(''); // Clear search when selecting
                        }
                      }}
                      disabled={isPaid}
                    >
                      <Text style={[
                        styles.sheetItemText,
                        selectedComponentId === c.id && styles.sheetItemTextActive,
                        isPaid && styles.sheetItemTextPaid
                      ]}>
                        {c.name}
                      </Text>
                      {selectedComponentId === c.id && <Text style={styles.checkmark}>✓</Text>}
                      {isPaid && (
                        <Text style={styles.sheetItemPaidBadge}>Paid</Text>
                      )}
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean, shadows: Shadows) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  headerRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headlineCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    ...shadows.xs,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headlineEdge: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.primary[500],
    borderRadius: 2,
    marginRight: spacing.md,
  },
  headlineTitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  headlineSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  headlineAmountWrap: {
    alignItems: 'flex-end',
  },
  headlineContentCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headlineAmount: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
    color: colors.primary[700],
  },
  headlineLabel: { display: 'none' as any },
  headlineSubLabel: { display: 'none' as any },
  toggleRow: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  toggleText: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: colors.primary[700],
  },
  filterSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    elevation: 2,
    shadowColor: isDark ? colors.neutral[900] : colors.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 4,
  },
  filterItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  filterContent: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  filterValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
  },
  filterDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  totalCollected: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  tableHeader: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    ...shadows.xs,
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    elevation: 0,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  filterIconButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // filterLabel used above for value row
  datePickerSm: {
    height: 36,
  },
  methodRow: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  methodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  methodChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  methodChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  methodChipTextActive: {
    color: colors.primary[700],
    fontWeight: '600',
  },
  methodPicker: {
    height: 36,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  methodPickerText: {
    color: colors.text.primary,
  },
  clearBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.error[50],
    borderRadius: borderRadius.full,
    marginLeft: 'auto',
  },
  clearBtnText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModalContainer: {
    backgroundColor: colors.surface.primary,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    width: '90%',
    maxHeight: '70%',
  },
  dropdownModalTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  dropdownList: {
    marginBottom: spacing.sm,
  },
  dropdownItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.DEFAULT,
  },
  dropdownItemSelected: {
    backgroundColor: colors.primary[50],
  },
  dropdownItemText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  dropdownItemTextSelected: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  dropdownCloseButton: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.full,
  },
  // Bottom Sheet (Task Management style)
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
    minHeight: 400,
    height: '70%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border.DEFAULT,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: colors.text.primary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    flex: 1,
    minHeight: 300,
  },
  sheetSearchContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheetSearchInputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    padding: 0,
  },
  sheetSearchClear: {
    padding: spacing.xs,
  },
  sheetEmptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center' as const,
  },
  sheetEmptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center' as const,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: 2,
    backgroundColor: colors.surface.secondary,
  },
  sheetItemActive: {
    backgroundColor: isDark ? colors.primary[900] : colors.primary[50],
  },
  sheetItemPaid: {
    backgroundColor: colors.neutral[50],
    opacity: 0.6,
  },
  sheetItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  sheetItemTextActive: {
    color: colors.primary[600],
  },
  sheetItemTextPaid: {
    color: colors.text.tertiary,
  },
  sheetItemPaidBadge: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    fontWeight: '600',
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
  },
  checkmark: {
    fontSize: typography.fontSize.lg,
    color: colors.primary[600],
    fontWeight: '700',
  },
  studentPaymentCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  studentPaymentCardHeader: {
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  studentPaymentCardInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  studentPaymentCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  studentPaymentCardName: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  studentPaymentCardCode: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  studentPaymentCardAmounts: {
    alignItems: 'flex-end',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  amountLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  amountPaidText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.success[600],
  },
  amountPendingText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  amountPendingTextDanger: {
    color: colors.error[600],
  },
  expandIcon: {
    marginLeft: spacing.xs,
  },
  detailsModalOverlay: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  detailsModalContent: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    width: '95%',
    maxHeight: '90%',
    ...shadows.lg,
  },
  detailsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  detailsModalHeaderInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  detailsModalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  detailsModalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  detailsModalCloseButton: {
    padding: spacing.xs,
  },
  detailsModalBody: {
    maxHeight: 600,
  },
  detailsModalContentContainer: {
    padding: spacing.lg,
  },
  detailsModalEmpty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  detailsModalEmptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  studentPaymentDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.lg,
  },
  studentPaymentDetailsScroll: {
    flexGrow: 0,
  },
  studentPaymentDetailsContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  studentPaymentDetailsEmpty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  studentPaymentDetailsEmptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  paymentDetailsContainer: {
    width: '100%',
  },
  paymentDetailsList: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
    overflow: 'hidden',
  },
  studentPaymentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    width: '100%',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  studentPaymentDetailIndex: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.text.tertiary,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    flexShrink: 0,
  },
  studentPaymentDetailAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.success[600],
    flexShrink: 0,
  },
  studentPaymentDetailBadge: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    flexShrink: 0,
  },
  studentPaymentDetailBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: colors.surface.primary,
    textTransform: 'uppercase' as const,
  },
  studentPaymentDetailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: '400',
    flexShrink: 0,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.md,
  },
  paymentTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  paymentTotalLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  paymentTotalAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: colors.success[600],
  },
  datePickerModal: {
    backgroundColor: colors.surface.primary,
    padding: spacing.lg,
    margin: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  datePickerContainer: {
    alignItems: 'center',
  },
  datePickerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  datePickerActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    width: '100%',
  },
  datePickerButton: {
    flex: 1,
  },
  th: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  alignLeft: { textAlign: 'left' as const },
  alignRight: { textAlign: 'right' as const },
  alignCenter: { textAlign: 'center' as const },
  tableRow: {
    flexDirection: 'row' as const,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.surface.primary,
  },
  tableRowAlt: {
    backgroundColor: colors.background.secondary,
  },
  colName: {
    flex: 2,
    paddingRight: spacing.sm,
    minWidth: 100,
  },
  colAmount: {
    flex: 1.2,
    paddingRight: spacing.sm,
    minWidth: 90,
    alignItems: 'flex-end' as const,
  },
  colDate: {
    flex: 1.3,
    paddingRight: spacing.sm,
    minWidth: 90,
  },
  colCollectedBy: {
    flex: 1.3,
    paddingRight: spacing.sm,
    minWidth: 90,
  },
  row: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    ...shadows.xs,
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 64,
    alignItems: 'flex-start',
  },
  rowAlt: {
    backgroundColor: colors.background.secondary,
  },
  td: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: '400',
  },
  tdMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: '400',
  },
  amountText: {
    fontWeight: '600' as const,
    color: colors.success[600],
  },
  colStudent: { flex: 2.5, minWidth: 100, paddingRight: spacing.xs },
  colComponent: { flex: 1.8, minWidth: 90, paddingRight: spacing.xs },
  colMethod: { flex: 0.8, minWidth: 60, justifyContent: 'center', alignItems: 'center' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
    paddingHorizontal: spacing.xl,
    minHeight: 400,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: spacing.xl,
    maxWidth: 320,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border.DEFAULT,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  // Record Fee Form Styles
  recordScrollView: {
    flex: 1,
  },
  recordFormContainer: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  recordFormGroup: {
    marginBottom: spacing.md,
  },
  recordLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  recordSelect: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  recordSelectEmpty: {
    borderColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  recordSelectText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.text.primary,
    flex: 1,
  },
  recordSelectTextEmpty: {
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.normal as any,
  },
  recordAmountInputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  recordCurrencySymbol: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  recordAmountInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  recordMethodContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  recordMethodOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    minWidth: 80,
  },
  recordMethodOptionSelected: {
    backgroundColor: colors.primary[100],
    borderColor: colors.primary[600],
  },
  recordMethodText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.text.primary,
    textAlign: 'center' as const,
  },
  recordMethodTextSelected: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold as any,
  },
  recordTextInput: {
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 48,
  },
  recordTextArea: {
    minHeight: 100,
    textAlignVertical: 'top' as const,
  },
  recordSubmitButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  // Fee Balance Card Styles
  feeBalanceCard: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    ...shadows.sm,
  },
  feeBalanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  feeBalanceTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.primary[700],
  },
  feeBalanceLoading: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  feeBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  feeBalanceRowLast: {
    borderTopWidth: 1,
    borderTopColor: colors.primary[200],
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  feeBalanceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium as any,
  },
  feeBalanceValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
  },
  feeBalancePaid: {
    color: colors.success[600],
  },
  feeBalanceRemaining: {
    color: colors.error[600],
  },
  feeBalanceComplete: {
    color: colors.success[600],
  },
  feeBalanceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.success[200],
  },
  feeBalanceWarningText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium as any,
  },
  feeBalanceNoPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  feeBalanceNoPlanText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium as any,
  },
  feeBalanceDivider: {
    height: 1,
    backgroundColor: colors.primary[200],
    marginVertical: spacing.sm,
  },
  feeBalanceComponentTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.primary[700],
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  // Record Form Enhanced Styles
  recordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  recordMaxAmount: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold as any,
  },
  recordAmountInputError: {
    borderColor: colors.error[400],
    backgroundColor: colors.error[50],
    borderWidth: 2,
  },
  recordAmountError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  recordAmountErrorText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    fontWeight: typography.fontWeight.medium as any,
  },
  recordAmountHint: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  recordAmountHintText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium as any,
  },
  paymentActions: {
    flexDirection: 'row' as const,
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  paymentActionButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  paymentActionDelete: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[200],
  },
  editPaymentModalOverlay: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  editPaymentModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  editPaymentModalContent: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    width: '95%',
    maxHeight: '90%',
    ...shadows.lg,
  },
  editPaymentModalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  editPaymentModalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
  },
  editPaymentModalCloseButton: {
    padding: spacing.xs,
  },
  editPaymentModalBody: {
    maxHeight: 500,
    padding: spacing.lg,
  },
  editPaymentModalFooter: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  editPaymentSaveButton: {
    minWidth: 120,
  },
});


