'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/context/ToastContext';
import { cropsApi } from '@/lib/api/crops';
import { Sprout, Calendar, Layers, ArrowLeft, Check } from 'lucide-react';

export default function EditCropPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const cropId = params.cropId;
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    crop_type: 'Tomato',
    variety: '',
    planting_date: '',
    acreage_hectares: '',
    status: 'active',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errors, setErrors] = useState({});

  const loadCropData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await cropsApi.getCropById(cropId);
      const cropObj = res.data?.crop || res.data || res;
      setFormData({
        name: cropObj.crop_name || cropObj.name || '',
        crop_type: cropObj.crop_type || 'Tomato',
        variety: cropObj.crop_variety || cropObj.variety || '',
        planting_date: (cropObj.sowing_date || cropObj.planting_date) ? new Date(cropObj.sowing_date || cropObj.planting_date).toISOString().split('T')[0] : '',
        acreage_hectares: cropObj.acreage_hectares ? cropObj.acreage_hectares.toString() : '',
        status: cropObj.status || 'active',
      });
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load crop details for editing.');
    } finally {
      setIsLoading(false);
    }
  }, [cropId]);

  useEffect(() => {
    loadCropData();
  }, [loadCropData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Crop identifier name is required';
    if (!formData.planting_date) newErrors.planting_date = 'Sowing date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        crop_name: formData.name.trim(),
        crop_variety: formData.variety.trim() || formData.crop_type || null,
        sowing_date: formData.planting_date ? new Date(formData.planting_date).toISOString() : null,
        status: ['active', 'harvested', 'fallow', 'failed'].includes(formData.status) ? formData.status : 'active',
      };

      await cropsApi.updateCrop(cropId, payload);
      showSuccess(`Crop "${formData.name}" updated successfully!`);
      router.push(`/crops/${cropId}`);
    } catch (err) {
      const msg = err.message || 'Failed to update crop.';
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-3xl mx-auto">
          <Skeleton variant="card" height="400px" />
        </div>
      </DashboardLayout>
    );
  }

  if (errorMessage && !formData.name) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-3xl mx-auto">
          <ErrorState title="Error Loading Crop Record" message={errorMessage} onRetry={loadCropData} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <PageHeader
          title={`Edit Crop: ${formData.name}`}
          subtitle="Update variety, planting date, or monitoring status."
          icon={<Sprout className="w-6 h-6 text-emerald-400" />}
          breadcrumbs={['Dashboard', 'Crops', formData.name, 'Edit']}
          action={
            <Link href={`/crops/${cropId}`}>
              <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Cancel
              </Button>
            </Link>
          }
        />

        <Card glow className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Edit Crop Parameters</CardTitle>
            <CardDescription>Update crop fields matching field planting status</CardDescription>
          </CardHeader>

          {errorMessage && (
            <Alert type="error" className="mb-4" onClose={() => setErrorMessage('')}>
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Crop Identifier Name"
              name="name"
              placeholder="e.g. Field B Tomatoes"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              leftIcon={<Sprout className="w-4 h-4" />}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Crop Type / Species"
                name="crop_type"
                value={formData.crop_type}
                onChange={handleChange}
                options={['Tomato', 'Maize', 'Apple', 'Wheat', 'Potato', 'Grape', 'Rice', 'Soybean', 'Cotton']}
              />
              <Input
                label="Variety / Hybrid"
                name="variety"
                placeholder="e.g. Roma VF"
                value={formData.variety}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Sowing / Planting Date"
                name="planting_date"
                type="date"
                value={formData.planting_date}
                onChange={handleChange}
                error={errors.planting_date}
                leftIcon={<Calendar className="w-4 h-4" />}
                required
              />
              <Input
                label="Acreage (Hectares)"
                name="acreage_hectares"
                type="number"
                step="0.1"
                placeholder="e.g. 1.5"
                value={formData.acreage_hectares}
                onChange={handleChange}
                error={errors.acreage_hectares}
                leftIcon={<Layers className="w-4 h-4" />}
                required
              />
              <Select
                label="Status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                options={[
                  { value: 'active', label: 'Active Growth' },
                  { value: 'monitoring', label: 'Under Disease Monitoring' },
                  { value: 'harvested', label: 'Harvest Completed' },
                ]}
              />
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
              <Link href={`/crops/${cropId}`}>
                <Button variant="ghost" size="md">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" size="md" isLoading={isSubmitting} leftIcon={<Check className="w-4 h-4" />}>
                Update Crop Record
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
