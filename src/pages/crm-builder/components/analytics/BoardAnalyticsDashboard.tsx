import { useCRMBoardAnalytics } from '../../hooks/useCRMBoardAnalytics';
import { BoardSummaryCards } from './BoardSummaryCards';
import { PipelineFunnelChart } from './PipelineFunnelChart';
import { PipelineAvgTimeChart } from './PipelineAvgTimeChart';
import { DealsValueDistribution } from './DealsValueDistribution';
import type { CRMDeal, CRMPipeline } from '../../types';

interface BoardAnalyticsDashboardProps {
  deals: CRMDeal[];
  pipelines: CRMPipeline[];
}

export function BoardAnalyticsDashboard({ deals, pipelines }: BoardAnalyticsDashboardProps) {
  const analytics = useCRMBoardAnalytics({ deals, pipelines });

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <BoardSummaryCards analytics={analytics} />
      
      {/* Funnel Chart */}
      <PipelineFunnelChart data={analytics.funnelData} />
      
      {/* Average Time Chart */}
      <PipelineAvgTimeChart data={analytics.pipelineStats} />
      
      {/* Value Distribution */}
      <DealsValueDistribution data={analytics.pipelineStats} />
    </div>
  );
}
