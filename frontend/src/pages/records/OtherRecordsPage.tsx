import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Building2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PoliceStation {
  id: string;
  name: string;
  suspects: Suspect[];
}

interface Suspect {
  id: string;
  name: string;
  crimeDetails: string;
  type: 'suspect' | 'surveillance';
}

const OtherRecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const [stationSearchTerm, setStationSearchTerm] = useState('');
  const [suspectSearchTerm, setSuspectSearchTerm] = useState('');
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  const stations: PoliceStation[] = [
    {
      id: '1',
      name: 'Kharghar Police Station',
      suspects: [
        { id: '1', name: 'Alex Brown', crimeDetails: 'Burglary', type: 'suspect' },
        { id: '2', name: 'Emma Davis', crimeDetails: 'Vandalism', type: 'surveillance' },
      ]
    },
    {
      id: '2',
      name: 'Panvel Police Station',
      suspects: [
        { id: '3', name: 'Chris Wilson', crimeDetails: 'Assault', type: 'suspect' },
        { id: '4', name: 'Diana Miller', crimeDetails: 'Theft', type: 'surveillance' },
      ]
    },
    {
      id: '3',
      name: 'Raigad Police Station',
      suspects: [
        { id: '5', name: 'Michael Scott', crimeDetails: 'Fraud', type: 'suspect' },
        { id: '6', name: 'Pam Beesly', crimeDetails: 'Cybercrime', type: 'surveillance' },
      ]
    },
    {
      id: '4',
      name: 'Varanasi Police Station',
      suspects: [
        { id: '7', name: 'Jim Halpert', crimeDetails: 'Identity Theft', type: 'suspect' },
        { id: '8', name: 'Dwight Schrute', crimeDetails: 'Conspiracy', type: 'surveillance' },
      ]
    }
  ];

  const filteredStations = stations.filter(station =>
    station.name.toLowerCase().includes(stationSearchTerm.toLowerCase())
  );

  const selectedStationData = stations.find(station => station.id === selectedStation);

  const filteredSuspects = selectedStationData?.suspects.filter(suspect =>
    suspect.name.toLowerCase().includes(suspectSearchTerm.toLowerCase()) ||
    suspect.crimeDetails.toLowerCase().includes(suspectSearchTerm.toLowerCase())
  );

  const SuspectCard: React.FC<{ suspect: Suspect }> = ({ suspect }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gray-800 rounded-xl p-6 space-y-4"
    >
      <div>
        <h3 className="text-xl font-semibold text-white">{suspect.name}</h3>
        <p className="text-gray-400">{suspect.crimeDetails}</p>
        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm
          ${suspect.type === 'suspect' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
          {suspect.type === 'suspect' ? 'Suspect' : 'Under Surveillance'}
        </span>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-12">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/records')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Records</span>
          </motion.button>
        </div>

        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Other Records</h1>
          <p className="text-gray-400">View records from other police stations</p>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search police stations..."
            value={stationSearchTerm}
            onChange={(e) => setStationSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-800 rounded-xl text-white placeholder-gray-400
              border-2 border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <AnimatePresence>
            {filteredStations.map(station => (
              <motion.div
                key={station.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedStation(station.id)}
                className={`cursor-pointer p-6 rounded-xl transition-colors
                  ${selectedStation === station.id ? 
                    'bg-blue-600 shadow-lg shadow-blue-500/20' : 
                    'bg-gray-800 hover:bg-gray-700'}`}
              >
                <Building2 className="w-8 h-8 mb-4" />
                <h3 className="text-xl font-semibold">{station.name}</h3>
                <p className="text-gray-400 mt-2">
                  {station.suspects.length} Records
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {selectedStationData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-semibold">{selectedStationData.name} Records</h2>
            
            <div className="relative mb-8">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search suspects by name or crime details..."
                value={suspectSearchTerm}
                onChange={(e) => setSuspectSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-800 rounded-xl text-white placeholder-gray-400
                  border-2 border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-400">Suspects</h3>
                <AnimatePresence>
                  {filteredSuspects
                    ?.filter(s => s.type === 'suspect')
                    .map(suspect => (
                      <SuspectCard key={suspect.id} suspect={suspect} />
                    ))}
                </AnimatePresence>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-400">Under Surveillance</h3>
                <AnimatePresence>
                  {filteredSuspects
                    ?.filter(s => s.type === 'surveillance')
                    .map(suspect => (
                      <SuspectCard key={suspect.id} suspect={suspect} />
                    ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default OtherRecordsPage;