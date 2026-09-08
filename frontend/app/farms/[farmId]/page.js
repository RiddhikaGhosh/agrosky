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
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { farmsApi } from '@/lib/api/farms';
import { cropsApi } from '@/lib/api/crops';
import { weatherApi } from '@/lib/api/weather';
import { riskApi } from '@/lib/api/risk';
import { analysisApi } from '@/lib/api/analysis';
import {
  Tractor,
  MapPin,
  Layers,
  Droplets,
  Sprout,
  Plus,
  Edit,
  Trash2,
  CloudSun,
  Activity,
  Scan,
  ArrowLeft,
  Thermometer,
  CloudRain,
  Eye,
} from 'lucide-react';

export default function FarmDetailPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const farmId = params.farmId;
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [farm, setFarm] = useState(null);
  const [crops, setCrops] = useState([]);
  const [weather, setWeather] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [scans, setScans] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals & Dialogs
  const [isAddCropOpen, setIsAddCropOpen] = useState(false);
  const [isDeletingFarm, setIsDeletingFarm] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Crop delete state
  const [cropToDelete, setCropToDelete] = useState(null);

  // New Crop Form
  const [cropForm, setCropForm] = useState({
    name: '',
    crop_type: 'Tomato',
    variety: 'Roma VF',
    planting_date: new Date().toISOString().split('T')[0],
    acreage_hectares: '',
  });

  const loadFarmData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch farm details first
      const farmRes = await farmsApi.getFarmById(farmId);
      const farmObj = farmRes.data?.farm || farmRes.data || farmRes;
      setFarm(farmObj);

      // Concurrently fetch sub-crops, weather, risk & scan history
      const [cropsRes, weatherRes, riskRes, scansRes] = await Promise.allSettled([
        farmsApi.getCropsByFarm(farmId),
        weatherApi.getCurrentWeather(farmId),
        riskApi.getFarmRisk(farmId),
        analysisApi.getFarmAnalysisHistory(farmId, { limit: 5 }),
      ]);

      if (cropsRes.status === 'fulfilled') {
        const cVal = cropsRes.value.data?.crops || cropsRes.value.data?.items || cropsRes.value.crops || (Array.isArray(cropsRes.value.data) ? cropsRes.value.data : []);
        setCrops(Array.isArray(cVal) ? cVal : []);
      }
      if (weatherRes.status === 'fulfilled') {
        setWeather(weatherRes.value.data || weatherRes.value.weather || weatherRes.value);
      }
      if (riskRes.status === 'fulfilled') {
        setRiskData(riskRes.value.data || riskRes.value.risk || riskRes.value);
      }
      if (scansRes.status === 'fulfilled') {
        setScans(scansRes.value.data?.items || scansRes.value.data?.history || scansRes.value.analyses || scansRes.value.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch farm detail record');
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    loadFarmData();
  }, [loadFarmData]);

  // Add Crop Submit
  const handleAddCropSubmit = async (e) => {
    e.preventDefault();
    if (!cropForm.name.trim()) return;

    try {
      await farmsApi.addCropToFarm(farmId, {
        crop_name: cropForm.name.trim(),
        crop_variety: cropForm.variety.trim() || cropForm.crop_type || null,
        sowing_date: cropForm.planting_date ? new Date(cropForm.planting_date).toISOString() : null,
        status: 'active',
      });

      showSuccess(`Crop "${cropForm.name}" registered successfully!`);
      setIsAddCropOpen(false);
      setCropForm({ name: '', crop_type: 'Tomato', variety: 'Roma VF', planting_date: new Date().toISOString().split('T')[0], acreage_hectares: '' });
      // Refresh crops
      const cRes = await farmsApi.getCropsByFarm(farmId);
      const cList = cRes.data?.crops || cRes.data?.items || cRes.crops || (Array.isArray(cRes.data) ? cRes.data : []);
      setCrops(Array.isArray(cList) ? cList : []);
    } catch (err) {
      showError(err.message || 'Failed to add crop');
    }
  };

  // Delete Farm Confirm
  const handleDeleteFarmConfirm = async () => {
    setIsDeletingFarm(true);
    try {
      await farmsApi.deleteFarm(farmId);
      showSuccess(`Farm "${farm?.farm_name || farm?.name}" deleted.`);
      router.push('/farms');
    } catch (err) {
      showError(err.message || 'Failed to delete farm.');
    } finally {
      setIsDeletingFarm(false);
    }
  };

  // Delete Crop Confirm
  const handleDeleteCropConfirm = async () => {
    if (!cropToDelete) return;
    try {
      await cropsApi.deleteCrop(cropToDelete.id);
      showSuccess(`Crop "${cropToDelete.crop_name || cropToDelete.name}" removed.`);
      setCropToDelete(null);
      const cRes = await farmsApi.getCropsByFarm(farmId);
      const cList = cRes.data?.crops || cRes.data?.items || cRes.crops || (Array.isArray(cRes.data) ? cRes.data : []);
      setCrops(Array.isArray(cList) ? cList : []);
    } catch (err) {
      showError(err.message || 'Failed to delete crop');
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton variant="card" height="80px" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton variant="card" height="200px" />
            <Skeleton variant="card" height="200px" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !farm) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <PageHeader title="Farm Field Details" breadcrumbs={['Dashboard', 'Farms', 'Details']} />
          <ErrorState title="Farm Field Not Found" message={error || 'The requested farm record does not exist or has been deleted.'} onRetry={loadFarmData} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={farm.farm_name || farm.name}
          subtitle={`Location: ${farm.location || 'Central Region'} • Total Area: ${farm.area || farm.size_hectares || 1.0} ${farm.area_unit || 'Ha'}`}
          icon={<Tractor className="w-6 h-6 text-emerald-400" />}
          breadcrumbs={['Dashboard', 'Farms', farm.farm_name || farm.name]}
          action={
            <div className="flex items-center gap-2">
              <Link href="/farms">
                <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Farms List
                </Button>
              </Link>
              <Link href={`/farms/${farmId}/edit`}>
                <Button variant="outline" size="sm" leftIcon={<Edit className="w-4 h-4" />}>
                  Edit Field
                </Button>
              </Link>
              <Button variant="danger" size="sm" onClick={() => setIsConfirmDeleteOpen(true)} leftIcon={<Trash2 className="w-4 h-4" />}>
                Delete
              </Button>
            </div>
          }
        />

        {/* Farm Parameters Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <span className="text-[10px] text-slate-400">Total Field Size</span>
            <p className="text-lg font-bold text-slate-100 mt-0.5">{farm.area || farm.size_hectares || 1.0} {farm.area_unit || 'Hectares'}</p>
          </Card>
          <Card className="p-4 text-center">
            <span className="text-[10px] text-slate-400">Soil Classification</span>
            <p className="text-lg font-bold text-amber-400 mt-0.5">{farm.soil_type || 'Loam'}</p>
          </Card>
          <Card className="p-4 text-center">
            <span className="text-[10px] text-slate-400">Area Unit</span>
            <p className="text-lg font-bold text-sky-400 mt-0.5 capitalize">{farm.area_unit || 'Hectares'}</p>
          </Card>
          <Card className="p-4 text-center">
            <span className="text-[10px] text-slate-400">Active Plantings</span>
            <p className="text-lg font-bold text-emerald-400 mt-0.5">{crops.length} Crops</p>
          </Card>
        </div>

        {/* Weather & Risk Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Weather Observation */}
          <Card className="lg:col-span-6 space-y-4">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CloudSun className="w-5 h-5 text-sky-400" />
                  Field Microclimate Observation
                </CardTitle>
                <CardDescription>Live weather reading for field coordinates</CardDescription>
              </div>
              <Badge variant="info">Live Weather</Badge>
            </CardHeader>
            <CardContent>
              {weather ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <Thermometer className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                    <span className="text-[10px] text-slate-400">Temp</span>
                    <p className="text-base font-bold text-slate-100">
                      {weather.temperature !== undefined && weather.temperature !== null ? `${weather.temperature}°C` : weather.temperature_celsius ? `${weather.temperature_celsius}°C` : '--'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <Droplets className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                    <span className="text-[10px] text-slate-400">Humidity</span>
                    <p className="text-base font-bold text-sky-400">
                      {weather.humidity !== undefined && weather.humidity !== null ? `${weather.humidity}%` : weather.relative_humidity ? `${weather.relative_humidity}%` : '--'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <CloudRain className="w-4 h-4 text-teal-400 mx-auto mb-1" />
                    <span className="text-[10px] text-slate-400">Rain</span>
                    <p className="text-base font-bold text-slate-100">
                      {weather.rainfall !== undefined && weather.rainfall !== null ? `${weather.rainfall}mm` : weather.rainfall_mm !== undefined ? `${weather.rainfall_mm}mm` : '0mm'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">No live weather telemetry available for this farm location.</p>
              )}
            </CardContent>
          </Card>

          {/* Risk Card */}
          <Card glow className="lg:col-span-6 space-y-4">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-5 h-5 text-rose-400" />
                  Farm Deterministic Risk Score
                </CardTitle>
                <CardDescription>Pathogen base severity + environmental moisture factor</CardDescription>
              </div>
              <Badge variant={riskData?.overallRiskLevel || riskData?.riskLevel || riskData?.risk_level || 'low'}>
                {(riskData?.overallRiskLevel || riskData?.riskLevel || riskData?.risk_level || 'Low').toUpperCase()}
              </Badge>
            </CardHeader>
            <CardContent>
              {riskData ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div>
                    <span className="text-xs text-slate-400">Calculated Risk Index</span>
                    <div className="text-3xl font-extrabold text-rose-400 tracking-tight mt-0.5">
                      {riskData.averageRiskScore ?? riskData.riskScore ?? riskData.risk_score ?? 0} / 100
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-full border-4 border-rose-500/40 flex items-center justify-center bg-rose-950/30 text-rose-400 font-bold text-sm">
                    {riskData.averageRiskScore ?? riskData.riskScore ?? riskData.risk_score ?? 0}%
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Execute crop scans to compute deterministic risk metrics.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sub-Crops Inventory Section */}
        <Card className="space-y-4">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-400" />
                Crops Registered in Field ({crops.length})
              </CardTitle>
              <CardDescription>Individual crop plantings monitored in this farm field</CardDescription>
            </div>
            <Button size="sm" variant="primary" onClick={() => setIsAddCropOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
              Add Crop to Farm
            </Button>
          </CardHeader>
          <CardContent>
            {crops.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {crops.map((crop) => (
                  <div key={crop.id} className="p-4 rounded-xl glass-panel border border-slate-800 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">{crop.crop_name || crop.name}</h4>
                        <p className="text-xs text-slate-400">
                          {crop.crop_variety || crop.variety || 'Standard Crop'}
                        </p>
                      </div>
                      <Badge variant={crop.status === 'harvested' ? 'secondary' : 'low'}>{crop.status || 'active'}</Badge>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Sowing Date: <strong className="text-slate-300">{crop.sowing_date || crop.planting_date ? new Date(crop.sowing_date || crop.planting_date).toLocaleDateString() : 'N/A'}</strong>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <Link href={`/crops/${crop.id}`}>
                        <Button size="sm" variant="outline" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                          View Details
                        </Button>
                      </Link>
                      <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300" onClick={() => setCropToDelete(crop)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No Crops in this Field"
                description="Register crop varieties planted in this farm to begin tracking plant disease analysis."
                actionLabel="Register First Crop"
                onAction={() => setIsAddCropOpen(true)}
              />
            )}
          </CardContent>
        </Card>

        {/* Recent Disease Diagnostics History */}
        <Card className="space-y-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Scan className="w-5 h-5 text-sky-400" />
              Disease Analysis History for {farm.farm_name || farm.name}
            </CardTitle>
            <CardDescription>Recent AI leaf scan records for this farm</CardDescription>
          </CardHeader>
          <CardContent>
            {scans.length > 0 ? (
              <div className="divide-y divide-slate-800">
                {scans.map((s, idx) => (
                  <div key={s.id || s.analysisId || idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <h5 className="font-bold text-slate-100">{s.disease || s.diseaseName || s.disease_name || s.diagnosis || 'Healthy Crop'}</h5>
                      <span className="text-slate-400 text-[11px]">Scanned: {new Date(s.date || s.created_at || Date.now()).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={s.severity === 'high' ? 'critical' : 'warning'}>{(s.severity || 'low').toUpperCase()}</Badge>
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
              <p className="text-xs text-slate-400 py-2">No disease diagnosis scans executed for this farm yet.</p>
            )}
          </CardContent>
        </Card>

        {/* MODAL: ADD CROP */}
        <Modal
          isOpen={isAddCropOpen}
          onClose={() => setIsAddCropOpen(false)}
          title={`Register Crop under ${farm.farm_name || farm.name}`}
          subtitle="Specify crop variety and acreage."
        >
          <form onSubmit={handleAddCropSubmit} className="space-y-4 py-2">
            <Input
              label="Crop Identifier Name"
              placeholder="e.g. Field B Tomatoes"
              value={cropForm.name}
              onChange={(e) => setCropForm({ ...cropForm, name: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Crop Type"
                value={cropForm.crop_type}
                onChange={(e) => setCropForm({ ...cropForm, crop_type: e.target.value })}
                options={['Tomato', 'Maize', 'Apple', 'Wheat', 'Potato', 'Grape', 'Rice', 'Soybean', 'Cotton']}
              />
              <Input
                label="Variety / Hybrid"
                placeholder="e.g. Roma VF"
                value={cropForm.variety}
                onChange={(e) => setCropForm({ ...cropForm, variety: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Planting Date"
                type="date"
                value={cropForm.planting_date}
                onChange={(e) => setCropForm({ ...cropForm, planting_date: e.target.value })}
                required
              />
              <Input
                label="Acreage (Hectares)"
                type="number"
                step="0.1"
                placeholder="0.5"
                value={cropForm.acreage_hectares}
                onChange={(e) => setCropForm({ ...cropForm, acreage_hectares: e.target.value })}
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsAddCropOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Crop
              </Button>
            </div>
          </form>
        </Modal>

        {/* CONFIRM DELETE FARM */}
        <ConfirmDialog
          isOpen={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          onConfirm={handleDeleteFarmConfirm}
          title="Delete Farm Field"
          message={`Are you sure you want to delete farm "${farm.farm_name || farm.name}"? All associated crops and scan history will be permanently deleted.`}
          confirmText="Delete Farm"
          isDanger
          isLoading={isDeletingFarm}
        />

        {/* CONFIRM DELETE CROP */}
        <ConfirmDialog
          isOpen={!!cropToDelete}
          onClose={() => setCropToDelete(null)}
          onConfirm={handleDeleteCropConfirm}
          title="Remove Crop"
          message={`Are you sure you want to remove crop "${cropToDelete?.crop_name || cropToDelete?.name}" from this farm?`}
          confirmText="Remove Crop"
          isDanger
        />
      </div>
    </DashboardLayout>
  );
}
