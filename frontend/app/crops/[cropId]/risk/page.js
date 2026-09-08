'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { cropsApi } from '@/lib/api/crops';
import { riskApi } from '@/lib/api/risk';
import { Activity, Sprout, ArrowLeft } from 'lucide-react';

export async function generateStaticParams() {
  return [];
}

export default function CropRiskPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const cropId = params.cropId;

  const [crop, setCrop] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCropRisk = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cropRes, riskRes] = await Promise.all([
        cropsApi.getCropById(cropId),
        riskApi.getCropRisk(cropId),
      ]);

      setCrop(cropRes.data?.crop || cropRes.data || cropRes);
      setRiskData(riskRes.data?.risk || riskRes.data || riskRes);
    } catch (err) {
      setError(err.message || 'Failed to fetch crop risk metrics.');
    } finally {
      setIsLoading(false);
    }
  }, [cropId]);

  useEffect(() => {
    loadCropRisk();
  }, [loadCropRisk]);

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
          <PageHeader title="Crop Risk Assessment" breadcrumbs={['Dashboard', 'Crops', 'Risk']} />
          <ErrorState title="Risk Metrics Unavailable" message={error || 'Unable to compute crop risk.'} onRetry={loadCropRisk} />
        </div>
      </DashboardLayout>
    );
  }

  const cropDisplayName = crop?.crop_name || crop?.name || 'Crop Planting';
  const cropVariety = crop?.crop_variety || crop?.crop_type || 'Crop';
  const scoreVal = riskData.riskScore ?? riskData.risk_score ?? riskData.total_score ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader
          title={`Crop Risk: ${cropDisplayName}`}
          subtitle={`Species/Variety: ${cropVariety} • Authoritative Risk Score: ${scoreVal}/100`}
          icon={<Activity className="w-6 h-6 text-rose-400" />}
          breadcrumbs={['Dashboard', 'Crops', cropDisplayName, 'Risk']}
          action={
            <Link href={`/crops/${cropId}`}>
              <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Crop Details
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
              <h2 className="text-xl font-bold text-slate-100">{cropDisplayName} Risk Index</h2>
            </div>
            <div className="text-3xl font-extrabold text-rose-400">{scoreVal} / 100</div>
          </div>
        </Card>

        {/* Risk factors list */}
        {Array.isArray(riskData.riskFactors) && riskData.riskFactors.length > 0 && (
          <Card className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">Identified Risk Factors</h3>
            <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4">
              {riskData.riskFactors.map((rf, fIdx) => (
                <li key={fIdx} className="leading-relaxed">{rf}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
