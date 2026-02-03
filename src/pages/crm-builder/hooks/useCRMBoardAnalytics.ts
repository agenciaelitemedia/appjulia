import { useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import type { CRMDeal, CRMPipeline, DealStatus, DealPriority } from '../types';

export interface PipelineStats {
  id: string;
  name: string;
  color: string;
  position: number;
  count: number;
  value: number;
  percentage: number;
  avgDays: number;
}

export interface BoardAnalytics {
  // Summary
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  archivedDeals: number;
  
  // Values
  totalValue: number;
  openValue: number;
  wonValue: number;
  
  // Rates
  conversionRate: number; // won / (won + lost) * 100
  avgTimeInPipeline: number; // days
  
  // Pipeline distribution
  pipelineStats: PipelineStats[];
  
  // Funnel data (sorted by position)
  funnelData: PipelineStats[];
}

interface UseCRMBoardAnalyticsParams {
  deals: CRMDeal[];
  pipelines: CRMPipeline[];
}

export function useCRMBoardAnalytics({ deals, pipelines }: UseCRMBoardAnalyticsParams): BoardAnalytics {
  return useMemo(() => {
    const now = new Date();
    
    // Count by status
    const openDeals = deals.filter(d => d.status === 'open');
    const wonDeals = deals.filter(d => d.status === 'won');
    const lostDeals = deals.filter(d => d.status === 'lost');
    const archivedDeals = deals.filter(d => d.status === 'archived');
    
    // Calculate values
    const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    const openValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const wonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    
    // Conversion rate
    const finalized = wonDeals.length + lostDeals.length;
    const conversionRate = finalized > 0 ? (wonDeals.length / finalized) * 100 : 0;
    
    // Average time in current pipeline (for open deals)
    const avgTimeInPipeline = openDeals.length > 0
      ? openDeals.reduce((sum, d) => {
          const enteredAt = new Date(d.stage_entered_at);
          return sum + differenceInDays(now, enteredAt);
        }, 0) / openDeals.length
      : 0;
    
    // Pipeline stats
    const pipelineStats: PipelineStats[] = pipelines
      .filter(p => p.is_active)
      .sort((a, b) => a.position - b.position)
      .map(pipeline => {
        const pipelineDeals = deals.filter(d => d.pipeline_id === pipeline.id);
        const pipelineOpenDeals = pipelineDeals.filter(d => d.status === 'open');
        
        // Average days in this pipeline
        const avgDays = pipelineOpenDeals.length > 0
          ? pipelineOpenDeals.reduce((sum, d) => {
              const enteredAt = new Date(d.stage_entered_at);
              return sum + differenceInDays(now, enteredAt);
            }, 0) / pipelineOpenDeals.length
          : 0;
        
        return {
          id: pipeline.id,
          name: pipeline.name,
          color: pipeline.color,
          position: pipeline.position,
          count: pipelineDeals.length,
          value: pipelineDeals.reduce((sum, d) => sum + (d.value || 0), 0),
          percentage: deals.length > 0 ? (pipelineDeals.length / deals.length) * 100 : 0,
          avgDays: Math.round(avgDays * 10) / 10,
        };
      });
    
    // Funnel data (same as pipeline stats but used for funnel visualization)
    const funnelData = [...pipelineStats];
    
    return {
      totalDeals: deals.length,
      openDeals: openDeals.length,
      wonDeals: wonDeals.length,
      lostDeals: lostDeals.length,
      archivedDeals: archivedDeals.length,
      totalValue,
      openValue,
      wonValue,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgTimeInPipeline: Math.round(avgTimeInPipeline * 10) / 10,
      pipelineStats,
      funnelData,
    };
  }, [deals, pipelines]);
}
