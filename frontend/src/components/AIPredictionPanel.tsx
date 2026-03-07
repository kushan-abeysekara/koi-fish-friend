import React, { useState, useEffect, useCallback } from 'react';
import { aiApi, type AIPrediction } from '../services/api';

const AIPredictionPanel: React.FC = () => {
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchPrediction = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await aiApi.getPrediction();
      setPrediction(data);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AI prediction');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrediction();
    const interval = setInterval(fetchPrediction, 5 * 60 * 1000); // Refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchPrediction]);

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    try {
      setAsking(true);
      const res = await aiApi.askQuestion(question.trim());
      setAiAnswer(res.answer);
    } catch (err: any) {
      setAiAnswer('Error: ' + (err.message || 'Failed to get answer'));
    } finally {
      setAsking(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 border-green-200';
    if (score >= 60) return 'bg-yellow-100 border-yellow-200';
    if (score >= 40) return 'bg-orange-100 border-orange-200';
    return 'bg-red-100 border-red-200';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Critical';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <i className="fas fa-brain"></i>
              AI Predictions & Insights
            </h2>
            <p className="text-purple-100 mt-1">
              Smart farm analysis powered by {prediction?.source === 'flowise' ? 'Flowise AI' : 'Rule Engine'}
            </p>
          </div>
          <button
            onClick={fetchPrediction}
            disabled={loading}
            className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition flex items-center gap-2"
          >
            <i className={`fas fa-sync-alt ${loading ? 'animate-spin' : ''}`}></i>
            Refresh
          </button>
        </div>
        {lastRefresh && (
          <p className="text-xs text-purple-200 mt-2">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <i className="fas fa-exclamation-triangle mr-2"></i>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && !prediction && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
          <p className="text-gray-500">Analyzing farm data...</p>
        </div>
      )}

      {/* Prediction Results */}
      {prediction && (
        <>
          {/* Health Score & Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Health Score */}
            <div className={`rounded-xl p-5 border ${getHealthBg(prediction.healthScore)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Farm Health</span>
                <i className={`fas fa-heartbeat text-xl ${getHealthColor(prediction.healthScore)}`}></i>
              </div>
              <div className={`text-4xl font-bold ${getHealthColor(prediction.healthScore)}`}>
                {prediction.healthScore}
              </div>
              <p className={`text-sm font-medium mt-1 ${getHealthColor(prediction.healthScore)}`}>
                {getHealthLabel(prediction.healthScore)}
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    prediction.healthScore >= 80 ? 'bg-green-500' :
                    prediction.healthScore >= 60 ? 'bg-yellow-500' :
                    prediction.healthScore >= 40 ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${prediction.healthScore}%` }}
                ></div>
              </div>
            </div>

            {/* Next Feeding */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Next Feeding</span>
                <i className="fas fa-clock text-xl text-blue-500"></i>
              </div>
              <p className="text-lg font-bold text-gray-800">{prediction.nextFeedingTime}</p>
            </div>

            {/* Recommended Amount */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Feed Amount</span>
                <i className="fas fa-weight text-xl text-cyan-500"></i>
              </div>
              <p className="text-3xl font-bold text-gray-800">
                {prediction.recommendedAmount}<span className="text-lg text-gray-500 ml-1">g</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">Recommended per feeding</p>
            </div>

            {/* Tank Estimate */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Tank Empty In</span>
                <i className="fas fa-battery-half text-xl text-orange-500"></i>
              </div>
              <p className="text-lg font-bold text-gray-800">{prediction.tankEmptyEstimate}</p>
            </div>
          </div>

          {/* Abnormal Behavior Alert */}
          {prediction.abnormalBehavior && prediction.abnormalBehavior !== 'None detected' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <i className="fas fa-exclamation-triangle text-amber-500 text-xl mt-0.5"></i>
                <div>
                  <h4 className="font-bold text-amber-800">Anomaly Detected</h4>
                  <p className="text-amber-700 mt-1">{prediction.abnormalBehavior}</p>
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {prediction.recommendations && prediction.recommendations.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <i className="fas fa-lightbulb text-yellow-500"></i>
                AI Recommendations
              </h3>
              <div className="space-y-3">
                {prediction.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-purple-600">{idx + 1}</span>
                    </div>
                    <p className="text-gray-700">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Insight (if Flowise returned free text) */}
          {prediction.aiInsight && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-robot text-purple-500"></i>
                AI Analysis
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap text-sm">
                {prediction.aiInsight}
              </div>
            </div>
          )}
        </>
      )}

      {/* Ask AI Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-comments text-indigo-500"></i>
          Ask the AI Assistant
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
            placeholder="e.g., What's the optimal feeding schedule for 28°C weather?"
            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 outline-none transition"
          />
          <button
            onClick={handleAskQuestion}
            disabled={asking || !question.trim()}
            className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {asking ? (
              <><i className="fas fa-spinner animate-spin"></i> Thinking...</>
            ) : (
              <><i className="fas fa-paper-plane"></i> Ask</>
            )}
          </button>
        </div>
        {aiAnswer && (
          <div className="mt-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-100">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="fas fa-robot text-white text-sm"></i>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-700 mb-1">AI Response</p>
                <p className="text-gray-700 whitespace-pre-wrap">{aiAnswer}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Source Badge */}
      {prediction && (
        <div className="text-center text-xs text-gray-400">
          Predictions powered by {prediction.source === 'flowise' ? 'Flowise AI' : 'Built-in Rule Engine'}
          {prediction.source === 'rule-engine' && (
            <span className="block mt-1">
              Configure <code className="bg-gray-100 px-1 rounded">flowise.chatflow.id</code> in application.properties for AI-powered predictions
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default AIPredictionPanel;
