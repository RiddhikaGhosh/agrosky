'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/context/ToastContext';
import { analysisApi } from '@/lib/api/analysis';
import { reportsApi } from '@/lib/api/reports';
import {
  Brain,
  Scan,
  ShieldAlert,
  CloudSun,
  Activity,
  FileText,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCw,
  Eye,
  PlusCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export async function generateStaticParams() {
  return [];
}

export default function AnalysisDetailPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const analysisId = params.analysisId;
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [scan, setScan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Processing stage animation for live scan simulation
  const [processingStage, setProcessingStage] = useState(0);
  const stages = [
    'Image received',
    'AI analyzing image',
    'Checking agricultural context',
    'Evaluating environmental risk',
    'Preparing recommendation',
  ];

  const loadScanDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setProcessingStage(0);

    // Simulate progress stages
    const timer1 = setTimeout(() => setProcessingStage(1), 300);
    const timer2 = setTimeout(() => setProcessingStage(2), 600);
    const timer3 = setTimeout(() => setProcessingStage(3), 900);
    const timer4 = setTimeout(() => setProcessingStage(4), 1200);

    try {
      const res = await analysisApi.getAnalysisById(analysisId);
      const scanObj = res.data?.analysis || res.data || res;
      setScan(scanObj);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch AI analysis record from backend.');
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      setIsLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    loadScanDetails();
  }, [loadScanDetails]);

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await reportsApi.downloadAnalysisPdfReport(analysisId);
      showSuccess('Agronomic PDF Report downloaded successfully!');
    } catch (err) {
      showError(err.message || 'Failed to download PDF report.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto">
          <Card glow className="p-8 text-center space-y-6">
            <div className="p-4 w-fit mx-auto rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 animate-pulse">
              <Brain className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-100">AI Agricultural Diagnostic Processing</h2>
              <p className="text-xs text-emerald-400 font-medium">Stage: {stages[processingStage] || 'Evaluating...'}</p>
            </div>

            {/* Stage Progress Pills */}
            <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto pt-2">
              {stages.map((stg, idx) => (
                <span
                  key={idx}
                  className={`text-[11px] px-3 py-1 rounded-full border transition-all ${
                    idx <= processingStage
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 font-semibold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-500'
                  }`}
                >
                  {idx + 1}. {stg}
                </span>
              ))}
            </div>

            <Skeleton variant="card" height="200px" />
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !scan) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto">
          <PageHeader title="AI Disease Diagnostic Details" breadcrumbs={['Dashboard', 'AI Scanner', 'Analysis']} />
          <ErrorState title="Analysis Record Unavailable" message={error || 'The requested AI analysis record could not be loaded.'} onRetry={loadScanDetails} />
        </div>
      </DashboardLayout>
    );
  }

  // Confidence Rating Helper
  const getConfidenceBadge = (score) => {
    const val = typeof score === 'number' ? score : parseFloat(score) || 90;
    if (val >= 90) return { label: 'High Confidence', variant: 'low' };
    if (val >= 70) return { label: 'Medium Confidence', variant: 'medium' };
    return { label: 'Low Confidence', variant: 'high' };
  };

  const conf = getConfidenceBadge(scan.confidence_score ?? scan.confidenceScore);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader
          title={`Diagnosis: ${scan.disease_name || scan.diseaseName || scan.diagnosis || 'Healthy Crop'}`}
          subtitle={`Analysis ID: ${analysisId} • Executed: ${new Date(scan.created_at || scan.createdAt || Date.now()).toLocaleDateString()}`}
          icon={<Brain className="w-6 h-6 text-emerald-400" />}
          breadcrumbs={['Dashboard', 'AI Scanner', scan.disease_name || scan.diseaseName || 'Details']}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/analysis/history">
                <Button variant="ghost" size="sm" leftIcon={<Clock className="w-4 h-4" />}>
                  Scan History
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                isLoading={isDownloadingPdf}
                onClick={handleDownloadPdf}
                leftIcon={<FileText className="w-4 h-4" />}
              >
                Generate PDF Report
              </Button>
            </div>
          }
        />

        {/* AI Disclaimer Notice */}
        <Alert type="info" title="AI Agricultural Guidance Notice">
          This diagnosis is generated by Google Gemini AI vision technology. Results serve as agronomic guidance and should be verified with local agricultural extension authorities before applying chemical treatments.
        </Alert>

        {/* 1. MASTER DIAGNOSTIC CARD */}
        <Card glow className="p-6 space-y-6 border-emerald-500/40">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Scanned Image Container */}
            <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center min-h-[260px]">
              {(scan.image_url || scan.original_url || scan.optimized_url) ? (
                <img src={scan.image_url || scan.original_url || scan.optimized_url} alt={scan.disease_name || scan.diseaseName} loading="lazy" decoding="async" className="w-full h-full object-cover max-h-72" />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <Scan className="w-10 h-10 text-emerald-400 mx-auto" />
                  <span className="text-xs text-slate-400">Scanned Leaf Image Asset</span>
                </div>
              )}
            </div>

            {/* Diagnostic Metrics & Pathogen Details */}
            <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-100">{scan.disease_name || scan.diseaseName || 'Crop Pathogen Detected'}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Pathogen: <strong className="text-slate-200">{scan.pathogen_type || 'Crop Pathogen'}</strong>
                    </p>
                  </div>
                  <Badge variant={(scan.severity || 'high') === 'high' ? 'critical' : scan.severity === 'medium' ? 'warning' : 'success'} size="lg">
                    {(scan.severity || 'high').toUpperCase()} SEVERITY
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] text-slate-400">AI Confidence Score</span>
                    <p className="text-lg font-extrabold text-emerald-400">{scan.confidence_score ?? scan.confidenceScore ?? 94.2}%</p>
                    <Badge variant={conf.variant} size="sm" className="mt-1">
                      {conf.label}
                    </Badge>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Pathogen Severity</span>
                    <p className="text-lg font-extrabold text-rose-400 capitalize">{scan.severity || 'High'}</p>
                    <span className="text-[10px] text-slate-400">Visual Lesions</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Computed Risk Score</span>
                    <p className="text-lg font-extrabold text-amber-400">{scan.risk_score ?? scan.riskScore ?? 78} / 100</p>
                    <span className="text-[10px] text-amber-300">Agricultural Risk</span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/weather">
                    <Button size="sm" variant="outline" leftIcon={<CloudSun className="w-3.5 h-3.5" />}>
                      View Weather
                    </Button>
                  </Link>
                  <Link href="/risk">
                    <Button size="sm" variant="outline" leftIcon={<Activity className="w-3.5 h-3.5" />}>
                      View Risk
                    </Button>
                  </Link>
                  <Link href="/recommendations">
                    <Button size="sm" variant="secondary" leftIcon={<ShieldAlert className="w-3.5 h-3.5" />}>
                      View Recommendations
                    </Button>
                  </Link>
                </div>

                <Link href="/analysis">
                  <Button size="sm" variant="primary" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
                    Analyze Another Image
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>

        {/* 2. SYMPTOMS & TREATMENT SECTIONS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Symptoms List */}
          <Card className="space-y-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Identified Symptoms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-2">
                {Array.isArray(scan.symptoms) ? (
                  <ul className="space-y-2 list-disc pl-4">
                    {scan.symptoms.map((sym, idx) => (
                      <li key={idx} className="leading-relaxed">{sym}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="leading-relaxed">{scan.symptoms || 'Water-soaked irregular dark spots on leaves with pale green halos.'}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Treatment Suggestions */}
          <Card className="space-y-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Treatment Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 space-y-2">
                {Array.isArray(scan.treatment_suggestions || scan.treatmentSuggestions) ? (
                  <ul className="space-y-2 list-disc pl-4">
                    {(scan.treatment_suggestions || scan.treatmentSuggestions).map((trt, idx) => (
                      <li key={idx} className="leading-relaxed">{trt}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="leading-relaxed">{scan.treatment_summary || scan.treatment_suggestions || scan.treatmentSuggestions || 'Apply agricultural fungicide in accordance with extension label guidelines.'}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 3. PREVENTATIVE AGRONOMIC STEPS */}
        <Card className="space-y-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Long-Term Agronomic Prevention Steps
            </CardTitle>
            <CardDescription>Preventative cultural and sanitation practices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
              {Array.isArray(scan.prevention_steps || scan.preventionSteps) ? (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(scan.prevention_steps || scan.preventionSteps).map((prev, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{prev}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="leading-relaxed">Rotate crops annually, remove infected plant debris, and ensure adequate spacing for field ventilation.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
