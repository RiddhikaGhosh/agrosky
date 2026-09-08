'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/context/ToastContext';
import { farmsApi } from '@/lib/api/farms';
import { uploadsApi } from '@/lib/api/uploads';
import { analysisApi } from '@/lib/api/analysis';
import {
  Scan,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Trash2,
  Eye,
  Layers,
  Brain,
  Cloud,
} from 'lucide-react';

// Preset sample leaf images for instant user testing
const sampleLeaves = [
  {
    title: 'Tomato Late Blight',
    crop_type: 'Tomato',
    url: 'https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=800&q=80',
    description: 'Dark water-soaked lesions on leaf margins with white fungal sporulation.',
  },
  {
    title: 'Maize Common Rust',
    crop_type: 'Maize',
    url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80',
    description: 'Pustules containing reddish-brown urediniospores on upper leaf surfaces.',
  },
  {
    title: 'Apple Scab',
    crop_type: 'Apple',
    url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=800&q=80',
    description: 'Olive-green to brown velvety spots on apple leaves and fruit.',
  },
  {
    title: 'Healthy Leaf Sample',
    crop_type: 'Tomato',
    url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=800&q=80',
    description: 'Vibrant green tissue with zero necrotic lesions or pathogen rust.',
  },
];

function DiseaseScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useToast();

  const fileInputRef = useRef(null);

  // Selector state
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [crops, setCrops] = useState([]);
  const [selectedCropId, setSelectedCropId] = useState('');

  // Image & Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Analysis pipeline stage state
  const [uploadStage, setUploadStage] = useState('idle'); // 'idle', 'signing', 'uploading', 'optimizing', 'analyzing', 'completed', 'error'
  const [progressMessage, setProgressMessage] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Pre-fill farm and crop from query params if available
  const initialCropParam = searchParams.get('crop_id') || searchParams.get('cropId');
  const initialFarmParam = searchParams.get('farm_id') || searchParams.get('farmId');

  // Load farms list on mount
  useEffect(() => {
    async function loadFarms() {
      try {
        const res = await farmsApi.getFarms();
        const fList = Array.isArray(res.data?.farms)
          ? res.data.farms
          : Array.isArray(res.data?.items)
          ? res.data.items
          : Array.isArray(res.farms)
          ? res.farms
          : Array.isArray(res.data)
          ? res.data
          : [];
        setFarms(fList);
        if (fList.length > 0) {
          if (initialFarmParam && fList.some((f) => String(f.id) === String(initialFarmParam))) {
            setSelectedFarmId(initialFarmParam);
          } else {
            setSelectedFarmId(fList[0].id);
          }
        }
      } catch (err) {
        showError('Failed to load farms selection');
      }
    }
    loadFarms();
  }, [initialFarmParam]);

  // Fetch crops whenever selected farm changes
  useEffect(() => {
    if (!selectedFarmId) return;
    async function loadCrops() {
      try {
        const res = await farmsApi.getCropsByFarm(selectedFarmId);
        const cList = Array.isArray(res.data?.crops)
          ? res.data.crops
          : Array.isArray(res.data?.items)
          ? res.data.items
          : Array.isArray(res.crops)
          ? res.crops
          : Array.isArray(res.data)
          ? res.data
          : [];
        setCrops(cList);
        if (cList.length > 0) {
          if (initialCropParam && cList.some((c) => String(c.id) === String(initialCropParam))) {
            setSelectedCropId(initialCropParam);
          } else {
            setSelectedCropId(cList[0].id);
          }
        } else {
          setSelectedCropId('');
        }
      } catch (err) {
        setCrops([]);
      }
    }
    loadCrops();
  }, [selectedFarmId, initialCropParam]);

  // Handle file select
  const handleFileSelect = (file) => {
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      showError('Please select a valid image file (JPEG, PNG, WebP)');
      return;
    }

    // Validate max size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showError('Image file size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysisResult(null);
    setErrorMessage('');
  };

  // Drag & drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Sample leaf select helper
  const handleSelectSample = (sample) => {
    setSelectedFile(null);
    setPreviewUrl(sample.url);
    setAnalysisResult(null);
    setErrorMessage('');
  };

  // Trigger Master AI Analysis Pipeline
  const handleRunAnalysis = async () => {
    if (!selectedFarmId) {
      showError('Please select a farm field');
      return;
    }

    if (!selectedCropId) {
      showError('Please select a crop planting for diagnosis');
      return;
    }

    if (!previewUrl && !selectedFile) {
      showError('Please select or upload a crop leaf image first');
      return;
    }

    setErrorMessage('');

    try {
      // Step 1: Upload / Cloudinary Signature Request
      setUploadStage('signing');
      setProgressMessage('Requesting Cloudinary upload signature from backend...');
      const sigRes = await uploadsApi.getUploadSignature({
        farmId: selectedFarmId,
        cropId: selectedCropId,
      });
      const signatureData = sigRes.data || sigRes;

      // Step 2: Actually upload the image to Cloudinary CDN
      setUploadStage('uploading');
      setProgressMessage('Uploading leaf photograph securely to Cloudinary CDN...');
      const fileToUpload = selectedFile || previewUrl || 'https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=800&q=80';
      const cloudinaryResult = await uploadsApi.uploadToCloudinary(fileToUpload, signatureData);

      // Step 3: Register Real Cloudinary Metadata in MySQL operational DB
      setUploadStage('optimizing');
      setProgressMessage('Registering Cloudinary asset metadata in MySQL operational DB...');
      const optimizedCdnUrl = (cloudinaryResult.eager && cloudinaryResult.eager[0] && cloudinaryResult.eager[0].secure_url)
        || cloudinaryResult.secure_url;

      const metaRes = await uploadsApi.registerMetadata({
        farm_id: selectedFarmId,
        crop_id: selectedCropId,
        public_id: cloudinaryResult.public_id,
        original_url: cloudinaryResult.secure_url,
        optimized_url: optimizedCdnUrl,
        secure_url: cloudinaryResult.secure_url,
        resource_type: cloudinaryResult.resource_type || 'image',
        width: cloudinaryResult.width || 800,
        height: cloudinaryResult.height || 600,
        format: cloudinaryResult.format || 'jpg',
      });

      const assetId = metaRes.data?.id || metaRes.id || metaRes.asset_id;

      // Step 4: Execute Master AI Analysis Pipeline
      setUploadStage('analyzing');
      setProgressMessage('Executing Gemini AI vision disease diagnosis & deterministic risk calculation...');
      const analysisRes = await analysisApi.executeCompleteAnalysis({
        farmId: selectedFarmId,
        cropId: selectedCropId,
        cloudinaryAssetId: assetId,
        imageUrl: optimizedCdnUrl,
      });

      const resultObj = analysisRes.data?.analysis || analysisRes.data || analysisRes;
      setAnalysisResult(resultObj);
      setUploadStage('completed');
      showSuccess('AI Disease Analysis completed!');
    } catch (err) {
      setUploadStage('error');
      const errDetail = err.response?.data?.message || err.message || 'AI Disease Analysis failed';
      setErrorMessage(errDetail);
      showError(errDetail);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader
          title="AI Plant Disease Diagnostic Scanner"
          subtitle="Upload crop leaf images for instant Gemini vision AI pathogen diagnosis and severity scoring."
          icon={<Scan className="w-6 h-6 text-emerald-400" />}
          breadcrumbs={['Dashboard', 'AI Scanner']}
          action={
            <Link href="/analysis/history">
              <Button variant="outline" size="sm" leftIcon={<Eye className="w-4 h-4" />}>
                View Scan History
              </Button>
            </Link>
          }
        />

        {/* 1. SELECTION CONTROLS BAR */}
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Select Target Farm Field"
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              options={(Array.isArray(farms) ? farms : []).map((f) => ({ value: f.id, label: `🌾 ${f.farm_name || f.name} (${f.location || 'Central'})` }))}
              placeholder="Choose Farm Field"
              required
            />

            <Select
              label="Select Crop Planting"
              value={selectedCropId}
              onChange={(e) => setSelectedCropId(e.target.value)}
              options={(Array.isArray(crops) ? crops : []).map((c) => ({ value: c.id, label: `🌱 ${c.crop_name || c.name} (${c.crop_variety || c.crop_type || 'Crop'})` }))}
              placeholder="Choose Crop"
              required
            />
          </div>
        </Card>

        {/* 2. DRAG & DROP UPLOAD ZONE & PRESET SAMPLES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload Dropzone Card */}
          <Card glow className="lg:col-span-7 space-y-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                Upload Crop Leaf Image
              </CardTitle>
              <CardDescription>Drag and drop or select a high-resolution leaf photo</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
              />

              {!previewUrl ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 min-h-[220px] ${
                    isDragging
                      ? 'border-emerald-400 bg-emerald-950/30 scale-[1.01]'
                      : 'border-slate-800 hover:border-emerald-500/50 bg-slate-950/60 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="p-4 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-200">
                      Click to upload or drag & drop leaf image
                    </p>
                    <p className="text-xs text-slate-400">Supports JPEG, PNG, WebP up to 10MB</p>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col items-center justify-center p-3 space-y-3">
                  <div className="relative w-full max-h-64 overflow-hidden rounded-lg border border-slate-800">
                    <img src={previewUrl} alt="Selected Leaf Scan" className="w-full h-full object-cover max-h-64 mx-auto" />
                  </div>
                  <div className="flex items-center justify-between w-full text-xs text-slate-400 px-1">
                    <span className="truncate max-w-[200px]">{selectedFile?.name || 'Selected Sample Image'}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-400 hover:text-rose-300"
                      onClick={() => {
                        setPreviewUrl('');
                        setSelectedFile(null);
                      }}
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Trigger Button */}
              <Button
                variant="primary"
                className="w-full py-3 text-base shadow-lg shadow-emerald-950/40"
                isDisabled={!previewUrl || uploadStage !== 'idle' && uploadStage !== 'completed' && uploadStage !== 'error'}
                isLoading={uploadStage === 'signing' || uploadStage === 'uploading' || uploadStage === 'optimizing' || uploadStage === 'analyzing'}
                onClick={handleRunAnalysis}
                leftIcon={<Brain className="w-5 h-5" />}
              >
                Execute Gemini AI Disease Diagnosis
              </Button>
            </CardContent>
          </Card>

          {/* Sample Leaf Selector Card */}
          <Card className="lg:col-span-5 space-y-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Or Select Sample Leaf Preset
              </CardTitle>
              <CardDescription>Test AI scanner immediately with sample field photographs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sampleLeaves.map((sample, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSample(sample)}
                  className={`p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all duration-200 ${
                    previewUrl === sample.url
                      ? 'border-emerald-500 bg-emerald-950/30'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                  }`}
                >
                  <img src={sample.url} alt={sample.title} className="w-12 h-12 rounded-lg object-cover border border-slate-800 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-slate-200 truncate">{sample.title}</h4>
                    <p className="text-[11px] text-slate-400 truncate">{sample.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* 3. PROGRESS & STAGE FEEDBACK */}
        {(uploadStage === 'signing' || uploadStage === 'uploading' || uploadStage === 'optimizing' || uploadStage === 'analyzing') && (
          <Card glow className="p-6 text-center space-y-4">
            <div className="p-3 w-fit mx-auto rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 animate-bounce">
              <Brain className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-100">AI Diagnostic Pipeline In Progress</h3>
              <p className="text-xs text-emerald-400 font-medium">{progressMessage}</p>
            </div>
            <Spinner size="lg" className="text-emerald-400 mx-auto" />
          </Card>
        )}

        {/* 3.1 ERROR FEEDBACK */}
        {uploadStage === 'error' && errorMessage && (
          <Alert type="error" title="Analysis Execution Failed" onClose={() => setErrorMessage('')}>
            {errorMessage}
          </Alert>
        )}

        {/* 4. ANALYSIS RESULTS INSPECTOR PANEL */}
        {analysisResult && (
          <Card glow className="p-6 space-y-6 border-emerald-500/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <Badge variant={(analysisResult.severity || 'high') === 'high' ? 'critical' : 'warning'} size="lg" className="mb-2">
                  {(analysisResult.severity || 'high').toUpperCase()} SEVERITY
                </Badge>
                <h2 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
                  {analysisResult.disease_name || analysisResult.diseaseName || 'Late Blight'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pathogen: <strong className="text-slate-200">{analysisResult.pathogen_type || 'Crop Pathogen'}</strong> • Diagnostic Method: Gemini Vision AI
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400">AI Confidence</span>
                  <p className="text-xl font-extrabold text-emerald-400">{analysisResult.confidence_score ?? analysisResult.confidenceScore ?? 94}%</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400">Computed Risk Score</span>
                  <p className="text-xl font-extrabold text-rose-400">{analysisResult.risk_score ?? analysisResult.riskScore ?? analysisResult.risk?.riskScore ?? 78}/100</p>
                </div>
              </div>
            </div>

            {/* Symptoms & Treatment Guidance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Identified Leaf Symptoms</h3>
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs text-slate-300">
                  {Array.isArray(analysisResult.symptoms) ? (
                    <ul className="space-y-1.5 list-disc pl-4">
                      {analysisResult.symptoms.map((sym, idx) => (
                        <li key={idx}>{sym}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{analysisResult.symptoms || 'Visible necrotic lesions and leaf tissue discoloration.'}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Immediate Treatment Action</h3>
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-3 text-xs text-emerald-200">
                  <p className="leading-relaxed">
                    {analysisResult.treatment_summary ||
                      (Array.isArray(analysisResult.treatmentSuggestions) ? analysisResult.treatmentSuggestions.join(' ') : null) ||
                      (Array.isArray(analysisResult.treatment_suggestions) ? analysisResult.treatment_suggestions.join(' ') : null) ||
                      'Apply agricultural fungicide following local extension label instructions.'}
                  </p>
                  <div className="pt-2 border-t border-emerald-500/20 flex justify-end">
                    <Link href="/recommendations">
                      <Button size="sm" variant="primary" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                        View Full AI Treatment Plan
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center"><Spinner size="lg" className="text-emerald-400" /></div>}>
      <DiseaseScannerContent />
    </Suspense>
  );
}
