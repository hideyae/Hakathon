import { useState, useEffect } from 'react';
import {
  Waves,
  Calendar,
  Search,
  TrendingUp,
  MessageSquare,
  Send,
  Download,
  RefreshCw,
  Activity,
  Anchor,
  LogIn,
  LogOut,
  Cloud,
  Leaf
} from 'lucide-react';
import { ActivityType, OceanVariable, ActivityCondition, ChatMessage, LocationCoordinates } from './types';
import { ActivityCard } from './components/ActivityCard';
import { OceanVariableCard } from './components/OceanVariableCard';
import { ChatMessage as ChatMessageComponent } from './components/ChatMessage';
import { AuthModal } from './components/AuthModal';
import { LocationSearch } from './components/LocationSearch';
import { ActivityHistory } from './components/ActivityHistory';
import { MapView } from './components/MapView';
import { ConservationAlerts } from './components/ConservationAlerts';
import { ClimateProtection } from './components/ClimateProtection';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { generateOceanData, calculateActivityConditions } from './utils/oceanData';
import { exportToCSV } from './utils/export';
import { supabase } from './lib/supabase';
import { fetchNasaWeatherStats } from './services/nasaService';
import { calculateProbabilities } from './utils/probability';
import ProbabilityChart from './components/ProbabilityChart';

