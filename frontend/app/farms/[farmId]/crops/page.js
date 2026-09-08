'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { farmsApi } from '@/lib/api/farms';
import { cropsApi } from '@/lib/api/crops';
import { Sprout, Plus, Eye, Edit, Trash2, Calendar, Scan, ArrowLeft, Layers } from 'lucide-react';

export default function FarmCropsListPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const farmId = params.farmId;
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [farm, setFarm] = useState(null);
  const [crops, setCrops] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cropToDelete, setCropToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [farmRes, cropsRes] = await Promise.all([
        farmsApi.getFarmById(farmId),
        farmsApi.getCropsByFarm(farmId),
      ]);

      const farmObj = farmRes.data?.farm || farmRes.data || farmRes;
      setFarm(farmObj);

      const cropList = Array.isArray(cropsRes.data?.crops)
        ? cropsRes.data.crops
        : Array.isArray(cropsRes.data?.items)
        ? cropsRes.data.items
        : Array.isArray(cropsRes.crops)
        ? cropsRes.crops
        : Array.isArray(cropsRes.data)
        ? cropsRes.data
        : [];
      setCrops(cropList);
    } catch (err) {
      setError(err.message || 'Failed to load crops list for farm.');
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteConfirm = async () => {
    if (!cropToDelete) return;
    setIsDeleting(true);
    try {
      await cropsApi.deleteCrop(cropToDelete.id);
      showSuccess(`Crop "${cropToDelete.name}" removed.`);
      setCropToDelete(null);
      loadData();
    } catch (err) {
      showError(err.message || 'Failed to remove crop.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={farm ? `Crops in ${farm.farm_name || farm.name}` : 'Farm Crop Inventory'}
          subtitle="Manage individual crop plantings, sowing dates, and disease monitoring status."
          icon={<Sprout className="w-6 h-6 text-emerald-400" />}
          breadcrumbs={['Dashboard', 'Farms', farm?.farm_name || farm?.name || 'Farm', 'Crops']}
          action={
            <div className="flex items-center gap-2">
              <Link href={`/farms/${farmId}`}>
                <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Back to Farm
                </Button>
              </Link>
              <Link href={`/farms/${farmId}/crops/new`}>
                <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                  Register New Crop
                </Button>
              </Link>
            </div>
          }
        />

        {error && <ErrorState title="Failed to Load Crop Inventory" message={error} onRetry={loadData} />}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton variant="card" height="200px" />
            <Skeleton variant="card" height="200px" />
            <Skeleton variant="card" height="200px" />
          </div>
        ) : crops.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {crops.map((crop) => (
              <Card key={crop.id} glow className="flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-all">
                <div className="space-y-3">
                  <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-100">{crop.crop_name || crop.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {crop.crop_variety || crop.variety || 'Standard Crop'}
                      </p>
                    </div>
                    <Badge variant={crop.status === 'harvested' ? 'secondary' : 'low'}>
                      {(crop.status || 'active').toUpperCase()}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-sky-400" /> Sowing Date
                      </span>
                      <p className="font-semibold text-slate-200 mt-0.5">
                        {crop.sowing_date || crop.planting_date ? new Date(crop.sowing_date || crop.planting_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-amber-400" /> Growth Status
                      </span>
                      <p className="font-semibold text-slate-200 mt-0.5 capitalize">{crop.status || 'Active'}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <Link href={`/crops/${crop.id}`}>
                    <Button size="sm" variant="outline" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                      Crop Details
                    </Button>
                  </Link>

                  <div className="flex items-center gap-1">
                    <Link href={`/crops/${crop.id}/edit`}>
                      <Button size="sm" variant="ghost" className="p-1.5 text-slate-400 hover:text-slate-200">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                      onClick={() => setCropToDelete(crop)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No crops added yet."
            description="You have not registered any crop plantings for this farm field yet."
            actionLabel="Add Your First Crop"
            onAction={() => router.push(`/farms/${farmId}/crops/new`)}
          />
        )}

        {/* Delete Confirm */}
        <ConfirmDialog
          isOpen={!!cropToDelete}
          onClose={() => setCropToDelete(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Crop Planting"
          message={`Are you sure you want to remove crop "${cropToDelete?.crop_name || cropToDelete?.name}"?`}
          confirmText="Delete Crop"
          isDanger
          isLoading={isDeleting}
        />
      </div>
    </DashboardLayout>
  );
}
