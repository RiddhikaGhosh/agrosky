'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { farmsApi } from '@/lib/api/farms';
import { riskApi } from '@/lib/api/risk';
import { Activity, Brain, CloudSun, MapPin, ArrowLeft } from 'lucide-react';

export async function generateStaticParams() {
  return [];
}

export default function FarmRiskPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const farmId = params.farmId;

  const [farm, setFarm] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFarmRisk = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [farmRes, riskRes] = await Promise.all([
        farmsApi.getFarmById(farmId),
        riskApi.getFarmRisk(farmId),
      ]);

      setFarm(farmRes.data?.farm || farmRes.data || farmRes);
      setRiskData(riskRes.data?.risk || riskRes.data || riskRes);
    } catch (err) {
      setError(err.message || 'Failed to fetch farm risk metrics from backend.');
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    loadFarmRisk();
  }, [loadFarmRisk]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto">
          <Skeleton variant="card" height="240px" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !riskData) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto">
          <PageHeader title="Field Risk Assessment" breadcrumbs={['Dashboard', 'Farms', 'Risk']} />
          <ErrorState title="Risk Metrics Unavailable" message={error || 'Unable to compute risk score.'} onRetry={loadFarmRisk} />
        </div>
      </DashboardLayout>
    );
  }

  const farmDisplayName = farm?.farm_name || farm?.name || 'Farm Field';
  const scoreVal = riskData.averageRiskScore ?? riskData.risk_score ?? riskData.riskScore ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader
          title={`Risk Matrix: ${farmDisplayName}`}
          subtitle={`Location: ${farm?.location || 'Central Region'} • Authoritative Risk Score: ${scoreVal}/100`}
          icon={<Activity className="w-6 h-6 text-rose-400" />}
          breadcrumbs={['Dashboard', 'Farms', farmDisplayName, 'Risk']}
          action={
            <Link href={`/farms/${farmId}`}>
              <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Farm Details
              </Button>
            </Link>
          }
        />

        <Card glow className="p-6 space-y-6 border-rose-500/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <Badge variant={scoreVal >= 67 ? 'critical' : scoreVal >= 34 ? 'warning' : 'low'} size="lg" className="mb-2">
                {scoreVal >= 67 ? 'HIGH RISK' : scoreVal >= 34 ? 'MEDIUM RISK' : 'LOW RISK'}
              </Badge>
              <h2 className="text-xl font-bold text-slate-100">{farmDisplayName} Calculated Risk Index</h2>
            </div>
            <div className="text-3xl font-extrabold text-rose-400">{scoreVal} / 100</div>
          </div>
        </Card>

        {/* Crops risk list if available */}
        {Array.isArray(riskData.cropRisks) && riskData.cropRisks.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">Crop Plantings Risk Assessment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {riskData.cropRisks.map((cr, idx) => (
                <Card key={idx} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100">{cr.cropName || `Crop #${idx + 1}`}</span>
                    <Badge variant={(cr.riskScore ?? 0) >= 67 ? 'critical' : (cr.riskScore ?? 0) >= 34 ? 'warning' : 'low'} size="sm">
                      {(cr.riskLevel || 'LOW').toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-100">{cr.riskScore ?? 0} / 100</div>
                  {Array.isArray(cr.riskFactors) && cr.riskFactors.length > 0 && (
                    <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
                      {cr.riskFactors.map((rf, fIdx) => (
                        <li key={fIdx}>{rf}</li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