function AppContent() {
  const { user, signOut } = useAuth();
  const [view, setView] = useState<'planner' | 'dashboard' | 'history' | 'climate'>('planner');
  const [selectedActivity, setSelectedActivity] = useState<ActivityType>('surfing');
  const [location, setLocation] = useState('Santa Monica, CA');
  const [locationCoords, setLocationCoords] = useState<LocationCoordinates | undefined>();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActivityCondition | null>(null);
  const [oceanData, setOceanData] = useState<OceanVariable[]>([]);
  const [selectedVariable, setSelectedVariable] = useState<OceanVariable | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your Ocean Safety AI Assistant. Ask me anything about ocean conditions, safety tips, or activity recommendations.',
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [probabilities, setProbabilities] = useState<{ hot: number; cold: number } | null>(null);

  useEffect(() => {
    loadOceanData();
    const interval = setInterval(() => {
      loadOceanData();
    }, 30000);
    return () => clearInterval(interval);
  }, [locationCoords]);

  const loadOceanData = async () => {
    const data = await generateOceanData(locationCoords);
    setOceanData(data);
  };

  const activities: ActivityType[] = ['surfing', 'fishing', 'diving', 'sailing', 'kayaking', 'swimming'];

  const handleCheckConditions = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const conditions = await calculateActivityConditions(selectedActivity, location, date, locationCoords);
    setResult(conditions);

    if (user) {
      await saveActivityHistory(conditions);
    }

    setLoading(false);
  };

  const saveActivityHistory = async (conditions: ActivityCondition) => {
    if (!user) return;

    const { error } = await supabase
      .from('activity_history')
      .insert([{
        user_id: user.id,
        activity_type: conditions.activity,
        location: conditions.location,
        latitude: conditions.latitude,
        longitude: conditions.longitude,
        date: conditions.date,
        score: conditions.score,
        overall_status: conditions.overall,
        conditions_data: {
          variables: conditions.variables,
          weather: conditions.weather,
          tide: conditions.tide
        }
      }]);

    if (error) {
      console.error('Error saving activity history:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            message: chatInput,
            context: {
              activity: selectedActivity,
              location: location,
              oceanData: result?.variables
            }
          })
        }
      );

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response || 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling AI assistant:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error connecting to the AI service. Please try again.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleRefresh = async () => {
    await loadOceanData();
  };

  const handleLocationChange = (newLocation: string, coords?: LocationCoordinates) => {
    setLocation(newLocation);
    setLocationCoords(coords);
  };

  const handleFetchProbabilities = async () => {
    if (!locationCoords) return;
    const start = '20240101'; // Example: Jan 1, 2024
    const end = '20241231';   // Example: Dec 31, 2024
    const nasaData = await fetchNasaWeatherStats(locationCoords.latitude, locationCoords.longitude, start, end);
    setProbabilities(calculateProbabilities(nasaData));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50">
      <header className="bg-gradient-to-r from-cyan-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/Logo_Ocean_safe copy.png"
                alt="OceanSafe Logo"
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-3xl font-bold">OceanSafe</h1>
                <p className="text-cyan-100 text-sm">Real-time Ocean Safety & Activity Planner</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setView('planner')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${view === 'planner'
                    ? 'bg-white text-cyan-700 shadow-lg'
                    : 'bg-white/20 hover:bg-white/30 backdrop-blur-sm'
                    }`}
                >
                  Planner
                </button>
                <button
                  onClick={() => setView('dashboard')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${view === 'dashboard'
                    ? 'bg-white text-cyan-700 shadow-lg'
                    : 'bg-white/20 hover:bg-white/30 backdrop-blur-sm'
                    }`}
                >
                  Dashboard
                </button>
                {user && (
                  <button
                    onClick={() => setView('history')}
                    className={`px-6 py-2 rounded-lg font-medium transition-all ${view === 'history'
                      ? 'bg-white text-cyan-700 shadow-lg'
                      : 'bg-white/20 hover:bg-white/30 backdrop-blur-sm'
                      }`}
                  >
                    History
                  </button>
                )}
                <button
                  onClick={() => setView('climate')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${view === 'climate'
                    ? 'bg-white text-cyan-700 shadow-lg'
                    : 'bg-white/20 hover:bg-white/30 backdrop-blur-sm'
                    }`}
                >
                  <Leaf className="w-4 h-4 inline mr-1" />
                  Climate
                </button>
              </div>

              {user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{user.full_name || user.email}</p>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-6 py-2 bg-white text-cyan-700 rounded-lg font-semibold hover:bg-cyan-50 transition-all shadow-lg"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'planner' ? (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Activity className="w-6 h-6 text-cyan-600" />
                Plan Your Ocean Activity
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Select Activity
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {activities.map(activity => (
                      <ActivityCard
                        key={activity}
                        activity={activity}
                        selected={selectedActivity === activity}
                        onClick={() => setSelectedActivity(activity)}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <LocationSearch
                    value={location}
                    onChange={handleLocationChange}
                  />

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition-all"
                    />
                  </div>
                </div>

                <MapView
                  latitude={locationCoords?.latitude}
                  longitude={locationCoords?.longitude}
                  location={location}
                />

                <button
                  onClick={handleCheckConditions}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-700 text-white py-4 rounded-lg font-semibold hover:from-cyan-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Analyzing Conditions...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Check Conditions
                    </>
                  )}
                </button>
              </div>
            </div>

            {result && (
              <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-100 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-cyan-600" />
                    Conditions Report
                  </h2>
                  <button
                    onClick={() => exportToCSV(result)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-lg hover:from-teal-600 hover:to-emerald-700 transition-all shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>

                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-cyan-100 text-sm">Overall Safety Score</p>
                      <h3 className="text-4xl font-bold">{result.score}%</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-cyan-100 mb-1">{result.location}</p>
                      <p className="text-xs text-cyan-200">{result.date}</p>
                    </div>
                  </div>
                  <p className="text-lg font-semibold">{result.overall}</p>
                  <p className="text-cyan-100 text-sm mt-2">{result.details}</p>
                </div>

                {result.weather && (
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-6">
                    <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                      <Cloud className="w-5 h-5" />
                      Current Weather
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-blue-700">Temperature</p>
                        <p className="text-lg font-bold text-blue-900">{result.weather.temp.toFixed(1)}°C</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700">Wind Speed</p>
                        <p className="text-lg font-bold text-blue-900">{result.weather.windSpeed.toFixed(1)} km/h</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700">Humidity</p>
                        <p className="text-lg font-bold text-blue-900">{result.weather.humidity}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700">Conditions</p>
                        <p className="text-lg font-bold text-blue-900 capitalize">{result.weather.description}</p>
                      </div>
                    </div>
                  </div>
                )}

                {result.tide && (
                  <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-teal-200 rounded-xl p-6">
                    <h3 className="font-bold text-teal-900 mb-3 flex items-center gap-2">
                      <Waves className="w-5 h-5" />
                      Tide Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-teal-700">Current Tide</p>
                        <p className="text-lg font-bold text-teal-900 capitalize">{result.tide.type} - {result.tide.height}m</p>
                        <p className="text-xs text-teal-600">{result.tide.time}</p>
                      </div>
                      <div>
                        <p className="text-xs text-teal-700">Next Tide</p>
                        <p className="text-lg font-bold text-teal-900 capitalize">{result.tide.next.type} - {result.tide.next.height}m</p>
                        <p className="text-xs text-teal-600">{result.tide.next.time}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-bold text-gray-800 mb-4">Ocean Variables</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {result.variables.map(variable => (
                      <OceanVariableCard
                        key={variable.id}
                        variable={variable}
                        onClick={() => setSelectedVariable(variable)}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6">
                  <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                    <Anchor className="w-5 h-5" />
                    Safety Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {result.safety.map((tip, idx) => (
                      <li key={idx} className="text-sm text-amber-800 flex items-start gap-2">
                        <span className="text-amber-600 font-bold">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : view === 'dashboard' ? (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Waves className="w-6 h-6 text-cyan-600" />
                  Live Ocean Data
                </h2>
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Data
                </button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {oceanData.map(variable => (
                  <OceanVariableCard
                    key={variable.id}
                    variable={variable}
                    onClick={() => setSelectedVariable(variable)}
                  />
                ))}
              </div>

              {selectedVariable && (
                <div className="mt-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-2">{selectedVariable.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{selectedVariable.recommendation}</p>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-gray-900">
                      {selectedVariable.value} {selectedVariable.unit}
                    </span>
                    <span className={`
                      px-3 py-1 rounded-full text-xs font-semibold
                      ${selectedVariable.status === 'safe' ? 'bg-emerald-100 text-emerald-700' : ''}
                      ${selectedVariable.status === 'moderate' ? 'bg-amber-100 text-amber-700' : ''}
                      ${selectedVariable.status === 'warning' ? 'bg-orange-100 text-orange-700' : ''}
                    `}>
                      {selectedVariable.statusText}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-cyan-600" />
                AI Safety Assistant
              </h2>

              <div className="space-y-4 mb-6 h-80 overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200">
                {chatMessages.map((msg, idx) => (
                  <ChatMessageComponent key={idx} message={msg} />
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask about ocean conditions, safety tips..."
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition-all"
                />
                <button
                  onClick={handleSendMessage}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-700 text-white rounded-lg hover:from-cyan-700 hover:to-blue-800 transition-all shadow-md flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {probabilities && (
              <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Weather Probabilities (NASA Data)</h2>
                <ProbabilityChart probabilities={probabilities} />
              </div>
            )}
          </div>
        ) : view === 'history' ? (
          <ActivityHistory />
        ) : (
          <ClimateProtection />
        )}
      </main>

      <footer className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-300 mb-2">
            Built for NASA Space Apps Challenge 2025
          </p>
          <p className="text-xs text-gray-400">
            Ocean data powered by real-time monitoring systems | Stay safe, explore responsibly
          </p>
        </div>
      </footer>

      <ConservationAlerts />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
