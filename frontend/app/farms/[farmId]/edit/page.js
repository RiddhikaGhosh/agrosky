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
import { farmsApi } from '@/lib/api/farms';
import { Tractor, MapPin, Navigation, Layers, ArrowLeft, Check } from 'lucide-react';

export default function EditFarmPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const farmId = params.farmId;
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    latitude: '',
    longitude: '',
    size_hectares: '',
    soil_type: 'Loam',
    irrigation_type: 'Drip',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errors, setErrors] = useState({});

  const loadFarmData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await farmsApi.getFarmById(farmId);
      const farmObj = res.data?.farm || res.data || res;
      setFormData({
        name: farmObj.farm_name || farmObj.name || '',
        location: farmObj.location || '',
        latitude: farmObj.latitude !== undefined && farmObj.latitude !== null ? farmObj.latitude.toString() : '',
        longitude: farmObj.longitude !== undefined && farmObj.longitude !== null ? farmObj.longitude.toString() : '',
        size_hectares: (farmObj.area || farmObj.size_hectares) ? (farmObj.area || farmObj.size_hectares).toString() : '',
        soil_type: farmObj.soil_type || 'Loam',
        irrigation_type: farmObj.irrigation_type || 'Drip',
      });
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load farm details for editing.');
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    loadFarmData();
  }, [loadFarmData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Farm name is required';
    if (!formData.size_hectares || parseFloat(formData.size_hectares) <= 0) {
      newErrors.size_hectares = 'Area in hectares must be greater than 0';
    }
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
        farm_name: formData.name.trim(),
        location: formData.location.trim() || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        area: parseFloat(formData.size_hectares) || 1.0,
        area_unit: 'hectares',
        soil_type: formData.soil_type || 'Loam',
      };

      await farmsApi.updateFarm(farmId, payload);
      showSuccess(`Farm "${formData.name}" updated successfully!`);
      router.push(`/farms/${farmId}`);
    } catch (err) {
      const msg = err.message || 'Failed to update farm.';
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
          <ErrorState title="Error Loading Farm" message={errorMessage} onRetry={loadFarmData} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <PageHeader
          title={`Edit Farm: ${formData.name}`}
          subtitle="Update field parameters, location, and irrigation settings."
          icon={<Tractor className="w-6 h-6 text-emerald-400" />}
          breadcrumbs={['Dashboard', 'Farms', formData.name, 'Edit']}
          action={
            <Link href={`/farms/${farmId}`}>
              <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Cancel
              </Button>
            </Link>
          }
        />

        <Card glow className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Edit Field Information</CardTitle>
            <CardDescription>Update parameters for this farm field</CardDescription>
          </CardHeader>

          {errorMessage && (
            <Alert type="error" className="mb-4" onClose={() => setErrorMessage('')}>
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Farm Name"
              name="name"
              placeholder="e.g. Sunny Valley Plot 3"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              leftIcon={<Tractor className="w-4 h-4" />}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Location / District"
                name="location"
                placeholder="e.g. Northern Valley District"
                value={formData.location}
                onChange={handleChange}
                leftIcon={<MapPin className="w-4 h-4" />}
              />
              <Input
                label="Total Area (Hectares)"
                name="size_hectares"
                type="number"
                step="0.1"
                placeholder="e.g. 3.5"
                value={formData.size_hectares}
                onChange={handleChange}
                error={errors.size_hectares}
                leftIcon={<Layers className="w-4 h-4" />}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Latitude"
                name="latitude"
                type="number"
                step="0.000001"
                placeholder="e.g. 36.778261"
                value={formData.latitude}
                onChange={handleChange}
                leftIcon={<Navigation className="w-4 h-4" />}
              />
              <Input
                label="Longitude"
                name="longitude"
                type="number"
                step="0.000001"
                placeholder="e.g. -119.417932"
                value={formData.longitude}
                onChange={handleChange}
                leftIcon={<Navigation className="w-4 h-4" />}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Soil Type"
                name="soil_type"
                value={formData.soil_type}
                onChange={handleChange}
                options={['Loam', 'Clay', 'Sandy', 'Silt', 'Peat', 'Chalky']}
              />
              <Select
                label="Irrigation System"
                name="irrigation_type"
                value={formData.irrigation_type}
                onChange={handleChange}
                options={['Drip', 'Sprinkler', 'Flood', 'Rainfed', 'Sub-irrigation']}
              />
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
              <Link href={`/farms/${farmId}`}>
                <Button variant="ghost" size="md">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" size="md" isLoading={isSubmitting} leftIcon={<Check className="w-4 h-4" />}>
                Update Farm Record
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
