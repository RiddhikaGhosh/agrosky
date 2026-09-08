'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/context/ToastContext';
import { farmsApi } from '@/lib/api/farms';
import { Sprout, Calendar, Layers, ArrowLeft, Check } from 'lucide-react';

export default function CreateCropPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const farmId = params.farmId;
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    crop_type: 'Tomato',
    variety: 'Roma VF',
    planting_date: new Date().toISOString().split('T')[0],
    acreage_hectares: '',
    status: 'active',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Crop identifier name is required';
    if (!formData.planting_date) newErrors.planting_date = 'Sowing / planting date is required';
    if (!formData.acreage_hectares || parseFloat(formData.acreage_hectares) <= 0) {
      newErrors.acreage_hectares = 'Acreage in hectares must be greater than 0';
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
        crop_name: formData.name.trim(),
        crop_variety: formData.variety.trim() || formData.crop_type || null,
        sowing_date: formData.planting_date ? new Date(formData.planting_date).toISOString() : null,
        status: ['active', 'harvested', 'fallow', 'failed'].includes(formData.status) ? formData.status : 'active',
      };

      await farmsApi.addCropToFarm(farmId, payload);
      showSuccess(`Crop "${formData.name}" registered successfully!`);
      router.push(`/farms/${farmId}/crops`);
    } catch (err) {
      const msg = err.message || 'Failed to register crop planting.';
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <PageHeader
          title="Register Crop Planting"
          subtitle="Add crop variety, sowing date, and field acreage details."
          icon={<Sprout className="w-6 h-6 text-emerald-400" />}
          breadcrumbs={['Dashboard', 'Farms', 'Crops', 'New Crop']}
          action={
            <Link href={`/farms/${farmId}/crops`}>
              <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Cancel
              </Button>
            </Link>
          }
        />

        <Card glow className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Crop Planting Parameters</CardTitle>
            <CardDescription>Enter details matching your field sowing record</CardDescription>
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
              placeholder="e.g. Field Sector B Tomatoes"
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
                placeholder="e.g. Roma VF / Hybrid 302"
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
              <Link href={`/farms/${farmId}/crops`}>
                <Button variant="ghost" size="md">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" size="md" isLoading={isSubmitting} leftIcon={<Check className="w-4 h-4" />}>
                Register Crop Record
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
