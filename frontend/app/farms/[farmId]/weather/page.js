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
import { weatherApi } from '@/lib/api/weather';
import {
  CloudSun,
  Thermometer,
  Droplets,
  CloudRain,
  Wind,
  ShieldAlert,
  Calendar,
  MapPin,
  ArrowLeft,
  Sun,
  CloudLightning,
  Cloud,
} from 'lucide-react';

export async function generateStaticParams() {
  return [];
}

export default function FarmWeatherPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const farmId = params.farmId;

  const [farm, setFarm] = useState(null);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFarmWeather = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [farmRes, currRes, foreRes] = await Promise.all([
        farmsApi.getFarmById(farmId),
        weatherApi.getCurrentWeather(farmId),
        weatherApi.getForecastWeather(farmId),
      ]);

      setFarm(farmRes.data?.farm || farmRes.data || farmRes);
      setWeather(currRes.data?.weather || currRes.data || currRes);
      const foreList = foreRes.data?.forecasts || foreRes.data?.forecast || foreRes.forecasts || foreRes.forecast || foreRes.data?.items || foreRes.data || [];
      setForecast(Array.isArray(foreList) ? foreList : []);
    } catch (err) {
      setError('Weather information is temporarily unavailable.');
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    loadFarmWeather();
  }, [loadFarmWeather]);

  const getWeatherIcon = (cond = '') => {
    const lower = (cond || '').toLowerCase();
    if (lower.includes('thunder')) return <CloudLightning className="w-6 h-6 text-amber-400" />;
    if (lower.includes('rain')) return <CloudRain className="w-6 h-6 text-sky-400" />;
    if (lower.includes('cloud')) return <CloudSun className="w-6 h-6 text-teal-400" />;
    return <Sun className="w-6 h-6 text-amber-300" />;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto">
          <Skeleton variant="card" height="240px" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !weather) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto">
          <PageHeader title="Field Weather Station" breadcrumbs={['Dashboard', 'Farms', 'Weather']} />
          <ErrorState
            title="Weather Temporarily Unavailable"
            message="Weather information is temporarily unavailable."
            onRetry={loadFarmWeather}
          />
        </div>
      </DashboardLayout>
    );
  }

  const farmDisplayName = farm?.farm_name || farm?.name || 'Farm Field';
  const humVal = weather.humidity ?? weather.relative_humidity ?? 80;
  const tempVal = weather.temperature ?? weather.temperature_celsius ?? 26;
  const rainVal = weather.rainfall ?? weather.rainfall_mm ?? 0;
  const windVal = weather.windSpeed ?? weather.wind_speed_kmh ?? weather.wind_speed ?? 12;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader
          title={`Weather Station: ${farmDisplayName}`}
          subtitle={`Location: ${farm?.location || 'Central Region'} • Relative Humidity & Rainfall Telemetry`}
          icon={<CloudSun className="w-6 h-6 text-sky-400" />}
          breadcrumbs={['Dashboard', 'Farms', farmDisplayName, 'Weather']}
          action={
            <Link href={`/farms/${farmId}`}>
              <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Farm Details
              </Button>
            </Link>
          }
        />

        {/* Current Weather Panel */}
        <Card glow className="p-6 space-y-6 border-sky-500/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-sky-950/60 border border-sky-500/30">
                {getWeatherIcon(weather.weatherCondition || weather.weather_condition)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">{farmDisplayName} Microclimate</h2>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {farm?.location}
                </p>
              </div>
            </div>
            <Badge variant={humVal >= 85 ? 'critical' : 'low'} size="lg">
              {humVal >= 85 ? 'HIGH SPORE RISK' : 'NORMAL SPORE THREAT'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-1">
              <Thermometer className="w-5 h-5 text-amber-400 mx-auto" />
              <span className="text-xs text-slate-400">Temperature</span>
              <p className="text-2xl font-extrabold text-slate-100">{tempVal}°C</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-1">
              <Droplets className="w-5 h-5 text-sky-400 mx-auto" />
              <span className="text-xs text-slate-400">Humidity</span>
              <p className="text-2xl font-extrabold text-sky-400">{humVal}%</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-1">
              <CloudRain className="w-5 h-5 text-teal-400 mx-auto" />
              <span className="text-xs text-slate-400">Rainfall</span>
              <p className="text-2xl font-extrabold text-slate-100">{rainVal}mm</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-1">
              <Wind className="w-5 h-5 text-indigo-400 mx-auto" />
              <span className="text-xs text-slate-400">Wind</span>
              <p className="text-2xl font-extrabold text-slate-100">{windVal}km/h</p>
            </div>
          </div>
        </Card>

        {/* Forecast Panel if available */}
        {forecast.length > 0 && (
          <Card className="space-y-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                Forecast Telemetry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto pb-2 scrollbar-thin">
                <div className="flex gap-4 min-w-[600px]">
                  {forecast.map((item, idx) => {
                    const dateObj = item.timestamp ? new Date(item.timestamp) : null;
                    const dayLabel = dateObj ? dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : `Day ${idx + 1}`;
                    return (
                      <div key={idx} className="flex-1 p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-center space-y-2 min-w-[100px]">
                        <span className="text-xs font-bold text-slate-200">{dayLabel}</span>
                        <div className="flex justify-center">{getWeatherIcon(item.weather_condition || item.weatherCondition)}</div>
                        <p className="text-xs font-bold text-slate-100">{Math.round(item.temp_max ?? item.temperature ?? 0)}°C</p>
                        <p className="text-[10px] text-sky-400">{Math.round(item.humidity ?? 0)}% Humid</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
