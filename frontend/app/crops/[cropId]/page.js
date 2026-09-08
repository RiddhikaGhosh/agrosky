'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { cropsApi } from '@/lib/api/crops';
import { riskApi } from '@/lib/api/risk';
import {
  Sprout,
  Calendar,
  Layers,
  Activity,
  Scan,
  ShieldAlert,
  FileText,
  Edit,
  Trash2,
  ArrowLeft,
  Eye,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export async function generateStaticParams() {
  return [];
}

export default function CropDetailPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const cropId = params.cropId;
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [crop, setCrop] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [scans, setScans] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const loadCropData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Crop details
      const cropRes = await cropsApi.getCropById(cropId);
      const cropObj = cropRes.data?.crop || cropRes.data || cropRes;
      setCrop(cropObj);

      // 2. Fetch Risk data & scan history
      const [riskRes, historyRes] = await Promise.allSettled([
        riskApi.getCropRisk(cropId),
        cropsApi.getCropAnalysisHistory(cropId, { limit: 5 }),
      ]);

      if (riskRes.status === 'fulfilled') {
        setRiskData(riskRes.value.data || riskRes.value.risk || riskRes.value);
      }
      if (historyRes.status === 'fulfilled') {
        const scRaw = historyRes.value.data?.items || historyRes.value.data?.history || historyRes.value.analyses || historyRes.value.data?.analyses || historyRes.value.data;
        setScans(Array.isArray(scRaw) ? scRaw : []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch crop details from backend server.');
    } finally {
      setIsLoading(false);
    }
  }, [cropId]);

  useEffect(() => {
    loadCropData();
  }, [loadCropData]);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await cropsApi.deleteCrop(cropId);
      showSuccess(`Crop "${crop?.crop_name || crop?.name}" deleted.`);
      router.push('/farms');
    } catch (err) {
      showError(err.message || 'Failed to delete crop');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto">
          <Skeleton variant="card" height="120px" />
          <Skeleton variant="card" height="240px" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !crop) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto">
          <PageHeader title="Crop Record Details" breadcrumbs={['Dashboard', 'Crops', 'Details']} />
          <ErrorState title="Crop Record Not Found" message={error || 'The requested crop record does not exist or has been removed.'} onRetry={loadCropData} />
        </div>
      </DashboardLayout>
    );
  }

  const latestScan = Array.isArray(scans) && scans.length > 0 ? scans[0] : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader
          title={crop.crop_name || crop.name}
          subtitle={`Variety: ${crop.crop_variety || crop.variety || 'Standard'} • Status: ${(crop.status || 'Active').toUpperCase()}`}
          icon={<Sprout className="w-6 h-6 text-emerald-400" />}
          breadcrumbs={['Dashboard', 'Crops', crop.crop_name || crop.name]}
          action={
            <div className="flex items-center gap-2">
              <Link href="/farms">
                <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Back to Farms
                </Button>
              </Link>
              <Link href={`/crops/${cropId}/edit`}>
                <Button variant="outline" size="sm" leftIcon={<Edit className="w-4 h-4" />}>
                  Edit Crop
                </Button>
              </Link>
              <Button variant="danger" size="sm" onClick={() => setIsConfirmDeleteOpen(true)} leftIcon={<Trash2 className="w-4 h-4" />}>
                Delete
              </Button>
            </div>
          }
        />

        {/* Action Buttons Toolbar */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Crop Actions:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/analysis?crop_id=${cropId}`}>
              <Button size="sm" variant="primary" leftIcon={<Scan className="w-3.5 h-3.5" />}>
                Analyze Crop
              </Button>
            </Link>
            <Link href="/risk">
              <Button size="sm" variant="secondary" leftIcon={<Activity className="w-3.5 h-3.5" />}>
                View Risk
              </Button>
            </Link>
            <Link href="/recommendations">
              <Button size="sm" variant="secondary" leftIcon={<ShieldAlert className="w-3.5 h-3.5" />}>
                View Recommendations
              </Button>
            </Link>
            <Link href="/reports">
              <Button size="sm" variant="outline" leftIcon={<FileText className="w-3.5 h-3.5" />}>
                Generate Report
              </Button>
            </Link>
          </div>
        </div>

        {/* Crop Information Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <span className="text-[10px] text-slate-400">Crop Identifier</span>
            <p className="text-base font-bold text-slate-100 mt-0.5">{crop.crop_name || crop.name}</p>
          </Card>
          <Card className="p-4 text-center">
            <span className="text-[10px] text-slate-400">Variety / Hybrid</span>
            <p className="text-base font-bold text-emerald-400 mt-0.5">{crop.crop_variety || crop.variety || 'Standard'}</p>
          </Card>
          <Card className="p-4 text-center">
            <span className="text-[10px] text-slate-400">Sowing / Planting Date</span>
            <p className="text-base font-bold text-sky-400 mt-0.5">
              {crop.sowing_date || crop.planting_date ? new Date(crop.sowing_date || crop.planting_date).toLocaleDateString() : 'N/A'}
            </p>
          </Card>
          <Card className="p-4 text-center">
            <span className="text-[10px] text-slate-400">Status</span>
            <p className="text-base font-bold text-amber-400 mt-0.5 capitalize">{crop.status || 'Active'}</p>
          </Card>
        </div>

        {/* Crop Health Status & Risk Double Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Latest AI Disease Diagnosis */}
          <Card glow className="lg:col-span-6 space-y-4">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scan className="w-5 h-5 text-emerald-400" />
                  Latest AI Disease Diagnosis
                </CardTitle>
                <CardDescription>Most recent plant leaf scan result</CardDescription>
              </div>
              {latestScan && (
                <Badge variant={latestScan.severity === 'high' ? 'critical' : 'success'}>
                  {(latestScan.severity || 'low').toUpperCase()}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {latestScan ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <h4 className="text-sm font-bold text-slate-100 flex items-center justify-between">
                      <span>{latestScan.disease || latestScan.diseaseName || latestScan.disease_name || latestScan.diagnosis || 'Healthy Leaf'}</span>
                      {(latestScan.confidence || latestScan.confidence_score) && (
                        <span className="text-xs font-normal text-emerald-400">
                          {latestScan.confidence || latestScan.confidence_score}% confidence
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Scanned on {new Date(latestScan.date || latestScan.created_at || Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                  <Link href={`/analysis/${latestScan.analysisId || latestScan.id || latestScan.analysis_id}`}>
                    <Button size="sm" variant="outline" className="w-full" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                      Inspect Full Analysis Report
                    </Button>
                  </Link>
                </div>
              ) : (
                <EmptyState
                  title="No Scans Executed"
                  description="Run an AI leaf diagnostic scan to detect potential disease pathogens."
                  actionLabel="Start Crop Scan"
                  onAction={() => router.push(`/analysis?crop_id=${cropId}`)}
                />
              )}
            </CardContent>
          </Card>

          {/* Crop Deterministic Risk Score */}
          <Card glow className="lg:col-span-6 space-y-4">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-5 h-5 text-rose-400" />
                  Crop Risk Assessment
                </CardTitle>
                <CardDescription>Calculated 0–100 deterministic risk index</CardDescription>
              </div>
              <Badge variant={riskData?.riskLevel || riskData?.risk_level || 'low'}>
                {(riskData?.riskLevel || riskData?.risk_level || 'Low Threat').toUpperCase()}
              </Badge>
            </CardHeader>
            <CardContent>
              {riskData ? (
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div>
                    <span className="text-xs text-slate-400">Crop Risk Score</span>
                    <div className="text-3xl font-extrabold text-rose-400 mt-0.5">
                      {riskData.riskScore ?? riskData.risk_score ?? 0} / 100
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-full border-4 border-rose-500/40 flex items-center justify-center bg-rose-950/30 text-rose-400 font-bold text-sm">
                    {riskData.riskScore ?? riskData.risk_score ?? 0}%
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-2">No specific risk metrics calculated for this crop yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Health Timeline & Scan History */}
        <Card className="space-y-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Crop Health Scan Timeline ({Array.isArray(scans) ? scans.length : 0})</CardTitle>
            <CardDescription>Historical AI diagnostic logs for this crop planting</CardDescription>
          </CardHeader>
          <CardContent>
            {Array.isArray(scans) && scans.length > 0 ? (
              <div className="divide-y divide-slate-800">
                {scans.map((s, idx) => (
                  <div key={s.id || s.analysisId || idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400">
                        <Scan className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-100">{s.disease || s.diseaseName || s.disease_name || s.diagnosis || 'Healthy Crop'}</h5>
                        <span className="text-slate-400 text-[11px]">
                          Scanned on {new Date(s.date || s.created_at || Date.now()).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={s.severity === 'high' ? 'critical' : 'success'}>{(s.severity || 'low').toUpperCase()}</Badge>
                      <Link href={`/analysis/${s.analysisId || s.id || s.analysis_id}`}>
                        <Button size="sm" variant="ghost" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                          Inspect
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-2">No historical scan logs registered for this crop.</p>
            )}
          </CardContent>
        </Card>

        {/* CONFIRM DELETE DIALOG */}
        <ConfirmDialog
          isOpen={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Crop Planting Record"
          message={`Are you sure you want to delete crop "${crop.crop_name || crop.name}"? This action cannot be undone.`}
          confirmText="Delete Crop"
          isDanger
          isLoading={isDeleting}
        />
      </div>
    </DashboardLayout>
  );
}
