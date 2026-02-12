import React, { useState , useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, TouchableOpacity, TextInput, StyleSheet, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { spacing, borderRadius, typography, shadows, colors } from '../../../lib/design-system';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}: PaginationProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const [goToPageInput, setGoToPageInput] = useState('');
  
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        // Show first 5 pages
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Show last 5 pages
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show pages around current page
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const handleGoToPage = () => {
    const page = parseInt(goToPageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
      setGoToPageInput('');
    }
  };

  if (totalPages <= 1) {
    return (
      <View style={styles.container}>
        <Text style={styles.summary}>
          {startItem}-{endItem} of {totalItems} students
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <Text style={styles.summary}>
          {startItem}-{endItem} of {totalItems} students
        </Text>
      </View>
      
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={[styles.arrowButton, currentPage === 1 && styles.arrowButtonDisabled]}
        >
          <MaterialIcons 
            name="chevron-left" 
            size={20} 
            color={currentPage === 1 ? colors.text.tertiary : colors.text.primary} 
          />
        </TouchableOpacity>
        
        <View style={styles.pageNumbers}>
          {getPageNumbers().map((page, idx) => (
            page === '...' ? (
              <Text key={`ellipsis-${idx}`} style={styles.ellipsis}>...</Text>
            ) : (
              <TouchableOpacity
                key={page}
                onPress={() => onPageChange(page as number)}
                style={[
                  styles.pageButton,
                  currentPage === page && styles.pageButtonActive
                ]}
              >
                <Text style={[
                  styles.pageButtonText,
                  currentPage === page && styles.pageButtonTextActive
                ]}>
                  {page}
                </Text>
              </TouchableOpacity>
            )
          ))}
        </View>
        
        <TouchableOpacity
          onPress={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={[styles.arrowButton, currentPage === totalPages && styles.arrowButtonDisabled]}
        >
          <MaterialIcons 
            name="chevron-right" 
            size={20} 
            color={currentPage === totalPages ? colors.text.tertiary : colors.text.primary} 
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.footerControls}>
        {onItemsPerPageChange && (
          <View style={styles.itemsPerPageContainer}>
            <Text style={styles.itemsPerPageLabel}>{itemsPerPage} / page</Text>
          </View>
        )}
        
        <View style={styles.goToContainer}>
          <Text style={styles.goToLabel}>Go to</Text>
          <TextInput
            style={styles.goToInput}
            value={goToPageInput}
            onChangeText={setGoToPageInput}
            keyboardType="numeric"
            placeholder="Page"
            placeholderTextColor={colors.text.tertiary}
            onSubmitEditing={handleGoToPage}
            returnKeyType="go"
          />
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  summaryRow: {
    marginBottom: spacing.md,
  },
  summary: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  pageNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  arrowButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  arrowButtonDisabled: {
    opacity: 0.5,
  },
  pageButton: {
    minWidth: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.surface.primary,
  },
  pageButtonActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
    ...shadows.sm,
  },
  pageButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  pageButtonTextActive: {
    color: colors.text.inverse,
    fontWeight: typography.fontWeight.semibold,
  },
  ellipsis: {
    paddingHorizontal: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  footerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  itemsPerPageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemsPerPageLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  goToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  goToLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  goToInput: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 60,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    backgroundColor: colors.surface.primary,
  },
});


