/**
 * useAIAnalytics Hook
 * 
 * Provides analytics data for AI question generation usage.
 * Used in admin dashboards to track usage, costs, and performance.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface AIUsageStats {
    totalGenerations: number;
    successfulGenerations: number;
    failedGenerations: number;
    successRate: number;
    totalQuestions: number;
    averageDurationMs: number;
    estimatedCostUsd: number;
    uniqueUsers: number;
}

export interface AIUserUsage {
    userId: string;
    userName?: string;
    generations: number;
    questionsGenerated: number;
    successRate: number;
    lastUsed: string;
}

export interface AIUsageLimits {
    generationsToday: number;
    generationsThisMonth: number;
    dailyLimit: number;
    monthlyLimit: number;
    dailyRemaining: number;
    monthlyRemaining: number;
    lastGenerationAt: string | null;
}

/**
 * Get AI usage statistics for a school
 * 
 * @param schoolCode - School code to fetch analytics for
 * @param period - Time period ('day', 'week', 'month')
 */
export function useAIAnalytics(schoolCode: string, period: 'day' | 'week' | 'month' = 'month') {
    return useQuery({
        queryKey: ['ai-analytics', schoolCode, period],
        queryFn: async (): Promise<AIUsageStats> => {
            // Calculate start date based on period
            const now = new Date();
            let startDate: Date;

            switch (period) {
                case 'day':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
            }

            const { data, error } = await supabase
                .from('ai_generation_logs')
                .select('*')
                .eq('school_code', schoolCode)
                .gte('created_at', startDate.toISOString());

            if (error) {
                throw new Error(`Failed to fetch AI analytics: ${error.message}`);
            }

            if (!data || data.length === 0) {
                return {
                    totalGenerations: 0,
                    successfulGenerations: 0,
                    failedGenerations: 0,
                    successRate: 0,
                    totalQuestions: 0,
                    averageDurationMs: 0,
                    estimatedCostUsd: 0,
                    uniqueUsers: 0,
                };
            }

            const totalGenerations = data.length;
            const successfulGenerations = data.filter(d => d.success).length;
            const failedGenerations = totalGenerations - successfulGenerations;
            const successRate = totalGenerations > 0 ? (successfulGenerations / totalGenerations) * 100 : 0;
            const totalQuestions = data.reduce((sum, d) => sum + (d.questions_generated || 0), 0);
            const totalDuration = data.reduce((sum, d) => sum + (d.duration_ms || 0), 0);
            const averageDurationMs = totalGenerations > 0 ? Math.round(totalDuration / totalGenerations) : 0;
            const estimatedCostUsd = data.reduce((sum, d) => sum + parseFloat(d.estimated_cost_usd || '0'), 0);
            const uniqueUsers = new Set(data.map(d => d.user_id)).size;

            return {
                totalGenerations,
                successfulGenerations,
                failedGenerations,
                successRate: Math.round(successRate * 10) / 10,
                totalQuestions,
                averageDurationMs,
                estimatedCostUsd: Math.round(estimatedCostUsd * 1000) / 1000,
                uniqueUsers,
            };
        },
        enabled: !!schoolCode,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Get top AI users by usage for a school
 * 
 * @param schoolCode - School code to fetch data for
 * @param limit - Maximum number of users to return
 */
export function useAITopUsers(schoolCode: string, limit: number = 10) {
    return useQuery({
        queryKey: ['ai-top-users', schoolCode, limit],
        queryFn: async (): Promise<AIUserUsage[]> => {
            // Get logs from current month
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const { data, error } = await supabase
                .from('ai_generation_logs')
                .select(`
          user_id,
          questions_generated,
          success,
          created_at
        `)
                .eq('school_code', schoolCode)
                .gte('created_at', startOfMonth.toISOString());

            if (error) {
                throw new Error(`Failed to fetch AI top users: ${error.message}`);
            }

            if (!data || data.length === 0) {
                return [];
            }

            // Group by user
            const userMap = new Map<string, {
                generations: number;
                successful: number;
                questions: number;
                lastUsed: string;
            }>();

            for (const log of data) {
                const existing = userMap.get(log.user_id) || {
                    generations: 0,
                    successful: 0,
                    questions: 0,
                    lastUsed: log.created_at,
                };

                existing.generations++;
                if (log.success) existing.successful++;
                existing.questions += log.questions_generated || 0;
                if (log.created_at > existing.lastUsed) {
                    existing.lastUsed = log.created_at;
                }

                userMap.set(log.user_id, existing);
            }

            // Convert to array and sort by generations
            const users: AIUserUsage[] = Array.from(userMap.entries())
                .map(([userId, stats]) => ({
                    userId,
                    generations: stats.generations,
                    questionsGenerated: stats.questions,
                    successRate: stats.generations > 0
                        ? Math.round((stats.successful / stats.generations) * 100)
                        : 0,
                    lastUsed: stats.lastUsed,
                }))
                .sort((a, b) => b.generations - a.generations)
                .slice(0, limit);

            return users;
        },
        enabled: !!schoolCode,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Get current user's AI usage limits
 */
export function useMyAILimits() {
    return useQuery({
        queryKey: ['my-ai-limits'],
        queryFn: async (): Promise<AIUsageLimits | null> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('ai_usage_limits')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                // PGRST116 = no rows found (user hasn't used AI yet)
                throw new Error(`Failed to fetch AI limits: ${error.message}`);
            }

            if (!data) {
                // No usage yet, return defaults
                return {
                    generationsToday: 0,
                    generationsThisMonth: 0,
                    dailyLimit: 10,
                    monthlyLimit: 100,
                    dailyRemaining: 10,
                    monthlyRemaining: 100,
                    lastGenerationAt: null,
                };
            }

            return {
                generationsToday: data.generations_today || 0,
                generationsThisMonth: data.generations_this_month || 0,
                dailyLimit: data.daily_limit || 10,
                monthlyLimit: data.monthly_limit || 100,
                dailyRemaining: (data.daily_limit || 10) - (data.generations_today || 0),
                monthlyRemaining: (data.monthly_limit || 100) - (data.generations_this_month || 0),
                lastGenerationAt: data.last_generation_at,
            };
        },
        staleTime: 30 * 1000, // 30 seconds (refresh more often for rate limits)
    });
}

/**
 * Get recent AI generation logs for current user
 * 
 * @param limit - Maximum number of logs to return
 */
export function useMyAILogs(limit: number = 20) {
    return useQuery({
        queryKey: ['my-ai-logs', limit],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from('ai_generation_logs')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                throw new Error(`Failed to fetch AI logs: ${error.message}`);
            }

            return data || [];
        },
        staleTime: 30 * 1000, // 30 seconds
    });
}
