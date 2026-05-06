import React, { useState, useEffect, useCallback } from 'react';
import { expenditureApi, revenueApi, pondApi, type Pond } from '../services/api';

interface ForecastData {
  date: string;
  actual?: number;
  forecast: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

interface HistoricalDataPoint {
  date: string;
  value: number;
  category?: string;
}

interface ForecastMetrics {
  mae: number;
  rmse: number;
  mape: number;
  r2: number;
}

interface SeasonalPattern {
  month: string;
  avgValue: number;
  variance: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

const lkrFormatter = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
});

const BudgetForecasting: React.FC = () => {
  const [forecastType, setForecastType] = useState<'revenue' | 'expenditure' | 'netProfit'>('revenue');
  const [selectedPond, setSelectedPond] = useState<number | 'all'>('all');
  const [forecastPeriod, setForecastPeriod] = useState<3 | 6 | 12>(6);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [forecastMetrics, setForecastMetrics] = useState<ForecastMetrics | null>(null);
  const [seasonalPatterns, setSeasonalPatterns] = useState<SeasonalPattern[]>([]);
  const [trendAnalysis, setTrendAnalysis] = useState<string>('');
  const [confidenceLevel, setConfidenceLevel] = useState<80 | 90 | 95>(90);

  const loadPonds = useCallback(async () => {
    try {
      const response = await pondApi.getAll();
      if (response.success && response.data) {
        setPonds(response.data);
      }
    } catch (error) {
      console.error('Error loading ponds:', error);
    }
  }, []);

  const loadHistoricalData = useCallback(async () => {
    try {
      setIsLoading(true);
      let data: HistoricalDataPoint[] = [];

      if (forecastType === 'revenue' || forecastType === 'netProfit') {
        const revenueResponse = await revenueApi.getAll();
        if (revenueResponse.success && revenueResponse.data) {
          const revenues = selectedPond === 'all' 
            ? revenueResponse.data 
            : revenueResponse.data.filter(r => r.pond.id === selectedPond);
          
          const revenueByMonth = aggregateByMonth(revenues.map(r => ({
            date: r.date,
            value: r.amount,
            category: 'revenue'
          })));
          data = [...data, ...revenueByMonth];
        }
      }

      if (forecastType === 'expenditure' || forecastType === 'netProfit') {
        const expenditureResponse = await expenditureApi.getAll();
        if (expenditureResponse.success && expenditureResponse.data) {
          const expenditures = selectedPond === 'all' 
            ? expenditureResponse.data 
            : expenditureResponse.data.filter(e => e.pond?.id === selectedPond);
          
          const expenseByMonth = aggregateByMonth(expenditures.map(e => ({
            date: e.date,
            value: forecastType === 'netProfit' ? -e.amount : e.amount,
            category: 'expenditure'
          })));
          data = [...data, ...expenseByMonth];
        }
      }

      if (forecastType === 'netProfit') {
        data = aggregateNetProfit(data);
      }

      setHistoricalData(data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

      // Reset generated outputs whenever source history changes.
      setForecastData([]);
      setForecastMetrics(null);
      setSeasonalPatterns([]);
      setTrendAnalysis('');
    } catch (error) {
      console.error('Error loading historical data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [forecastType, selectedPond]);

  useEffect(() => {
    loadPonds();
  }, [loadPonds]);

  useEffect(() => {
    loadHistoricalData();
  }, [loadHistoricalData]);

  const aggregateByMonth = (data: HistoricalDataPoint[]): HistoricalDataPoint[] => {
    const monthlyData: Record<string, number> = {};
    
    data.forEach(item => {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + item.value;
    });

    return Object.entries(monthlyData).map(([date, value]) => ({
      date,
      value,
      category: data[0]?.category
    }));
  };

  const aggregateNetProfit = (data: HistoricalDataPoint[]): HistoricalDataPoint[] => {
    const monthlyProfit: Record<string, number> = {};
    
    data.forEach(item => {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      monthlyProfit[monthKey] = (monthlyProfit[monthKey] || 0) + item.value;
    });

    return Object.entries(monthlyProfit).map(([date, value]) => ({
      date,
      value,
      category: 'netProfit'
    }));
  };

  const generateForecast = () => {
    if (historicalData.length < 3) {
      alert('Not enough historical data to generate forecast. Need at least 3 months of data.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const forecast = generateARIMAForecast();

      setForecastData(forecast);
      calculateMetrics();
      analyzeSeasonalPatterns();
      generateTrendAnalysis();
      setIsLoading(false);
    }, 1000);
  };

  const generateARIMAForecast = (): ForecastData[] => {
    const values = historicalData.map(d => d.value);
    const lastDate = new Date(historicalData[historicalData.length - 1].date);
    
    // Calculate trend
    const trend = calculateTrend(values);
    
    // Calculate seasonal component (12-month cycle)
    const seasonalComponent = calculateSeasonalComponent(values);
    
    // Calculate moving average for smoothing
    const ma = calculateMovingAverage(values, 3);
    const lastMA = ma[ma.length - 1];
    
    // Generate forecast
    const forecast: ForecastData[] = [];
    const stdDev = calculateStdDev(values);
    const confidenceMultiplier = confidenceLevel === 95 ? 1.96 : confidenceLevel === 90 ? 1.645 : 1.282;

    for (let i = 1; i <= forecastPeriod; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      
      // ARIMA-like calculation: trend + seasonal + autoregressive component
      const seasonal = seasonalComponent[(historicalData.length + i - 1) % 12];
      const ar = lastMA + trend * i;
      const forecastValue = ar + seasonal;
      
      // Ensure non-negative values
      const adjustedForecast = Math.max(0, forecastValue);
      const errorMargin = stdDev * confidenceMultiplier * Math.sqrt(i);
      
      forecast.push({
        date: forecastDate.toISOString().split('T')[0],
        forecast: adjustedForecast,
        lowerBound: Math.max(0, adjustedForecast - errorMargin),
        upperBound: adjustedForecast + errorMargin,
        confidence: confidenceLevel
      });
    }

    return forecast;
  };

  const calculateTrend = (values: number[]): number => {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * values[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  };

  const calculateSeasonalComponent = (values: number[]): number[] => {
    const seasonal = new Array(12).fill(0);
    const counts = new Array(12).fill(0);
    
    values.forEach((value, index) => {
      const month = index % 12;
      seasonal[month] += value;
      counts[month]++;
    });
    
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    return seasonal.map((sum, i) => (counts[i] > 0 ? sum / counts[i] - avgValue : 0));
  };

  const calculateMovingAverage = (values: number[], window: number): number[] => {
    const ma: number[] = [];
    for (let i = window - 1; i < values.length; i++) {
      const sum = values.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      ma.push(sum / window);
    }
    return ma;
  };

  const calculateStdDev = (values: number[]): number => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  };

  const calculateMetrics = () => {
    if (historicalData.length < 12) {
      setForecastMetrics(null);
      return;
    }

    const testSize = Math.min(6, Math.floor(historicalData.length * 0.2));
    if (testSize < 1) {
      setForecastMetrics(null);
      return;
    }

    const trainData = historicalData.slice(0, -testSize);
    const testData = historicalData.slice(-testSize);

    let sumAbsError = 0;
    let sumSquaredError = 0;
    let sumPercentError = 0;
    let ssTotal = 0;
    let ssResidual = 0;

    const trainMean = trainData.reduce((sum, d) => sum + d.value, 0) / trainData.length;

    let nonZeroActualCount = 0;

    testData.forEach((actual) => {
      const predicted = trainData[trainData.length - 1].value; // Simple prediction
      const error = actual.value - predicted;
      
      sumAbsError += Math.abs(error);
      sumSquaredError += error * error;

      if (actual.value !== 0) {
        sumPercentError += Math.abs(error / actual.value) * 100;
        nonZeroActualCount++;
      }
      
      ssTotal += Math.pow(actual.value - trainMean, 2);
      ssResidual += Math.pow(error, 2);
    });

    setForecastMetrics({
      mae: sumAbsError / testSize,
      rmse: Math.sqrt(sumSquaredError / testSize),
      mape: nonZeroActualCount > 0 ? sumPercentError / nonZeroActualCount : 0,
      r2: ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0
    });
  };

  const analyzeSeasonalPatterns = () => {
    if (historicalData.length < 12) {
      setSeasonalPatterns([]);
      return;
    }

    const monthlyData: Record<string, number[]> = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    historicalData.forEach(item => {
      const month = new Date(item.date).getMonth();
      const monthName = monthNames[month];
      if (!monthlyData[monthName]) {
        monthlyData[monthName] = [];
      }
      monthlyData[monthName].push(item.value);
    });

    const patterns: SeasonalPattern[] = Object.entries(monthlyData).map(([month, values]) => {
      const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((acc, val) => acc + Math.pow(val - avgValue, 2), 0) / values.length;
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (values.length > 1) {
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        if (secondAvg > firstAvg * 1.1) trend = 'increasing';
        else if (secondAvg < firstAvg * 0.9) trend = 'decreasing';
      }

      return { month, avgValue, variance, trend };
    });

    setSeasonalPatterns(patterns);
  };

  const generateTrendAnalysis = () => {
    if (historicalData.length < 3) {
      setTrendAnalysis('Insufficient data for trend analysis');
      return;
    }

    const values = historicalData.map(d => d.value);
    const trend = calculateTrend(values);
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    const recentAvg = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const oldAvg = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const growthRate = oldAvg !== 0 ? ((recentAvg - oldAvg) / oldAvg) * 100 : 0;

    let analysis = '';
    if (trend > avgValue * 0.05) {
      analysis = `Strong upward trend detected. ${forecastType === 'expenditure' ? 'Costs' : 'Revenue'} growing at ${growthRate.toFixed(1)}% over the period. `;
      analysis += forecastType === 'expenditure' 
        ? 'Consider cost optimization strategies.' 
        : 'Positive growth trajectory. Consider expansion opportunities.';
    } else if (trend < -avgValue * 0.05) {
      analysis = `Downward trend observed. ${forecastType === 'expenditure' ? 'Costs' : 'Revenue'} declining at ${Math.abs(growthRate).toFixed(1)}% over the period. `;
      analysis += forecastType === 'revenue' 
        ? 'Review pricing and sales strategies.' 
        : 'Cost reduction measures showing positive results.';
    } else {
      analysis = `Stable trend with ${growthRate > 0 ? 'slight growth' : 'slight decline'} of ${Math.abs(growthRate).toFixed(1)}%. `;
      analysis += 'Operations are relatively consistent. Monitor for changes.';
    }

    setTrendAnalysis(analysis);
  };

  const formatCurrency = (value: number): string => {
    return lkrFormatter.format(value);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const getChartHeight = (value: number, maxValue: number): number => {
    if (maxValue <= 0) {
      return 5;
    }
    return Math.max(5, (value / maxValue) * 100);
  };

  const maxHistoricalValue = Math.max(
    1,
    ...historicalData.map(d => d.value),
    ...forecastData.map(d => d.upperBound)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">📊 Budget Forecasting</h1>
            <p className="text-purple-100">AI-powered predictive analytics for financial planning</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-4xl font-bold">{forecastPeriod}</div>
            <div className="text-sm">Months Ahead</div>
          </div>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-sliders-h text-purple-600"></i>
          Forecast Configuration
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Forecast Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Forecast Type</label>
            <select
              value={forecastType}
              onChange={(e) => setForecastType(e.target.value as 'revenue' | 'expenditure' | 'netProfit')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="revenue">💰 Revenue</option>
              <option value="expenditure">💸 Expenditure</option>
              <option value="netProfit">📈 Net Profit</option>
            </select>
          </div>

          {/* Pond Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pond</label>
            <select
              value={selectedPond}
              onChange={(e) => setSelectedPond(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Ponds</option>
              {ponds.map(pond => (
                <option key={pond.id} value={pond.id}>{pond.name}</option>
              ))}
            </select>
          </div>

          {/* Forecast Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Forecast Period</label>
            <select
              value={forecastPeriod}
              onChange={(e) => setForecastPeriod(parseInt(e.target.value, 10) as 3 | 6 | 12)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="3">3 Months</option>
              <option value="6">6 Months</option>
              <option value="12">12 Months</option>
            </select>
          </div>

          {/* Confidence Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confidence Level</label>
            <select
              value={confidenceLevel}
              onChange={(e) => setConfidenceLevel(parseInt(e.target.value, 10) as 80 | 90 | 95)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="80">80%</option>
              <option value="90">90%</option>
              <option value="95">95%</option>
            </select>
          </div>
        </div>

        <button
          onClick={generateForecast}
          disabled={isLoading || historicalData.length < 3}
          className="mt-4 w-full md:w-auto px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          {isLoading ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Generating Forecast...
            </>
          ) : (
            <>
              <i className="fas fa-chart-line mr-2"></i>
              Generate Forecast
            </>
          )}
        </button>
      </div>

      {/* Data Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Data Points</p>
              <p className="text-2xl font-bold text-gray-800">{historicalData.length}</p>
            </div>
            <div className="bg-blue-100 rounded-lg p-3">
              <i className="fas fa-database text-2xl text-blue-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Average Value</p>
              <p className="text-2xl font-bold text-gray-800">
                {historicalData.length > 0 
                  ? formatCurrency(historicalData.reduce((a, b) => a + b.value, 0) / historicalData.length)
                  : formatCurrency(0)}
              </p>
            </div>
            <div className="bg-green-100 rounded-lg p-3">
              <i className="fas fa-chart-bar text-2xl text-green-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Trend</p>
              <p className="text-2xl font-bold text-gray-800">
                {historicalData.length > 2 
                  ? calculateTrend(historicalData.map(d => d.value)) > 0 
                    ? '📈 Up' 
                    : '📉 Down'
                  : '--'}
              </p>
            </div>
            <div className="bg-purple-100 rounded-lg p-3">
              <i className="fas fa-chart-line text-2xl text-purple-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Model</p>
              <p className="text-xl font-bold text-gray-800 uppercase">ARIMA</p>
            </div>
            <div className="bg-indigo-100 rounded-lg p-3">
              <i className="fas fa-brain text-2xl text-indigo-600"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Analysis */}
      {trendAnalysis && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-6 border border-blue-200">
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <i className="fas fa-lightbulb text-yellow-500"></i>
            Trend Analysis & Insights
          </h3>
          <p className="text-gray-700 leading-relaxed">{trendAnalysis}</p>
        </div>
      )}

      {/* Forecast Visualization */}
      {forecastData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <i className="fas fa-chart-area text-purple-600"></i>
            Forecast Visualization
          </h2>

          <div className="overflow-x-auto">
            <div className="min-w-full inline-flex gap-2 items-end pb-8" style={{ minHeight: '400px' }}>
              {/* Historical Data */}
              {historicalData.map((item, index) => (
                <div key={`hist-${index}`} className="flex-1 flex flex-col items-center justify-end min-w-[40px]">
                  <div className="text-xs font-semibold text-gray-700 mb-2 h-8">
                    {formatCurrency(item.value)}
                  </div>
                  <div
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg relative group cursor-pointer transition-all duration-200 hover:from-blue-700 hover:to-blue-500"
                    style={{ height: `${getChartHeight(item.value, maxHistoricalValue)}%` }}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Actual: {formatCurrency(item.value)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mt-2 whitespace-nowrap transform rotate-45 origin-top-left">
                    {formatDate(item.date)}
                  </div>
                </div>
              ))}

              {/* Forecast Data with Confidence Intervals */}
              {forecastData.map((item, index) => (
                <div key={`forecast-${index}`} className="flex-1 flex flex-col items-center justify-end min-w-[40px] relative">
                  <div className="text-xs font-semibold text-purple-700 mb-2 h-8">
                    {formatCurrency(item.forecast)}
                  </div>
                  
                  {/* Confidence Interval */}
                  <div
                    className="w-full bg-purple-100 rounded-lg absolute bottom-0 opacity-30"
                    style={{ 
                      height: `${getChartHeight(item.upperBound, maxHistoricalValue)}%`
                    }}
                  ></div>
                  
                  {/* Forecast Bar */}
                  <div
                    className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-lg relative group cursor-pointer transition-all duration-200 hover:from-purple-700 hover:to-purple-500 border-2 border-dashed border-purple-300"
                    style={{ height: `${getChartHeight(item.forecast, maxHistoricalValue)}%` }}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Forecast: {formatCurrency(item.forecast)}<br/>
                      Range: {formatCurrency(item.lowerBound)} - {formatCurrency(item.upperBound)}<br/>
                      Confidence: {item.confidence}%
                    </div>
                  </div>
                  <div className="text-xs text-purple-600 mt-2 whitespace-nowrap transform rotate-45 origin-top-left font-medium">
                    {formatDate(item.date)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-t from-blue-600 to-blue-400 rounded"></div>
              <span className="text-gray-600">Historical Data</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-t from-purple-600 to-purple-400 rounded border-2 border-dashed border-purple-300"></div>
              <span className="text-gray-600">Forecast</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-100 rounded"></div>
              <span className="text-gray-600">Confidence Interval ({confidenceLevel}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Forecast Table */}
      {forecastData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-table text-purple-600"></i>
              Detailed Forecast Data
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Forecast</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lower Bound</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Upper Bound</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {forecastData.map((item, index) => (
                  <tr key={index} className="hover:bg-purple-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-700">
                      {formatCurrency(item.forecast)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatCurrency(item.lowerBound)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatCurrency(item.upperBound)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {item.confidence}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Model Performance Metrics */}
      {forecastMetrics && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-chart-pie text-purple-600"></i>
            Model Performance Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-blue-600 font-medium mb-1">MAE</p>
              <p className="text-2xl font-bold text-blue-800">{formatCurrency(forecastMetrics.mae)}</p>
              <p className="text-xs text-blue-600 mt-1">Mean Absolute Error</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <p className="text-sm text-green-600 font-medium mb-1">RMSE</p>
              <p className="text-2xl font-bold text-green-800">{formatCurrency(forecastMetrics.rmse)}</p>
              <p className="text-xs text-green-600 mt-1">Root Mean Square Error</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <p className="text-sm text-purple-600 font-medium mb-1">MAPE</p>
              <p className="text-2xl font-bold text-purple-800">{forecastMetrics.mape.toFixed(2)}%</p>
              <p className="text-xs text-purple-600 mt-1">Mean Absolute % Error</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
              <p className="text-sm text-orange-600 font-medium mb-1">R²</p>
              <p className="text-2xl font-bold text-orange-800">{forecastMetrics.r2.toFixed(4)}</p>
              <p className="text-xs text-orange-600 mt-1">Coefficient of Determination</p>
            </div>
          </div>
        </div>
      )}

      {/* Seasonal Patterns */}
      {seasonalPatterns.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-calendar-alt text-purple-600"></i>
            Seasonal Patterns Analysis
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {seasonalPatterns.map((pattern) => (
              <div key={pattern.month} className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">{pattern.month}</p>
                  <span className={`text-lg ${
                    pattern.trend === 'increasing' ? 'text-green-600' :
                    pattern.trend === 'decreasing' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {pattern.trend === 'increasing' ? '↗' : pattern.trend === 'decreasing' ? '↘' : '→'}
                  </span>
                </div>
                <p className="text-lg font-bold text-indigo-800">{formatCurrency(pattern.avgValue)}</p>
                <p className="text-xs text-gray-500 mt-1">Avg Value</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Panel */}
      {historicalData.length < 3 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <i className="fas fa-info-circle text-2xl text-yellow-600 mt-1"></i>
            <div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Insufficient Data</h3>
              <p className="text-yellow-700">
                You need at least 3 months of historical data to generate accurate forecasts. 
                Current data points: <strong>{historicalData.length}</strong>
              </p>
              <p className="text-yellow-600 mt-2 text-sm">
                Add more expenditures or revenues to enable forecasting capabilities.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetForecasting;
